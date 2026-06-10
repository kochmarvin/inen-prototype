resource "aws_lambda_function" "this" {
  function_name = var.function_name
  role          = var.execution_role_arn
  package_type  = "Image"
  image_uri     = var.image_uri
  memory_size   = var.memory_mb
  timeout       = var.timeout_seconds

  environment {
    variables = {
      MODEL_PATH     = var.model_path
      MIN_CONFIDENCE = var.min_confidence
    }
  }
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = 14
}
