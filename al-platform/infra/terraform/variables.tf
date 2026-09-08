variable "project" {
  type        = string
  default     = "al-platform"
  description = "Project/name prefix for resources."
}

variable "env" {
  type        = string
  default     = "prod"
  description = "Environment name (prod, staging)."
}

variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "Primary region. Keep real-time services co-located here."
}
