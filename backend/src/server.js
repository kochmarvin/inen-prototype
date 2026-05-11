import express from "express";
import cors from "cors";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";

import { emotionToLight, smoothLight } from "./emotionMapping.js";
import { appState } from "./state.js";

const PORT = Number(process.env.PORT ?? 3000);
const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8001";
const ML_PREDICT_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS ?? 10_000);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// 5 MB cap is plenty for a JPEG screenshot at reasonable quality.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    mlService: ML_SERVICE_URL,
    hasLatest: appState.latest !== null,
  });
});

app.post("/frame", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "missing 'image' file field" });
  }

  const receivedAt = Date.now();
  const form = new FormData();
  form.append("image", req.file.buffer, {
    filename: req.file.originalname || "frame.jpg",
    contentType: req.file.mimetype || "image/jpeg",
  });

  let mlResponse;
  try {
    mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, form, {
      headers: form.getHeaders(),
      timeout: ML_PREDICT_TIMEOUT_MS,
      maxBodyLength: Infinity,
    });
  } catch (err) {
    const detail = err.response?.data ?? err.message;
    console.error("[/frame] inference failed:", detail);
    return res.status(502).json({
      error: "inference_failed",
      detail,
    });
  }

  const { emotion, confidence, all_scores: allScores, face_found: faceFound } = mlResponse.data;
  const instantLight = emotionToLight(emotion);

  const entry = {
    emotion: emotion ?? null,
    confidence: typeof confidence === "number" ? confidence : 0,
    light: instantLight,
    allScores: allScores ?? {},
    faceFound: Boolean(faceFound),
    receivedAt,
    processedAt: Date.now(),
  };

  appState.push(entry);

  const smoothedLight = smoothLight(appState.getSmoothingWindow());

  res.json({
    ...entry,
    smoothedLight,
  });
});

app.get("/status", (_req, res) => {
  const latest = appState.latest;
  if (!latest) {
    return res.json({
      emotion: null,
      confidence: 0,
      light: null,
      smoothedLight: null,
      faceFound: false,
      allScores: {},
      receivedAt: null,
      ageMs: null,
    });
  }
  const smoothedLight = smoothLight(appState.getSmoothingWindow());
  res.json({
    emotion: latest.emotion,
    confidence: latest.confidence,
    light: latest.light,
    smoothedLight,
    faceFound: latest.faceFound,
    allScores: latest.allScores,
    receivedAt: latest.receivedAt,
    ageMs: Date.now() - latest.receivedAt,
  });
});

app.get("/history", (_req, res) => {
  res.json({ entries: appState.getHistory() });
});

app.use((err, _req, res, _next) => {
  console.error("[error]", err);
  res.status(500).json({ error: "internal_error", detail: err.message });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  console.log(`Forwarding inference to ${ML_SERVICE_URL}`);
});
