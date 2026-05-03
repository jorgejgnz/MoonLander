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
