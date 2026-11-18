variable "namespace" {
  description = "Kubernetes namespace in which to deploy PostgreSQL"
  type        = string
}

variable "password" {
  description = "Password for the hollyfilms PostgreSQL role"
  type        = string
  sensitive   = true
}

variable "image" {
  description = "PostgreSQL container image"
  type        = string
}

variable "storage_size" {
  description = "Persistent storage requested for PostgreSQL"
  type        = string
}

variable "major_version" {
  description = "Active PostgreSQL data format; a major switch requires a tested logical restore"
  type        = number
  default     = 18

  validation {
    condition     = contains([17, 18], var.major_version) && (var.major_version == 18 || var.retain_legacy_volume)
    error_message = "PostgreSQL 17 requires the retained legacy volume; PostgreSQL 18 uses its separate volume."
  }
}

variable "retain_legacy_volume" {
  description = "Retain the original PostgreSQL 17 PVC for rollback; never turn off on an upgraded installation without an explicit retirement"
  type        = bool
  default     = false
}

