import { Directory, File, Paths } from "expo-file-system";
import {
  copyAsync,
  deleteAsync,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
} from "expo-file-system/legacy";

import type { LiveRecordingDraft, LiveRecordingMeta } from "../recording/RecordingProvider";

export type LocalSessionStatus =
  | "recording"
  | "ready_to_sync"
  | "syncing"
  | "uploaded"
  | "failed";

export type LocalSessionMeta = {
  localId: string;
  remoteSessionId: string | null;
  status: LocalSessionStatus;
  /** True when the user intentionally minimized the live experience. */
  minimized?: boolean;
  title: string;
  prospectName: string | null;
  propertyName: string | null;
  agentName: string | null;
  source: LiveRecordingMeta["source"];
  draft: LiveRecordingDraft;
  mimeType: string;
  fileName: string;
  durationSec: number | null;
  elapsedSec: number;
  recordingSourceUri: string | null;
  lastError: string | null;
  autoProcess: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LocalSessionCheckpoint = {
  elapsedSec: number;
  recordingSourceUri: string | null;
  savedAt: string;
};

const SESSIONS_ROOT = "sessions";
const META_FILE = "meta.json";
const CHECKPOINT_FILE = "checkpoint.json";
const RECORDING_FILE = "recording.m4a";

function newLocalId(): string {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function sessionsRoot(): Directory {
  const dir = new Directory(Paths.document, SESSIONS_ROOT);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function sessionDir(localId: string): Directory {
  return new Directory(sessionsRoot(), localId);
}

function metaFile(localId: string): File {
  return new File(sessionDir(localId), META_FILE);
}

function checkpointFile(localId: string): File {
  return new File(sessionDir(localId), CHECKPOINT_FILE);
}

export function recordingFile(localId: string): File {
  return new File(sessionDir(localId), RECORDING_FILE);
}

/** Stable legacy URI for a session recording (documents directory). */
export function durableRecordingUri(localId: string): string | null {
  if (!documentDirectory) return null;
  return `${documentDirectory}sessions/${localId}/${RECORDING_FILE}`;
}

export function getRecordingUri(localId: string): string | null {
  const legacyUri = durableRecordingUri(localId);
  try {
    // New File API has been unreliable for ExpoAudio/cache paths; prefer legacy URI
    // and only treat it as present when the File API also confirms size (best-effort).
    if (legacyUri) {
      const legacyFile = new File(legacyUri);
      if (legacyFile.exists && legacyFile.size > 0) return legacyUri;
    }
  } catch {
    // continue
  }
  try {
    const file = recordingFile(localId);
    return file.exists && file.size > 0 ? (legacyUri ?? file.uri) : null;
  } catch {
    return null;
  }
}

export async function getRecordingUriAsync(localId: string): Promise<string | null> {
  const uri = durableRecordingUri(localId);
  if (!uri) return null;
  try {
    const info = await getInfoAsync(uri);
    if (info.exists && "size" in info && typeof info.size === "number" && info.size > 0) {
      return uri;
    }
  } catch {
    // missing
  }
  return null;
}

function readJsonFile<T>(file: File): T | null {
  try {
    if (!file.exists) return null;
    const raw = file.textSync();
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(file: File, value: unknown): void {
  const parent = file.parentDirectory;
  if (!parent.exists) {
    parent.create({ intermediates: true, idempotent: true });
  }
  if (!file.exists) {
    file.create({ intermediates: true });
  }
  file.write(JSON.stringify(value, null, 2));
}

export function readLocalSessionMeta(localId: string): LocalSessionMeta | null {
  return readJsonFile<LocalSessionMeta>(metaFile(localId));
}

export function writeLocalSessionMeta(meta: LocalSessionMeta): LocalSessionMeta {
  const next = { ...meta, updatedAt: new Date().toISOString() };
  writeJsonFile(metaFile(meta.localId), next);
  return next;
}

export function createLocalSession(input: {
  meta: LiveRecordingMeta;
  draft: LiveRecordingDraft;
  remoteSessionId?: string | null;
}): LocalSessionMeta {
  const now = new Date().toISOString();
  const localId = newLocalId();
  const dir = sessionDir(localId);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }

  const record: LocalSessionMeta = {
    localId,
    remoteSessionId: input.remoteSessionId ?? input.meta.sessionId,
    status: "recording",
    minimized: false,
    title: input.meta.title || "Tour conversation",
    prospectName: input.meta.prospectName,
    propertyName: input.meta.propertyName,
    agentName: input.meta.agentName,
    source: input.meta.source,
    draft: input.draft,
    mimeType: "audio/m4a",
    fileName: `tour-${Date.now()}.m4a`,
    durationSec: null,
    elapsedSec: 0,
    recordingSourceUri: null,
    lastError: null,
    autoProcess: true,
    createdAt: now,
    updatedAt: now,
  };
  writeJsonFile(metaFile(localId), record);
  return record;
}

export function updateLocalSession(
  localId: string,
  patch: Partial<Omit<LocalSessionMeta, "localId" | "createdAt">>,
): LocalSessionMeta | null {
  const current = readLocalSessionMeta(localId);
  if (!current) return null;
  return writeLocalSessionMeta({ ...current, ...patch, localId: current.localId, createdAt: current.createdAt });
}

export function listLocalSessions(): LocalSessionMeta[] {
  try {
    const root = sessionsRoot();
    if (!root.exists) return [];
    const items = root.list();
    const sessions: LocalSessionMeta[] = [];
    for (const item of items) {
      // Session folders are directories named by localId.
      if (!("list" in item) || typeof (item as Directory).list !== "function") continue;
      const meta = readLocalSessionMeta(item.name);
      if (meta) sessions.push(meta);
    }
    return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function listPendingSyncSessions(): LocalSessionMeta[] {
  return listLocalSessions().filter((session) =>
    session.status === "ready_to_sync" || session.status === "failed" || session.status === "syncing",
  );
}

export function listRecoverableRecordingSessions(): LocalSessionMeta[] {
  return listLocalSessions().filter((session) => {
    if (session.status !== "recording") return false;
    if (session.minimized) return false;
    return Boolean(getRecordingUri(session.localId) || session.recordingSourceUri);
  });
}

export function writeCheckpoint(
  localId: string,
  elapsedSec: number,
  recordingSourceUri: string | null,
): LocalSessionCheckpoint | null {
  try {
    const checkpoint: LocalSessionCheckpoint = {
      elapsedSec,
      recordingSourceUri,
      savedAt: new Date().toISOString(),
    };
    writeJsonFile(checkpointFile(localId), checkpoint);
    updateLocalSession(localId, {
      elapsedSec,
      recordingSourceUri,
      draft: readLocalSessionMeta(localId)?.draft ?? {
        notes: "",
        assets: [],
        selectedAssetIds: [],
        participants: [],
        attachments: [],
        prospect: "",
        location: "",
        rubricId: null,
      },
    });
    return checkpoint;
  } catch {
    return null;
  }
}

/**
 * Best-effort sync hint only — real copies must use ensureDurableRecording (legacy FS).
 * Kept for mid-recording checkpoints that cannot await.
 */
export function copyRecordingToDurableStore(localId: string, sourceUri: string | null | undefined): string | null {
  if (!sourceUri) return null;
  updateLocalSession(localId, { recordingSourceUri: sourceUri });
  return sourceUri;
}

async function waitForReadableFile(uri: string, attempts = 8): Promise<number | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const info = await getInfoAsync(uri);
      if (info.exists && "size" in info && typeof info.size === "number" && info.size > 0) {
        return info.size;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }
  return null;
}

function uniqueRecordingSources(
  localId: string,
  sourceUri: string | null | undefined,
): string[] {
  const destination = durableRecordingUri(localId);
  const metaSource = readLocalSessionMeta(localId)?.recordingSourceUri ?? null;
  const checkpointSource = readJsonFile<LocalSessionCheckpoint>(checkpointFile(localId))?.recordingSourceUri ?? null;
  return Array.from(new Set([sourceUri, metaSource, checkpointSource].filter(
    (candidate): candidate is string => Boolean(candidate) && candidate !== destination,
  )));
}

/** Copy ExpoAudio/cache recording into Documents via legacy FileSystem (reliable on iOS). */
export async function ensureDurableRecording(
  localId: string,
  sourceUri: string | null | undefined,
): Promise<string | null> {
  const existing = await getRecordingUriAsync(localId);
  if (existing) return existing;

  const sourceCandidates = uniqueRecordingSources(localId, sourceUri);
  let readableSource: string | null = null;
  let sourceSize: number | null = null;
  for (const candidate of sourceCandidates) {
    const candidateSize = await waitForReadableFile(candidate);
    if (candidateSize != null) {
      readableSource = candidate;
      sourceSize = candidateSize;
      break;
    }
  }

  if (!readableSource || sourceSize == null) {
    console.warn("[recording] no readable source found", {
      localId,
      destination: durableRecordingUri(localId),
      sourceCandidates,
    });
    return null;
  }

  // Keep the recorder/cache URI as a recovery fallback. The durable destination
  // is deterministic from localId and must never replace this source pointer.
  updateLocalSession(localId, { recordingSourceUri: readableSource });

  if (!documentDirectory) return readableSource;
  const destination = durableRecordingUri(localId);
  if (!destination) return readableSource;

  const dir = `${documentDirectory}sessions/${localId}`;
  try {
    await makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // directory may already exist
  }

  try {
    await deleteAsync(destination, { idempotent: true });
  } catch {
    // ignore
  }

  try {
    await copyAsync({ from: readableSource, to: destination });
  } catch (error) {
    console.warn("[recording] copyAsync failed", {
      localId,
      sourceUri: readableSource,
      sourceSize,
      destination,
      error,
    });
  }

  const copied = await getRecordingUriAsync(localId);
  if (copied) {
    return copied;
  }

  // Last resort: upload from the still-readable cache path.
  if ((await waitForReadableFile(readableSource, 2)) != null) {
    return readableSource;
  }
  console.warn("[recording] durable copy and source fallback are missing", {
    localId,
    sourceUri: readableSource,
    destination,
  });
  return null;
}

export function markReadyToSync(
  localId: string,
  input: {
    durationSec: number;
    sourceUri?: string | null;
    remoteSessionId?: string | null;
    draft?: LiveRecordingDraft;
    fileName?: string;
    mimeType?: string;
  },
): LocalSessionMeta | null {
  const current = readLocalSessionMeta(localId);
  const destination = durableRecordingUri(localId);
  const requestedSource = input.sourceUri ?? null;
  const sourceUri = requestedSource && requestedSource !== destination
    ? requestedSource
    : current?.recordingSourceUri ?? null;
  if (!sourceUri && !getRecordingUri(localId)) {
    return updateLocalSession(localId, {
      status: "failed",
      lastError: "Recording file was not saved on device.",
      durationSec: input.durationSec,
      remoteSessionId: input.remoteSessionId ?? undefined,
      draft: input.draft,
    });
  }

  return updateLocalSession(localId, {
    status: "ready_to_sync",
    durationSec: input.durationSec,
    elapsedSec: input.durationSec,
    remoteSessionId: input.remoteSessionId ?? undefined,
    draft: input.draft,
    fileName: input.fileName,
    mimeType: input.mimeType ?? "audio/m4a",
    recordingSourceUri: sourceUri ?? undefined,
    lastError: null,
  });
}

export function deleteLocalSession(localId: string): void {
  try {
    const dir = sessionDir(localId);
    if (dir.exists) dir.delete();
  } catch {
    // Best-effort cleanup.
  }
}

export function findLocalSessionByRemoteId(remoteSessionId: string): LocalSessionMeta | null {
  return listLocalSessions().find((session) => session.remoteSessionId === remoteSessionId) ?? null;
}
