import NetInfo from "@react-native-community/netinfo";
import { AppState, type AppStateStatus } from "react-native";
import { isRecordingUploadTitle } from "@tour/shared";

import {
  createSession,
  fetchSession,
  processSession,
  uploadRecording,
} from "../api";
import { getApiBaseUrl } from "../config";
import { promoteLocalRecordingToCache } from "../session-audio-cache";
import {
  deleteLocalSession,
  ensureDurableRecording,
  getRecordingUri,
  getRecordingUriAsync,
  listPendingSyncSessions,
  listRecoverableRecordingSessions,
  type LocalSessionMeta,
  updateLocalSession,
  writeLocalSessionMeta,
} from "./session-local-store";

type SyncListener = (event: {
  type: "started" | "item" | "done" | "error";
  localId?: string;
  remoteSessionId?: string | null;
  error?: string;
}) => void;

let draining = false;
let drainRequested = false;
let started = false;
const listeners = new Set<SyncListener>();
const directUploadLocalIds = new Set<string>();

/** Prevent the background outbox from racing a foreground upload for the same file. */
export function beginDirectLocalUpload(localId: string): void {
  directUploadLocalIds.add(localId);
}

export function endDirectLocalUpload(localId: string): void {
  directUploadLocalIds.delete(localId);
}

export function onSyncOutboxEvent(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: Parameters<SyncListener>[0]) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Ignore listener errors.
    }
  }
}

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  // Local API hosts are reachable without "internet"; treat null/unknown as online.
  if (!state.isConnected) return false;
  if (state.isInternetReachable === false) {
    try {
      const host = new URL(getApiBaseUrl()).hostname;
      const isPrivateLan =
        host === "localhost"
        || host === "127.0.0.1"
        || host.startsWith("192.168.")
        || host.startsWith("10.")
        || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
      if (isPrivateLan) return true;
    } catch {
      // fall through
    }
    return false;
  }
  return true;
}

async function syncOne(session: LocalSessionMeta): Promise<LocalSessionMeta | null> {
  if (directUploadLocalIds.has(session.localId)) return session;

  const recordingUri =
    (await ensureDurableRecording(session.localId, session.recordingSourceUri))
    ?? (await getRecordingUriAsync(session.localId))
    ?? session.recordingSourceUri;
  if (!recordingUri) {
    return updateLocalSession(session.localId, {
      status: "failed",
      lastError: "No durable recording found on device.",
    });
  }

  updateLocalSession(session.localId, { status: "syncing", lastError: null });
  emit({ type: "item", localId: session.localId, remoteSessionId: session.remoteSessionId });

  let remoteSessionId = session.remoteSessionId;

  try {
    const draft = session.draft;
    if (!remoteSessionId) {
      const created = await createSession({
        title: session.title.trim() || "Tour conversation",
        titleIsAuto: isRecordingUploadTitle(session.title),
        sourceFileName: session.fileName,
        prospectName: draft?.prospect?.trim() || session.prospectName,
        agentName: session.agentName,
        uploaderIsAgent: draft?.uploaderIsAgent ?? Boolean(session.agentName),
        location: draft?.location?.trim() || session.propertyName,
        notes: draft?.notes?.trim() || null,
        rubricId: draft?.rubricId ?? null,
      });
      remoteSessionId = created.session.id;
      updateLocalSession(session.localId, { remoteSessionId });
    } else {
      // Idempotent: skip upload if remote already has media.
      try {
        const { session: remote } = await fetchSession(remoteSessionId);
        if (remote.audioUrl || remote.videoUrl || remote.status === "uploaded" || remote.status === "analysis_ready" || remote.status === "reviewed" || remote.status === "transcribing" || remote.status === "segmenting" || remote.status === "analyzing") {
          promoteLocalRecordingToCache(remoteSessionId, recordingUri);
          deleteLocalSession(session.localId);
          return null;
        }
      } catch {
        // Continue with upload if status check fails.
      }
    }

    await uploadRecording(
      remoteSessionId,
      recordingUri,
      session.mimeType || "audio/m4a",
      session.fileName || `tour-${session.localId}.m4a`,
      session.durationSec ?? undefined,
    );

    promoteLocalRecordingToCache(remoteSessionId, recordingUri);

    if (session.autoProcess) {
      try {
        await processSession(remoteSessionId);
      } catch {
        // Upload succeeded; processing can be retried from session detail.
      }
    }

    deleteLocalSession(session.localId);
    return null;
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Sync failed";
    return updateLocalSession(session.localId, {
      status: "failed",
      remoteSessionId,
      lastError: message,
    });
  }
}

export async function drainSyncOutbox(): Promise<void> {
  if (draining) {
    drainRequested = true;
    return;
  }
  if (!(await isOnline())) return;

  draining = true;
  emit({ type: "started" });
  try {
    // Promote interrupted recordings that already have durable audio into the outbox.
    for (const recoverable of listRecoverableRecordingSessions()) {
      if (directUploadLocalIds.has(recoverable.localId)) continue;
      const durable =
        (await ensureDurableRecording(recoverable.localId, recoverable.recordingSourceUri))
        ?? (await getRecordingUriAsync(recoverable.localId))
        ?? getRecordingUri(recoverable.localId);
      if (durable) {
        writeLocalSessionMeta({
          ...recoverable,
          status: "ready_to_sync",
          durationSec: recoverable.durationSec ?? Math.max(1, recoverable.elapsedSec),
          recordingSourceUri: recoverable.recordingSourceUri ?? durable,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    const pending = listPendingSyncSessions();
    for (const session of pending) {
      if (!(await isOnline())) break;
      if (directUploadLocalIds.has(session.localId)) continue;
      await syncOne(session);
    }
    emit({ type: "done" });
  } catch (caught) {
    emit({
      type: "error",
      error: caught instanceof Error ? caught.message : "Sync failed",
    });
  } finally {
    draining = false;
    if (drainRequested) {
      drainRequested = false;
      void drainSyncOutbox();
    }
  }
}

/** Sync a single local session immediately (e.g. right after stop when online). */
export async function syncLocalSessionNow(localId: string): Promise<LocalSessionMeta | null> {
  const pending = listPendingSyncSessions().find((session) => session.localId === localId)
    ?? listRecoverableRecordingSessions().find((session) => session.localId === localId);
  if (!pending) return null;
  if (!(await isOnline())) {
    return updateLocalSession(localId, { status: "ready_to_sync" });
  }
  return syncOne(pending);
}

export function startSyncOutbox(): () => void {
  if (started) return () => {};
  started = true;

  const netSub = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void drainSyncOutbox();
    }
  });

  const onAppState = (next: AppStateStatus) => {
    if (next === "active") void drainSyncOutbox();
  };
  const appSub = AppState.addEventListener("change", onAppState);

  void drainSyncOutbox();

  return () => {
    started = false;
    netSub();
    appSub.remove();
  };
}
