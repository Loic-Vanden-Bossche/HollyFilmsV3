resource "kubernetes_deployment_v1" "sabnzbd" {
  metadata {
    name      = "sabnzbd"
    namespace = kubernetes_namespace_v1.sabnzbd.metadata[0].name
    labels = {
      "app.kubernetes.io/name" = "sabnzbd"
    }
  }

  spec {
    replicas = 1

    strategy {
      type = "Recreate"
    }

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "sabnzbd"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name" = "sabnzbd"
        }
      }

      spec {
        automount_service_account_token = false

        security_context {
          fs_group = var.pgid
        }

        container {
          name              = "sabnzbd"
          image             = "lscr.io/linuxserver/sabnzbd:${var.image_version}"
          image_pull_policy = "IfNotPresent"

          port {
            name           = "http"
            container_port = 8080
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
              cpu    = "2"
              memory = "2Gi"
            }
          }

          volume_mount {
            name       = "config"
            mount_path = "/config"
          }

          volume_mount {
            name       = "downloads"
            mount_path = "/downloads"
          }

          readiness_probe {
            tcp_socket {
              port = "http"
            }
            initial_delay_seconds = 20
            period_seconds        = 10
            timeout_seconds       = 3
            failure_threshold     = 12
          }

          liveness_probe {
            tcp_socket {
              port = "http"
            }
            initial_delay_seconds = 60
            period_seconds        = 30
            timeout_seconds       = 3
            failure_threshold     = 6
          }
        }

        dynamic "volume" {
          for_each = toset(["config", "downloads"])

          content {
            name = volume.value
            persistent_volume_claim {
              claim_name = kubernetes_persistent_volume_claim_v1.sabnzbd[volume.value].metadata[0].name
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "sabnzbd" {
  metadata {
    name      = "sabnzbd"
    namespace = kubernetes_namespace_v1.sabnzbd.metadata[0].name
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "sabnzbd"
    }

    port {
      name        = "http"
      port        = 8080
      target_port = "http"
    }

    type = "ClusterIP"
  }
}
