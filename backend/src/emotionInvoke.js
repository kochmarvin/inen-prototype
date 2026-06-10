import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const EMOTION_LAMBDA_NAME = process.env.EMOTION_LAMBDA_NAME ?? "";
const ML_PREDICT_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS ?? 10_000);

const lambdaClient = new LambdaClient({});

/**
 * Invoke the emotion Lambda with a direct JSON payload (see ml-service/lambda_handler.py).
 */
export async function predictViaLambda(buffer, mimetype, originalname) {
  if (!EMOTION_LAMBDA_NAME) {
    throw new Error("EMOTION_LAMBDA_NAME is not configured");
  }

  const payload = {
    imageBase64: buffer.toString("base64"),
    contentType: mimetype || "image/jpeg",
    filename: originalname || "frame.jpg",
  };

  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: EMOTION_LAMBDA_NAME,
      Payload: Buffer.from(JSON.stringify(payload)),
    }),
  );

  if (response.FunctionError) {
    const errText = response.Payload
      ? Buffer.from(response.Payload).toString("utf8")
      : response.FunctionError;
    throw new Error(`emotion_lambda_error: ${errText}`);
  }

  const raw = Buffer.from(response.Payload).toString("utf8");
  const parsed = JSON.parse(raw);

  if (parsed.statusCode && parsed.statusCode >= 400) {
    let detail = parsed.body;
    try {
      detail = JSON.parse(parsed.body);
    } catch {
      // keep string body
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  if (parsed.body && typeof parsed.body === "string") {
    return JSON.parse(parsed.body);
  }

  return parsed;
}
