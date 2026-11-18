resource "kubernetes_deployment_v1" "jellyfin" {
  timeouts {
    create = "35m"
    update = "35m"
  }

  metadata {
    name      = "jellyfin"
    namespace = kubernetes_namespace_v1.jellyfin.metadata[0].name
    labels = {
      "app.kubernetes.io/name" = "jellyfin"
    }
  }

  spec {
    replicas                  = 1
    progress_deadline_seconds = 1800

    strategy {
      type = "Recreate"
    }

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "jellyfin"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name" = "jellyfin"
        }
        annotations = {
          "checksum/abyss-init-script"    = sha256(local.abyss_init_script)
          "checksum/enhanced-installer"   = sha256(local.enhanced_installer_script)
          "checksum/home-defaults-script" = local.home_defaults_enabled ? sha256(local.home_defaults_script) : "disabled"
        }
      }

      spec {
        security_context {
          fs_group = 1000
        }

        init_container {
          name              = "enhanced-installer"
          image             = "alpine:3.24.4@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf"
          image_pull_policy = "IfNotPresent"
          command           = ["/bin/sh", "/opt/chbrx/install-enhanced.sh"]

          resources {
            requests = {
              cpu    = "10m"
              memory = "32Mi"
            }
            limits = {
              cpu    = "200m"
              memory = "128Mi"
            }
          }

          security_context {
            allow_privilege_escalation = false
            privileged                 = false
          }

          volume_mount {
            name       = "config"
            mount_path = "/config"
          }

          volume_mount {
            name       = "enhanced-installer"
            mount_path = "/opt/chbrx/install-enhanced.sh"
            sub_path   = "install-enhanced.sh"
            read_only  = true
          }
        }

        container {
          name              = "jellyfin"
          image             = "lscr.io/linuxserver/jellyfin:${var.jellyfin_version}"
          image_pull_policy = "IfNotPresent"

          port {
            name           = "http"
            container_port = 8096
          }

          env {
            name  = "TZ"
            value = "Europe/Paris"
          }

          env {
            name  = "PUID"
            value = tostring(var.puid)
          }

          env {
            name  = "PGID"
            value = tostring(var.pgid)
          }

          env {
            name  = "UMASK"
            value = "002"
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }
            limits = {
              memory = "4Gi"
            }
          }

          volume_mount {
            name       = "config"
            mount_path = "/config"
          }

          volume_mount {
            name       = "media"
            mount_path = "/media"
          }

          volume_mount {
            name       = "abyss-init-script"
            mount_path = "/custom-cont-init.d/abyss-spotlight.sh"
            sub_path   = "abyss-spotlight.sh"
            read_only  = true
          }

          # Major upgrades migrate the existing database before /health is ready.
          startup_probe {
            http_get {
              path = "/health"
              port = "http"
            }
            period_seconds    = 10
            timeout_seconds   = 5
            failure_threshold = 150
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = "http"
            }
            initial_delay_seconds = 20
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 12
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = "http"
            }
            initial_delay_seconds = 60
            period_seconds        = 30
            timeout_seconds       = 5
            failure_threshold     = 6
          }
        }

        dynamic "container" {
          for_each = local.home_defaults_enabled ? [1] : []

          content {
            name              = "home-defaults"
            image             = "lscr.io/linuxserver/jellyfin:${var.jellyfin_version}"
            image_pull_policy = "IfNotPresent"
            command           = ["/bin/sh", "/opt/chbrx/apply-home-defaults.sh"]

            env {
              name = "JELLYFIN_API_KEY"
              value_from {
                secret_key_ref {
                  name = kubernetes_secret_v1.home_defaults[0].metadata[0].name
                  key  = "api-key"
                }
              }
            }

            resources {
              requests = {
                cpu    = "5m"
                memory = "16Mi"
              }
              limits = {
                cpu    = "50m"
                memory = "64Mi"
              }
            }

            security_context {
              allow_privilege_escalation = false
              privileged                 = false
            }

            readiness_probe {
              exec {
                command = ["/bin/sh", "-c", "test -f /tmp/home-defaults-ready"]
              }
              initial_delay_seconds = 1
              period_seconds        = 1
              timeout_seconds       = 1
              failure_threshold     = 120
            }

            volume_mount {
              name       = "home-defaults-script"
              mount_path = "/opt/chbrx/apply-home-defaults.sh"
              sub_path   = "apply-home-defaults.sh"
              read_only  = true
            }
          }
        }

        volume {
          name = "config"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim_v1.config.metadata[0].name
          }
        }

        volume {
          name = "media"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim_v1.media.metadata[0].name
          }
        }

        volume {
          name = "abyss-init-script"
          config_map {
            name         = kubernetes_config_map_v1.abyss_init_script.metadata[0].name
            default_mode = "0755"
          }
        }

        volume {
          name = "enhanced-installer"
          config_map {
            name         = kubernetes_config_map_v1.enhanced_installer.metadata[0].name
            default_mode = "0555"
          }
        }

        dynamic "volume" {
          for_each = local.home_defaults_enabled ? [1] : []

          content {
            name = "home-defaults-script"
            config_map {
              name         = kubernetes_config_map_v1.home_defaults[0].metadata[0].name
              default_mode = "0555"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "jellyfin" {
  metadata {
    name      = "jellyfin"
    namespace = kubernetes_namespace_v1.jellyfin.metadata[0].name
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "jellyfin"
    }

    port {
      name        = "http"
      port        = 8096
      target_port = "http"
    }
  }
}
