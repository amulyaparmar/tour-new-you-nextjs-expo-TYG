import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { Mic, Square } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { transcribeDictation } from "../dictation";
import { Icon } from "@/components/ui/icon";
import { LoadingDots } from "@/components/loading-dots";

type DictationStatus = "idle" | "recording" | "transcribing";

type Props = {
  disabled?: boolean;
  keepAudioSessionActive?: boolean;
  style?: StyleProp<ViewStyle>;
  onBeforeStart?: () => void | Promise<void>;
  onAfterStop?: () => void | Promise<void>;
  onTranscript: (text: string) => void;
  onError?: (message: string | null) => void;
};

const MAX_DICTATION_MS = 60_000;

export function ElevenLabsDictationButton({
  disabled = false,
  keepAudioSessionActive = false,
  style,
  onBeforeStart,
  onAfterStop,
  onTranscript,
  onError,
}: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [status, setStatus] = useState<DictationStatus>("idle");
  const stopTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const startedAtRef = useRef(0);
  const mountedRef = useRef(true);
  const recordingRef = useRef(false);
  const lifecycleStartedRef = useRef(false);
  const stoppingRef = useRef(false);
  const keepAudioSessionActiveRef = useRef(keepAudioSessionActive);
  const onBeforeStartRef = useRef(onBeforeStart);
  const onAfterStopRef = useRef(onAfterStop);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  onBeforeStartRef.current = onBeforeStart;
  onAfterStopRef.current = onAfterStop;
  onTranscriptRef.current = onTranscript;
  onErrorRef.current = onError;
  keepAudioSessionActiveRef.current = keepAudioSessionActive;

  const reportError = useCallback((message: string | null) => {
    onErrorRef.current?.(message);
  }, []);

  const finishAudioLifecycle = useCallback(async () => {
    if (!lifecycleStartedRef.current) return;
    lifecycleStartedRef.current = false;
    await onAfterStopRef.current?.();
    if (!keepAudioSessionActiveRef.current) {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      }).catch(() => {});
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = undefined;

    try {
      const wasRecording = recordingRef.current;
      recordingRef.current = false;
      if (wasRecording) await recorder.stop();
      const fileUri = recorder.uri;
      await finishAudioLifecycle();

      if (!fileUri || Date.now() - startedAtRef.current < 250) {
        throw new Error("Hold the microphone a little longer, then try again.");
      }

      if (mountedRef.current) setStatus("transcribing");
      const text = await transcribeDictation(fileUri);
      onTranscriptRef.current(text);
      reportError(null);
    } catch (error) {
      await finishAudioLifecycle().catch(() => {});
      reportError(error instanceof Error ? error.message : "Dictation failed. Please try again.");
    } finally {
      stoppingRef.current = false;
      if (mountedRef.current) setStatus("idle");
    }
  }, [finishAudioLifecycle, recorder, reportError]);

  const startRecording = useCallback(async () => {
    if (disabled || status !== "idle") return;
    reportError(null);

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Microphone access is needed for dictation.");
      }

      lifecycleStartedRef.current = true;
      await onBeforeStartRef.current?.();
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: "mixWithOthers",
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingRef.current = true;
      startedAtRef.current = Date.now();
      setStatus("recording");
      stopTimerRef.current = setTimeout(() => {
        void stopRecording();
      }, MAX_DICTATION_MS);
    } catch (error) {
      recordingRef.current = false;
      await finishAudioLifecycle().catch(() => {});
      reportError(error instanceof Error ? error.message : "Could not start dictation.");
      setStatus("idle");
    }
  }, [
    disabled,
    finishAudioLifecycle,
    recorder,
    reportError,
    status,
    stopRecording,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      const shouldStop = recordingRef.current;
      recordingRef.current = false;
      if (!shouldStop) {
        void finishAudioLifecycle();
        return;
      }

      try {
        void recorder.stop()
          .catch(() => {})
          .finally(() => {
            void finishAudioLifecycle();
          });
      } catch {
        void finishAudioLifecycle();
      }
    };
  }, [finishAudioLifecycle, recorder]);

  const isRecording = status === "recording";
  const label =
    isRecording
      ? "Stop dictation"
      : status === "transcribing"
        ? "Transcribing dictation"
        : "Start dictation";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || status === "transcribing", selected: isRecording }}
      disabled={disabled || status === "transcribing"}
      hitSlop={8}
      onPress={isRecording ? () => void stopRecording() : () => void startRecording()}
      style={({ pressed }) => [
        styles.button,
        isRecording && styles.recording,
        (disabled || status === "transcribing") && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {status === "transcribing" ? (
        <LoadingDots size="small" color="#006CE5" />
      ) : isRecording ? (
        <Icon as={Square} size={14} color="#D92D20" fill="#D92D20" />
      ) : (
        <Icon as={Mic} size={18} color="#667085" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F4F7",
  },
  recording: {
    backgroundColor: "#FEE4E2",
    borderWidth: 1,
    borderColor: "#FDA29B",
  },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.94 }] },
});
