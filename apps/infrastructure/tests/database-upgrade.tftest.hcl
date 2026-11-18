mock_provider "kubernetes" {}

variables {
  namespace    = "hollyfilms-v3"
  password     = "onlyForAnIsolatedTest123456789"
  image        = "postgres:18.7-alpine"
  storage_size = "5Gi"
}

run "fresh_postgres_18" {
  command = plan
  module { source = "./database" }
  variables {
    major_version        = 18
    retain_legacy_volume = false
  }
  assert {
    condition     = length(kubernetes_persistent_volume_claim_v1.legacy_database) == 0 && kubernetes_persistent_volume_claim_v1.database_v18.metadata[0].name == "hollyfilms-postgres-18"
    error_message = "A fresh PostgreSQL 18 installation must use its own claim without creating a legacy database."
  }
  assert {
    condition     = kubernetes_deployment_v1.database.spec[0].template[0].spec[0].container[0].volume_mount[0].mount_path == "/var/lib/postgresql" && kubernetes_deployment_v1.database.spec[0].template[0].spec[0].container[0].env[0].value == "/var/lib/postgresql/18/docker"
    error_message = "PostgreSQL 18 must use its versioned data directory and parent volume mount."
  }
}

run "retain_postgres_17_rollback" {
  command = plan
  module { source = "./database" }
  variables {
    major_version        = 18
    retain_legacy_volume = true
  }
  assert {
    condition     = kubernetes_persistent_volume_claim_v1.legacy_database[0].metadata[0].name == "hollyfilms-postgres" && kubernetes_deployment_v1.database.spec[0].template[0].spec[0].volume[0].persistent_volume_claim[0].claim_name == "hollyfilms-postgres-18"
    error_message = "The old claim must retain its name and data while the active database uses the new claim."
  }
}

run "postgres_17_during_preparation" {
  command = plan
  module { source = "./database" }
  variables {
    image                = "postgres:17-alpine"
    major_version        = 17
    retain_legacy_volume = true
  }
  assert {
    condition     = kubernetes_deployment_v1.database.spec[0].template[0].spec[0].volume[0].persistent_volume_claim[0].claim_name == "hollyfilms-postgres" && kubernetes_deployment_v1.database.spec[0].template[0].spec[0].container[0].env[0].value == "/var/lib/postgresql/data/pgdata"
    error_message = "Preparation and rollback must keep PostgreSQL 17 on its original data directory."
  }
}
