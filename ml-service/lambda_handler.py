"""AWS Lambda entry: API Gateway (Mangum) or direct invoke from app backend."""

from __future__ import annotations

import base64
import json
import logging
from typing import Any

from mangum import Mangum

from app import app, predict_from_bytes

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("ml-lambda")

_mangum = Mangum(app, lifespan="on")


def _api_response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body),
    }


def _direct_invoke(event: dict[str, Any]) -> dict[str, Any]:
    raw_b64 = event.get("imageBase64")
    if not raw_b64:
        return _api_response(400, {"detail": "missing imageBase64"})

    try:
        raw = base64.b64decode(raw_b64)
    except Exception as exc:
        return _api_response(400, {"detail": f"invalid base64: {exc}"})

    try:
        result = predict_from_bytes(raw)
        return _api_response(200, result)
    except Exception as exc:
        log.exception("direct predict failed")
        return _api_response(500, {"detail": str(exc)})


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    if isinstance(event, dict) and "imageBase64" in event:
        return _direct_invoke(event)
    return _mangum(event, context)
