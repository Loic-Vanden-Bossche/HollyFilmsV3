variable "namespace" { type = string }
variable "web_push" {
  type      = object({ subject = string, public_key = string, private_key = string })
  default   = null
  sensitive = true
}
variable "seerr" {
  type      = object({ url = string, api_key = string })
  default   = null
  sensitive = true
}
variable "api_image" { type = string }
variable "web_image" { type = string }
variable "image_pull_policy" { type = string }
variable "replicas" { type = number }
variable "database_secret_name" { type = string }
variable "database_secret_revision" {
  type      = string
  sensitive = true
}
variable "public_origin" { type = string }
variable "jellyfin_url" { type = string }
variable "jellyfin_api_key" {
  type      = string
  sensitive = true
}
variable "tmdb_api_token" {
  type      = string
  sensitive = true
}
variable "google" {
  type      = object({ client_id = string, client_secret = string, password_key = string })
  sensitive = true
  nullable  = true
}
variable "ghcr_credentials" {
  type      = object({ username = string, token = string })
  sensitive = true
  nullable  = true
}
