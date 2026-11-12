locals {
  labels = {
    "app.kubernetes.io/name"      = "hollyfilms"
    "app.kubernetes.io/component" = "database"
  }

  name         = "hollyfilms"
  username     = "hollyfilms"
  service      = "hollyfilms-postgres"
  database_url = "postgresql://${local.username}:${var.password}@${local.service}:5432/${local.name}?schema=public"
}

