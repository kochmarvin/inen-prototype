locals {
  name_prefix              = var.project_name
  emotion_lambda_name      = "${var.project_name}-emotion-ml"
  app_lambda_name          = "${var.project_name}-app-backend"
}

module "ecr" {
  source = "./modules/ecr"

  project_name = local.name_prefix
}

module "iam" {
  source = "./modules/iam"

  project_name                 = local.name_prefix
  emotion_lambda_function_name = local.emotion_lambda_name
}

module "lambda_emotion" {
  source = "./modules/lambda_emotion"

  project_name       = local.name_prefix
  function_name      = local.emotion_lambda_name
  execution_role_arn = module.iam.emotion_lambda_role_arn
  image_uri          = "${module.ecr.emotion_repository_url}:${var.image_tag}"
  memory_mb          = var.emotion_lambda_memory_mb
  timeout_seconds    = var.lambda_timeout_seconds
  model_path         = "/var/task/best.pt"
  min_confidence     = "0.25"
}

module "lambda_app" {
  source = "./modules/lambda_app"

  project_name            = local.name_prefix
  function_name           = local.app_lambda_name
  execution_role_arn      = module.iam.app_lambda_role_arn
  image_uri               = "${module.ecr.app_repository_url}:${var.image_tag}"
  memory_mb               = var.app_lambda_memory_mb
  timeout_seconds         = var.lambda_timeout_seconds
  emotion_lambda_name     = module.lambda_emotion.function_name
  ml_timeout_ms           = "15000"
  provisioned_concurrency = var.app_provisioned_concurrency
}

module "api" {
  source = "./modules/api"

  project_name              = local.name_prefix
  app_lambda_invoke_arn     = module.lambda_app.invoke_arn
  app_lambda_permission_arn = module.lambda_app.permission_arn
  emotion_lambda_invoke_arn = module.lambda_emotion.invoke_arn
  emotion_lambda_name       = module.lambda_emotion.function_name
}

module "frontend" {
  source = "./modules/frontend"

  project_name    = local.name_prefix
  api_domain_name = module.api.api_domain_name
}
