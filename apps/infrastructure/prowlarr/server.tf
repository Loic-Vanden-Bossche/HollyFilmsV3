resource "kubernetes_deployment_v1" "prowlarr" {
  metadata {
    name      = "prowlarr"
    namespace = kubernetes_namespace_v1.prowlarr.metadata[0].name
    labels    = { "app.kubernetes.io/name" = "prowlarr" }
  }

  spec {
    replicas = 1

    strategy {
      type = "Recreate"
    }

    selector {
      match_labels = { "app.kubernetes.io/name" = "prowlarr" }
    }

    template {
      metadata {
        labels = { "app.kubernetes.io/name" = "prowlarr" }
      }

      spec {
        automount_service_account_token = false

        security_context {
          fs_group = var.pgid
        }

        container {
          name              = "prowlarr"
          image             = "lscr.io/linuxserver/prowlarr:${var.image_version}"
          image_pull_policy = "IfNotPresent"

          port {
            name           = "http"
            container_port = 9696
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
            requests = { cpu = "50m", memory = "128Mi" }
            limits   = { cpu = "500m", memory = "512Mi" }
          }

          volume_mount {
            name       = "config"
            mount_path = "/config"
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

resource "kubernetes_service_v1" "prowlarr" {
  metadata {
    name      = "prowlarr"
    namespace = kubernetes_namespace_v1.prowlarr.metadata[0].name
  }

  spec {
    selector = { "app.kubernetes.io/name" = "prowlarr" }

    port {
      name        = "http"
      port        = 9696
      target_port = "http"
    }

    type = "ClusterIP"
  }
}
