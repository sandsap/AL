output "alb_dns_name" {
  value       = aws_lb.main.dns_name
  description = "Public ALB hostname. Point Twilio's Media Streams URL at wss://<this>/media."
}

output "ecr_repository_urls" {
  value       = { for k, r in aws_ecr_repository.services : k => r.repository_url }
  description = "Push service images here before deploying."
}

output "postgres_endpoint" {
  value       = aws_rds_cluster.main.endpoint
  description = "Aurora writer endpoint."
}

output "redis_endpoint" {
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
  description = "Redis primary endpoint."
}

output "recordings_bucket" {
  value       = aws_s3_bucket.recordings.bucket
  description = "S3 bucket for call recordings/transcripts."
}
