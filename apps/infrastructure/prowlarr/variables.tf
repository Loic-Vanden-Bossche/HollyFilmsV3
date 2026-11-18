variable "image_version" {
  description = "Pinned LinuxServer Prowlarr image tag"
  type        = string
}

variable "hostname" {
  description = "Public hostname reserved for Prowlarr"
  type        = string
}

variable "ingress_enabled" {
  description = "Whether Prowlarr is exposed through the public TLS ingress"
  type        = bool
}

variable "config_host_path" {
  description = "Node host path used for Prowlarr configuration"
  type        = string
}

variable "puid" {
  description = "Linux user ID used by Prowlarr"
  type        = number
}

variable "pgid" {
  description = "Linux group ID used by Prowlarr"
  type        = number
}

variable "nginx_ingress_class" {
  description = "Ingress class used when Prowlarr public access is enabled"
  type        = string
}

variable "certificate_issuer_name" {
  description = "cert-manager ClusterIssuer used for the Prowlarr certificate"
  type        = string
}
