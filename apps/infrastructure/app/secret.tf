resource "kubernetes_secret_v1" "runtime" {
  metadata {
    name      = "hollyfilms-runtime"
    namespace = var.namespace
    labels    = local.labels
  }
  type = "Opaque"
  data = {
    JELLYFIN_API_KEY     = var.jellyfin_api_key
    GOOGLE_CLIENT_ID     = var.google == null ? "" : var.google.client_id
    GOOGLE_CLIENT_SECRET = var.google == null ? "" : var.google.client_secret
    GOOGLE_PASSWORD_KEY  = var.google == null ? "" : var.google.password_key
    TMDB_API_TOKEN       = var.tmdb_api_token
    SEERR_URL            = var.seerr == null ? "" : var.seerr.url
    SEERR_API_KEY        = var.seerr == null ? "" : var.seerr.api_key
  }
}
