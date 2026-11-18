resource "kubernetes_namespace_v1" "sabnzbd" {
  lifecycle {
    prevent_destroy = true
  }

  metadata {
    name = "sabnzbd"
    labels = {
      "app.kubernetes.io/name" = "sabnzbd"
    }
  }
}
