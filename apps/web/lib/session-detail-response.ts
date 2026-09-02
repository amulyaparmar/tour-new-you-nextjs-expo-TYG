import type { SessionDetail } from "@tour/shared";

import {
  getRecordingPlaybackPath,
  getRecordingUrl,
  isLegacyLocalUrl,
} from "@/lib/storage";

export async function attachSessionPlaybackUrls(session: SessionDetail) {
  const playbackPath = await getRecordingUrl(session.id);
  if (!playbackPath) return session;

  const isVideo = Boolean(session.videoUrl && !session.audioUrl);
  const needsUpdate =
    isLegacyLocalUrl(session.audioUrl)
    || isLegacyLocalUrl(session.videoUrl)
    || (!session.audioUrl && !session.videoUrl);

  if (
    needsUpdate
    || session.audioUrl?.includes("supabase")
    || session.videoUrl?.includes("supabase")
  ) {
    const path = getRecordingPlaybackPath(session.id);
    if (isVideo) session.videoUrl = path;
    else session.audioUrl = path;
  }

  return session;
}
