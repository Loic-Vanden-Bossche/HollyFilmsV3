variable "jellyfin_version" {
  description = "Pinned LinuxServer Jellyfin image tag"
  type        = string
}

variable "hostname" {
  description = "Public hostname used to expose Jellyfin"
  type        = string
}

variable "nginx_ingress_class" {
  description = "Ingress class used to expose Jellyfin"
  type        = string
}

variable "certificate_issuer_name" {
  description = "cert-manager ClusterIssuer used for the Jellyfin certificate"
  type        = string
}

variable "puid" {
  description = "Linux user ID used by the LinuxServer Jellyfin process"
  type        = number
}

variable "pgid" {
  description = "Linux group ID used by the LinuxServer Jellyfin process"
  type        = number
}

variable "home_defaults_api_key" {
  description = "Jellyfin API key used to apply the default home layout to new non-admin users"
  type        = string
  default     = null
  nullable    = true
  sensitive   = true
}

variable "enhanced_version" {
  description = "Pinned Jellyfin Enhanced plugin version"
  type        = string
}

variable "enhanced_checksum" {
  description = "Published MD5 checksum of the Jellyfin Enhanced plugin archive"
  type        = string
}

variable "file_transform_version" {
  description = "Pinned File Transformation plugin version"
  type        = string
}

variable "file_transform_checksum" {
  description = "Published MD5 checksum of the File Transformation plugin archive"
  type        = string
}

variable "tweaks_version" {
  description = "Pinned Jellyfin Tweaks plugin version"
  type        = string
}

variable "tweaks_checksum" {
  description = "Published MD5 checksum of the Jellyfin Tweaks plugin archive"
  type        = string
}
