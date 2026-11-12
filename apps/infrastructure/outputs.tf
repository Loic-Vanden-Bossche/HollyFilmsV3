output "url" { value = "https://${var.hostname}" }
output "namespace" { value = kubernetes_namespace_v1.hollyfilms.metadata[0].name }
output "google_callback_url" { value = "https://${var.hostname}/api/auth/google/callback" }
output "database_service" { value = module.database.service_dns }
output "migration_job" { value = module.app.migration_job }
