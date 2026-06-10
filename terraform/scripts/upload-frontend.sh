#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$TF_DIR"

BUCKET="$(terraform output -raw s3_frontend_bucket)"
DIST_ID="$(terraform output -raw cloudfront_distribution_id)"

echo "Building frontend (same-origin API via CloudFront /api)..."
cd "$ROOT/frontend"
npm ci
VITE_BACKEND_URL= npm run build

echo "Uploading to s3://${BUCKET} ..."
aws s3 sync dist/ "s3://${BUCKET}/" --delete

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"

echo "Frontend deployed. Open: $(terraform -chdir="$TF_DIR" output -raw cloudfront_url)"
