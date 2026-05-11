// Central mapping from raw YOLO emotion classes to the 3-step traffic light.
// Keep this the single source of truth so the frontend just consumes the
// `light` field and does not need its own emotion knowledge.

export const TRAFFIC_LIGHT = {
  GREEN: "green",
  YELLOW: "yellow",
  RED: "red",
};

const EMOTION_TO_LIGHT = {
  happy: TRAFFIC_LIGHT.GREEN,
  surprise: TRAFFIC_LIGHT.GREEN,
  neutral: TRAFFIC_LIGHT.YELLOW,
  sad: TRAFFIC_LIGHT.RED,
  angry: TRAFFIC_LIGHT.RED,
  fear: TRAFFIC_LIGHT.RED,
  disgust: TRAFFIC_LIGHT.RED,
};

export function emotionToLight(emotion) {
  if (!emotion) return null;
  return EMOTION_TO_LIGHT[emotion.toLowerCase()] ?? TRAFFIC_LIGHT.YELLOW;
}

// Pick the most frequent traffic-light value across a window of recent
// detections. Ties are broken by recency (later entries win).
export function smoothLight(window) {
  if (!window.length) return null;
  const counts = new Map();
  for (const entry of window) {
    if (!entry.light) continue;
    counts.set(entry.light, (counts.get(entry.light) ?? 0) + 1);
  }
  if (!counts.size) return null;
  let best = null;
  let bestCount = -1;
  for (const [light, count] of counts) {
    if (count >= bestCount) {
      best = light;
      bestCount = count;
    }
  }
  return best;
}
