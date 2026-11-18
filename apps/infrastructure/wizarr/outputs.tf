output "public_url" {
  description = "Public URL of the Wizarr invitation service"
  value       = "https://${var.hostname}"
}

output "internal_url" {
  description = "Internal Kubernetes URL of the Wizarr service"
  value       = "http://${kubernetes_service_v1.wizarr.metadata[0].name}.${kubernetes_namespace_v1.wizarr.metadata[0].name}.svc.cluster.local:5690"
}
