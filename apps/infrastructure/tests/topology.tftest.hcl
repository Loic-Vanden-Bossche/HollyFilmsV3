mock_provider "kubernetes" {}

variables {
  api_image         = "ghcr.io/test/hollyfilms-api:v1"
  web_image         = "ghcr.io/test/hollyfilms-web:v1"
  database_password = "onlyForAnIsolatedTest123456789"
  jellyfin_api_key  = "fake-test-key"
}

run "public_routes_and_isolation" {
  command = plan
  assert {
    condition     = output.url == "https://hollyfilms-v3.chbrx.com" && output.google_callback_url == "https://hollyfilms-v3.chbrx.com/api/auth/google/callback"
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
  variables { jellyfin_url = "https://hollyfilms-v3.chbrx.com" }
  expect_failures = [var.jellyfin_url]
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
    public_origin            = "https://hollyfilms-v3.chbrx.com"
    jellyfin_url             = "https://hollyfilms.chbrx.com"
    tmdb_api_token           = "fake-tmdb"
    seerr                    = { url = "https://seerr.example.com", api_key = "fake-seerr-key" }
    google                   = null
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
    error_message = "Le web ne doit recevoir aucun Secret ; seulement l’origine publique de Jellyfin."
  }
}
