resource "kubernetes_deployment_v1" "radarr" {
  metadata {
    name      = "radarr"
    namespace = kubernetes_namespace_v1.radarr.metadata[0].name
    labels = {
      "app.kubernetes.io/name" = "radarr"
    }
  }

  spec {
    replicas = 1

    strategy {
      type = "Recreate"
    }

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "radarr"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name" = "radarr"
        }
      }

      spec {
        automount_service_account_token = false

        security_context {
          fs_group = var.pgid
        }

        init_container {
          name              = "prepare-media-directories"
          image             = "busybox:1.37.0"
          image_pull_policy = "IfNotPresent"

          command = [
            "/bin/sh",
            "-ec",
            <<-EOT
              mkdir -p /media/movies /downloads/incomplete /downloads/complete/radarr
              chown ${var.puid}:${var.pgid} /media /media/movies /downloads /downloads/incomplete /downloads/complete /downloads/complete/radarr
                chmod 0775 /media /media/movies /downloads /downloads/incomplete /downloads/complete /downloads/complete/radarr
            EOT
          ]

          security_context {
            run_as_user  = 0
            run_as_group = 0
          }

          volume_mount {
            name       = "media"
            mount_path = "/media"
          }

          volume_mount {
            name       = "downloads"
            mount_path = "/downloads"
          }
        }

        container {
          name              = "radarr"
          image             = "lscr.io/linuxserver/radarr:${var.image_version}"
          image_pull_policy = "IfNotPresent"

          port {
            name           = "http"
            container_port = 7878
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

          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
          }

          dynamic "volume_mount" {
            for_each = {
              config    = "/config"
              media     = "/media"
              downloads = "/downloads"
            }

            content {
              name       = volume_mount.key
              mount_path = volume_mount.value
            }
          }

          readiness_probe {
            http_get {
              path = "/ping"
              port = "http"
            }
            initial_delay_seconds = 20
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 12
          }

          liveness_probe {
            http_get {
              path = "/ping"
              port = "http"
            }
            initial_delay_seconds = 60
            period_seconds        = 30
            timeout_seconds       = 5
            failure_threshold     = 6
          }
        }

        dynamic "volume" {
          for_each = toset(["config", "media", "downloads"])

          content {
            name = volume.value
            persistent_volume_claim {
              claim_name = kubernetes_persistent_volume_claim_v1.radarr[volume.value].metadata[0].name
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "radarr" {
  metadata {
    name      = "radarr"
    namespace = kubernetes_namespace_v1.radarr.metadata[0].name
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "radarr"
    }

    port {
      name        = "http"
      port        = 7878
      target_port = "http"
    }

    type = "ClusterIP"
  }
}
