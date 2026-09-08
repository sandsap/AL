# ECS Fargate services for the control API and media gateway, behind the ALB.
# Both run in private subnets; egress via NAT. Images come from the ECR repos in
# main.tf (push a tag, then set var.image_tag).

resource "aws_security_group" "service" {
  name        = "${local.name}-service"
  description = "ECS tasks: ingress from ALB only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "From ALB"
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_cloudwatch_log_group" "services" {
  for_each          = toset(["control-api", "media-gateway"])
  name              = "/ecs/${local.name}/${each.key}"
  retention_in_days = 30
}

locals {
  services = {
    control-api = {
      port    = 8080
      command = ["node", "dist/server/control-api.js"]
      tg_arn  = aws_lb_target_group.control_api.arn
    }
    media-gateway = {
      port    = 8081
      command = ["node", "dist/server/media-gateway.js"]
      tg_arn  = aws_lb_target_group.media_gateway.arn
    }
  }
}

resource "aws_ecs_task_definition" "svc" {
  for_each                 = local.services
  family                   = "${local.name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = each.key
      image     = "${aws_ecr_repository.services[each.key].repository_url}:${var.image_tag}"
      command   = each.value.command
      essential = true
      portMappings = [{ containerPort = each.value.port, protocol = "tcp" }]
      environment = [
        { name = "PORT", value = "8080" },
        { name = "MEDIA_PORT", value = "8081" },
      ]
      # Inject vendor keys from Secrets Manager (JSON keys mapped per field).
      secrets = [
        { name = "ANTHROPIC_API_KEY", valueFrom = "${aws_secretsmanager_secret.app.arn}:ANTHROPIC_API_KEY::" },
        { name = "DEEPGRAM_API_KEY", valueFrom = "${aws_secretsmanager_secret.app.arn}:DEEPGRAM_API_KEY::" },
        { name = "CARTESIA_API_KEY", valueFrom = "${aws_secretsmanager_secret.app.arn}:CARTESIA_API_KEY::" },
        { name = "STRIPE_SECRET_KEY", valueFrom = "${aws_secretsmanager_secret.app.arn}:STRIPE_SECRET_KEY::" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.services[each.key].name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = each.key
        }
      }
    }
  ])
}

resource "aws_ecs_service" "svc" {
  for_each        = local.services
  name            = each.key
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.svc[each.key].arn
  desired_count   = var.service_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = each.value.tg_arn
    container_name   = each.key
    container_port   = each.value.port
  }

  depends_on = [aws_lb_listener.http]
}
