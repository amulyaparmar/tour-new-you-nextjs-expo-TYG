import { createAudioPlayer, type AudioPlayer } from "expo-audio";

const LOAD_TIMEOUT_MS = 15_000;

/**
 * Creates a player only after its source is ready, so callers can safely read
 * duration and subscribe to status updates without racing the native loader.
 */
export async function createLoadedAudioPlayer(uri: string): Promise<AudioPlayer> {
  const player = createAudioPlayer({ uri }, { updateInterval: 250 });

  if (player.isLoaded) return player;

  return new Promise<AudioPlayer>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      subscription.remove();
      callback();
    };

    const subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (status.isLoaded) finish(() => resolve(player));
    });

    const timeout = setTimeout(() => {
      finish(() => {
        player.remove();
        reject(new Error("Audio took too long to load."));
      });
    }, LOAD_TIMEOUT_MS);
  });
}
