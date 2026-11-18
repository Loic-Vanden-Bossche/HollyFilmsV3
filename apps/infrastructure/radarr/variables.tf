variable "image_version" {
  description = "Pinned LinuxServer Radarr image tag"
  type        = string
}

variable "hostname" {
  description = "Public hostname used to expose Radarr"
  type        = string
}

variable "ingress_enabled" {
  description = "Whether Radarr is exposed through the public TLS ingress"
  type        = bool
}

variable "config_host_path" {
  description = "Node host path used for Radarr configuration"
  type        = string
}

variable "media_host_path" {
  description = "Node host path shared with the Jellyfin media library"
  type        = string
}

variable "downloads_host_path" {
  description = "Node host path reserved for downloads"
  type        = string
}

variable "puid" {
  description = "Linux user ID used by Radarr"
  type        = number
}

variable "pgid" {
  description = "Linux group ID used by Radarr"
  type        = number
}

variable "nginx_ingress_class" {
  description = "Ingress class used to expose Radarr"
  type        = string
}

variable "certificate_issuer_name" {
  description = "cert-manager ClusterIssuer used for the Radarr certificate"
  type        = string
}
