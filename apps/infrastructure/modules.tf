module "database" {
  source               = "./database"
  namespace            = kubernetes_namespace_v1.hollyfilms.metadata[0].name
  password             = var.database_password
  image                = var.database_image
  storage_size         = var.database_storage_size
  major_version        = var.database_major_version
  retain_legacy_volume = var.database_retain_legacy_volume
}

module "app" {
  source                   = "./app"
  depends_on               = [module.database]
  namespace                = kubernetes_namespace_v1.hollyfilms.metadata[0].name
  api_image                = var.api_image
  web_image                = var.web_image
  image_pull_policy        = var.image_pull_policy
  ghcr_credentials         = var.ghcr_credentials
  replicas                 = var.replicas
  database_secret_name     = module.database.secret_name
  database_secret_revision = module.database.secret_revision
  public_origin            = "https://${var.hostname}"
  jellyfin_url             = trimsuffix(var.jellyfin_url, "/")
  jellyfin_api_key         = var.jellyfin_api_key
  google                   = var.google
  web_push                 = var.web_push
  tmdb_api_token           = var.tmdb_api_token
  seerr                    = var.seerr
}

module "domain" {
  source                  = "./domain"
  namespace               = kubernetes_namespace_v1.hollyfilms.metadata[0].name
  hostname                = var.hostname
  ingress_class_name      = var.nginx_ingress_class
  certificate_issuer_name = var.certificate_issuer_name
  service_name            = module.app.service_name
  service_port_name       = "http"
}
