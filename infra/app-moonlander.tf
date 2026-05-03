# ─────────────────────────────────────────────
# S3 — Bucket privado, solo accesible por CloudFront
# ─────────────────────────────────────────────
resource "aws_s3_bucket" "app_moonlander" {
  bucket = "jorgejgnz-app-moonlander"
  tags   = { Project = "moonlander", ManagedBy = "terraform" }
}

resource "aws_s3_bucket_public_access_block" "app_moonlander" {
  bucket                  = aws_s3_bucket.app_moonlander.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "app_moonlander" {
  bucket = aws_s3_bucket.app_moonlander.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowCloudFront"
      Effect = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.app_moonlander.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.app_moonlander.arn
        }
      }
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.app_moonlander]
}

# ─────────────────────────────────────────────
# CloudFront — Origin Access Control
# ─────────────────────────────────────────────
resource "aws_cloudfront_origin_access_control" "app_moonlander" {
  name                              = "jorgejgnz-app-moonlander-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ─────────────────────────────────────────────
# CloudFront — Distribución propia de la app
# ─────────────────────────────────────────────
resource "aws_cloudfront_distribution" "app_moonlander" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  comment             = "moonlander.jorgejgnz.com"
  aliases             = ["moonlander.jorgejgnz.com"]

  origin {
    domain_name              = aws_s3_bucket.app_moonlander.bucket_regional_domain_name
    origin_id                = "S3-app-moonlander"
    origin_access_control_id = aws_cloudfront_origin_access_control.app_moonlander.id
  }

  default_cache_behavior {
    target_origin_id       = "S3-app-moonlander"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    # CachingOptimized — assets con hash en el nombre (JS, CSS, imágenes)
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  ordered_cache_behavior {
    path_pattern           = "*.html"
    target_origin_id       = "S3-app-moonlander"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    # CachingDisabled — index.html siempre fresco
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  viewer_certificate {
    # Reutiliza el certificado wildcard *.jorgejgnz.com leído como data source
    acm_certificate_arn      = data.aws_acm_certificate.wildcard.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  tags = { Project = "moonlander", ManagedBy = "terraform" }
}

# ─────────────────────────────────────────────
# Route53 — Subdominio apuntando a la distribución CloudFront
# ─────────────────────────────────────────────
resource "aws_route53_record" "app_moonlander" {
  zone_id = data.aws_route53_zone.website.zone_id
  name    = "moonlander.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.app_moonlander.domain_name
    zone_id                = aws_cloudfront_distribution.app_moonlander.hosted_zone_id
    evaluate_target_health = false
  }
}

# ─────────────────────────────────────────────
# IAM — Rol OIDC para que el repo pueda desplegar
# Reutiliza el OIDC provider leído como data source
# ─────────────────────────────────────────────
resource "aws_iam_role" "github_actions_app_moonlander" {
  name = "jorgejgnz-app-moonlander-github-actions"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRoleWithWebIdentity"
      Effect = "Allow"
      Principal = {
        Federated = data.aws_iam_openid_connect_provider.github.arn
      }
      Condition = {
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:jorgejgnz/MoonLander:*"
        }
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })

  tags = { Project = "moonlander", ManagedBy = "terraform" }
}

resource "aws_iam_role_policy" "github_actions_app_moonlander" {
  name = "jorgejgnz-app-moonlander-deploy-policy"
  role = aws_iam_role.github_actions_app_moonlander.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:ListBucket", "s3:DeleteObject"]
        Resource = [
          aws_s3_bucket.app_moonlander.arn,
          "${aws_s3_bucket.app_moonlander.arn}/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = [aws_cloudfront_distribution.app_moonlander.arn]
      }
    ]
  })
}

output "app_moonlander_role_arn" {
  description = "ARN del rol — guardar como AWS_ROLE_ARN en el repo de la app"
  value       = aws_iam_role.github_actions_app_moonlander.arn
}

output "app_moonlander_distribution_id" {
  description = "ID de la distribución CloudFront — guardar como CF_DISTRIBUTION_ID en el repo"
  value       = aws_cloudfront_distribution.app_moonlander.id
}

output "app_moonlander_bucket" {
  description = "Nombre del bucket S3 — guardar como S3_BUCKET_NAME en el repo"
  value       = aws_s3_bucket.app_moonlander.bucket
}
