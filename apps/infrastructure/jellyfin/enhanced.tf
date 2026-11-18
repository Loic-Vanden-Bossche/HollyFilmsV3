locals {
  jellyfin_release         = regex("^[0-9]+\\.[0-9]+(?:\\.[0-9]+)?", var.jellyfin_version)
  jellyfin_package_release = length(split(".", local.jellyfin_release)) == 2 ? "${local.jellyfin_release}.0" : local.jellyfin_release
  jellyfin_12              = startswith(local.jellyfin_release, "12.")
  plugin_api_version       = local.jellyfin_12 ? "12.0.0" : "10.11.0"

  enhanced_installer_script = <<-EOT
    #!/usr/bin/env sh
    set -eu

    apk add --no-cache ca-certificates curl unzip >/dev/null

    install_plugin() {
      plugin_name="$1"
      plugin_version="$2"
      plugin_url="$3"
      expected_checksum="$(printf '%s' "$4" | tr '[:upper:]' '[:lower:]')"
      plugin_root="/config/data/plugins"
      target_dir="$${plugin_root}/$${plugin_name}_$${plugin_version}"

      if [ -d "$${target_dir}" ] && find "$${target_dir}" -maxdepth 1 -name '*.dll' | grep -q .; then
        echo "[plugins] $${plugin_name} $${plugin_version} is already installed"
        return
      fi

      archive="/tmp/$${plugin_name}.zip"
      curl --fail --location --silent --show-error "$${plugin_url}" --output "$${archive}"

      actual_checksum="$(md5sum "$${archive}" | awk '{print $1}')"
      if [ "$${actual_checksum}" != "$${expected_checksum}" ]; then
        echo "[plugins] Checksum mismatch for $${plugin_name}" >&2
        exit 1
      fi

      mkdir -p "$${target_dir}"
      unzip -q "$${archive}" -d "$${target_dir}"
      rm -f "$${archive}"

      for old_dir in "$${plugin_root}/$${plugin_name}_"*; do
        [ -e "$${old_dir}" ] || continue
        [ "$${old_dir}" = "$${target_dir}" ] || rm -rf "$${old_dir}"
      done

      chown -R ${var.puid}:${var.pgid} "$${target_dir}"
      echo "[plugins] Installed $${plugin_name} $${plugin_version}"
    }

    install_plugin \
      "File Transformation" \
      "${var.file_transform_version}" \
      "https://github.com/IAmParadox27/jellyfin-plugin-file-transformation/releases/download/${var.file_transform_version}/Release-${local.jellyfin_package_release}.zip" \
      "${var.file_transform_checksum}"

    install_plugin \
      "Jellyfin Enhanced" \
      "${var.enhanced_version}" \
      "https://github.com/n00bcodr/Jellyfin-Enhanced/releases/download/${var.enhanced_version}/Jellyfin.Plugin.JellyfinEnhanced_${local.plugin_api_version}.zip" \
      "${var.enhanced_checksum}"

    install_plugin \
      "Jellyfin Tweaks" \
      "${var.tweaks_version}" \
      "https://github.com/n00bcodr/JellyfinTweaks/releases/download/${var.tweaks_version}/Jellyfin.Plugin.JellyTweaks_${local.plugin_api_version}.zip" \
      "${var.tweaks_checksum}"
  EOT
}

resource "kubernetes_config_map_v1" "enhanced_installer" {
  metadata {
    name      = "jellyfin-enhanced-installer"
    namespace = kubernetes_namespace_v1.jellyfin.metadata[0].name
    labels = {
      "app.kubernetes.io/name"      = "jellyfin"
      "app.kubernetes.io/component" = "plugins"
    }
  }

  data = {
    "install-enhanced.sh" = local.enhanced_installer_script
  }
}
