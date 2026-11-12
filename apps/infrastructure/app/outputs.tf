output "service_name" { value = kubernetes_service_v1.application.metadata[0].name }
output "migration_job" { value = kubernetes_job_v1.database_migration.metadata[0].name }
