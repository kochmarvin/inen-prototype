// Lightweight E2E smoke test for the backend.
// Spawns a tiny mock ML service, starts the real backend pointed at it,
// posts a fake "frame", and checks /status returns the expected fields.
//
// Run with: node test/e2e.mjs

import http from "node:http";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const ML_PORT = 18001;
const BACKEND_PORT = 13000;
const SCRIPTED_RESPONSE = {
  emotion: "happy",
  confidence: 0.91,
  all_scores: { happy: 0.91, neutral: 0.05, sad: 0.02 },
  face_found: true,
};

function startMockMl() {
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/predict") {
      req.on("data", () => {});
      req.on("end", () => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(SCRIPTED_RESPONSE));
      });
      return;
    }
    res.writeHead(404).end();
  });
  return new Promise((resolve) => {
    server.listen(ML_PORT, () => resolve(server));
  });
}

async function postFrame() {
  const boundary = "----test" + Date.now();
  const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
  const parts = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="image"; filename="frame.jpg"\r\n`,
    `Content-Type: image/jpeg\r\n\r\n`,
  ].join("");
  const tail = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(parts), fakeJpeg, Buffer.from(tail)]);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method: "POST",
        host: "localhost",
        port: BACKEND_PORT,
        path: "/frame",
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          "content-length": body.length,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode, body: text });
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "localhost", port: BACKEND_PORT, path }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

let mlServer;
let backendProc;
try {
  mlServer = await startMockMl();
  backendProc = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(BACKEND_PORT),
      ML_SERVICE_URL: `http://localhost:${ML_PORT}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  backendProc.stderr.on("data", (c) => (stderr += c.toString()));
  backendProc.stdout.on("data", () => {});

  for (let i = 0; i < 30; i++) {
    try {
      const h = await getJson("/health");
      if (h.status === "ok") break;
    } catch {
      // not ready yet
    }
    await sleep(100);
  }

  const initial = await getJson("/status");
  if (initial.emotion !== null) throw new Error("expected initial emotion null");

  const frameRes = await postFrame();
  if (frameRes.status !== 200) {
    throw new Error(`POST /frame failed: ${frameRes.status} ${frameRes.body}`);
  }
  const frameJson = JSON.parse(frameRes.body);
  if (frameJson.emotion !== "happy") {
    throw new Error(`expected emotion happy, got ${frameJson.emotion}`);
  }
  if (frameJson.light !== "green") {
    throw new Error(`expected light green, got ${frameJson.light}`);
  }

  const status = await getJson("/status");
  if (status.emotion !== "happy" || status.smoothedLight !== "green") {
    throw new Error(`unexpected /status: ${JSON.stringify(status)}`);
  }
  if (status.ageMs === null || status.ageMs < 0) {
    throw new Error(`ageMs missing: ${JSON.stringify(status)}`);
  }

  console.log("E2E OK:", status);
} catch (err) {
  console.error("E2E FAILED:", err);
  process.exitCode = 1;
} finally {
  backendProc?.kill("SIGTERM");
  mlServer?.close();
}
