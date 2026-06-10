"""FastAPI inference service for facial emotion detection.

Loads the YOLO model once at startup and exposes a /predict endpoint that
takes a JPEG/PNG image and returns the dominant detected emotion together
with per-class scores.
"""

from __future__ import annotations

import io
import logging
import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import APIRouter, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from ultralytics import YOLO

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("ml-service")

MODEL_PATH = os.environ.get(
    "MODEL_PATH",
    os.path.join(os.path.dirname(__file__), "best.pt"),
)

MIN_CONFIDENCE = float(os.environ.get("MIN_CONFIDENCE", "0.25"))

state: dict[str, Any] = {"model": None, "names": {}}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_model_loaded()
    yield
    state.clear()


def ensure_model_loaded() -> None:
    if state.get("model") is not None:
        return
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(
            f"Model file not found at {MODEL_PATH}. "
            "Copy best.pt into ml-service/ or set MODEL_PATH."
        )
    log.info("Loading YOLO model from %s", MODEL_PATH)
    model = YOLO(MODEL_PATH)
    state["model"] = model
    state["names"] = (
        model.names
        if isinstance(model.names, dict)
        else {i: n for i, n in enumerate(model.names)}
    )
    log.info("Model loaded. Classes: %s", state["names"])


def predict_from_bytes(raw: bytes) -> dict[str, Any]:
    ensure_model_loaded()
    if not raw:
        raise ValueError("Empty image payload")

    try:
        pil_image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:
        raise ValueError(f"Invalid image: {exc}") from exc

    model: YOLO = state["model"]
    results = model.predict(pil_image, verbose=False, conf=MIN_CONFIDENCE)

    names: dict[int, str] = state["names"]
    per_class_max: dict[str, float] = {label: 0.0 for label in names.values()}
    detections: list[dict[str, Any]] = []

    if results:
        boxes = results[0].boxes
        if boxes is not None and len(boxes) > 0:
            cls_tensor = boxes.cls.cpu().tolist()
            conf_tensor = boxes.conf.cpu().tolist()
            xyxy = boxes.xyxy.cpu().tolist()
            for cls_idx, conf, box in zip(cls_tensor, conf_tensor, xyxy):
                label = names.get(int(cls_idx), str(int(cls_idx)))
                if conf > per_class_max[label]:
                    per_class_max[label] = float(conf)
                detections.append(
                    {
                        "emotion": label,
                        "confidence": float(conf),
                        "box": [float(v) for v in box],
                    }
                )

    if not detections:
        return {
            "emotion": None,
            "confidence": 0.0,
            "all_scores": per_class_max,
            "detections": [],
            "face_found": False,
        }

    top = max(detections, key=lambda d: d["confidence"])
    return {
        "emotion": top["emotion"],
        "confidence": top["confidence"],
        "all_scores": per_class_max,
        "detections": detections,
        "face_found": True,
    }


app = FastAPI(title="Emotion Inference Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok" if state.get("model") is not None else "loading",
        "classes": list(state.get("names", {}).values()),
    }


async def _predict_upload(image: UploadFile) -> dict[str, Any]:
    if state.get("model") is None:
        raise HTTPException(status_code=503, detail="Model is not ready yet")

    raw = await image.read()
    try:
        return predict_from_bytes(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/predict")
async def predict(image: UploadFile = File(...)) -> dict[str, Any]:
    return await _predict_upload(image)


emotion_router = APIRouter(prefix="/emotion")


@emotion_router.get("/health")
def emotion_health() -> dict[str, Any]:
    return health()


@emotion_router.post("/predict")
async def emotion_predict(image: UploadFile = File(...)) -> dict[str, Any]:
    return await _predict_upload(image)


app.include_router(emotion_router)
