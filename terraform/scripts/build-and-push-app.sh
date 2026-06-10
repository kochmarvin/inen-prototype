#!/usr/bin/env bash
# Build and push only the app backend Lambda image (skip emotion ML).
exec "$(dirname "$0")/build-and-push.sh" app
