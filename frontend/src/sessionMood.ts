import type { TrafficLight } from "./types";

export interface MoodCounts {
  green: number;
  yellow: number;
  red: number;
  total: number;
}

export interface SessionMoodSummary {
  counts: MoodCounts;
  overall: TrafficLight | null;
  label: string;
  detail: string;
}

export interface CompletedRound extends SessionMoodSummary {
  id: number;
  endedAt: number;
}

const LABELS: Record<TrafficLight, string> = {
  green: "positiv",
  yellow: "neutral",
  red: "negativ",
};

const OVERALL_LABELS: Record<TrafficLight, string> = {
  green: "Überwiegend positiv",
  yellow: "Überwiegend neutral",
  red: "Überwiegend negativ",
};

/** One entry per unique backend frame (keyed by receivedAt). */
export type SessionSamples = Map<number, TrafficLight>;

export function recordSessionSample(
  samples: SessionSamples,
  receivedAt: number,
  light: TrafficLight | null | undefined,
): SessionSamples {
  if (!light) return samples;
  if (samples.has(receivedAt)) return samples;

  const next = new Map(samples);
  next.set(receivedAt, light);
  return next;
}

export function summarizeSession(samples: SessionSamples): SessionMoodSummary | null {
  if (samples.size === 0) return null;

  const counts: MoodCounts = { green: 0, yellow: 0, red: 0, total: 0 };

  for (const [, light] of samples) {
    counts[light] += 1;
    counts.total += 1;
  }

  let overall: TrafficLight | null = null;
  let bestCount = -1;
  for (const light of ["green", "yellow", "red"] as TrafficLight[]) {
    if (counts[light] >= bestCount) {
      overall = light;
      bestCount = counts[light];
    }
  }

  if (!overall) return null;

  const pct = (n: number) => Math.round((n / counts.total) * 100);
  const detail = (["green", "yellow", "red"] as TrafficLight[])
    .filter((c) => counts[c] > 0)
    .map((c) => `${pct(counts[c])}% ${LABELS[c]}`)
    .join(" · ");

  return {
    counts,
    overall,
    label: OVERALL_LABELS[overall],
    detail,
  };
}

export function toCompletedRound(
  id: number,
  summary: SessionMoodSummary,
): CompletedRound {
  return {
    ...summary,
    id,
    endedAt: Date.now(),
  };
}

export function formatRoundTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
