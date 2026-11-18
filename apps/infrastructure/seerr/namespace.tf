resource "kubernetes_namespace_v1" "seerr" {
  lifecycle {
    prevent_destroy = true
  }

  metadata {
    name = "seerr"
    labels = {
      "app.kubernetes.io/name" = "seerr"
    }
  }
}
