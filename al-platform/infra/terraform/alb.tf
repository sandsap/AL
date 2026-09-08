# Internet-facing ALB. Routes / to the control API and /media/* (WebSocket) to
# the media gateway. ALB natively supports WebSocket upgrades over the HTTP
# listener, so Twilio Media Streams connect straight through.

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "ALB ingress"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "main" {
  name               = "${local.name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "control_api" {
  name        = "${local.name}-api"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    path    = "/health"
    matcher = "200"
  }
}

resource "aws_lb_target_group" "media_gateway" {
  name        = "${local.name}-media"
  port        = 8081
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  # Gateway serves GET /health (200) alongside the WebSocket upgrade endpoint.
  health_check {
    path    = "/health"
    matcher = "200"
  }
}

locals {
  tls_enabled = var.certificate_arn != ""
}

# Port 80: forwards to the API when no cert is set (local/testing); redirects to
# 443 once a cert ARN is provided (Twilio Media Streams requires wss://).
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  dynamic "default_action" {
    for_each = local.tls_enabled ? [] : [1]
    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.control_api.arn
    }
  }
  dynamic "default_action" {
    for_each = local.tls_enabled ? [1] : []
    content {
      type = "redirect"
      redirect {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }
}

# Route /media(/*) to the gateway on whichever listener serves live traffic.
resource "aws_lb_listener_rule" "media_http" {
  count        = local.tls_enabled ? 0 : 1
  listener_arn = aws_lb_listener.http.arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.media_gateway.arn
  }
  condition {
    path_pattern {
      values = ["/media", "/media/*"]
    }
  }
}

# HTTPS listener — created only when a cert ARN is supplied.
resource "aws_lb_listener" "https" {
  count             = local.tls_enabled ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.control_api.arn
  }
}

resource "aws_lb_listener_rule" "media_https" {
  count        = local.tls_enabled ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.media_gateway.arn
  }
  condition {
    path_pattern {
      values = ["/media", "/media/*"]
    }
  }
}
