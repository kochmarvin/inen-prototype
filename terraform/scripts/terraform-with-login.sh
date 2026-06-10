#!/usr/bin/env bash
# Bridge "aws login" credentials into the current shell for Terraform.
# Usage: ./scripts/terraform-with-login.sh [terraform args...]
# Example: ./scripts/terraform-with-login.sh apply -target=module.ecr -target=module.iam

set -euo pipefail

PROFILE="${AWS_PROFILE:-default}"
TF_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required" >&2
  exit 1
fi

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform is required" >&2
  exit 1
fi

echo "Exporting credentials from profile: ${PROFILE}"
# shellcheck disable=SC1090
eval "$(aws configure export-credentials --profile "${PROFILE}" --format env)"

echo "Caller identity:"
aws sts get-caller-identity

cd "$TF_DIR"
exec terraform "$@"
