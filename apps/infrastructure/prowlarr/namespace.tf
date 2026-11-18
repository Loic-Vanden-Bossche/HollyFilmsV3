resource "kubernetes_namespace_v1" "prowlarr" {
  lifecycle {
    prevent_destroy = true
  }

  metadata {
    name = "prowlarr"
    labels = {
      "app.kubernetes.io/name" = "prowlarr"
    }
  }
}
