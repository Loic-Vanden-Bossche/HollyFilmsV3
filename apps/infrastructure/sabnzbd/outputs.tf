output "public_url" {
  description = "Public URL of SABnzbd when enabled"
  value       = var.ingress_enabled ? "https://${var.hostname}" : null
}

output "internal_url" {
  description = "Internal Kubernetes URL of SABnzbd"
  value       = "http://sabnzbd.sabnzbd.svc.cluster.local:8080"
}
