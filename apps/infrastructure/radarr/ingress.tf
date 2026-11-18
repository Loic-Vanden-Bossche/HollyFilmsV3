resource "kubernetes_ingress_v1" "radarr" {
  count = var.ingress_enabled ? 1 : 0

  metadata {
    name      = "radarr"
    namespace = kubernetes_namespace_v1.radarr.metadata[0].name
    annotations = {
      "cert-manager.io/cluster-issuer"                 = var.certificate_issuer_name
      "nginx.ingress.kubernetes.io/backend-protocol"   = "HTTP"
      "nginx.ingress.kubernetes.io/force-ssl-redirect" = "true"
      "nginx.ingress.kubernetes.io/proxy-body-size"    = "0"
      "nginx.ingress.kubernetes.io/ssl-redirect"       = "true"
    }
  }

  spec {
    ingress_class_name = var.nginx_ingress_class

    tls {
      hosts       = [var.hostname]
      secret_name = "radarr-tls"
    }

    rule {
      host = var.hostname

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service_v1.radarr.metadata[0].name
              port {
                number = 7878
              }
            }
          }
        }
      }
    }
  }
}
