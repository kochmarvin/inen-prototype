output "app_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "emotion_repository_url" {
  value = aws_ecr_repository.emotion.repository_url
}
