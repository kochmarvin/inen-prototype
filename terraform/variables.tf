variable "project_name" {
  description = "Prefix for AWS resource names."
  type        = string
  default     = "ineni-emotion"
}

variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "eu-central-1"
}

variable "image_tag" {
  description = "Docker image tag pushed to ECR (run scripts/build-and-push.sh)."
  type        = string
  default     = "latest"
}

variable "app_lambda_memory_mb" {
  type    = number
  default = 1024
}

variable "emotion_lambda_memory_mb" {
  type    = number
  default = 3008
}

variable "lambda_timeout_seconds" {
  description = "Max 29 for API Gateway HTTP API integration."
  type        = number
  default     = 29
}

variable "app_provisioned_concurrency" {
  description = "Warm App-Lambda instances for stable in-memory /api/status. Requires enough account Lambda concurrency (unreserved pool >= 10). Use 0 on new/small accounts."
  type        = number
  default     = 0
}
