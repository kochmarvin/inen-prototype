output "function_name" {
  value = aws_lambda_function.this.function_name
}

output "function_arn" {
  value = aws_lambda_function.this.arn
}

output "invoke_arn" {
  description = "Target for API Gateway integration (alias only when provisioned concurrency is enabled)."
  value       = var.provisioned_concurrency > 0 ? aws_lambda_alias.live[0].invoke_arn : aws_lambda_function.this.invoke_arn
}

output "permission_arn" {
  description = "Lambda ARN to use in aws_lambda_permission (must match invoke target)."
  value       = var.provisioned_concurrency > 0 ? aws_lambda_alias.live[0].arn : aws_lambda_function.this.arn
}
