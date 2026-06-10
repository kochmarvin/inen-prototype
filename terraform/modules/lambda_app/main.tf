resource "aws_lambda_function" "this" {
  function_name = var.function_name
  role          = var.execution_role_arn
  package_type  = "Image"
  image_uri     = var.image_uri
  memory_size   = var.memory_mb
  timeout       = var.timeout_seconds
  publish       = var.provisioned_concurrency > 0

  environment {
    variables = {
      EMOTION_LAMBDA_NAME = var.emotion_lambda_name
      ML_TIMEOUT_MS       = var.ml_timeout_ms
      NODE_ENV            = "production"
    }
  }
}

resource "aws_lambda_alias" "live" {
  count = var.provisioned_concurrency > 0 ? 1 : 0

  name             = "live"
  description      = "Alias for provisioned concurrency"
  function_name    = aws_lambda_function.this.function_name
  function_version = aws_lambda_function.this.version
}

resource "aws_lambda_provisioned_concurrency_config" "this" {
  count = var.provisioned_concurrency > 0 ? 1 : 0

  function_name                     = aws_lambda_function.this.function_name
  provisioned_concurrent_executions = var.provisioned_concurrency
  qualifier                         = aws_lambda_alias.live[0].name
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = 14
}
