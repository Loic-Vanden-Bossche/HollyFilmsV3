resource "kubernetes_namespace_v1" "hollyfilms" {
  metadata {
    name   = var.namespace_name
    labels = { "app.kubernetes.io/name" = "hollyfilms" }
  }
  lifecycle { prevent_destroy = true }
}
