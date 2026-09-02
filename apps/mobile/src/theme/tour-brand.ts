/** Canonical Tour product tokens — keep aligned with web (#006ce5) and TourLogo mark (#4D8AE5). */

export const tourColors = {
  brand: "#006ce5",
  mark: "#4D8AE5",
  bg: "#f4f7fb",
  card: "#ffffff",
  text: "#101828",
  textSec: "#667085",
  textMuted: "#8a94a6",
  border: "rgba(16, 24, 40, 0.08)",
  green: "#16a34a",
  greenBg: "#eefaf3",
  amber: "#d97706",
  amberBg: "#fffbeb",
  red: "#b91c1c",
  redBg: "#fef2f2",
  // AI belongs to the Tour product, so it uses the primary blue rather than a
  // competing accent color.
  ai: "#006ce5",
  aiText: "#006ce5",
  aiBg: "#eaf3ff",
  aiBorder: "#bfdbfe",
  agent: "#006ce5",
  prospect: "#667085",
} as const;

export const tourRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const tourShadow = {
  card: "0 4px 12px rgba(16, 24, 40, 0.07)",
  fab: "0 8px 24px rgba(0, 108, 229, 0.28)",
  pressed: "0 2px 6px rgba(16, 24, 40, 0.06)",
} as const;

export function scoreColor(score: number) {
  if (score >= 75) return tourColors.green;
  if (score >= 50) return tourColors.amber;
  return tourColors.red;
}

export function scoreLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs work";
  return "Review";
}

/** @deprecated Use tourColors — kept for incremental App.tsx migration */
export const C = tourColors;
