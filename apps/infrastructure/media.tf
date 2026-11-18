# Existing CHBRX media services: names, namespaces and storage paths are preserved.
# Shared NGINX, cert-manager and local-path remain owned by chbrx.tfstate.

module "jellyfin" {
  source = "./jellyfin"

  jellyfin_version        = var.jellyfin_version
  hostname                = var.jellyfin_hostname
  puid                    = var.jellyfin_puid
  pgid                    = var.jellyfin_pgid
  home_defaults_api_key   = var.jellyfin_home_defaults_api_key
  enhanced_version        = var.jellyfin_enhanced_version
  enhanced_checksum       = var.jellyfin_enhanced_checksum
  file_transform_version  = var.jellyfin_file_transformation_version
  file_transform_checksum = var.jellyfin_file_transformation_checksum
  tweaks_version          = var.jellyfin_tweaks_version
  tweaks_checksum         = var.jellyfin_tweaks_checksum
  nginx_ingress_class     = var.nginx_ingress_class
  certificate_issuer_name = var.certificate_issuer_name
}

module "wizarr" {
  source = "./wizarr"

  image_version           = var.wizarr_version
  hostname                = var.wizarr_hostname
  pvc_size                = var.wizarr_pvc_size
  storage_class_name      = var.wizarr_storage_class_name
  puid                    = var.wizarr_puid
  pgid                    = var.wizarr_pgid
  nginx_ingress_class     = var.nginx_ingress_class
  certificate_issuer_name = var.certificate_issuer_name
}

module "radarr" {
  source = "./radarr"

  image_version           = var.radarr_version
  hostname                = var.radarr_hostname
  ingress_enabled         = var.radarr_ingress_enabled
  config_host_path        = var.radarr_config_host_path
  media_host_path         = var.radarr_media_host_path
  downloads_host_path     = var.radarr_downloads_host_path
  puid                    = var.radarr_puid
  pgid                    = var.radarr_pgid
  nginx_ingress_class     = var.nginx_ingress_class
  certificate_issuer_name = var.certificate_issuer_name
}

module "seerr" {
  source     = "./seerr"
  depends_on = [module.jellyfin, module.radarr]

  image_version           = var.seerr_version
  hostname                = var.seerr_hostname
  config_host_path        = var.seerr_config_host_path
  nginx_ingress_class     = var.nginx_ingress_class
  certificate_issuer_name = var.certificate_issuer_name
}

module "prowlarr" {
  source     = "./prowlarr"
  depends_on = [module.radarr]

  image_version           = var.prowlarr_version
  hostname                = var.prowlarr_hostname
  ingress_enabled         = var.prowlarr_ingress_enabled
  config_host_path        = var.prowlarr_config_host_path
  puid                    = var.prowlarr_puid
  pgid                    = var.prowlarr_pgid
  nginx_ingress_class     = var.nginx_ingress_class
  certificate_issuer_name = var.certificate_issuer_name
}

module "sabnzbd" {
  source = "./sabnzbd"

  image_version           = var.sabnzbd_version
  hostname                = var.sabnzbd_hostname
  ingress_enabled         = var.sabnzbd_ingress_enabled
  config_host_path        = var.sabnzbd_config_host_path
  downloads_host_path     = var.radarr_downloads_host_path
  puid                    = var.sabnzbd_puid
  pgid                    = var.sabnzbd_pgid
  nginx_ingress_class     = var.nginx_ingress_class
  certificate_issuer_name = var.certificate_issuer_name
}
