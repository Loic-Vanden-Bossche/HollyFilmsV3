resource "kubernetes_namespace_v1" "jellyfin" {
  lifecycle {
    prevent_destroy = true
  }

  metadata {
    name = "jellyfin"
  }
}
