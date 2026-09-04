import {
  createAudioPlayer,
  type AudioPlayer,
  type AudioPlayerOptions,
} from "expo-audio";

const DEFAULT_LOAD_TIMEOUT_MS = 15_000;

/** Creates an expo-audio player and resolves only after its source is ready. */
export function createLoadedAudioPlayer(
  uri: string,
  options: AudioPlayerOptions = { updateInterval: 250 },
  timeoutMs = DEFAULT_LOAD_TIMEOUT_MS,
): Promise<AudioPlayer> {
  const player = createAudioPlayer({ uri }, options);
  if (player.isLoaded) return Promise.resolve(player);

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let subscription: { remove: () => void } | undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      subscription?.remove();
      if (error) {
        player.remove();
        reject(error);
      } else {
        resolve(player);
      }
    };
    subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (status.isLoaded) {
        finish();
        return;
      }
      if (status.playbackState.toLowerCase().includes("error")) {
        finish(new Error("Audio could not be loaded."));
      }
    });
    timer = setTimeout(
      () => finish(new Error("Audio loading timed out.")),
      timeoutMs,
    );
  });
}
