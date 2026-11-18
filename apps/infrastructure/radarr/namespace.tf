resource "kubernetes_namespace_v1" "radarr" {
  lifecycle {
    prevent_destroy = true
  }

  metadata {
    name = "radarr"
    labels = {
      "app.kubernetes.io/name" = "radarr"
    }
  }
}
