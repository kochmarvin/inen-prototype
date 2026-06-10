import axios from "axios";
import FormData from "form-data";

import { emotionToLight, smoothLight } from "./emotionMapping.js";
import { appState } from "./state.js";
import { predictViaLambda } from "./emotionInvoke.js";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8001";
const EMOTION_LAMBDA_NAME = process.env.EMOTION_LAMBDA_NAME ?? "";
const ML_PREDICT_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS ?? 10_000);

async function runInference(file) {
  if (EMOTION_LAMBDA_NAME) {
    return predictViaLambda(file.buffer, file.mimetype, file.originalname);
  }

  const form = new FormData();
  form.append("image", file.buffer, {
    filename: file.originalname || "frame.jpg",
    contentType: file.mimetype || "image/jpeg",
  });

  const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, form, {
    headers: form.getHeaders(),
    timeout: ML_PREDICT_TIMEOUT_MS,
    maxBodyLength: Infinity,
  });
  return mlResponse.data;
}

export function registerApiRoutes(router, { upload }) {
  router.get("/", (_req, res) => {
    res.json({ status: "ok", service: "emotion-backend" });
  });

  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      mlTarget: EMOTION_LAMBDA_NAME || ML_SERVICE_URL,
      hasLatest: appState.latest !== null,
    });
  });

  router.post("/frame", upload.single("image"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "missing 'image' file field" });
    }

    const receivedAt = Date.now();
    let mlData;
    try {
      mlData = await runInference(req.file);
    } catch (err) {
      const detail = err.response?.data ?? err.message;
      console.error("[/frame] inference failed:", detail);
      return res.status(502).json({
        error: "inference_failed",
        detail,
      });
    }

    const {
      emotion,
      confidence,
      all_scores: allScores,
      face_found: faceFound,
    } = mlData;
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

  router.get("/status", (_req, res) => {
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

  router.get("/history", (_req, res) => {
    res.json({ entries: appState.getHistory() });
  });
}
