output "public_url" {
  description = "Public URL of the Seerr request interface"
  value       = "https://${var.hostname}"
}

output "internal_url" {
  description = "Internal Kubernetes URL of Seerr"
  value       = "http://${kubernetes_service_v1.seerr.metadata[0].name}.${kubernetes_namespace_v1.seerr.metadata[0].name}.svc.cluster.local:5055"
}
