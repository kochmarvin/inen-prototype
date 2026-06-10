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

variable "model_path" {
  type = string
}

variable "min_confidence" {
  type = string
}
