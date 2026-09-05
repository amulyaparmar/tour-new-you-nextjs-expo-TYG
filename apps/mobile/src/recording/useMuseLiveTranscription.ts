import NetInfo from "@react-native-community/netinfo";
import { useAudioStream, type AudioStreamBuffer } from "expo-audio";
import { File, FileMode, Paths, type FileHandle } from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";

import type { TranscriptRange } from "./liveTranscript";
import {
  createPcm16WavHeader,
  recoveredLinesFromResponse,
  type MuseFileResponse,
} from "./museAudioRecovery";

export type RealtimeTranscriptionStatus = "idle" | "connecting" | "streaming" | "fallback";

export type RealtimeTranscriptLine = {
  id: string;
  speaker: string;
  text: string;
  time: number;
  isInterim?: boolean;
};

type MuseServerEvent = {
  type?: string;
  sessionId?: string;
  turnId?: number;
  transcript?: string;
  label?: string;
  audioProcessedMs?: number;
};

type OpenTurn = {
  startMs: number;
  speaker: string;
};

type BufferedAudio = {
  audio: ArrayBuffer;
  recordedAtMs: number;
};

type ActiveAudioGap = {
  id: string;
  file: File;
  handle: FileHandle;
  startMs: number;
  endMs: number;
  dataBytes: number;
};

type SealedAudioGap = Omit<ActiveAudioGap, "handle">;

const PCM_SAMPLE_RATE = 16_000;
const PCM_BYTES_PER_SECOND = PCM_SAMPLE_RATE * 2;
const PCM_CHUNK_BYTES = 3_200;
const PCM_SILENCE = new Uint8Array(PCM_CHUNK_BYTES);
const MAX_STARTUP_AUDIO_BYTES = PCM_BYTES_PER_SECOND * 2;
const MAX_RECOVERY_OVERLAP_BYTES = PCM_BYTES_PER_SECOND * 5;
const MAX_GAP_AUDIO_BYTES = PCM_BYTES_PER_SECOND * 9 * 60;
const MUSE_REALTIME_URL = "wss://api.meta.ai/v1/asr/realtime";
const MUSE_TRANSCRIBE_URL = "https://api.meta.ai/v1/asr/transcribe";
const MUSE_API_KEY = process.env.EXPO_PUBLIC_META_MODEL_API_KEY?.trim() ?? "";

