#!/usr/bin/env bash
# Build Lambda-compatible images and push to ECR.
# Uses buildx with --provenance=false --sbom=false so AWS Lambda accepts the manifest
# (plain linux/amd64; no OCI index / attestations from Docker Desktop).
#
# Usage:
#   ./scripts/build-and-push.sh           # both images (default)
#   ./scripts/build-and-push.sh app       # app backend only
#   ./scripts/build-and-push.sh emotion   # emotion ML only
#   ./scripts/build-and-push-app.sh       # shortcut for app only
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE_TAG="${IMAGE_TAG:-latest}"
BUILDER_NAME="${BUILDER_NAME:-ineni-lambda-builder}"
TARGET="${1:-${BUILD_TARGET:-all}}"

cd "$TF_DIR"

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform is required" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

case "$TARGET" in
  all | app | emotion) ;;
  *)
    echo "Unknown target: ${TARGET} (use: all, app, emotion)" >&2
    exit 1
    ;;
esac

APP_REPO="$(terraform output -raw ecr_app_repository_url)"
EMOTION_REPO="$(terraform output -raw ecr_emotion_repository_url)"
AWS_REGION="${AWS_REGION:-$(terraform output -raw aws_region 2>/dev/null || true)}"
AWS_REGION="${AWS_REGION:-eu-central-1}"

if [[ "$TARGET" == "all" || "$TARGET" == "emotion" ]]; then
  if [[ ! -f "$ROOT/ml-service/best.pt" ]]; then
    echo "Missing $ROOT/ml-service/best.pt — copy the model first:" >&2
    echo '  cp "Facial Emotion Detection/best.pt" ml-service/best.pt' >&2
    exit 1
  fi
fi

if ! docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
  echo "Creating buildx builder: ${BUILDER_NAME}"
  docker buildx create --name "$BUILDER_NAME" --use
else
  docker buildx use "$BUILDER_NAME"
fi

echo "Logging in to ECR..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${APP_REPO%%/*}"

build_and_push() {
  local dockerfile="$1"
  local context="$2"
  local repo="$3"
  local label="$4"

  echo "Building and pushing ${label} (linux/amd64, Lambda-compatible manifest)..."
  docker buildx build \
    --platform linux/amd64 \
    --provenance=false \
    --sbom=false \
    -f "$dockerfile" \
    -t "${repo}:${IMAGE_TAG}" \
    --push \
    "$context"
}

PUSHED=()

if [[ "$TARGET" == "all" || "$TARGET" == "emotion" ]]; then
  build_and_push "$ROOT/ml-service/Dockerfile.lambda" "$ROOT/ml-service" "$EMOTION_REPO" "emotion Lambda"
  PUSHED+=("${EMOTION_REPO}:${IMAGE_TAG}")
fi

if [[ "$TARGET" == "all" || "$TARGET" == "app" ]]; then
  build_and_push "$ROOT/backend/Dockerfile.lambda" "$ROOT/backend" "$APP_REPO" "app backend Lambda"
  PUSHED+=("${APP_REPO}:${IMAGE_TAG}")
fi

echo ""
echo "Done (target: ${TARGET}). Run: cd terraform && terraform apply"
echo "Images pushed:"
for img in "${PUSHED[@]}"; do
  echo "  ${img}"
done
