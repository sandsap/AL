# Data stores: Aurora Serverless v2 Postgres (relational + pgvector) and
# ElastiCache Redis (live call/session state). Both private-subnet only.

resource "aws_security_group" "data" {
  name        = "${local.name}-data"
  description = "Postgres + Redis from ECS tasks only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres from services"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.service.id]
  }
  ingress {
    description     = "Redis from services"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.service.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# --- Aurora Serverless v2 Postgres ---
resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_rds_cluster" "main" {
  cluster_identifier     = "${local.name}-pg"
  engine                 = "aurora-postgresql"
  engine_mode            = "provisioned"
  engine_version         = var.postgres_version
  database_name          = "al"
  master_username        = "al_admin"
  manage_master_user_password = true
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.data.id]
  storage_encrypted      = true
  skip_final_snapshot    = var.env != "prod"

  serverlessv2_scaling_configuration {
    min_capacity = 0.5
    max_capacity = 4.0
  }
}

resource "aws_rds_cluster_instance" "main" {
  identifier         = "${local.name}-pg-1"
  cluster_identifier = aws_rds_cluster.main.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.main.engine
  engine_version     = aws_rds_cluster.main.engine_version
}

# --- ElastiCache Redis ---
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name}-redis"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "${local.name}-redis"
  description                = "Al live call/session state"
  engine                     = "redis"
  node_type                  = var.redis_node_type
  num_cache_clusters         = 1
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.data.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
}
