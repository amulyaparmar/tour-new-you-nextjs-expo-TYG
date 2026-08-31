import { setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { useCallback, useEffect, useState } from "react";

import { getRecordingSignedPlaybackUrl } from "@/api";
import { createLoadedAudioPlayer } from "@/audio-player";
import {
  cacheRecordingFromUrl,
  resolveSessionPlaybackUri,
} from "@/session-audio-cache";

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
  changeSpeed: () => Promise<void>;
  retry: () => void;
};

export function useSessionPlayback(sessionId: string): SessionPlaybackState {
  const [sound, setSound] = useState<AudioPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let mounted = true;
    let loadedSound: AudioPlayer | undefined;
    let removeStatusListener: (() => void) | undefined;

    void (async () => {
      setLoading(true);
      setError(null);
      setSound(null);
      setPlaying(false);
      setPosition(0);
      setDuration(0);
      setFromCache(false);

      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        let resolved = await resolveSessionPlaybackUri(sessionId);
        let loadedFromCache = resolved.fromCache;

        let player: AudioPlayer;
        try {
          player = await createLoadedAudioPlayer(resolved.uri);
        } catch {
          if (resolved.fromCache) throw new Error("Cached audio could not be loaded.");
          const refreshed = await getRecordingSignedPlaybackUrl(sessionId);
          resolved = { uri: refreshed.signedUrl, fromCache: false };
          void cacheRecordingFromUrl(sessionId, refreshed.signedUrl).catch(() => {});
          player = await createLoadedAudioPlayer(resolved.uri);
          loadedFromCache = false;
        }

        if (!mounted) {
          player.remove();
          return;
        }

        loadedSound = player;
        setSound(player);
        setFromCache(loadedFromCache);
        setDuration(player.duration || 0);
        const subscription = player.addListener("playbackStatusUpdate", (status) => {
          if (!mounted) return;
          setPosition(status.currentTime);
          if (status.duration) setDuration(status.duration);
          setPlaying(status.playing);
          if (status.didJustFinish) setPlaying(false);
        });
        removeStatusListener = () => subscription.remove();
      } catch (caught) {
        if (mounted) {
          setError(caught instanceof Error ? caught.message : "Audio is unavailable for this session.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      removeStatusListener?.();
      loadedSound?.remove();
    };
  }, [sessionId, retryToken]);

  const seekToSeconds = useCallback(
    async (seconds: number, shouldPlay = false) => {
      if (!sound) return;
      const next = Math.max(0, Math.min(duration || seconds, seconds));
      await sound.seekTo(next);
      setPosition(next);
      if (shouldPlay) sound.play();
    },
    [duration, sound],
  );

  const togglePlayback = useCallback(async () => {
    if (!sound) return;
    if (playing) sound.pause();
    else sound.play();
  }, [playing, sound]);

  const changeSpeed = useCallback(async () => {
    if (!sound) return;
    const next = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 2 : 1;
    sound.setPlaybackRate(next);
    setSpeed(next);
  }, [sound, speed]);

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1);
  }, []);

  const progressPercent = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return {
    ready: !!sound,
    loading,
    error,
    playing,
    position,
    duration,
    speed,
    progressPercent,
    fromCache,
    seekToSeconds,
    togglePlayback,
    changeSpeed,
    retry,
  };
}
