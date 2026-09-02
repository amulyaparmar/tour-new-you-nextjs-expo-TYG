function parseTimestampToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 2 && parts.every((n) => !isNaN(n))) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return -1;
}

export function isValidTimestamp(ts: string) {
  const parts = ts.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return false;
  if (parts.length === 2 && parts[1]! >= 60) return false;
  if (parts.length === 3 && (parts[1]! >= 60 || parts[2]! >= 60)) return false;
  return parseTimestampToSeconds(ts) >= 0;
}

const TIMESTAMP_PATTERN = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]|\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g;
const MARKDOWN_TIMESTAMP_LINK = /\[([^\]]*)\]\((#seek-\d+|\d{1,2}:\d{2}(?::\d{2})?)\)/g;
const PROTECTED_MARKDOWN_SEGMENT = /(```[\s\S]*?```|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/g;

function seekHref(seconds: number) {
  return `#seek-${seconds}`;
}

function linkifySegment(segment: string) {
  let result = segment.replace(MARKDOWN_TIMESTAMP_LINK, (match, label, ts) => {
    if (ts.startsWith("#seek-")) return match;
    if (!isValidTimestamp(ts)) return match;
    return `[${label}](${seekHref(parseTimestampToSeconds(ts))})`;
  });

  result = result.replace(TIMESTAMP_PATTERN, (match, bracketed, plain) => {
    const ts = (bracketed || plain) as string;
    if (!isValidTimestamp(ts)) return match;
    return `[${ts}](${seekHref(parseTimestampToSeconds(ts))})`;
  });

  return result;
}

export function linkifyTimestampsInMarkdown(content: string) {
  return content
    // Keep existing Markdown links intact. Re-linking a timestamp which is
    // already inside a link creates nested Markdown and makes it untappable
    // in the native renderer.
    .split(PROTECTED_MARKDOWN_SEGMENT)
    .map((segment) => (
      segment.startsWith("`") || /^\[[^\]]+\]\([^)]+\)$/.test(segment)
        ? segment
        : linkifySegment(segment)
    ))
    .join("");
}

export function parseSeekHref(href: string | undefined): number | null {
  if (!href) return null;
  if (href.startsWith("#seek-")) {
    const seconds = Number(href.slice("#seek-".length));
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  }
  if (href.startsWith("timestamp:")) {
    const seconds = Number(href.slice("timestamp:".length));
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  }
  if (isValidTimestamp(href)) return parseTimestampToSeconds(href);
  return null;
}

export type AiTextSegment =
  | { type: "text"; value: string }
  | { type: "seek"; label: string; seconds: number };

const SEEK_LINK_PATTERN = /\[([^\]]+)\]\(#seek-(\d+)\)/g;

export function parseAiTextSegments(content: string): AiTextSegment[] {
  const linked = linkifyTimestampsInMarkdown(content);
  const segments: AiTextSegment[] = [];
  let lastIndex = 0;

  for (const match of linked.matchAll(SEEK_LINK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "text", value: linked.slice(lastIndex, index) });
    }
    const seconds = Number(match[2]);
    if (Number.isFinite(seconds)) {
      segments.push({ type: "seek", label: match[1] ?? formatTs(seconds), seconds });
    }
    lastIndex = index + match[0].length;
  }

  if (lastIndex < linked.length) {
    segments.push({ type: "text", value: linked.slice(lastIndex) });
  }

  return segments.length ? segments : [{ type: "text", value: content }];
}

export function formatTs(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
