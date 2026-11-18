resource "kubernetes_config_map_v1" "web_proxy" {
  metadata {
    name      = "hollyfilms-web-proxy"
    namespace = var.namespace
    labels    = local.labels
  }
  data = {
    "nginx.conf.template" = file("${path.module}/../docker/nginx.conf.template")
  }
}

resource "kubernetes_deployment_v1" "application" {
  depends_on = [kubernetes_job_v1.database_migration]
  metadata {
    name      = "hollyfilms"
    namespace = var.namespace
    labels    = local.labels
  }
  spec {
    replicas                  = var.replicas
    revision_history_limit    = 3
    progress_deadline_seconds = 600
    strategy {
      type = "RollingUpdate"
      rolling_update {
        max_surge       = "1"
        max_unavailable = "0"
      }
    }
    selector { match_labels = local.labels }
    template {
      metadata {
        labels = local.labels
        annotations = {
          "checksum/runtime"         = sha256(jsonencode(kubernetes_secret_v1.runtime.data))
          "checksum/database-secret" = var.database_secret_revision
          "checksum/web-proxy"       = sha256(kubernetes_config_map_v1.web_proxy.data["nginx.conf.template"])
        }
      }
      spec {
        automount_service_account_token  = false
        termination_grace_period_seconds = 60
        dynamic "image_pull_secrets" {
          for_each = nonsensitive(var.ghcr_credentials == null) ? [] : [1]
          content {
            name = kubernetes_secret_v1.registry[0].metadata[0].name
          }
        }
        security_context {
          run_as_non_root = true
          fs_group        = 1000
          seccomp_profile { type = "RuntimeDefault" }
        }
        container {
          name              = "api"
          image             = var.api_image
          image_pull_policy = var.image_pull_policy
          security_context {
            run_as_user                = 1000
            run_as_group               = 1000
            allow_privilege_escalation = false
            read_only_root_filesystem  = true
            capabilities { drop = ["ALL"] }
          }
          port {
            name           = "api"
            container_port = 3000
          }
          env_from {
            secret_ref {
              name = kubernetes_secret_v1.runtime.metadata[0].name
            }
          }
          dynamic "env" {
            for_each = {
              NODE_ENV            = "production"
              PORT                = "3000"
              HOLLYFILMS_API_HOST = "0.0.0.0"
              PUBLIC_ORIGIN       = var.public_origin
              JELLYFIN_URL        = var.jellyfin_url
              TRUST_PROXY         = "loopback"
            }
            content {
              name  = env.key
              value = env.value
            }
          }
          env {
            name = "DATABASE_URL"
            value_from {
              secret_key_ref {
                name = var.database_secret_name
                key  = "url"
              }
            }
          }
          resources {
            requests = { cpu = "100m", memory = "256Mi" }
            limits   = { cpu = "1000m", memory = "768Mi" }
          }
          startup_probe {
            tcp_socket { port = "api" }
            period_seconds    = 5
            failure_threshold = 30
          }
          readiness_probe {
            http_get {
              path = "/api/health"
              port = "api"
            }
            period_seconds  = 10
            timeout_seconds = 5
          }
          # A database outage must not cause an API restart loop.
          liveness_probe {
            tcp_socket { port = "api" }
            period_seconds = 30
          }
          volume_mount {
            name       = "api-tmp"
            mount_path = "/tmp"
          }
        }
        container {
          name              = "web"
          image             = var.web_image
          image_pull_policy = var.image_pull_policy
          security_context {
            run_as_user                = 101
            run_as_group               = 1000
            allow_privilege_escalation = false
            read_only_root_filesystem  = true
            capabilities { drop = ["ALL"] }
          }
          port {
            name           = "http"
            container_port = 8080
          }
          env {
            name  = "JELLYFIN_URL"
            value = var.jellyfin_url
          }
          resources {
            requests = { cpu = "50m", memory = "64Mi" }
            limits   = { cpu = "1000m", memory = "256Mi" }
          }
          readiness_probe {
            http_get {
              path = "/healthz"
              port = "http"
            }
          }
          liveness_probe {
            http_get {
              path = "/healthz"
              port = "http"
            }
            period_seconds = 30
          }
          volume_mount {
            name       = "web-tmp"
            mount_path = "/tmp"
          }
          volume_mount {
            name       = "web-proxy"
            mount_path = "/opt/hollyfilms/nginx.conf.template"
            sub_path   = "nginx.conf.template"
            read_only  = true
          }
        }
        volume {
          name = "api-tmp"
          empty_dir { size_limit = "128Mi" }
        }
        volume {
          name = "web-tmp"
          empty_dir {}
        }
        volume {
          name = "web-proxy"
          config_map { name = kubernetes_config_map_v1.web_proxy.metadata[0].name }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "application" {
  metadata {
    name      = "hollyfilms"
    namespace = var.namespace
    labels    = local.labels
  }
  spec {
    selector = local.labels
    port {
      name        = "http"
      port        = 8080
      target_port = "http"
    }
    type = "ClusterIP"
  }
}

