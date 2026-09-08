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
  # The gateway is WebSocket-only; a plain GET returns a non-200 upgrade code,
  # so accept the WS handshake range. TODO: add a lightweight /health route to
  # the gateway and tighten this to "200".
  health_check {
    path    = "/"
    matcher = "200-499"
  }
}

# HTTP listener. In production, add an HTTPS (443) listener with an ACM cert and
# redirect 80 -> 443; kept as HTTP here so `apply` needs no pre-provisioned cert.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.control_api.arn
  }
}

resource "aws_lb_listener_rule" "media" {
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
