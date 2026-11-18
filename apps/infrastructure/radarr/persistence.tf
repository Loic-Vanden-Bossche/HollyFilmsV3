resource "kubernetes_storage_class_v1" "protected" {
  metadata {
    name = "radarr-protected"
    labels = {
      "app.kubernetes.io/name"   = "radarr"
      "chbrx.com/protected-data" = "true"
    }
  }

  storage_provisioner = "kubernetes.io/no-provisioner"
  reclaim_policy      = "Retain"
  volume_binding_mode = "Immediate"
}

locals {
  volumes = {
    config = {
      capacity  = "10Gi"
      host_path = var.config_host_path
    }
    media = {
      capacity  = "1Ti"
      host_path = var.media_host_path
    }
    downloads = {
      capacity  = "1Ti"
      host_path = var.downloads_host_path
    }
  }
}

resource "kubernetes_persistent_volume_v1" "radarr" {
  for_each = local.volumes

  lifecycle {
    prevent_destroy = true
  }

  metadata {
    name = "radarr-${each.key}"
    labels = {
      "app.kubernetes.io/name"      = "radarr"
      "app.kubernetes.io/component" = each.key
      "chbrx.com/protected-data"    = "true"
    }
  }

  spec {
    capacity = {
      storage = each.value.capacity
    }
    access_modes                     = ["ReadWriteOnce"]
    persistent_volume_reclaim_policy = "Retain"
    storage_class_name               = kubernetes_storage_class_v1.protected.metadata[0].name

    persistent_volume_source {
      host_path {
        path = each.value.host_path
        type = "DirectoryOrCreate"
      }
    }
  }
}

resource "kubernetes_persistent_volume_claim_v1" "radarr" {
  for_each = local.volumes

  lifecycle {
    prevent_destroy = true
  }

  metadata {
    name      = "radarr-${each.key}"
    namespace = kubernetes_namespace_v1.radarr.metadata[0].name
    labels = {
      "app.kubernetes.io/name"      = "radarr"
      "app.kubernetes.io/component" = each.key
      "chbrx.com/protected-data"    = "true"
    }
  }

  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = kubernetes_storage_class_v1.protected.metadata[0].name
    volume_name        = kubernetes_persistent_volume_v1.radarr[each.key].metadata[0].name

    resources {
      requests = {
        storage = each.value.capacity
      }
    }
  }
}
