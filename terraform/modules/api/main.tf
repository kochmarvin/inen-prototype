resource "aws_apigatewayv2_api" "http" {
  name          = "${var.project_name}-http"
  protocol_type = "HTTP"

  cors_configuration {
    allow_credentials = false
    allow_headers     = ["*"]
    allow_methods     = ["GET", "POST", "OPTIONS"]
    allow_origins     = ["*"]
    max_age           = 300
  }
}

resource "aws_apigatewayv2_integration" "app" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.app_lambda_invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "emotion" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.emotion_lambda_invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "app_proxy" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "ANY /api/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.app.id}"
}

resource "aws_apigatewayv2_route" "app_root" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "ANY /api"
  target    = "integrations/${aws_apigatewayv2_integration.app.id}"
}

resource "aws_apigatewayv2_route" "emotion_proxy" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "ANY /emotion/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.emotion.id}"
}

resource "aws_apigatewayv2_route" "emotion_root" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "ANY /emotion"
  target    = "integrations/${aws_apigatewayv2_integration.emotion.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "app" {
  statement_id  = "AllowAPIGatewayInvokeApp"
  action        = "lambda:InvokeFunction"
  function_name = var.app_lambda_permission_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_lambda_permission" "emotion" {
  statement_id  = "AllowAPIGatewayInvokeEmotion"
  action        = "lambda:InvokeFunction"
  function_name = var.emotion_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}
