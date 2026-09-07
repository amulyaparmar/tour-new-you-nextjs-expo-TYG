import type { AudioStreamBuffer } from "expo-audio";

type Listener = (buffer: AudioStreamBuffer) => void;

const listeners = new Set<Listener>();

export function publishLivePcm(buffer: AudioStreamBuffer) {
  for (const listener of listeners) listener(buffer);
}

export function subscribeToLivePcm(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
