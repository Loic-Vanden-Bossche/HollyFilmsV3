resource "kubernetes_storage_class_v1" "protected" {
  metadata {
    name = "jellyfin-protected"
    labels = {
      "app.kubernetes.io/name"   = "jellyfin"
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
    name = "jellyfin-config"
    labels = {
      "app.kubernetes.io/name"      = "jellyfin"
      "app.kubernetes.io/component" = "config"
      "chbrx.com/protected-data"    = "true"
    }
  }

  spec {
    capacity = {
      storage = "20Gi"
    }
    access_modes                     = ["ReadWriteOnce"]
    persistent_volume_reclaim_policy = "Retain"
    storage_class_name               = kubernetes_storage_class_v1.protected.metadata[0].name

    persistent_volume_source {
      host_path {
        path = "/mnt/HDD3/jellyfin/config"
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
    name      = "jellyfin-config"
    namespace = kubernetes_namespace_v1.jellyfin.metadata[0].name
    labels = {
      "app.kubernetes.io/name"   = "jellyfin"
      "chbrx.com/protected-data" = "true"
    }
  }

  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = kubernetes_storage_class_v1.protected.metadata[0].name
    volume_name        = kubernetes_persistent_volume_v1.config.metadata[0].name

    resources {
      requests = {
        storage = "20Gi"
      }
    }
  }
}

resource "kubernetes_persistent_volume_v1" "media" {
  lifecycle {
    prevent_destroy = true
  }

  metadata {
    name = "jellyfin-media"
    labels = {
      "app.kubernetes.io/name"      = "jellyfin"
      "app.kubernetes.io/component" = "media"
      "chbrx.com/protected-data"    = "true"
    }
  }

  spec {
    capacity = {
      storage = "1Ti"
    }
    access_modes                     = ["ReadWriteOnce"]
    persistent_volume_reclaim_policy = "Retain"
    storage_class_name               = kubernetes_storage_class_v1.protected.metadata[0].name

    persistent_volume_source {
      host_path {
        path = "/mnt/HDD3/jellyfin/media"
        type = "DirectoryOrCreate"
      }
    }
  }
}

resource "kubernetes_persistent_volume_claim_v1" "media" {
  lifecycle {
    prevent_destroy = true
  }

  metadata {
    name      = "jellyfin-media"
    namespace = kubernetes_namespace_v1.jellyfin.metadata[0].name
    labels = {
      "app.kubernetes.io/name"   = "jellyfin"
      "chbrx.com/protected-data" = "true"
    }
  }

  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = kubernetes_storage_class_v1.protected.metadata[0].name
    volume_name        = kubernetes_persistent_volume_v1.media.metadata[0].name

    resources {
      requests = {
        storage = "1Ti"
      }
    }
  }
}
