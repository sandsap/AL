# Al platform — AWS infrastructure skeleton (Terraform).
#
# This is a STARTING POINT, not a turnkey apply. It declares the shape of the
# production stack from ARCHITECTURE.md §5. Fill in networking (VPC/subnets),
# task definitions, and IAM before `terraform apply`. Review every resource and
# its cost before applying — this provisions billable AWS infrastructure.

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

# TODO (see ARCHITECTURE.md §5):
#   - aws_vpc / subnets / NAT / security groups
#   - aws_lb (ALB, WSS) for control-api and media-gateway
#   - aws_ecs_task_definition + aws_ecs_service per service
#   - aws_rds_cluster (Aurora Serverless v2 Postgres, pgvector)
#   - aws_elasticache_cluster (Redis)
#   - aws_iam_role task/exec roles (least privilege)
#   - CloudWatch log groups + alarms (p95 conversational latency SLO)
