output "jellyfin_url" {
  description = "Public URL of the Jellyfin server"
  depends_on  = [module.jellyfin]
  value       = module.jellyfin.url
}

output "radarr_url" {
  description = "Public URL of the Radarr administration interface"
  depends_on  = [module.radarr]
  value       = module.radarr.public_url
}

output "radarr_internal_url" {
  description = "Internal Kubernetes URL of Radarr"
  depends_on  = [module.radarr]
  value       = module.radarr.internal_url
}

output "seerr_url" {
  description = "Public URL of the Seerr request interface"
  depends_on  = [module.seerr]
  value       = module.seerr.public_url
}

output "seerr_internal_url" {
  description = "Internal Kubernetes URL of Seerr"
  depends_on  = [module.seerr]
  value       = module.seerr.internal_url
}

output "prowlarr_url" {
  description = "Public URL of Prowlarr when its ingress is enabled"
  depends_on  = [module.prowlarr]
  value       = module.prowlarr.public_url
}

output "prowlarr_internal_url" {
  description = "Internal Kubernetes URL of Prowlarr"
  depends_on  = [module.prowlarr]
  value       = module.prowlarr.internal_url
}

output "sabnzbd_url" {
  description = "Public URL of SABnzbd when its ingress is enabled"
  depends_on  = [module.sabnzbd]
  value       = module.sabnzbd.public_url
}

output "sabnzbd_internal_url" {
  description = "Internal Kubernetes URL of SABnzbd"
  depends_on  = [module.sabnzbd]
  value       = module.sabnzbd.internal_url
}
