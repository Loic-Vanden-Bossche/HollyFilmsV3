mock_provider "kubernetes" {}

variables {
  api_image         = "ghcr.io/test/hollyfilms-api:v1"
  web_image         = "ghcr.io/test/hollyfilms-web:v1"
  database_password = "onlyForAnIsolatedTest123456789"
  jellyfin_api_key  = "fake-test-key"
  hostname          = "hollyfilms.chbrx.com"
  jellyfin_hostname = "jellyfin.chbrx.com"
  jellyfin_url      = "https://jellyfin.chbrx.com"
}

run "public_routes_and_isolation" {
  command = plan
  assert {
    condition     = output.url == "https://hollyfilms.chbrx.com" && output.google_callback_url == "https://hollyfilms.chbrx.com/api/auth/google/callback"
    error_message = "Le frontend et le retour Google doivent utiliser le nouveau domaine."
  }
  assert {
    condition     = kubernetes_namespace_v1.hollyfilms.metadata[0].name == "hollyfilms-v3"
    error_message = "Le namespace doit être dédié à la v3."
  }
}
run "reject_mutable_image" {
  command = plan
  variables { api_image = "ghcr.io/test/api:latest" }
  expect_failures = [var.api_image]
}
run "reject_proxy_loop" {
  command = plan
  variables { jellyfin_url = "https://hollyfilms.chbrx.com" }
  expect_failures = [var.jellyfin_url]
}
run "reject_overlapping_ingresses" {
  command = plan
  variables { jellyfin_previous_hostname = "hollyfilms.chbrx.com" }
  expect_failures = [var.jellyfin_previous_hostname]
}

run "reject_google_gate_with_public_upstream" {
  command = plan
  variables { jellyfin_admin_google_enabled = true }
  expect_failures = [var.jellyfin_admin_google_enabled]
}

run "issue_new_frontend_certificate_separately" {
  command = plan
  module { source = "./domain" }
  variables {
    namespace               = "hollyfilms-v3"
    hostname                = "hollyfilms-v3.chbrx.com"
    certificate_alias       = "hollyfilms.chbrx.com"
    tls_secret_name         = "hollyfilms-tls"
    ingress_class_name      = "nginx"
    certificate_issuer_name = "letsencrypt-production"
    service_name            = "hollyfilms"
    service_port_name       = "http"
  }
  assert {
    condition = tomap({
      for tls in kubernetes_ingress_v1.application.spec[0].tls : tls.secret_name => one(tls.hosts)
      }) == tomap({
      hollyfilms-tls        = "hollyfilms-v3.chbrx.com"
      hollyfilms-public-tls = "hollyfilms.chbrx.com"
    })
    error_message = "The new certificate must be independently issuable even if the previous DNS record has been retired."
  }
  assert {
    condition     = one(kubernetes_ingress_v1.application.spec[0].rule).host == "hollyfilms-v3.chbrx.com"
    error_message = "Pre-issuing the frontend certificate must not take over the old Jellyfin host."
  }
}

run "redirect_old_frontend_with_tls" {
  command = plan
  module { source = "./domain" }
  variables {
    namespace               = "hollyfilms-v3"
    hostname                = "hollyfilms.chbrx.com"
    legacy_hostname         = "hollyfilms-v3.chbrx.com"
    ingress_class_name      = "nginx"
    certificate_issuer_name = "letsencrypt-production"
    service_name            = "hollyfilms"
    service_port_name       = "http"
  }
  assert {
    condition     = toset(kubernetes_ingress_v1.application.spec[0].tls[0].hosts) == toset(["hollyfilms.chbrx.com", "hollyfilms-v3.chbrx.com"])
    error_message = "The frontend and its legacy redirect must share a certificate for both hostnames."
  }
  assert {
    condition     = kubernetes_ingress_v1.legacy_redirect[0].metadata[0].annotations["nginx.ingress.kubernetes.io/permanent-redirect"] == "https://hollyfilms.chbrx.com/"
    error_message = "The old frontend must redirect to the canonical homepage."
  }
}

run "private_images_and_runtime" {
  command = plan
  module { source = "./app" }
  variables {
    namespace                = "hollyfilms-v3"
    image_pull_policy        = "IfNotPresent"
    replicas                 = 1
    database_secret_name     = "hollyfilms-database"
    database_secret_revision = "fake-secret-revision"
    public_origin            = "https://hollyfilms.chbrx.com"
    jellyfin_url             = "https://jellyfin.chbrx.com"
    tmdb_api_token           = "fake-tmdb"
    seerr                    = { url = "https://seerr.example.com", api_key = "fake-seerr-key" }
    google                   = null
    web_push                 = { subject = "mailto:push@example.org", public_key = "fake-public", private_key = "fake-private" }
    ghcr_credentials         = { username = "test", token = "fake-registry" }
  }
  assert {
    condition     = length(kubernetes_deployment_v1.application.spec[0].template[0].spec[0].container) == 2 && kubernetes_service_v1.application.spec[0].port[0].port == 8080
    error_message = "Le service expose uniquement le web ; l’API reste derrière son proxy dans le même pod."
  }
  assert {
    condition     = length(kubernetes_secret_v1.registry) == 1 && kubernetes_job_v1.database_migration.wait_for_completion
    error_message = "Les images privées et l’attente des migrations doivent être configurées."
  }
  assert {
    condition     = kubernetes_job_v1.database_migration.spec[0].template[0].spec[0].container[0].command[3] == "deploy"
    error_message = "Le Job doit utiliser migrate deploy, jamais migrate dev."
  }
  assert {
    condition     = kubernetes_secret_v1.runtime.data["SEERR_URL"] == "https://seerr.example.com" && kubernetes_secret_v1.runtime.data["SEERR_API_KEY"] == "fake-seerr-key"
    error_message = "La clé Seerr doit être disponible uniquement dans le Secret runtime de l’API."
  }
  assert {
    condition     = length([for c in kubernetes_deployment_v1.application.spec[0].template[0].spec[0].container : c.name if c.name == "web" && length(c.env_from) == 0 && length(c.env) == 1]) == 1
    error_message = "Le conteneur web doit recevoir uniquement l’origine Jellyfin, sans Secret."
  }
  assert {
    condition     = kubernetes_deployment_v1.application.spec[0].template[0].metadata[0].annotations["checksum/web-proxy"] == sha256(kubernetes_config_map_v1.web_proxy.data["nginx.conf.template"])
    error_message = "Le proxy de production doit bloquer l’interface Jellyfin et redémarrer lors d’un changement de configuration."
  }
  assert {
    condition     = kubernetes_secret_v1.runtime.data["VAPID_PRIVATE_KEY"] == "fake-private" && kubernetes_secret_v1.runtime.data["VAPID_SUBJECT"] == "mailto:push@example.org"
    error_message = "Les paramètres VAPID doivent être injectés dans le Secret de l’API."
  }
}
