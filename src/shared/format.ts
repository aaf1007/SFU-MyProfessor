// Score formatting shared by the schedule cards and the side panel so both
// surfaces show the same precision, units, and colour thresholds.

export type ScoreKind = "rating" | "difficulty" | "takeAgain";
export type ScoreTone = "good" | "mid" | "bad";

/** Number part only ("3.3", "53"); null when the score is unavailable. */
export const formatScoreValue = (value: number | null, kind: ScoreKind): string | null => {
  if (value === null) return null;
  return kind === "takeAgain" ? String(Math.round(value)) : value.toFixed(1);
};

export const scoreUnit = (kind: ScoreKind): string => (kind === "takeAgain" ? "%" : "/5");

/** Full display string ("3.3/5", "53%", "—"). */
export const formatScore = (value: number | null, kind: ScoreKind): string => {
  const formatted = formatScoreValue(value, kind);
  return formatted === null ? "—" : `${formatted}${scoreUnit(kind)}`;
};

export const scoreTone = (value: number | null, kind: ScoreKind): ScoreTone | null => {
  if (value === null) return null;
  if (kind === "rating") return value >= 4 ? "good" : value >= 3 ? "mid" : "bad";
  // Low difficulty is good.
  if (kind === "difficulty") return value <= 2.5 ? "good" : value <= 3.5 ? "mid" : "bad";
  return value >= 80 ? "good" : value >= 60 ? "mid" : "bad";
};

export const formatRatingCount = (count: number): string =>
  `${count.toLocaleString()} ${count === 1 ? "rating" : "ratings"}`;
