output "aws_region" {
  value = var.aws_region
}

output "cloudfront_url" {
  description = "Public HTTPS URL for the web app (open in browser)."
  value       = "https://${module.frontend.cloudfront_domain_name}"
}

output "cloudfront_domain_name" {
  value = module.frontend.cloudfront_domain_name
}

output "api_endpoint" {
  description = "API Gateway HTTP API base URL (no trailing slash)."
  value       = module.api.api_endpoint
}

output "desktop_backend_url" {
  description = "Set this in the desktop app Backend URL field."
  value       = "https://${module.frontend.cloudfront_domain_name}/api"
}

output "s3_frontend_bucket" {
  value = module.frontend.bucket_id
}

output "ecr_app_repository_url" {
  value = module.ecr.app_repository_url
}

output "ecr_emotion_repository_url" {
  value = module.ecr.emotion_repository_url
}

output "cloudfront_distribution_id" {
  value = module.frontend.cloudfront_distribution_id
}
