mock_provider "kubernetes" {}

variables {
  api_image         = "ghcr.io/test/hollyfilms-api:v1"
  web_image         = "ghcr.io/test/hollyfilms-web:v1"
  database_password = "onlyForAnIsolatedTest123456789"
  jellyfin_api_key  = "fake-test-key"
}

run "preserve_media_addresses" {
  command = plan

  assert {
    condition     = output.jellyfin_url == "https://hollyfilms.chbrx.com" && output.seerr_url == "https://seerr.chbrx.com" && output.wizarr_url == "https://invite.hollyfilms.chbrx.com"
    error_message = "Moving Terraform ownership must preserve existing public media URLs."
  }

  assert {
    condition     = output.radarr_internal_url == "http://radarr.radarr.svc.cluster.local:7878" && output.prowlarr_internal_url == "http://prowlarr.prowlarr.svc.cluster.local:9696" && output.sabnzbd_internal_url == "http://sabnzbd.sabnzbd.svc.cluster.local:8080"
    error_message = "Existing integrations must retain their service names, namespaces and ports."
  }

  assert {
    condition     = output.radarr_url == null && output.prowlarr_url == null && output.sabnzbd_url == null
    error_message = "Administration services must remain private by default."
  }
}

run "preserve_radarr_storage" {
  command = plan
  module { source = "./radarr" }
  variables {
    image_version           = "7.0.3.10918-ls328"
    hostname                = "radarr.chbrx.com"
    ingress_enabled         = false
    config_host_path        = "/mnt/HDD3/radarr/config"
    media_host_path         = "/mnt/HDD3/jellyfin/media"
    downloads_host_path     = "/mnt/HDD3/downloads"
    puid                    = 1000
    pgid                    = 1000
    nginx_ingress_class     = "nginx"
    certificate_issuer_name = "letsencrypt-production"
  }
  assert {
    condition     = kubernetes_namespace_v1.radarr.metadata[0].name == "radarr" && length(kubernetes_persistent_volume_v1.radarr) == 3
    error_message = "Radarr must keep its namespace and three existing volumes."
  }
  assert {
    condition     = alltrue([for v in kubernetes_persistent_volume_v1.radarr : v.spec[0].persistent_volume_reclaim_policy == "Retain"]) && kubernetes_persistent_volume_v1.radarr["media"].spec[0].persistent_volume_source[0].host_path[0].path == "/mnt/HDD3/jellyfin/media"
    error_message = "Radarr must retain the existing shared media directory without copying or deleting data."
  }
  assert {
    condition     = kubernetes_persistent_volume_v1.radarr["downloads"].spec[0].persistent_volume_source[0].host_path[0].path == "/mnt/HDD3/downloads"
    error_message = "Radarr downloads must keep the host directory shared with SABnzbd."
  }
}

run "preserve_wizarr_claim" {
  command = plan
  module { source = "./wizarr" }
  variables {
    image_version           = "v2026.10.1"
    hostname                = "invite.hollyfilms.chbrx.com"
    pvc_size                = "2Gi"
    storage_class_name      = "local-path"
    puid                    = 1000
    pgid                    = 1000
    nginx_ingress_class     = "nginx"
    certificate_issuer_name = "letsencrypt-production"
  }
  assert {
    condition     = kubernetes_namespace_v1.wizarr.metadata[0].name == "wizarr" && kubernetes_persistent_volume_claim_v1.data.metadata[0].name == "wizarr-data" && kubernetes_persistent_volume_claim_v1.data.spec[0].storage_class_name == "local-path" && !kubernetes_persistent_volume_claim_v1.data.wait_until_bound
    error_message = "Wizarr must retain the original local-path claim; recreating it would allocate an empty volume."
  }
}
