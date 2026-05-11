export type TrafficLight = "green" | "yellow" | "red";

export interface StatusResponse {
  emotion: string | null;
  confidence: number;
  light: TrafficLight | null;
  smoothedLight: TrafficLight | null;
  faceFound: boolean;
  allScores: Record<string, number>;
  receivedAt: number | null;
  ageMs: number | null;
}
