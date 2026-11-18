resource "kubernetes_namespace_v1" "wizarr" {
  lifecycle {
    prevent_destroy = true
  }

  metadata {
    name = "wizarr"
    labels = {
      "app.kubernetes.io/name" = "wizarr"
    }
  }
}