export function useMuseLiveTranscription({
  enabled,
  sessionId,
  elapsed,
}: {
  enabled: boolean;
  sessionId: string | null;
  elapsed: number;
}) {
  const [status, setStatus] = useState<RealtimeTranscriptionStatus>("idle");
  const [internetAvailable, setInternetAvailable] = useState(true);
  const [captureFailed, setCaptureFailed] = useState(false);
  const [turns, setTurns] = useState<RealtimeTranscriptLine[]>([]);
  const [partial, setPartial] = useState<RealtimeTranscriptLine | null>(null);
  const [recoveredRanges, setRecoveredRanges] = useState<TranscriptRange[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const upstreamReadyRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const hasSentAudioRef = useRef(false);
  const lastAudioSentAtRef = useRef(0);
  const elapsedRef = useRef(elapsed);
  const sessionIdRef = useRef(sessionId);
  const internetAvailableRef = useRef(internetAvailable);
  const connectionOffsetMsRef = useRef(0);
  const connectionNumberRef = useRef(0);
  const gapNumberRef = useRef(0);
  const openTurnsRef = useRef(new Map<number, OpenTurn>());
  const activeTurnIdRef = useRef<number | null>(null);
  const partialTurnIdRef = useRef<number | null>(null);
  const startupAudioRef = useRef<BufferedAudio[]>([]);
  const startupAudioBytesRef = useRef(0);
  const recentAudioRef = useRef<BufferedAudio[]>([]);
  const recentAudioBytesRef = useRef(0);
  const captureGapRef = useRef(false);
  const activeGapRef = useRef<ActiveAudioGap | null>(null);
  const backfillQueueRef = useRef<SealedAudioGap[]>([]);
  const backfillInFlightRef = useRef(false);
  const backfillReadyRef = useRef(false);
  const backfillRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);

  elapsedRef.current = elapsed;
  sessionIdRef.current = sessionId;
  internetAvailableRef.current = internetAvailable;

  const createGap = useCallback((startMs: number): ActiveAudioGap | null => {
    try {
      gapNumberRef.current += 1;
      const id = `${Date.now()}-${gapNumberRef.current}`;
      const safeSessionId = (sessionIdRef.current ?? "local").replace(/[^a-zA-Z0-9_-]/g, "-");
      const file = new File(Paths.cache, `muse-gap-${safeSessionId}-${id}.wav`);
      file.create({ intermediates: true, overwrite: true });
      const handle = file.open(FileMode.ReadWrite);
      handle.writeBytes(createPcm16WavHeader(0));
      return { id, file, handle, startMs, endMs: startMs, dataBytes: 0 };
    } catch {
      return null;
    }
  }, []);

  const sealActiveGap = useCallback(() => {
    const gap = activeGapRef.current;
    activeGapRef.current = null;
    if (!gap) return null;

    try {
      if (gap.dataBytes === 0) {
        gap.handle.close();
        gap.file.delete();
        return null;
      }
      gap.handle.offset = 0;
      gap.handle.writeBytes(createPcm16WavHeader(gap.dataBytes));
      gap.handle.close();
      const sealed: SealedAudioGap = {
        id: gap.id,
        file: gap.file,
        startMs: gap.startMs,
        endMs: gap.endMs,
        dataBytes: gap.dataBytes,
      };
      backfillQueueRef.current.push(sealed);
      return sealed;
    } catch {
      try {
        gap.handle.close();
        if (gap.file.exists) gap.file.delete();
      } catch {
        // Best-effort cleanup; the normal recording remains the durable source.
      }
      return null;
    }
  }, []);

  const appendGapAudio = useCallback((item: BufferedAudio) => {
    const durationMs = item.audio.byteLength / (PCM_BYTES_PER_SECOND / 1_000);
    let gap = activeGapRef.current;
    if (!gap) {
      gap = createGap(item.recordedAtMs);
      activeGapRef.current = gap;
    }
    if (!gap) return;

    if (gap.dataBytes > 0 && gap.dataBytes + item.audio.byteLength > MAX_GAP_AUDIO_BYTES) {
      sealActiveGap();
      gap = createGap(item.recordedAtMs);
      activeGapRef.current = gap;
    }
    if (!gap) return;

    try {
      gap.handle.writeBytes(new Uint8Array(item.audio));
      gap.dataBytes += item.audio.byteLength;
      gap.endMs = Math.max(gap.endMs, item.recordedAtMs + durationMs);
    } catch {
      try {
        gap.handle.close();
        if (gap.file.exists) gap.file.delete();
      } catch {
        // Best-effort cleanup.
      }
      activeGapRef.current = null;
    }
  }, [createGap, sealActiveGap]);

  const beginGap = useCallback(() => {
    if (!MUSE_API_KEY || captureGapRef.current) return;
    captureGapRef.current = true;

    const pending = [...recentAudioRef.current, ...startupAudioRef.current]
      .sort((a, b) => a.recordedAtMs - b.recordedAtMs);
    recentAudioRef.current = [];
    recentAudioBytesRef.current = 0;
    startupAudioRef.current = [];
    startupAudioBytesRef.current = 0;
    for (const item of pending) appendGapAudio(item);
  }, [appendGapAudio]);

  const finishGap = useCallback(() => {
    captureGapRef.current = false;
    return sealActiveGap();
  }, [sealActiveGap]);

  const processBackfillQueue = useCallback(async () => {
    if (
      backfillInFlightRef.current
      || !backfillReadyRef.current
      || !internetAvailableRef.current
      || !MUSE_API_KEY
    ) {
      return;
    }

    backfillInFlightRef.current = true;
    const generation = generationRef.current;
    try {
      while (
        backfillQueueRef.current.length > 0
        && backfillReadyRef.current
        && internetAvailableRef.current
        && generation === generationRef.current
      ) {
        const gap = backfillQueueRef.current[0];
        if (!gap) break;
        let requestFile: File | null = null;

        try {
          requestFile = new File(Paths.cache, `muse-request-${gap.id}.json`);
          requestFile.create({ intermediates: true, overwrite: true });
          requestFile.write(JSON.stringify({
            mode: "DIARIZATION",
            model: "muse-voice-transcribe-1.0",
            audioEncoding: "WAV",
            languageBias: ["English"],
          }));

          const formData = new FormData();
          formData.append("request", {
            uri: requestFile.uri,
            type: "application/json",
            name: "request.json",
          } as unknown as Blob);
          formData.append("audio", {
            uri: gap.file.uri,
            type: "audio/wav",
            name: `muse-gap-${gap.id}.wav`,
          } as unknown as Blob);

          const response = await fetch(MUSE_TRANSCRIBE_URL, {
            method: "POST",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${MUSE_API_KEY}`,
            },
            body: formData,
          });
          const body = await response.json().catch(() => null) as MuseFileResponse | { message?: string } | null;
          if (!response.ok) {
            const message = body && "message" in body ? body.message : null;
            throw new Error(message || `Muse recovery failed (${response.status}).`);
          }
          if (generation !== generationRef.current) break;

          const recovered = recoveredLinesFromResponse(body as MuseFileResponse, gap.id, gap.startMs);
          const range = { start: gap.startMs / 1_000, end: gap.endMs / 1_000 };
          setTurns((current) => [
            ...current.filter((line) => line.time < range.start || line.time > range.end),
            ...recovered,
          ].sort((a, b) => a.time - b.time));
          setRecoveredRanges((current) => [...current, range].sort((a, b) => a.start - b.start));

          backfillQueueRef.current.shift();
          if (gap.file.exists) gap.file.delete();
        } catch {
          if (!backfillRetryRef.current && generation === generationRef.current) {
            backfillRetryRef.current = setTimeout(() => {
              backfillRetryRef.current = null;
              void processBackfillQueue();
            }, 5_000);
          }
          break;
        } finally {
          try {
            if (requestFile?.exists) requestFile.delete();
          } catch {
            // Best-effort cleanup.
          }
        }
      }
    } finally {
      backfillInFlightRef.current = false;
    }
  }, []);

  const handleAudioBuffer = useCallback((buffer: AudioStreamBuffer) => {
    if (buffer.sampleRate !== PCM_SAMPLE_RATE || buffer.channels !== 1) {
      setCaptureFailed(true);
      setStatus("fallback");
      return;
    }

    const audio = buffer.data.slice(0);
    if (!audio.byteLength) return;

    const socket = socketRef.current;
    const durationMs = audio.byteLength / (PCM_BYTES_PER_SECOND / 1_000);
    const recordedAtMs = Math.max(0, elapsedRef.current * 1_000 - durationMs);
    const item = { audio, recordedAtMs };

    if (captureGapRef.current) {
      appendGapAudio(item);
      return;
    }

    if (!upstreamReadyRef.current || socket?.readyState !== WebSocket.OPEN) {
      startupAudioRef.current.push(item);
      startupAudioBytesRef.current += audio.byteLength;
      while (
        startupAudioBytesRef.current > MAX_STARTUP_AUDIO_BYTES
        && startupAudioRef.current.length > 1
      ) {
        const removed = startupAudioRef.current.shift();
        startupAudioBytesRef.current -= removed?.audio.byteLength ?? 0;
      }
      return;
    }

    recentAudioRef.current.push(item);
    recentAudioBytesRef.current += audio.byteLength;
    while (
      recentAudioBytesRef.current > MAX_RECOVERY_OVERLAP_BYTES
      && recentAudioRef.current.length > 1
    ) {
      const removed = recentAudioRef.current.shift();
      recentAudioBytesRef.current -= removed?.audio.byteLength ?? 0;
    }

    if (!hasSentAudioRef.current) {
      hasSentAudioRef.current = true;
      connectionOffsetMsRef.current = recordedAtMs;
    }
    socket.send(audio);
    lastAudioSentAtRef.current = Date.now();
  }, [appendGapAudio]);

  const { stream: audioStream } = useAudioStream({
    sampleRate: PCM_SAMPLE_RATE,
    channels: 1,
    encoding: "int16",
    onBuffer: handleAudioBuffer,
  });

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      if (backfillRetryRef.current) clearTimeout(backfillRetryRef.current);
      try {
        activeGapRef.current?.handle.close();
        if (activeGapRef.current?.file.exists) activeGapRef.current.file.delete();
        for (const gap of backfillQueueRef.current) if (gap.file.exists) gap.file.delete();
      } catch {
        // Best-effort cleanup.
      }
    };
  }, []);

  const previousSessionIdRef = useRef(sessionId);
  useEffect(() => {
    const previousSessionId = previousSessionIdRef.current;
    previousSessionIdRef.current = sessionId;
    if (!previousSessionId || !sessionId || previousSessionId === sessionId) return;

    generationRef.current += 1;
    try {
      activeGapRef.current?.handle.close();
      if (activeGapRef.current?.file.exists) activeGapRef.current.file.delete();
      for (const gap of backfillQueueRef.current) if (gap.file.exists) gap.file.delete();
    } catch {
      // Best-effort cleanup for the previous session.
    }
    activeGapRef.current = null;
    backfillQueueRef.current = [];
    setTurns([]);
    setPartial(null);
    setRecoveredRanges([]);
    startupAudioRef.current = [];
    startupAudioBytesRef.current = 0;
    recentAudioRef.current = [];
    recentAudioBytesRef.current = 0;
    captureGapRef.current = false;
    hasConnectedRef.current = false;
    backfillReadyRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (enabled) return;
    setCaptureFailed(false);
    startupAudioRef.current = [];
    startupAudioBytesRef.current = 0;
    recentAudioRef.current = [];
    recentAudioBytesRef.current = 0;
    if (captureGapRef.current) finishGap();
    if (internetAvailableRef.current) {
      backfillReadyRef.current = true;
      void processBackfillQueue();
    }
  }, [enabled, finishGap, processBackfillQueue]);

  useEffect(() => NetInfo.addEventListener((state) => {
    const available = state.isConnected !== false && state.isInternetReachable !== false;
    internetAvailableRef.current = available;
    setInternetAvailable(available);
  }), []);

  useEffect(() => {
    if (!enabled || captureFailed || !MUSE_API_KEY) {
      setStatus(enabled ? "fallback" : "idle");
      setPartial(null);
      const socket = socketRef.current;
      socketRef.current = null;
      upstreamReadyRef.current = false;
      backfillReadyRef.current = !enabled && internetAvailable;
      socket?.close();
      return;
    }

    if (!internetAvailable) {
      upstreamReadyRef.current = false;
      backfillReadyRef.current = false;
      beginGap();
      setStatus("fallback");
      setPartial(null);
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close();
      return;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;

    const connect = async () => {
      if (!captureGapRef.current && !hasConnectedRef.current) setStatus("connecting");
      try {
        if (cancelled) return;

        const socket = new WebSocket(MUSE_REALTIME_URL);
        socket.binaryType = "arraybuffer";
        socketRef.current = socket;
        upstreamReadyRef.current = false;
        backfillReadyRef.current = false;
        hasSentAudioRef.current = false;
        connectionOffsetMsRef.current = 0;
        openTurnsRef.current.clear();
        activeTurnIdRef.current = null;
        partialTurnIdRef.current = null;
        connectionNumberRef.current += 1;
        const connectionNumber = connectionNumberRef.current;

        socket.onopen = () => {
          if (cancelled) return;
          socket.send(JSON.stringify({
            model: "muse-voice-transcribe-1.0",
            mode: "DIARIZATION",
            audioEncoding: "PCM_16KHZ",
            partialMode: "CUMULATIVE",
            emitAudioProgress: true,
            languageBias: ["English"],
            authorization: { accessToken: `Bearer ${MUSE_API_KEY}` },
          }));
        };

        socket.onmessage = (event) => {
          if (cancelled || typeof event.data !== "string") return;
          let message: MuseServerEvent;
          try {
            message = JSON.parse(event.data) as MuseServerEvent;
          } catch {
            return;
          }

          if (!message.type && message.sessionId) {
            upstreamReadyRef.current = true;
            backfillReadyRef.current = true;
            hasConnectedRef.current = true;
            reconnectAttempt = 0;
            setStatus("connecting");

            if (captureGapRef.current) {
              finishGap();
            } else {
              const buffered = startupAudioRef.current;
              startupAudioRef.current = [];
              startupAudioBytesRef.current = 0;
              for (const item of buffered) {
                if (socket.readyState !== WebSocket.OPEN) break;
                if (!hasSentAudioRef.current) {
                  hasSentAudioRef.current = true;
                  connectionOffsetMsRef.current = item.recordedAtMs;
                }
                socket.send(item.audio);
                lastAudioSentAtRef.current = Date.now();
              }
            }
            void processBackfillQueue();
            return;
          }

          const processedMs = Number.isFinite(message.audioProcessedMs)
            ? Number(message.audioProcessedMs)
            : 0;
          const timelineMs = connectionOffsetMsRef.current + processedMs;

          if (message.type === "audioProgress") {
            setStatus("streaming");
            return;
          }
          if (message.type === "speechStart" && Number.isFinite(message.turnId)) {
            const turnId = Number(message.turnId);
            activeTurnIdRef.current = turnId;
            openTurnsRef.current.set(turnId, {
              startMs: timelineMs,
              speaker: "Speaker",
            });
            return;
          }
          if (message.type === "speaker" && activeTurnIdRef.current !== null) {
            const turn = openTurnsRef.current.get(activeTurnIdRef.current);
            if (!turn) return;
            turn.speaker = speakerLabel(message.label);
            setPartial((current) => current ? { ...current, speaker: turn.speaker } : current);
            return;
          }
          if (message.type === "transcript" && typeof message.transcript === "string") {
            const turnId = activeTurnIdRef.current;
            const turn = turnId === null ? null : openTurnsRef.current.get(turnId);
            partialTurnIdRef.current = turnId;
            setPartial({
              id: `muse-${connectionNumber}-${turnId ?? "active"}`,
              speaker: turn?.speaker ?? "Speaker",
              text: message.transcript.trim(),
              time: Math.max(0, (turn?.startMs ?? timelineMs) / 1_000),
              isInterim: true,
            });
            return;
          }
          if (
            message.type === "speechComplete"
            && Number.isFinite(message.turnId)
            && typeof message.transcript === "string"
          ) {
            const turnId = Number(message.turnId);
            const turn = openTurnsRef.current.get(turnId);
            const completed: RealtimeTranscriptLine = {
              id: `muse-${connectionNumber}-${turnId}`,
              speaker: turn?.speaker ?? "Speaker",
              text: message.transcript.trim(),
              time: Math.max(0, (turn?.startMs ?? timelineMs) / 1_000),
            };
            if (completed.text) {
              setTurns((current) => {
                const withoutTurn = current.filter((item) => item.id !== completed.id);
                return [...withoutTurn, completed].sort((a, b) => a.time - b.time);
              });
            }
            openTurnsRef.current.delete(turnId);
            if (activeTurnIdRef.current === turnId) activeTurnIdRef.current = null;
            if (partialTurnIdRef.current === turnId) {
              partialTurnIdRef.current = null;
              setPartial(null);
            }
            return;
          }
          if (message.type === "error") {
            upstreamReadyRef.current = false;
            backfillReadyRef.current = false;
            beginGap();
            setStatus("fallback");
            partialTurnIdRef.current = null;
            setPartial(null);
            socket.close();
          }
        };

        socket.onerror = () => {
          if (cancelled) return;
          upstreamReadyRef.current = false;
          backfillReadyRef.current = false;
          beginGap();
          setStatus("fallback");
        };
        socket.onclose = () => {
          if (socketRef.current === socket) socketRef.current = null;
          upstreamReadyRef.current = false;
          backfillReadyRef.current = false;
          partialTurnIdRef.current = null;
          setPartial(null);
          if (cancelled) return;
          beginGap();
          setStatus("fallback");
          reconnectAttempt += 1;
          const delay = Math.min(10_000, 750 * 2 ** Math.min(reconnectAttempt, 4));
          reconnectTimer = setTimeout(() => void connect(), delay);
        };
      } catch {
        if (cancelled) return;
        upstreamReadyRef.current = false;
        backfillReadyRef.current = false;
        beginGap();
        setStatus("fallback");
        reconnectAttempt += 1;
        const delay = Math.min(10_000, 750 * 2 ** Math.min(reconnectAttempt, 4));
        reconnectTimer = setTimeout(() => void connect(), delay);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const socket = socketRef.current;
      if (socketRef.current === socket) socketRef.current = null;
      upstreamReadyRef.current = false;
      backfillReadyRef.current = false;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "endStream" }));
        setTimeout(() => {
          if (socket.readyState === WebSocket.OPEN) socket.close(1000, "Recording stopped");
        }, 1_000);
      } else {
        socket?.close();
      }
    };
  }, [
    beginGap,
    captureFailed,
    enabled,
    finishGap,
    internetAvailable,
    processBackfillQueue,
  ]);

  const streamStartedRef = useRef(false);

  useEffect(() => {
    if (!internetAvailable || !backfillReadyRef.current) return;
    void processBackfillQueue();
  }, [internetAvailable, processBackfillQueue]);

  const shouldCapture = enabled && !captureFailed;

  useEffect(() => {
    const stopIfStarted = () => {
      if (!streamStartedRef.current) return;
      streamStartedRef.current = false;
      try {
        audioStream.stop();
      } catch {
        // stop() can throw if Fast Refresh already released the native stream.
      }
    };

    if (!shouldCapture) {
      stopIfStarted();
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          await audioStream.start();
          if (cancelled) {
            try {
              audioStream.stop();
            } catch {
              // The start completed after unmount; the native object may already be gone.
            }
            return;
          }
          streamStartedRef.current = true;
        } catch {
          if (cancelled) return;
          streamStartedRef.current = false;
          try {
            audioStream.stop();
          } catch {
            // start() may have already released the native stream.
          }
          setCaptureFailed(true);
          setStatus("fallback");
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopIfStarted();
    };
  }, [audioStream, shouldCapture]);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      const socket = socketRef.current;
      if (
        !hasSentAudioRef.current
        || !upstreamReadyRef.current
        || socket?.readyState !== WebSocket.OPEN
        || Date.now() - lastAudioSentAtRef.current < 180
      ) {
        return;
      }
      socket.send(PCM_SILENCE.buffer);
      lastAudioSentAtRef.current = Date.now();
    }, 100);
    return () => clearInterval(interval);
  }, [enabled]);

  const shouldUseNativeFallback = enabled && status === "fallback";

  return {
    status,
    internetAvailable,
    shouldUseNativeFallback,
    turns,
    partial,
    recoveredRanges,
  };
}

function speakerLabel(label: unknown) {
  const normalized = typeof label === "string" ? label.trim().toUpperCase() : "";
  return normalized ? `Speaker ${normalized}` : "Speaker";
}
