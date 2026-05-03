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
