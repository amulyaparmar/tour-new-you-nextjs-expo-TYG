import NetInfo from "@react-native-community/netinfo";
import { useAudioStream, type AudioStreamBuffer } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

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

const PCM_CHUNK_BYTES = 3_200;
const PCM_SILENCE = new Uint8Array(PCM_CHUNK_BYTES);
const MAX_RECONNECT_AUDIO_BYTES = 64_000;
const MUSE_REALTIME_URL = "wss://api.meta.ai/v1/asr/realtime";
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
  const socketRef = useRef<WebSocket | null>(null);
  const upstreamReadyRef = useRef(false);
  const hasSentAudioRef = useRef(false);
  const lastAudioSentAtRef = useRef(0);
  const elapsedRef = useRef(elapsed);
  const connectionOffsetMsRef = useRef(0);
  const connectionNumberRef = useRef(0);
  const openTurnsRef = useRef(new Map<number, OpenTurn>());
  const activeTurnIdRef = useRef<number | null>(null);
  const partialTurnIdRef = useRef<number | null>(null);
  const bufferedAudioRef = useRef<BufferedAudio[]>([]);
  const bufferedAudioBytesRef = useRef(0);

  elapsedRef.current = elapsed;

  const handleAudioBuffer = useCallback((buffer: AudioStreamBuffer) => {
    if (buffer.sampleRate !== 16_000 || buffer.channels !== 1) {
      setCaptureFailed(true);
      setStatus("fallback");
      return;
    }

    const audio = buffer.data.slice(0);
    if (!audio.byteLength) return;

    const socket = socketRef.current;
    const durationMs = audio.byteLength / 32;
    const recordedAtMs = Math.max(0, elapsedRef.current * 1_000 - durationMs);

    if (!upstreamReadyRef.current || socket?.readyState !== WebSocket.OPEN) {
      bufferedAudioRef.current.push({ audio, recordedAtMs });
      bufferedAudioBytesRef.current += audio.byteLength;
      while (
        bufferedAudioBytesRef.current > MAX_RECONNECT_AUDIO_BYTES
        && bufferedAudioRef.current.length > 1
      ) {
        const removed = bufferedAudioRef.current.shift();
        bufferedAudioBytesRef.current -= removed?.audio.byteLength ?? 0;
      }
      return;
    }

    if (!hasSentAudioRef.current) {
      hasSentAudioRef.current = true;
      connectionOffsetMsRef.current = recordedAtMs;
    }
    socket.send(audio);
    lastAudioSentAtRef.current = Date.now();
  }, []);

  const { stream: audioStream } = useAudioStream({
    sampleRate: 16_000,
    channels: 1,
    encoding: "int16",
    onBuffer: handleAudioBuffer,
  });

  useEffect(() => {
    setTurns([]);
    setPartial(null);
    setCaptureFailed(false);
    bufferedAudioRef.current = [];
    bufferedAudioBytesRef.current = 0;
  }, [sessionId]);

  useEffect(() => {
    if (enabled) return;
    setCaptureFailed(false);
    bufferedAudioRef.current = [];
    bufferedAudioBytesRef.current = 0;
  }, [enabled]);

  useEffect(() => NetInfo.addEventListener((state) => {
    setInternetAvailable(state.isConnected !== false && state.isInternetReachable !== false);
  }), []);

  useEffect(() => {
    if (!enabled || !sessionId || !internetAvailable || captureFailed) {
      setStatus(enabled ? "fallback" : "idle");
      setPartial(null);
      const socket = socketRef.current;
      socketRef.current = null;
      upstreamReadyRef.current = false;
      if (socket?.readyState === WebSocket.OPEN) socket.close(1000, "Local fallback");
      return;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;

    const connect = async () => {
      setStatus("connecting");
      try {
        if (!MUSE_API_KEY) {
          setStatus("fallback");
          return;
        }
        if (cancelled) return;

        const socket = new WebSocket(MUSE_REALTIME_URL);
        socket.binaryType = "arraybuffer";
        socketRef.current = socket;
        upstreamReadyRef.current = false;
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
            reconnectAttempt = 0;
            setStatus("connecting");
            const buffered = bufferedAudioRef.current;
            bufferedAudioRef.current = [];
            bufferedAudioBytesRef.current = 0;
            for (const item of buffered) {
              if (socket.readyState !== WebSocket.OPEN) break;
              if (!hasSentAudioRef.current) {
                hasSentAudioRef.current = true;
                connectionOffsetMsRef.current = item.recordedAtMs;
              }
              socket.send(item.audio);
              lastAudioSentAtRef.current = Date.now();
            }
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
              time: Math.max(0, (turn?.startMs ?? timelineMs) / 1000),
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
              time: Math.max(0, (turn?.startMs ?? timelineMs) / 1000),
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
            setStatus("fallback");
            partialTurnIdRef.current = null;
            setPartial(null);
            socket.close();
          }
        };

        socket.onerror = () => {
          if (!cancelled) setStatus("fallback");
        };
        socket.onclose = () => {
          if (socketRef.current === socket) socketRef.current = null;
          upstreamReadyRef.current = false;
          partialTurnIdRef.current = null;
          setPartial(null);
          if (cancelled) return;
          setStatus("fallback");
          reconnectAttempt += 1;
          const delay = Math.min(10_000, 750 * 2 ** Math.min(reconnectAttempt, 4));
          reconnectTimer = setTimeout(() => void connect(), delay);
        };
      } catch {
        if (cancelled) return;
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
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "endStream" }));
        setTimeout(() => {
          if (socket.readyState === WebSocket.OPEN) socket.close(1000, "Recording stopped");
        }, 1_000);
      } else {
        socket?.close();
      }
    };
  }, [captureFailed, enabled, internetAvailable, sessionId]);

  const shouldCapture = enabled
    && internetAvailable
    && !captureFailed
    && (status === "connecting" || status === "streaming");

  useEffect(() => {
    if (!shouldCapture) {
      audioStream.stop();
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void audioStream.start().catch(() => {
        if (cancelled) return;
        audioStream.stop();
        setCaptureFailed(true);
        setStatus("fallback");
      });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      audioStream.stop();
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

  return { status, internetAvailable, shouldUseNativeFallback, turns, partial };
}

function speakerLabel(label: unknown) {
  const normalized = typeof label === "string" ? label.trim().toUpperCase() : "";
  return normalized ? `Speaker ${normalized}` : "Speaker";
}
