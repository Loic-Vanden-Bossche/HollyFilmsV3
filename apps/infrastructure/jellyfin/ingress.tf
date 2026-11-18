locals {
  jellyfin_tls = merge(
    { (var.hostname) = "jellyfin-public-tls" },
    var.previous_hostname == null ? {} : { (var.previous_hostname) = "jellyfin-tls" },
  )
}

resource "kubernetes_ingress_v1" "jellyfin" {
  depends_on = [kubernetes_deployment_v1.admin_auth, kubernetes_ingress_v1.admin_auth]

  metadata {
    name      = "jellyfin"
    namespace = kubernetes_namespace_v1.jellyfin.metadata[0].name
    annotations = merge({
      "cert-manager.io/cluster-issuer"                 = var.certificate_issuer_name
      "nginx.ingress.kubernetes.io/backend-protocol"   = "HTTP"
      "nginx.ingress.kubernetes.io/force-ssl-redirect" = "true"
      "nginx.ingress.kubernetes.io/proxy-body-size"    = "0"
      "nginx.ingress.kubernetes.io/proxy-buffering"    = "off"
      "nginx.ingress.kubernetes.io/proxy-read-timeout" = "3600"
      "nginx.ingress.kubernetes.io/proxy-send-timeout" = "3600"
      "nginx.ingress.kubernetes.io/ssl-redirect"       = "true"
      }, var.admin_google_enabled ? {
      "nginx.ingress.kubernetes.io/enable-access-log" = "false"
      "nginx.ingress.kubernetes.io/auth-url"          = "http://jellyfin-admin-auth.${kubernetes_namespace_v1.jellyfin.metadata[0].name}.svc.cluster.local:4180/oauth2/auth"
      "nginx.ingress.kubernetes.io/auth-signin"       = "https://${var.hostname}/oauth2/start?rd=$escaped_request_uri"
    } : {})
  }

  spec {
    ingress_class_name = var.nginx_ingress_class

    dynamic "tls" {
      for_each = local.jellyfin_tls
      content {
        hosts       = [tls.key]
        secret_name = tls.value
      }
    }

    dynamic "rule" {
      for_each = local.jellyfin_tls
      content {
        host = rule.key
        http {
          path {
            path      = "/"
            path_type = "Prefix"
            backend {
              service {
                name = kubernetes_service_v1.jellyfin.metadata[0].name
                port {
                  number = 8096
                }
              }
            }
          }
        }
      }
    }
  }
}
