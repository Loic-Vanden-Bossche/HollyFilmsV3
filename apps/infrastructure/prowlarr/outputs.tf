output "public_url" {
  description = "Public URL of Prowlarr when enabled"
  value       = var.ingress_enabled ? "https://${var.hostname}" : null
}

output "internal_url" {
  description = "Internal Kubernetes URL of Prowlarr"
  value       = "http://prowlarr.prowlarr.svc.cluster.local:9696"
}
