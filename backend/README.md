# Backend – Express Proxy + Traffic Light State

Express service that receives frames from the desktop app, forwards them to
the Python ML service, and exposes the current emotion / traffic-light value
to the React frontend.

## Setup

```bash
cd backend
npm install
```

## Run

```bash
npm run dev
```

Environment variables:

| Variable          | Default                | Purpose                            |
| ----------------- | ---------------------- | ---------------------------------- |
| `PORT`            | `3000`                 | HTTP port                          |
| `ML_SERVICE_URL`  | `http://localhost:8001`| Python inference service           |
| `ML_TIMEOUT_MS`   | `10000`                | Per-frame inference timeout        |

## Endpoints

All routes are mounted under `/api` (and duplicated at the root in local dev
without `AWS_LAMBDA_FUNCTION_NAME`):

- `POST /api/frame` (multipart, field `image`) – called by the desktop app.
- `GET /api/status` – current emotion / traffic light, polled by the frontend.
- `GET /api/history` – ring buffer of recent detections (last 120).
- `GET /api/health` – readiness check.

On AWS, the app Lambda sets `EMOTION_LAMBDA_NAME` and invokes the ML Lambda
directly. Locally, `ML_SERVICE_URL` (default `http://localhost:8001`) is used.

The emotion→traffic-light mapping lives in
[`src/emotionMapping.js`](src/emotionMapping.js):

- `happy`, `surprise` → green
- `neutral` → yellow
- `sad`, `angry`, `fear`, `disgust` → red

`smoothedLight` is the most frequent traffic-light value across the last 5
detections to avoid flicker.
