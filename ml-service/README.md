# ML Service – Facial Emotion Inference

FastAPI service that loads the YOLO emotion-detection model (`best.pt`) and
exposes a `/predict` endpoint used by the Node.js backend.

## Setup

```bash
cd ml-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Copy the trained model into this folder (it must be named `best.pt`):

```bash
cp "../Facial Emotion Detection/best.pt" ./best.pt
```

Alternatively point at any location with the `MODEL_PATH` env var.

## Run

```bash
uvicorn app:app --host 0.0.0.0 --port 8001
```

## Endpoints

- `GET /health` – readiness + list of available emotion classes.
- `POST /predict` – multipart upload, field name `image` (JPEG/PNG). Returns:

```json
{
  "emotion": "happy",
  "confidence": 0.87,
  "all_scores": { "happy": 0.87, "neutral": 0.10, "...": 0.0 },
  "detections": [{ "emotion": "happy", "confidence": 0.87, "box": [x1, y1, x2, y2] }],
  "face_found": true
}
```

If no face is detected, `emotion` is `null` and `face_found` is `false`.
