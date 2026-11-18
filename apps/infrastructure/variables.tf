variable "kubeconfig_path" {
  description = "Path to the kubeconfig file used to access the CHBRX Kubernetes cluster"
  type        = string
  default     = "~/.kube/config"
}

variable "namespace_name" {
  description = "Kubernetes namespace dedicated to the HollyFilms"
  type        = string
  default     = "hollyfilms-v3"

  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$", var.namespace_name))
    error_message = "The namespace must be a valid lowercase Kubernetes DNS label."
  }
}

variable "hostname" {
  description = "Public hostname used to expose the HollyFilms"
  type        = string
  default     = "hollyfilms-v3.chbrx.com"

  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", var.hostname))
    error_message = "The hostname must be a valid lowercase DNS hostname."
  }
}

variable "api_image" {
  description = "Image api versionnée, idéalement avec un digest sha256"
  type        = string
  validation {
    condition     = can(regex("(@sha256:[a-f0-9]{64}|:[A-Za-z0-9_][A-Za-z0-9_.-]*)$", var.api_image)) && !endswith(var.api_image, ":latest")
    error_message = "Fournir une image avec un tag de version explicite ou un digest ; latest est interdit."
  }
}

variable "web_image" {
  description = "Image web versionnée, idéalement avec un digest sha256"
  type        = string
  validation {
    condition     = can(regex("(@sha256:[a-f0-9]{64}|:[A-Za-z0-9_][A-Za-z0-9_.-]*)$", var.web_image)) && !endswith(var.web_image, ":latest")
    error_message = "Fournir une image avec un tag de version explicite ou un digest ; latest est interdit."
  }
}

variable "image_pull_policy" {
  description = "Kubernetes image pull policy used by the application and migration job"
  type        = string
  default     = "IfNotPresent"

  validation {
    condition     = contains(["Always", "IfNotPresent", "Never"], var.image_pull_policy)
    error_message = "The image pull policy must be Always, IfNotPresent, or Never."
  }
}

variable "ghcr_credentials" {
  description = "Optional GHCR credentials; leave null when the application image is public"
  type = object({
    username = string
    token    = string
  })
  default   = null
  nullable  = true
  sensitive = true
}

variable "replicas" {
  description = "Number of HollyFilms application replicas"
  type        = number
  default     = 1

  validation {
    condition     = var.replicas >= 1 && floor(var.replicas) == var.replicas
    error_message = "At least one application replica is required."
  }
}

variable "nginx_ingress_class" {
  description = "Ingress class provided by the CHBRX NGINX ingress controller"
  type        = string
  default     = "nginx"
}

variable "certificate_issuer_name" {
  description = "cert-manager ClusterIssuer used for the public TLS certificate"
  type        = string
  default     = "letsencrypt-production"
}

variable "database_password" {
  description = "Password for the HollyFilms PostgreSQL role"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.database_password) >= 16 && can(regex("^[A-Za-z0-9]+$", var.database_password))
    error_message = "The database password must contain at least 16 alphanumeric characters."
  }
}

variable "database_image" {
  description = "PostgreSQL image aligned with the canonical local compose environment"
  type        = string
  default     = "postgres:17-alpine"
}

variable "database_storage_size" {
  description = "Persistent storage requested for PostgreSQL"
  type        = string
  default     = "5Gi"
}

variable "kubeconfig_context" {
  description = "Contexte explicite du cluster cible ; null utilise le contexte courant"
  type        = string
  default     = null
}
variable "jellyfin_url" {
  description = "Origine du Jellyfin existant, accessible depuis les pods"
  type        = string
  default     = "https://hollyfilms.chbrx.com"
  validation {
    condition     = can(regex("^https?://[A-Za-z0-9.-]+(:[0-9]+)?/?$", var.jellyfin_url)) && trimsuffix(var.jellyfin_url, "/") != "https://${var.hostname}"
    error_message = "Jellyfin doit être une origine HTTP(S) distincte du frontend, sans chemin ni identifiants."
  }
}
variable "jellyfin_api_key" {
  description = "Clé serveur Jellyfin obligatoire, jamais transmise au frontend"
  type        = string
  sensitive   = true
  validation {
    condition     = length(trimspace(var.jellyfin_api_key)) > 0
    error_message = "La clé API Jellyfin est obligatoire."
  }
}
variable "tmdb_api_token" {
  type        = string
  sensitive   = true
  default     = ""
  description = "TMDB API Read Access Token, optionnel"
}
variable "seerr" {
  description = "Seerr existant : URL serveur et clé API, jamais transmis au navigateur"
  type        = object({ url = string, api_key = string })
  default     = null
  sensitive   = true
  validation {
    condition = var.seerr == null ? true : (
      can(regex("^https?://[A-Za-z0-9.-]+(:[0-9]+)?/?$", var.seerr.url)) &&
      length(trimspace(var.seerr.api_key)) > 0
    )
    error_message = "Seerr requiert une origine HTTP(S) valide et sa clé API."
  }
}
variable "google" {
  description = "Configuration Google complète ou null pour désactiver le SSO"
  type = object({
    client_id     = string
    client_secret = string
    password_key  = string
  })
  sensitive = true
  default   = null
  validation {
    condition = var.google == null ? true : (
      length(trimspace(var.google.client_id)) > 0 &&
      length(trimspace(var.google.client_secret)) > 0 &&
      can(regex("^[A-Za-z0-9+/]{43}=$", var.google.password_key))
    )
    error_message = "Google demande un client ID, un secret et une clé de 32 octets encodée en base64."
  }
}
