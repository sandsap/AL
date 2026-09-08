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

variable "vpc_cidr" {
  type        = string
  default     = "10.20.0.0/16"
  description = "VPC CIDR block."
}

variable "image_tag" {
  type        = string
  default     = "latest"
  description = "Container image tag to deploy (push to ECR first)."
}

variable "task_cpu" {
  type        = string
  default     = "512"
  description = "Fargate task CPU units."
}

variable "task_memory" {
  type        = string
  default     = "1024"
  description = "Fargate task memory (MiB)."
}

variable "service_desired_count" {
  type        = number
  default     = 1
  description = "Number of tasks per service."
}

variable "postgres_version" {
  type        = string
  default     = "15.4"
  description = "Aurora PostgreSQL engine version (verify availability in region)."
}

variable "redis_node_type" {
  type        = string
  default     = "cache.t4g.micro"
  description = "ElastiCache Redis node type."
}

variable "certificate_arn" {
  type        = string
  default     = ""
  description = "ACM certificate ARN. When set, an HTTPS (443) listener is created and port 80 redirects to it (required for Twilio wss://). Empty = HTTP only (local/testing)."
}
