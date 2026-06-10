output "api_id" {
  value = aws_apigatewayv2_api.http.id
}

output "api_endpoint" {
  description = "HTTP API invoke URL without trailing slash."
  value       = trimsuffix(aws_apigatewayv2_stage.default.invoke_url, "/")
}

output "api_domain_name" {
  description = "Host name for CloudFront custom origin (no scheme)."
  value       = trimprefix(trimsuffix(aws_apigatewayv2_stage.default.invoke_url, "/"), "https://")
}
