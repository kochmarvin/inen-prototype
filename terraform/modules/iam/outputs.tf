output "emotion_lambda_role_arn" {
  value = aws_iam_role.emotion.arn
}

output "app_lambda_role_arn" {
  value = aws_iam_role.app.arn
}
