variable "jellyfin_version" {
  description = "Stable LinuxServer Jellyfin image tag"
  type        = string
  default     = "12.4ubu2604-ls60"

  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+(?:\\.[0-9]+)?(?:ubu[0-9]+-ls[0-9]+)?$", var.jellyfin_version))
    error_message = "Use a pinned LinuxServer release tag such as 12.4ubu2604-ls59."
  }
}

variable "jellyfin_hostname" {
  description = "Public hostname used to expose Jellyfin"
  type        = string
  default     = "jellyfin.chbrx.com"

  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", var.jellyfin_hostname)) && var.jellyfin_hostname != var.hostname
    error_message = "The Jellyfin hostname must be a valid DNS hostname distinct from the frontend."
  }
}

variable "jellyfin_previous_hostname" {
  description = "Optional Jellyfin alias retained while clients move to the primary hostname"
  type        = string
  default     = null

  validation {
    condition = var.jellyfin_previous_hostname == null || (
      can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", var.jellyfin_previous_hostname))
      && var.jellyfin_previous_hostname != var.hostname && var.jellyfin_previous_hostname != var.jellyfin_hostname
    )
    error_message = "The previous Jellyfin hostname must be distinct from the active frontend and Jellyfin hostnames."
  }
}

variable "jellyfin_admin_google_enabled" {
  description = "Require the selected Google account on the public Jellyfin ingress"
  type        = bool
  default     = false

  validation {
    condition = !var.jellyfin_admin_google_enabled || (
      var.jellyfin_previous_hostname == null &&
      trimsuffix(var.jellyfin_url, "/") == "http://jellyfin.jellyfin.svc.cluster.local:8096"
    )
    error_message = "With Google protection, HollyFilms must use the internal Jellyfin Service and the previous public alias must be retired."
  }
}

variable "jellyfin_puid" {
  description = "Linux user ID used by the Jellyfin process"
  type        = number
  default     = 1000
}

variable "jellyfin_pgid" {
  description = "Linux group ID used by the Jellyfin process"
  type        = number
  default     = 1000
}

variable "jellyfin_home_defaults_api_key" {
  description = "Jellyfin API key used to apply the CHBRX home layout to new non-admin users; null or empty disables the automation"
  type        = string
  default     = null
  nullable    = true
  sensitive   = true
}

variable "jellyfin_enhanced_version" {
  description = "Pinned Jellyfin Enhanced plugin version compatible with Jellyfin 12"
  type        = string
  default     = "12.16.0.0"
}

variable "jellyfin_enhanced_checksum" {
  description = "MD5 checksum published in the Jellyfin Enhanced plugin catalog"
  type        = string
  default     = "588B840656D09418EBC61A47FBC2D42D"
}

variable "jellyfin_file_transformation_version" {
  description = "Pinned File Transformation plugin version compatible with Jellyfin"
  type        = string
  default     = "3.0.3.0"
}

variable "jellyfin_file_transformation_checksum" {
  description = "MD5 checksum published for the Jellyfin-specific File Transformation package"
  type        = string
  default     = "6FB4DDC8DC5324EA4E587F8549618748"
}

variable "jellyfin_tweaks_version" {
  description = "Pinned Jellyfin Tweaks plugin version compatible with Jellyfin 12"
  type        = string
  default     = "5.1.0.0"
}

variable "jellyfin_tweaks_checksum" {
  description = "MD5 checksum of the Jellyfin Tweaks archive for Jellyfin 12"
  type        = string
  default     = "6F3550040C7A3374338F66BE89ECFC91"
}

variable "radarr_version" {
  description = "Pinned LinuxServer Radarr image tag"
  type        = string
  default     = "7.0.3.10918-ls328"

  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+-ls[0-9]+$", var.radarr_version))
    error_message = "The Radarr version must be a LinuxServer tag such as 6.3.0.10514-ls312."
  }
}

