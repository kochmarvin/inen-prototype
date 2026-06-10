data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "emotion" {
  name               = "${var.project_name}-emotion-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "emotion_basic" {
  role       = aws_iam_role.emotion.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role" "app" {
  name               = "${var.project_name}-app-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "app_basic" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "app_invoke_emotion" {
  statement {
    sid    = "InvokeEmotionLambda"
    effect = "Allow"
    actions = [
      "lambda:InvokeFunction",
    ]
    resources = [
      "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${var.emotion_lambda_function_name}",
    ]
  }
}

resource "aws_iam_role_policy" "app_invoke_emotion" {
  name   = "${var.project_name}-invoke-emotion"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app_invoke_emotion.json
}
