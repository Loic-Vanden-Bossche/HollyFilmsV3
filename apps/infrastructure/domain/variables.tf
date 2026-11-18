variable "namespace" { type = string }
variable "hostname" { type = string }
variable "legacy_hostname" {
  type    = string
  default = null
}
variable "certificate_alias" {
  type    = string
  default = null
}
variable "tls_secret_name" {
  type    = string
  default = "hollyfilms-public-tls"
}
variable "ingress_class_name" { type = string }
variable "certificate_issuer_name" { type = string }
variable "service_name" { type = string }
variable "service_port_name" { type = string }
