variable "image_version" {
  description = "Pinned LinuxServer SABnzbd image tag"
  type        = string
}

variable "hostname" {
  description = "Public hostname reserved for SABnzbd"
  type        = string
}

variable "ingress_enabled" {
  description = "Whether SABnzbd is exposed through the public TLS ingress"
  type        = bool
}

variable "config_host_path" {
  description = "Node host path used for SABnzbd configuration"
  type        = string
}

variable "downloads_host_path" {
  description = "Node host path shared with Radarr for downloads"
  type        = string
}

variable "puid" {
  description = "Linux user ID used by SABnzbd"
  type        = number
}

variable "pgid" {
  description = "Linux group ID used by SABnzbd"
  type        = number
}

variable "nginx_ingress_class" {
  description = "Ingress class used when SABnzbd public access is enabled"
  type        = string
}

variable "certificate_issuer_name" {
  description = "cert-manager ClusterIssuer used for the SABnzbd certificate"
  type        = string
}
