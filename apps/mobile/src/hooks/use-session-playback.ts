import { setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

import { getRecordingSignedPlaybackUrl } from "@/api";
import { createLoadedAudioPlayer } from "@/audio-player";
import {
  cacheRecordingFromUrl,
  resolveSessionPlaybackUri,
} from "@/session-audio-cache";
import {
  createSessionPlaybackController,
  type SessionPlaybackController,
} from "@/session-playback-lifecycle";

export type SessionPlaybackState = {
  ready: boolean;
  loading: boolean;
  error: string | null;
  playing: boolean;
  position: number;
  duration: number;
  speed: number;
  progressPercent: number;
  fromCache: boolean;
  seekToSeconds: (seconds: number, shouldPlay?: boolean) => Promise<void>;
  togglePlayback: () => Promise<void>;
  pausePlayback: () => void;
  changeSpeed: () => Promise<void>;
  retry: () => void;
};

export function useSessionPlayback(sessionId: string, active = true): SessionPlaybackState {
  const [sound, setSound] = useState<AudioPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const controllerRef = useRef<SessionPlaybackController | null>(null);
  const speedRef = useRef(speed);
  const currentRender = useRef({ sessionId, retryToken, active });
  // Block an old async continuation as soon as a new source or inactive screen
  // renders, including the interval before passive effect cleanup runs.
  currentRender.current = { sessionId, retryToken, active };
  speedRef.current = speed;

  useEffect(() => {
    const controller = createSessionPlaybackController(() => {
      const current = currentRender.current;
      return current.active && current.sessionId === sessionId && current.retryToken === retryToken;
    });
    controllerRef.current = controller;
    let removeStatusListener: (() => void) | undefined;

    void (async () => {
      setLoading(active);
      setError(null);
      setSound(null);
      setPlaying(false);
      setPosition(0);
      setDuration(0);
      setFromCache(false);
      if (!active) return;

      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        if (!controller.isActive()) return;
        let resolved = await resolveSessionPlaybackUri(sessionId);
        if (!controller.isActive()) return;
        let loadedFromCache = resolved.fromCache;
        let loadedSound: AudioPlayer;

        try {
          loadedSound = await createLoadedAudioPlayer(resolved.uri);
        } catch {
          if (!controller.isActive()) return;
          if (resolved.fromCache) throw new Error("Cached audio could not be loaded.");
          const refreshed = await getRecordingSignedPlaybackUrl(sessionId);
          if (!controller.isActive()) return;
          resolved = { uri: refreshed.signedUrl, fromCache: false };
          void cacheRecordingFromUrl(sessionId, refreshed.signedUrl).catch(() => {});
          loadedSound = await createLoadedAudioPlayer(resolved.uri);
          loadedFromCache = false;
        }

        if (!controller.attach(loadedSound)) return;
        if (speedRef.current !== 1) controller.setPlaybackRate(speedRef.current);

        setSound(loadedSound);
        setFromCache(loadedFromCache);
        setDuration(loadedSound.duration || 0);
        const subscription = loadedSound.addListener("playbackStatusUpdate", (status) => {
          if (!controller.isCurrent(loadedSound)) return;
          setPosition(status.currentTime);
          if (status.duration) setDuration(status.duration);
          setPlaying(status.playing);
          if (status.didJustFinish) setPlaying(false);
        });
        removeStatusListener = () => subscription.remove();
      } catch (caught) {
        if (controller.isActive()) {
          setError(caught instanceof Error ? caught.message : "Audio is unavailable for this session.");
        }
      } finally {
        if (controller.isActive()) setLoading(false);
      }
    })();

    return () => {
      controller.dispose();
      removeStatusListener?.();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [active, sessionId, retryToken]);

  const seekToSeconds = useCallback(
    async (seconds: number, shouldPlay = false) => {
      const controller = controllerRef.current;
      if (!controller) return;
      try {
        const next = await controller.seek(seconds, shouldPlay);
        if (next !== null && controller.isActive()) {
          setError(null);
          setPosition(next);
          if (shouldPlay) setPlaying(true);
        }
      } catch (caught) {
        if (controller.isActive()) {
          setError(caught instanceof Error ? caught.message : "Could not seek in this recording.");
        }
      }
    },
    [],
  );

  const togglePlayback = useCallback(async () => {
    const controller = controllerRef.current;
    if (!controller) return;
    try {
      const nextPlaying = controller.toggle();
      if (nextPlaying !== null) {
        setError(null);
        setPlaying(nextPlaying);
      }
    } catch (caught) {
      if (controller.isActive()) {
        setError(caught instanceof Error ? caught.message : "Could not play this recording.");
      }
    }
  }, []);

  const pausePlayback = useCallback(() => {
    controllerRef.current?.pause();
    setPlaying(false);
  }, []);

  const changeSpeed = useCallback(async () => {
    const controller = controllerRef.current;
    if (!controller) return;
    const current = speedRef.current;
    const next = current === 1 ? 1.25 : current === 1.25 ? 1.5 : current === 1.5 ? 2 : 1;
    try {
      if (controller.setPlaybackRate(next)) {
        setError(null);
        speedRef.current = next;
        setSpeed(next);
      }
    } catch (caught) {
      if (controller.isActive()) {
        setError(caught instanceof Error ? caught.message : "Could not change playback speed.");
      }
    }
  }, []);

  const retry = useCallback(() => {
    controllerRef.current?.dispose();
    setRetryToken((token) => token + 1);
  }, []);

  const progressPercent = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return {
    ready: !!sound && !!controllerRef.current?.isCurrent(sound),
    loading,
    error,
    playing: active && playing,
    position,
    duration,
    speed,
    progressPercent,
    fromCache,
    seekToSeconds,
    togglePlayback,
    pausePlayback,
    changeSpeed,
    retry,
  };
}
