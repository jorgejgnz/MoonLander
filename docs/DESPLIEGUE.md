# Despliegue de la app

Guía para desplegar esta app como sitio estático bajo el dominio `jorgejgnz.com`, con su propio ciclo de vida (estado Terraform, bucket S3 y distribución CloudFront propios).

---

## Arquitectura

```
repo app (GitHub)
  └── .github/workflows/cd.yml  ← build + sync a S3 + invalidar CF
        │
        ▼
S3 bucket propio (jorgejgnz-app-moonlander)
        │
        ▼
CloudFront distribution propia
        │
        ▼
moonlander.jorgejgnz.com     ← subdominio bajo el certificado wildcard *.jorgejgnz.com
```

### Recursos compartidos (ya existen en AWS, no se crean)

Los siguientes recursos son gestionados por el repositorio de infraestructura principal (`PortfolioWeb`) y se **leen como `data` sources** desde este proyecto. No hace falta tocar PortfolioWeb:

| Recurso | Descripción |
|---|---|
| Certificado SSL wildcard `*.jorgejgnz.com` | ACM en `us-east-1` |
| OIDC provider de GitHub Actions | IAM, permite asumir roles sin Access Keys |
| Hosted zone de Route53 para `jorgejgnz.com` | DNS del dominio |
| Bucket de estado de Terraform `jorgejgnz-terraform-state` | S3, usado como backend |

---

## Estructura de la carpeta `infra/`

```
infra/
  main.tf          ← backend S3 + providers (eu-west-1 y us-east-1)
  shared.tf        ← data sources que leen los recursos compartidos de AWS
  app-moonlander.tf ← S3, CloudFront, Route53, IAM propios de esta app
```

---

## Infraestructura (única vez)

### `infra/main.tf`

```hcl
terraform {
  backend "s3" {
    bucket = "jorgejgnz-terraform-state"
    key    = "apps/moonlander/terraform.tfstate"
    region = "eu-west-1"
  }
}

provider "aws" {
  region = "eu-west-1"
}

# Alias necesario para leer el certificado ACM (CloudFront requiere us-east-1)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
```

### `infra/shared.tf`

```hcl
variable "domain_name" {
  description = "Dominio principal"
  type        = string
  default     = "jorgejgnz.com"
}

# Hosted zone de Route53 — ya existe, solo se lee
data "aws_route53_zone" "website" {
  name         = "${var.domain_name}."
  private_zone = false
}

# Certificado SSL (dominio principal jorgejgnz.com, incluye *.jorgejgnz.com como SAN)
# El data source busca por dominio principal, no por SANs
data "aws_acm_certificate" "wildcard" {
  provider    = aws.us_east_1
  domain      = var.domain_name
  most_recent = true
  statuses    = ["ISSUED"]
}

# OIDC provider de GitHub Actions — ya existe, solo se lee
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}
```

### `infra/app-moonlander.tf`

```hcl
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
          "token.actions.githubusercontent.com:sub" = "repo:jorgejgnz/GamifiedEbookReader:*"
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
```

---

## Aplicar la infraestructura

```powershell
cd infra
terraform init
terraform plan   # revisar antes de aplicar
terraform apply
```

Tras el apply, copiar los outputs como **Repository Secrets** en GitHub (`Settings > Secrets and variables > Actions`):

| Secret | Output de Terraform |
|---|---|
| `AWS_ROLE_ARN` | `app_moonlander_role_arn` |
| `S3_BUCKET_NAME` | `app_moonlander_bucket` |
| `CF_DISTRIBUTION_ID` | `app_moonlander_distribution_id` |

---

## GitHub Action de CD

El archivo `.github/workflows/cd.yml` se encarga del build y despliegue automático en cada push a `main`:

```yaml
name: CD

on:
  push:
    branches: [main]

concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    permissions:
      id-token: write
      contents: read

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: eu-west-1

      - name: Sync S3 — Assets con cache largo (JS, CSS, imágenes con hash)
        run: |
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET_NAME }} --delete \
            --exclude "*.html" \
            --cache-control "max-age=31536000, immutable"

      - name: Sync S3 — HTML sin cache
        run: |
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET_NAME }} \
            --include "*.html" \
            --cache-control "max-age=0, must-revalidate"

      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CF_DISTRIBUTION_ID }} \
            --paths "/*"
```

---

## Checklist de despliegue

- [ ] Crear `infra/main.tf`, `infra/shared.tf` e `infra/app-moonlander.tf`
- [ ] `terraform init` + `terraform plan` + `terraform apply` desde `infra/`
- [ ] Copiar los tres outputs como secrets en el repo de GitHub
- [ ] Crear `.github/workflows/cd.yml`
- [ ] Hacer push a `main` — el primer deploy se ejecuta automáticamente
- [ ] Verificar que `https://moonlander.jorgejgnz.com` carga correctamente

---

## Limitaciones conocidas

- **Certificado compartido:** El certificado wildcard `*.jorgejgnz.com` es gestionado por PortfolioWeb. Si caduca o se elimina desde allí, afecta a todas las apps. El `data source` solo lo lee; no lo destruirá un `terraform destroy` en este repo.
- **OIDC provider compartido:** Igual que el certificado — es leído, no gestionado.
- **Apps 100% estáticas:** Si la app necesita un backend dinámico (WebSockets, base de datos), debe desplegarse por separado (Lambda, ECS…) y no está cubierto aquí.
