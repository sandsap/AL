# Al Platform — AWS infrastructure (Terraform)

Provisions the stack from `../../../ARCHITECTURE.md` §5 on AWS ECS Fargate.

> ⚠️ **Review and validate before applying.** This provisions **billable** AWS
> resources (NAT gateway, ALB, Aurora, Redis, Fargate tasks). It was authored but
> **not** run through `terraform validate`/`plan` in this environment — do that
> in your account first. Costs accrue while resources exist.

## Files

| File | What it creates |
|---|---|
| `main.tf` | providers, ECR repos, ECS cluster, app secret, S3 recordings bucket |
| `network.tf` | VPC, 2 public + 2 private subnets, IGW, NAT, route tables |
| `alb.tf` | internet-facing ALB, target groups, listener (WebSocket-capable) |
| `ecs-services.tf` | Fargate task definitions + services (control-api, media-gateway), log groups |
| `data.tf` | Aurora Serverless v2 Postgres, ElastiCache Redis, data security group |
| `iam.tf` | ECS task execution + task roles (least privilege) |
| `variables.tf` / `outputs.tf` | inputs and useful outputs |

## Deploy

```bash
# 0. Authenticate to AWS (your account) and pick a region.
terraform init
terraform validate
terraform plan -out tf.plan          # READ THIS CAREFULLY — check every resource + cost
terraform apply tf.plan

# 1. Put vendor keys in the created Secrets Manager secret (JSON), mirroring
#    ../../.env.example keys: ANTHROPIC_API_KEY, DEEPGRAM_API_KEY,
#    CARTESIA_API_KEY, STRIPE_SECRET_KEY, ...

# 2. Build + push images, then roll the services to that tag.
#    (aws ecr get-login-password ... | docker login; docker build/push to the
#     ECR URLs from `terraform output ecr_repository_urls`)
terraform apply -var="image_tag=<git-sha>"

# 3. Point Twilio's Media Streams URL at:  wss://$(terraform output -raw alb_dns_name)/media
```

## Before production

- **HTTPS**: add an ACM cert + a 443 listener and redirect 80→443 (the current
  listener is HTTP only so `apply` needs no pre-provisioned cert). Twilio Media
  Streams requires `wss://`, so terminate TLS at the ALB.
- **Autoscaling**: add `aws_appautoscaling_*` to scale ECS on concurrent calls.
- **Latency SLO**: CloudWatch alarms on p95 conversational latency.
- **pgvector**: enable the extension via a DB migration.
- **Remote state**: configure the S3 + DynamoDB backend (stub in `main.tf`).
- **Verify in-region**: `postgres_version` and `redis_node_type` availability.

## Teardown

```bash
terraform destroy   # removes everything and stops the billing
```
