variable "image_version" {
  description = "Pinned official Seerr image release tag"
  type        = string
}

variable "hostname" {
  description = "Public hostname used to expose Seerr"
  type        = string
}

variable "config_host_path" {
  description = "Node host path used for Seerr configuration"
  type        = string
}

variable "nginx_ingress_class" {
  description = "Ingress class used to expose Seerr"
  type        = string
}

variable "certificate_issuer_name" {
  description = "cert-manager ClusterIssuer used for the Seerr certificate"
  type        = string
}
