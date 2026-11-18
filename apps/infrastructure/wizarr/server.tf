resource "kubernetes_deployment_v1" "wizarr" {
  metadata {
    name      = "wizarr"
    namespace = kubernetes_namespace_v1.wizarr.metadata[0].name
    labels = {
      "app.kubernetes.io/name"      = "wizarr"
      "app.kubernetes.io/component" = "server"
    }
  }

  spec {
    replicas = 1

    strategy {
      type = "Recreate"
    }

    selector {
      match_labels = {
        "app.kubernetes.io/name"      = "wizarr"
        "app.kubernetes.io/component" = "server"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "wizarr"
          "app.kubernetes.io/component" = "server"
        }
      }

      spec {
        automount_service_account_token = false

        security_context {
          fs_group = var.pgid
        }

        container {
          name              = "wizarr"
          image             = "ghcr.io/wizarrrr/wizarr:${var.image_version}"
          image_pull_policy = "IfNotPresent"

          security_context {
            privileged = false
          }

          port {
            name           = "http"
            container_port = 5690
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
            name  = "DISABLE_BUILTIN_AUTH"
            value = "false"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }

          volume_mount {
            name       = "data"
            mount_path = "/data"
          }

          readiness_probe {
            tcp_socket {
              port = "http"
            }
            initial_delay_seconds = 10
            period_seconds        = 10
            timeout_seconds       = 3
            failure_threshold     = 12
          }

          liveness_probe {
            tcp_socket {
              port = "http"
            }
            initial_delay_seconds = 30
            period_seconds        = 30
            timeout_seconds       = 3
            failure_threshold     = 6
          }
        }

        volume {
          name = "data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim_v1.data.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "wizarr" {
  metadata {
    name      = "wizarr"
    namespace = kubernetes_namespace_v1.wizarr.metadata[0].name
    labels = {
      "app.kubernetes.io/name" = "wizarr"
    }
  }

  spec {
    selector = {
      "app.kubernetes.io/name"      = "wizarr"
      "app.kubernetes.io/component" = "server"
    }

    port {
      name        = "http"
      port        = 5690
      target_port = "http"
    }

    type = "ClusterIP"
  }
}
