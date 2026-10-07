export type MetricKind = "rating" | "difficulty" | "takeAgain";
export type MetricTone = "good" | "mid" | "bad";

// Shared by the schedule cards and the side panel so both color scores the same way.
export function metricTone(value: number, kind: MetricKind): MetricTone {
  if (kind === "rating") return value >= 4 ? "good" : value >= 3 ? "mid" : "bad";
  // low difficulty is good
  if (kind === "difficulty") return value <= 2.5 ? "good" : value <= 3.5 ? "mid" : "bad";
  return value >= 80 ? "good" : value >= 60 ? "mid" : "bad";
}

// Below this many ratings the averages swing too much to trust.
export const FEW_RATINGS = 5;
