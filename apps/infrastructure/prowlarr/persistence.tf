resource "kubernetes_storage_class_v1" "protected" {
  metadata {
    name = "prowlarr-protected"
    labels = {
      "app.kubernetes.io/name"   = "prowlarr"
      "chbrx.com/protected-data" = "true"
    }
  }

  storage_provisioner = "kubernetes.io/no-provisioner"
  reclaim_policy      = "Retain"
  volume_binding_mode = "Immediate"
}

resource "kubernetes_persistent_volume_v1" "config" {
  lifecycle {
    prevent_destroy = true
  }

  metadata {
    name = "prowlarr-config"
    labels = {
      "app.kubernetes.io/name"      = "prowlarr"
      "app.kubernetes.io/component" = "config"
      "chbrx.com/protected-data"    = "true"
    }
  }

  spec {
    capacity                         = { storage = "10Gi" }
    access_modes                     = ["ReadWriteOnce"]
    persistent_volume_reclaim_policy = "Retain"
    storage_class_name               = kubernetes_storage_class_v1.protected.metadata[0].name

    persistent_volume_source {
      host_path {
        path = var.config_host_path
        type = "DirectoryOrCreate"
      }
    }
  }
}

resource "kubernetes_persistent_volume_claim_v1" "config" {
  lifecycle {
    prevent_destroy = true
  }

  metadata {
    name      = "prowlarr-config"
    namespace = kubernetes_namespace_v1.prowlarr.metadata[0].name
    labels = {
      "app.kubernetes.io/name"   = "prowlarr"
      "chbrx.com/protected-data" = "true"
    }
  }

  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = kubernetes_storage_class_v1.protected.metadata[0].name
    volume_name        = kubernetes_persistent_volume_v1.config.metadata[0].name

    resources {
      requests = { storage = "10Gi" }
    }
  }
}
