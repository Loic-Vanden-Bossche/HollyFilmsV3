output "public_url" {
  description = "Public URL of Radarr"
  value       = var.ingress_enabled ? "https://${var.hostname}" : null
}

output "internal_url" {
  description = "Internal Kubernetes URL of Radarr"
  value       = "http://radarr.radarr.svc.cluster.local:7878"
}
