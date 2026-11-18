variable "image_version" {
  description = "Wizarr container image release tag"
  type        = string
}

variable "hostname" {
  description = "Public hostname used to expose Wizarr"
  type        = string
}

variable "pvc_size" {
  description = "Persistent storage requested for Wizarr data"
  type        = string
}

variable "storage_class_name" {
  description = "Storage class used by the Wizarr persistent volume claim"
  type        = string
}

variable "puid" {
  description = "Linux user ID used by the Wizarr process"
  type        = number
}

variable "pgid" {
  description = "Linux group ID used by the Wizarr process"
  type        = number
}

variable "nginx_ingress_class" {
  description = "Ingress class used to expose Wizarr"
  type        = string
}

variable "certificate_issuer_name" {
  description = "cert-manager ClusterIssuer used for the Wizarr certificate"
  type        = string
}