variable "radarr_hostname" {
  description = "Public hostname used to expose Radarr"
  type        = string
  default     = "radarr.chbrx.com"
}

variable "radarr_ingress_enabled" {
  description = "Expose Radarr through the public TLS ingress after application authentication is configured"
  type        = bool
  default     = false
}

variable "radarr_config_host_path" {
  description = "Protected HDD3 host path used for Radarr configuration"
  type        = string
  default     = "/mnt/HDD3/radarr/config"
}

variable "radarr_media_host_path" {
  description = "HDD3 host path shared by Radarr and the Jellyfin media library"
  type        = string
  default     = "/mnt/HDD3/jellyfin/media"
}

variable "radarr_downloads_host_path" {
  description = "HDD3 host path reserved for the future download client"
  type        = string
  default     = "/mnt/HDD3/downloads"
}

variable "radarr_puid" {
  description = "Linux user ID used by Radarr"
  type        = number
  default     = 1000
}

variable "radarr_pgid" {
  description = "Linux group ID used by Radarr"
  type        = number
  default     = 1000
}

variable "seerr_version" {
  description = "Pinned official Seerr image release tag"
  type        = string
  default     = "v3.5.2"

  validation {
    condition     = can(regex("^v[0-9]+\\.[0-9]+\\.[0-9]+$", var.seerr_version))
    error_message = "The Seerr version must be a release tag such as v3.4.1."
  }
}

variable "seerr_hostname" {
  description = "Public hostname used to expose Seerr"
  type        = string
  default     = "seerr.chbrx.com"
}

variable "seerr_config_host_path" {
  description = "Protected HDD3 host path used for Seerr configuration"
  type        = string
  default     = "/mnt/HDD3/seerr/config"
}

variable "prowlarr_version" {
  description = "Pinned LinuxServer Prowlarr image tag"
  type        = string
  default     = "3.0.2.5780-ls169"

  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+-ls[0-9]+$", var.prowlarr_version))
    error_message = "The Prowlarr version must be a LinuxServer tag such as 2.5.2.5491-ls155."
  }
}

variable "prowlarr_hostname" {
  description = "Public hostname reserved for Prowlarr"
  type        = string
  default     = "prowlarr.chbrx.com"
}

variable "prowlarr_ingress_enabled" {
  description = "Expose Prowlarr through public TLS after application authentication is configured"
  type        = bool
  default     = false
}

variable "prowlarr_config_host_path" {
  description = "Protected HDD3 host path used for Prowlarr configuration"
  type        = string
  default     = "/mnt/HDD3/prowlarr/config"
}

variable "prowlarr_puid" {
  description = "Linux user ID used by Prowlarr"
  type        = number
  default     = 1000
}

variable "prowlarr_pgid" {
  description = "Linux group ID used by Prowlarr"
  type        = number
  default     = 1000
}

variable "sabnzbd_version" {
  description = "Pinned LinuxServer SABnzbd image tag"
  type        = string
  default     = "5.1.3-ls281"

  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+\\.[0-9]+-ls[0-9]+$", var.sabnzbd_version))
    error_message = "The SABnzbd version must be a LinuxServer tag such as 5.0.4-ls264."
  }
}

variable "sabnzbd_hostname" {
  description = "Public hostname reserved for SABnzbd"
  type        = string
  default     = "sabnzbd.chbrx.com"
}

variable "sabnzbd_ingress_enabled" {
  description = "Expose SABnzbd through public TLS after application authentication is configured"
  type        = bool
  default     = false
}

variable "sabnzbd_config_host_path" {
  description = "Protected HDD3 host path used for SABnzbd configuration"
  type        = string
  default     = "/mnt/HDD3/sabnzbd/config"
}

variable "sabnzbd_puid" {
  description = "Linux user ID used by SABnzbd"
  type        = number
  default     = 1000
}

variable "sabnzbd_pgid" {
  description = "Linux group ID used by SABnzbd"
  type        = number
  default     = 1000
}
