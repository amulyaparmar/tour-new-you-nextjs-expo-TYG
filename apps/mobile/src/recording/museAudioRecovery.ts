export type MuseFileTurn = {
  turnId?: number;
  startMs?: number;
  endMs?: number;
  transcript?: string;
  speaker?: string;
};

export type MuseFileResponse = {
  sessionId?: string;
  transcript?: string;
  audioDurationMs?: number;
  turns?: MuseFileTurn[];
};

const WAV_HEADER_BYTES = 44;

export function createPcm16WavHeader(
  dataBytes: number,
  sampleRate = 16_000,
  channels = 1,
) {
  const header = new Uint8Array(WAV_HEADER_BYTES);
  const view = new DataView(header.buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      header[offset + index] = value.charCodeAt(index);
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataBytes, true);
  return header;
}

export function recoveredLinesFromResponse(
  response: MuseFileResponse,
  gapId: string,
  gapStartMs: number,
) {
  return (response.turns ?? []).flatMap((turn, index) => {
    const text = typeof turn.transcript === "string" ? turn.transcript.trim() : "";
    if (!text) return [];
    const relativeStartMs = Number.isFinite(turn.startMs) ? Number(turn.startMs) : 0;
    const label = typeof turn.speaker === "string" ? turn.speaker.trim().toUpperCase() : "";
    return [{
      id: `muse-recovery-${gapId}-${turn.turnId ?? index}`,
      speaker: label ? `Speaker ${label}` : "Speaker",
      text,
      time: Math.max(0, gapStartMs + relativeStartMs) / 1_000,
    }];
  });
}
