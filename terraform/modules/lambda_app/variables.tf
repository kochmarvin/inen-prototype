variable "project_name" {
  type = string
}

variable "function_name" {
  type = string
}

variable "execution_role_arn" {
  type = string
}

variable "image_uri" {
  type = string
}

variable "memory_mb" {
  type = number
}

variable "timeout_seconds" {
  type = number
}

variable "emotion_lambda_name" {
  type = string
}

variable "ml_timeout_ms" {
  type = string
}

variable "provisioned_concurrency" {
  type    = number
  default = 0
}
