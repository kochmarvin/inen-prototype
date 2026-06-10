import { app } from "./app.js";

const PORT = Number(process.env.PORT ?? 3000);
const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8001";

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  console.log(`API routes: /api/* (and /* in local dev)`);
  console.log(`Forwarding inference to ${process.env.EMOTION_LAMBDA_NAME || ML_SERVICE_URL}`);
});
