/** The native player methods needed to own one screen's playback lifetime. */
export type SessionPlaybackPlayer = {
  readonly duration: number;
  readonly playing: boolean;
  play: () => void;
  pause: () => void;
  remove: () => void;
  seekTo: (seconds: number) => Promise<void>;
  setPlaybackRate: (rate: number) => void;
};

/** Expo's iOS remove() unregisters a player; it does not itself pause AVPlayer. */
export function disposeSessionPlaybackPlayer(player: SessionPlaybackPlayer): void {
  try {
    player.pause();
  } catch {
    // A player may already have been released by the native runtime.
  }
  try {
    player.remove();
  } catch {
    // Still attempt removal when pause failed, and tolerate duplicate teardown.
  }
}

/**
 * Owns one source/load generation. In-flight seeks cannot restart playback after
 * pause, navigation, retry, replacement, or a newer seek.
 */
export function createSessionPlaybackController(isScreenActive: () => boolean) {
  let player: SessionPlaybackPlayer | null = null;
  let disposed = false;
  let command = 0;

  const isActive = () => !disposed && isScreenActive();
  const isCurrent = (candidate: SessionPlaybackPlayer) =>
    isActive() && player === candidate;

  return {
    isActive,
    isCurrent,
    attach(candidate: SessionPlaybackPlayer): boolean {
      if (!isActive()) {
        disposeSessionPlaybackPlayer(candidate);
        return false;
      }
      if (player && player !== candidate) disposeSessionPlaybackPlayer(player);
      command += 1;
      player = candidate;
      return true;
    },
    pause(): void {
      command += 1;
      try {
        player?.pause();
      } catch {
        // Navigation must still complete if a native player was released.
      }
    },
    toggle(): boolean | null {
      if (!player || !isActive()) return null;
      command += 1;
      const shouldPlay = !player.playing;
      if (shouldPlay) player.play();
      else player.pause();
      return shouldPlay;
    },
    setPlaybackRate(rate: number): boolean {
      if (!player || !isActive()) return false;
      player.setPlaybackRate(rate);
      return true;
    },
    async seek(seconds: number, shouldPlay = false): Promise<number | null> {
      const seekingPlayer = player;
      if (!seekingPlayer || !isActive() || !Number.isFinite(seconds)) return null;
      const seekCommand = ++command;
      const max = Number.isFinite(seekingPlayer.duration) && seekingPlayer.duration > 0
        ? seekingPlayer.duration
        : Math.max(0, seconds);
      const position = Math.max(0, Math.min(max, seconds));
      const stillCurrent = () => isCurrent(seekingPlayer) && command === seekCommand;
      try {
        await seekingPlayer.seekTo(position);
      } catch (error) {
        if (stillCurrent()) throw error;
        return null;
      }
      if (!stillCurrent()) return null;
      if (shouldPlay) seekingPlayer.play();
      return position;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      command += 1;
      const ownedPlayer = player;
      player = null;
      if (ownedPlayer) disposeSessionPlaybackPlayer(ownedPlayer);
    },
  };
}

export type SessionPlaybackController = ReturnType<typeof createSessionPlaybackController>;
