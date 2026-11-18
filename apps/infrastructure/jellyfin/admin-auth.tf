locals {
  admin_auth_name = "jellyfin-admin-auth"
  admin_auth_labels = {
    "app.kubernetes.io/name"      = local.admin_auth_name
    "app.kubernetes.io/component" = "admin-google-auth"
  }
}

resource "kubernetes_deployment_v1" "admin_auth" {
  count = var.admin_google_enabled ? 1 : 0

  metadata {
    name      = local.admin_auth_name
    namespace = kubernetes_namespace_v1.jellyfin.metadata[0].name
    labels    = local.admin_auth_labels
  }

  spec {
    replicas = 1
    selector { match_labels = local.admin_auth_labels }
    template {
      metadata { labels = local.admin_auth_labels }
      spec {
        automount_service_account_token = false
        security_context {
          run_as_non_root = true
          seccomp_profile { type = "RuntimeDefault" }
        }
        container {
          name  = "oauth2-proxy"
          image = "quay.io/oauth2-proxy/oauth2-proxy:v7.15.6@sha256:c3415e8660af553f5e18f5d90db050614c02493c0ac6260ac59442f6d9b12048"
          args = [
            "--provider=google",
            "--redirect-url=https://${var.hostname}/oauth2/callback",
            "--authenticated-emails-file=/etc/jellyfin-admin/allowed-emails",
            "--http-address=0.0.0.0:4180",
            "--upstream=static://202",
            "--reverse-proxy=true",
            "--skip-provider-button=true",
            "--cookie-name=__Host-jellyfin-admin",
            "--cookie-secure=true",
            "--cookie-httponly=true",
            "--cookie-samesite=lax",
            "--cookie-expire=8h",
            "--request-logging=false",
          ]
          dynamic "env" {
            for_each = {
              OAUTH2_PROXY_CLIENT_ID     = "client-id"
              OAUTH2_PROXY_CLIENT_SECRET = "client-secret"
              OAUTH2_PROXY_COOKIE_SECRET = "cookie-secret"
            }
            content {
              name = env.key
              value_from {
                secret_key_ref {
                  name = "jellyfin-admin-google"
                  key  = env.value
                }
              }
            }
          }
          port {
            name           = "http"
            container_port = 4180
          }
          readiness_probe {
            http_get {
              path = "/ping"
              port = "http"
            }
          }
          resources {
            requests = { cpu = "25m", memory = "32Mi" }
            limits   = { cpu = "250m", memory = "128Mi" }
          }
          security_context {
            allow_privilege_escalation = false
            read_only_root_filesystem  = true
            capabilities { drop = ["ALL"] }
          }
          volume_mount {
            name       = "allowed-emails"
            mount_path = "/etc/jellyfin-admin"
            read_only  = true
          }
        }
        volume {
          name = "allowed-emails"
          secret {
            secret_name = "jellyfin-admin-google"
            items {
              key  = "allowed-emails"
              path = "allowed-emails"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "admin_auth" {
  count = var.admin_google_enabled ? 1 : 0

  metadata {
    name      = local.admin_auth_name
    namespace = kubernetes_namespace_v1.jellyfin.metadata[0].name
    labels    = local.admin_auth_labels
  }

  spec {
    selector = local.admin_auth_labels
    port {
      name        = "http"
      port        = 4180
      target_port = "http"
    }
  }
}

resource "kubernetes_ingress_v1" "admin_auth" {
  count = var.admin_google_enabled ? 1 : 0

  metadata {
    name      = local.admin_auth_name
    namespace = kubernetes_namespace_v1.jellyfin.metadata[0].name
    annotations = {
      "nginx.ingress.kubernetes.io/ssl-redirect"      = "true"
      "nginx.ingress.kubernetes.io/enable-access-log" = "false"
    }
  }

  spec {
    ingress_class_name = var.nginx_ingress_class
    tls {
      hosts       = [var.hostname]
      secret_name = "jellyfin-public-tls"
    }
    rule {
      host = var.hostname
      http {
        path {
          path      = "/oauth2"
          path_type = "Prefix"
          backend {
            service {
              name = kubernetes_service_v1.admin_auth[0].metadata[0].name
              port { name = "http" }
            }
          }
        }
      }
    }
  }
}
