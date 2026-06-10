variable "project_name" {
  type = string
}

variable "app_lambda_invoke_arn" {
  type = string
}

variable "app_lambda_permission_arn" {
  description = "Function or alias ARN — must match the integration invoke target."
  type        = string
}

variable "emotion_lambda_invoke_arn" {
  type = string
}

variable "emotion_lambda_name" {
  type = string
}
