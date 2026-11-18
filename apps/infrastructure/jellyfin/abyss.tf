locals {
  abyss_init_script = <<-EOT
    #!/usr/bin/env bash
    set -Eeuo pipefail

    script_path="/tmp/abyss-spotlight.sh"
    script_url="https://raw.githubusercontent.com/AumGupta/abyss-jellyfin/main/scripts/docker/abyss-spotlight.sh"

    echo "**** [abyss] Downloading the latest Abyss Spotlight init script ****"
    curl -fsSL "$${script_url}" -o "$${script_path}"
    chmod 0755 "$${script_path}"

    /bin/bash "$${script_path}"
  EOT
}

resource "kubernetes_config_map_v1" "abyss_init_script" {
  metadata {
    name      = "abyss-spotlight-init"
    namespace = kubernetes_namespace_v1.jellyfin.metadata[0].name
    labels = {
      "app.kubernetes.io/name"      = "jellyfin"
      "app.kubernetes.io/component" = "theme"
    }
  }

  data = {
    "abyss-spotlight.sh" = local.abyss_init_script
  }
}
