export function formatElapsed(seconds: number): string {
  const wholeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const mm = String(Math.floor(wholeSeconds / 60)).padStart(2, "0");
  const ss = String(wholeSeconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
