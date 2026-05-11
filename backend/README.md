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

- `POST /frame` (multipart, field `image`) – called by the desktop app.
- `GET /status` – current emotion / traffic light, polled by the frontend.
- `GET /history` – ring buffer of recent detections (last 120).
- `GET /health` – readiness check.

The emotion→traffic-light mapping lives in
[`src/emotionMapping.js`](src/emotionMapping.js):

- `happy`, `surprise` → green
- `neutral` → yellow
- `sad`, `angry`, `fear`, `disgust` → red

`smoothedLight` is the most frequent traffic-light value across the last 5
detections to avoid flicker.
