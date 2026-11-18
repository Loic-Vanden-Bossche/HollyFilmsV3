resource "kubernetes_persistent_volume_claim_v1" "data" {
  # local-path uses WaitForFirstConsumer. Return after creating the Pending PVC
  # so Terraform can create the Deployment that triggers volume provisioning.
  wait_until_bound = false

  lifecycle {
    prevent_destroy = true
  }

  metadata {
    name      = "wizarr-data"
    namespace = kubernetes_namespace_v1.wizarr.metadata[0].name
    labels = {
      "app.kubernetes.io/name"      = "wizarr"
      "app.kubernetes.io/component" = "data"
      "chbrx.com/protected-data"    = "true"
    }
  }

  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = var.storage_class_name

    resources {
      requests = {
        storage = var.pvc_size
      }
    }
  }
}
