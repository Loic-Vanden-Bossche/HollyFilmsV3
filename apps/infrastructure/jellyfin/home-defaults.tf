locals {
  home_defaults_enabled = try(trimspace(var.home_defaults_api_key), "") != ""

  home_defaults_script = <<-EOT
    #!/usr/bin/env sh
    set -eu

    jellyfin_url="http://127.0.0.1:8096"
    auth_header="Authorization: MediaBrowser Client=\"CHBRX Home Defaults\", Device=\"Kubernetes\", DeviceId=\"chbrx-home-defaults\", Version=\"1.0\", Token=\"$${JELLYFIN_API_KEY}\""
    file_transformation_plugin_id="5e87cc92-571a-4d8d-8d98-d2d4147f9f90"
    home_fallback_transformation_id="a92ff08b-bfc5-43ec-a733-3186155467f3"
    backdrop_fallback_transformation_id="11ebd444-a338-4f87-81a0-ff727c19e747"
    marker_key="chbrx-home-defaults-applied"
    processed_users_file="/tmp/home-defaults-processed-users"
    ready_file="/tmp/home-defaults-ready"
    blank_signature='[null,null,null,null,null,null,null,null,null,null]'
    legacy_default_signature='["smalllibrarytiles","resume","resumeaudio","resumebook","livetv","nextup","latestmedia","none",null,null]'
    default_signature='["smalllibrarytiles","resume","resumeaudio","resumebook","livetv","nextup","latestmedia","none","none","none"]'
    if [ "${local.jellyfin_12}" = true ]; then
      home_fallback_search='var a=[n.SmallLibraryTiles,n.Resume,n.ResumeAudio,n.ResumeBook,n.LiveTv,n.NextUp,n.LatestMedia,n.None,n.None,n.None]'
      home_fallback_replace_base='var a=[n.Resume,n.LatestMedia,n.None,n.None,n.None,n.None,n.None,n.None,n.None,n.None]'
      backdrop_fallback_search='(0,p.G4)(this.get("enableBackdrops",!1),!1)'
      backdrop_fallback_replace='(0,p.G4)(this.get("enableBackdrops",!1),!0)'
    else
      home_fallback_search='var o=[i.SmallLibraryTiles,i.Resume,i.ResumeAudio,i.ResumeBook,i.LiveTv,i.NextUp,i.LatestMedia,i.None]'
      home_fallback_replace_base='var o=[i.Resume,i.LatestMedia,i.None,i.None,i.None,i.None,i.None,i.None,i.None,i.None]'
      backdrop_fallback_search='(0,i.G4)(this.get("enableBackdrops",!1),!1)'
      backdrop_fallback_replace='(0,i.G4)(this.get("enableBackdrops",!1),!0)'
    fi

    # Keep the replacement the same length to avoid corrupting the JS when
    # a File Transformation version rewrites a stream without truncating it.
    home_fallback_padding_length=$(($${#home_fallback_search} - $${#home_fallback_replace_base}))
    if [ "$${home_fallback_padding_length}" -lt 0 ]; then
      echo "[home-defaults] Replacement is longer than the Jellyfin Web home fallback" >&2
      exit 1
    fi
    home_fallback_replace="$${home_fallback_replace_base}$(printf '%*s' "$${home_fallback_padding_length}" '')"

    echo "[home-defaults] Waiting for Jellyfin to become ready"
    until curl --fail --silent --output /dev/null "$${jellyfin_url}/health"; do
      sleep 2
    done
    echo "[home-defaults] Jellyfin is ready"
    : > "$${processed_users_file}"

    configure_first_page_fallback() {
      bundle_path="$(grep -lF "$${home_fallback_search}" /usr/share/jellyfin/web/*.js | head -n 1)"
      if [ -z "$${bundle_path}" ]; then
        echo "[home-defaults] Jellyfin Web home fallback not found; skipping bundle transforms" >&2
        return 0
      fi

      backdrop_bundle_path="$(grep -lF "$${backdrop_fallback_search}" /usr/share/jellyfin/web/main.jellyfin.bundle.js || true)"
      if [ -z "$${backdrop_bundle_path}" ]; then
        echo "[home-defaults] Jellyfin Web backdrop fallback not found; skipping bundle transforms" >&2
        return 0
      fi

      configuration_url="$${jellyfin_url}/Plugins/$${file_transformation_plugin_id}/Configuration"
      configuration="$(curl --fail --silent --show-error --max-time 5 \
        --header "$auth_header" \
        "$${configuration_url}")" || return 1

      bundle_name="$(basename "$${bundle_path}")"
      backdrop_bundle_name="$(basename "$${backdrop_bundle_path}")"
      payload="$(printf '%s' "$${configuration}" | jq \
        --arg home_id "$${home_fallback_transformation_id}" \
        --arg backdrop_id "$${backdrop_fallback_transformation_id}" \
        --arg filename_pattern "$bundle_name" \
        --arg backdrop_filename_pattern "$backdrop_bundle_name" \
        --arg search_text "$${home_fallback_search}" \
        --arg replace_text "$${home_fallback_replace}" \
        --arg backdrop_search_text "$${backdrop_fallback_search}" \
        --arg backdrop_replace_text "$${backdrop_fallback_replace}" '
          def normalized_id: ascii_downcase | gsub("-"; "");
          .Transformations = (
            (.Transformations // [])
            | map(select(
                ((.Id | normalized_id) != ($home_id | normalized_id)) and
                ((.Id | normalized_id) != ($backdrop_id | normalized_id))
              ))
            + [{
                Id: $home_id,
                FilenamePattern: $filename_pattern,
                SearchText: $search_text,
                ReplaceText: $replace_text
              }, {
                Id: $backdrop_id,
                FilenamePattern: $backdrop_filename_pattern,
                SearchText: $backdrop_search_text,
                ReplaceText: $backdrop_replace_text
              }]
          )
        ')"

      curl --fail --silent --show-error --max-time 5 \
        --request POST \
        --header "Content-Type: application/json" \
        --header "$auth_header" \
        --data-binary "$${payload}" \
        "$${configuration_url}" \
        >/dev/null || return 1

      echo "[home-defaults] Configured immediate first-page home layout in $${bundle_name}"
      echo "[home-defaults] Enabled backdrops by default in $${backdrop_bundle_name}"
    }

    echo "[home-defaults] Waiting for the File Transformation configuration API"
    attempts=0
    until configure_first_page_fallback; do
      attempts=$((attempts + 1))
      if [ "$attempts" -ge 20 ]; then
        echo "[home-defaults] File Transformation is unavailable; continuing with saved user preferences" >&2
        break
      fi
      sleep 2
    done
    : > "$${ready_file}"

    apply_defaults() {
      users="$(curl --fail --silent --show-error \
        --header "$auth_header" \
        "$${jellyfin_url}/Users")" || return 0

      printf '%s' "$${users}" \
        | jq -r '.[] | select((.Policy.IsAdministrator // false) == false) | .Id' \
        | while IFS= read -r user_id; do
            [ -n "$${user_id}" ] || continue
            grep -Fqx "$${user_id}" "$${processed_users_file}" && continue

            preferences="$(curl --fail --silent --show-error \
              --header "$auth_header" \
              "$${jellyfin_url}/DisplayPreferences/usersettings?userId=$${user_id}&client=emby")" || continue

            marker="$(printf '%s' "$${preferences}" | jq -r --arg key "$${marker_key}" '.CustomPrefs[$key] // "false"')"
            if [ "$${marker}" = "true" ]; then
              printf '%s\n' "$${user_id}" >> "$${processed_users_file}"
              continue
            fi

            current_signature="$(printf '%s' "$${preferences}" | jq -c \
              '[range(0; 10) as $i | .CustomPrefs["homesection" + ($i | tostring)]]')"

            # A newly-created Jellyfin user can have no stored home
            # preferences yet. Preserve any layout that is not blank or one
            # of Jellyfin's untouched default layouts.
            if [ "$${current_signature}" != "$${blank_signature}" ] \
              && [ "$${current_signature}" != "$${legacy_default_signature}" ] \
              && [ "$${current_signature}" != "$${default_signature}" ]; then
              printf '%s\n' "$${user_id}" >> "$${processed_users_file}"
              continue
            fi

            payload="$(printf '%s' "$${preferences}" | jq --arg key "$${marker_key}" '
              .CustomPrefs = (.CustomPrefs // {}) |
              .CustomPrefs.homesection0 = "resume" |
              .CustomPrefs.homesection1 = "latestmedia" |
              .CustomPrefs.homesection2 = "none" |
              .CustomPrefs.homesection3 = "none" |
              .CustomPrefs.homesection4 = "none" |
              .CustomPrefs.homesection5 = "none" |
              .CustomPrefs.homesection6 = "none" |
              .CustomPrefs.homesection7 = "none" |
              .CustomPrefs.homesection8 = "none" |
              .CustomPrefs.homesection9 = "none" |
              .CustomPrefs[$key] = "true"
            ')"

            if curl --fail --silent --show-error \
              --request POST \
              --header "Content-Type: application/json" \
              --header "$auth_header" \
              --data-binary "$${payload}" \
              "$${jellyfin_url}/DisplayPreferences/usersettings?userId=$${user_id}&client=emby" \
              >/dev/null; then
              echo "[home-defaults] Applied default home layout to Jellyfin user $${user_id}"
              printf '%s\n' "$${user_id}" >> "$${processed_users_file}"
            fi
          done
    }

    while true; do
      apply_defaults
      sleep 1
    done
  EOT
}

resource "kubernetes_secret_v1" "home_defaults" {
  count = local.home_defaults_enabled ? 1 : 0

  lifecycle {
    prevent_destroy = true
  }

  metadata {
    name      = "jellyfin-home-defaults"
    namespace = kubernetes_namespace_v1.jellyfin.metadata[0].name
    labels = {
      "app.kubernetes.io/name"      = "jellyfin"
      "app.kubernetes.io/component" = "home-defaults"
    }
  }

  data = {
    api-key = var.home_defaults_api_key
  }

  type = "Opaque"
}

resource "kubernetes_config_map_v1" "home_defaults" {
  count = local.home_defaults_enabled ? 1 : 0

  lifecycle {
    prevent_destroy = true
  }

  metadata {
    name      = "jellyfin-home-defaults"
    namespace = kubernetes_namespace_v1.jellyfin.metadata[0].name
    labels = {
      "app.kubernetes.io/name"      = "jellyfin"
      "app.kubernetes.io/component" = "home-defaults"
    }
  }

  data = {
    "apply-home-defaults.sh" = local.home_defaults_script
  }
}
