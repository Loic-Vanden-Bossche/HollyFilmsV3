resource "kubernetes_deployment_v1" "seerr" {
  metadata {
    name      = "seerr"
    namespace = kubernetes_namespace_v1.seerr.metadata[0].name
    labels = {
      "app.kubernetes.io/name" = "seerr"
    }
  }

  spec {
    replicas = 1

    strategy {
      type = "Recreate"
    }

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "seerr"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name" = "seerr"
        }
      }

      spec {
        automount_service_account_token = false

        security_context {
          fs_group               = 1000
          fs_group_change_policy = "OnRootMismatch"
          run_as_group           = 1000
          run_as_non_root        = true
          run_as_user            = 1000
          supplemental_groups    = [1000]
        }

        init_container {
          name              = "prepare-config"
          image             = "alpine:3.24.4@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf"
          image_pull_policy = "IfNotPresent"
          command = [
            "/bin/sh",
            "-c",
            "chown -R 1000:1000 /app/config && chmod 0775 /app/config"
          ]

          resources {
            requests = {
              cpu    = "5m"
              memory = "8Mi"
            }
            limits = {
              cpu    = "50m"
              memory = "32Mi"
            }
          }

          security_context {
            allow_privilege_escalation = false
            privileged                 = false
            run_as_group               = 0
            run_as_non_root            = false
            run_as_user                = 0
          }

          volume_mount {
            name       = "config"
            mount_path = "/app/config"
          }
        }

        container {
          name              = "seerr"
          image             = "ghcr.io/seerr-team/seerr:${var.image_version}"
          image_pull_policy = "IfNotPresent"

          port {
            name           = "http"
            container_port = 5055
          }

          env {
            name  = "TZ"
            value = "Europe/Paris"
          }

          env {
            name  = "PORT"
            value = "5055"
          }

          env {
            name  = "LOG_LEVEL"
            value = "info"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }

          security_context {
            allow_privilege_escalation = false
            privileged                 = false
          }

          volume_mount {
            name       = "config"
            mount_path = "/app/config"
          }

          readiness_probe {
            http_get {
              path = "/api/v1/settings/public"
              port = "http"
            }
            initial_delay_seconds = 20
            period_seconds        = 10
            timeout_seconds       = 3
            failure_threshold     = 12
          }

          liveness_probe {
            http_get {
              path = "/api/v1/settings/public"
              port = "http"
            }
            initial_delay_seconds = 60
            period_seconds        = 30
            timeout_seconds       = 3
            failure_threshold     = 6
          }
        }

        volume {
          name = "config"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim_v1.config.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "seerr" {
  metadata {
    name      = "seerr"
    namespace = kubernetes_namespace_v1.seerr.metadata[0].name
  }

  spec {
    selector = {
      "app.kubernetes.io/name" = "seerr"
    }

    port {
      name        = "http"
      port        = 5055
      target_port = "http"
    }

    type = "ClusterIP"
  }
}
