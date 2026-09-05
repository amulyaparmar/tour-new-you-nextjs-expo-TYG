export type LiveSessionOpenAction = "expand" | "open" | "detail";

export type LiveSessionOpenInput = {
  liveSessionId: string | null;
  hasLiveExperience: boolean;
  session: { id: string; status: string } | null | undefined;
  autoStartRecording?: boolean;
  hasPendingFinishedRecording: boolean;
};

/** Local audio that already left the live recorder and is waiting to upload. */
export function localSessionIsPendingUpload(
  local: { status: string } | null | undefined,
): boolean {
  return Boolean(
    local &&
      (local.status === "ready_to_sync" ||
        local.status === "failed" ||
        local.status === "syncing"),
  );
}

/**
 * Decide whether tapping a session should expand the live recorder, start a
 * bound recording, or open the finished/scheduled session page.
 */
export function resolveLiveSessionOpen(
  input: LiveSessionOpenInput,
): LiveSessionOpenAction {
  const {
    liveSessionId,
    hasLiveExperience,
    session,
    autoStartRecording = false,
    hasPendingFinishedRecording,
  } = input;

  if (hasLiveExperience) {
    if (session && liveSessionId === session.id) return "expand";
    if (session?.status === "in_progress") return "expand";
    if (autoStartRecording) return "expand";
    return "detail";
  }

  if (hasPendingFinishedRecording) return "detail";
  if (!session) return "detail";
  if (session.status === "in_progress") return "open";
  if (
    autoStartRecording &&
    (session.status === "scheduled" || session.status === "in_progress")
  ) {
    return "open";
  }
  return "detail";
}
