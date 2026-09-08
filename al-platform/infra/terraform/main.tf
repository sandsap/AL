# Al platform — AWS infrastructure (Terraform).
#
# Stack from ARCHITECTURE.md §5, split across files: network.tf (VPC), alb.tf,
# ecs-services.tf (Fargate), data.tf (Aurora + Redis), iam.tf, outputs.tf.
# This is intended to plan/apply, but REVIEW every resource and its cost first —
# it provisions billable AWS infrastructure (NAT, ALB, Aurora, Redis, Fargate).
# Not yet included (see README): HTTPS/ACM + 80->443 redirect, service
# autoscaling, remote state backend, WAF. Validate engine versions/node types in
# your region.

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # Recommended: remote state in S3 + DynamoDB lock (configure per environment).
  # backend "s3" {}
}

provider "aws" {
  region = var.aws_region
}

# --- Container registry for service images ---
resource "aws_ecr_repository" "services" {
  for_each             = toset(["control-api", "media-gateway"])
  name                 = "${var.project}-${each.key}"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

# --- ECS cluster (Fargate) for long-lived services ---
resource "aws_ecs_cluster" "main" {
  name = "${var.project}-cluster"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# --- Secrets (populate values out-of-band; never commit real secrets) ---
resource "aws_secretsmanager_secret" "app" {
  name = "${var.project}/app"
}

# --- Object store for recordings & transcripts ---
resource "aws_s3_bucket" "recordings" {
  bucket = "${var.project}-recordings-${var.env}"
}

resource "aws_s3_bucket_lifecycle_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id
  rule {
    id     = "archive-old-recordings"
    status = "Enabled"
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
}

# Implemented across the other files in this directory:
#   network.tf       VPC, public/private subnets, IGW, NAT, routes
#   alb.tf           ALB + target groups + listener (WSS-capable)
#   ecs-services.tf  Fargate task defs + services, log groups, service SG
#   data.tf          Aurora Serverless v2 Postgres, ElastiCache Redis
#   iam.tf           task execution + task roles (least privilege)
#   outputs.tf       ALB DNS, ECR URLs, DB/Redis endpoints
#
# Still to add before hardening for production:
#   - HTTPS listener (ACM cert) + 80->443 redirect
#   - aws_appautoscaling_* for ECS services (scale on concurrent calls)
#   - CloudWatch alarms for the p95 conversational-latency SLO
#   - enable pgvector extension via DB migration
#   - remote state backend (S3 + DynamoDB lock)
