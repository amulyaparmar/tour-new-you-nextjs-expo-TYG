export type TranscriptLine = {
  id: string;
  speaker: string;
  text: string;
  time: number;
  isInterim?: boolean;
};

export function speakerInitial(speaker: string) {
  if (speaker === "Prospect") return "P";
  if (speaker === "Agent") return "A";
  if (speaker === "Speaker") return "S";
  if (speaker.startsWith("Speaker ")) return speaker.slice("Speaker ".length, "Speaker ".length + 1);
  return "•";
}

function normalizedTranscript(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function transcriptsOverlap(a: TranscriptLine, b: TranscriptLine) {
  if (Math.abs(a.time - b.time) > 5) return false;
  const aText = normalizedTranscript(a.text);
  const bText = normalizedTranscript(b.text);
  if (!aText || !bText) return false;
  if (aText === bText) return true;

  const aWords = new Set(aText.split(" "));
  const bWords = new Set(bText.split(" "));
  const shorterSize = Math.min(aWords.size, bWords.size);
  const longerSize = Math.max(aWords.size, bWords.size);
  if (!shorterSize) return false;

  let shared = 0;
  for (const word of aWords) if (bWords.has(word)) shared += 1;

  // One-word replies must match exactly. For short phrases, require every word
  // from the shorter result so reconnects do not merge merely similar replies.
  if (shorterSize === 1) return false;
  if (shorterSize <= 3) return shared === shorterSize && longerSize - shorterSize <= 2;
  return shared / shorterSize >= 0.72;
}

export function mergeTranscriptLines<TLocal extends TranscriptLine, TMuse extends TranscriptLine>(
  local: TLocal[],
  muse: TMuse[],
) {
  const matchedMuse = new Set<number>();
  const localWithoutMuseDuplicates = local.filter((localLine) => {
    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < muse.length; index += 1) {
      const museLine = muse[index];
      if (!museLine || matchedMuse.has(index) || !transcriptsOverlap(localLine, museLine)) continue;
      const distance = Math.abs(localLine.time - museLine.time);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }
    if (nearestIndex < 0) return true;
    matchedMuse.add(nearestIndex);
    return false;
  });
  return [...localWithoutMuseDuplicates, ...muse].sort((a, b) => a.time - b.time);
}
