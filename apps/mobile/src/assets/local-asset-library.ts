import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  copyAsync,
  deleteAsync,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
} from "expo-file-system/legacy";

export type LocalAssetStatus = "saved" | "uploading" | "synced" | "failed";

export type LocalAsset = {
  id: string;
  communityId: string;
  localUri: string;
  mimeType: string;
  fileName: string;
  name: string;
  description: string;
  kind: "image" | "video";
  status: LocalAssetStatus;
  remoteMaterialId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "@tour/mobile/local-assets/v1";
const ASSET_ROOT = "asset-library";
const listeners = new Set<() => void>();
let cache: LocalAsset[] | null = null;
let loadPromise: Promise<LocalAsset[]> | null = null;
let persistTail = Promise.resolve();

function localId() {
  return `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function safePart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-96) || "asset";
}

function emit() {
  for (const listener of listeners) listener();
}

async function loadAll() {
  if (cache) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw) as LocalAsset[];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })
    .then((assets) => {
      cache = assets;
      return assets;
    })
    .finally(() => {
      loadPromise = null;
    });
  return loadPromise;
}

function persist(assets: LocalAsset[]) {
  cache = assets;
  persistTail = persistTail
    .catch(() => undefined)
    .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(assets)));
  emit();
  return persistTail;
}

async function durableUri(communityId: string, id: string, sourceUri: string, fileName: string) {
  if (!documentDirectory) return sourceUri;
  const directory = `${documentDirectory}${ASSET_ROOT}/${safePart(communityId)}`;
  await makeDirectoryAsync(directory, { intermediates: true });
  const destination = `${directory}/${id}-${safePart(fileName)}`;
  await deleteAsync(destination, { idempotent: true }).catch(() => undefined);
  await copyAsync({ from: sourceUri, to: destination });
  const info = await getInfoAsync(destination);
  if (!info.exists || (!("size" in info) || !info.size)) {
    throw new Error("Tour could not save this asset on your device.");
  }
  return destination;
}

export function subscribeLocalAssets(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function listLocalAssets(communityId: string) {
  const assets = await loadAll();
  return assets
    .filter((asset) => asset.communityId === communityId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function preserveLocalAsset(input: {
  communityId: string;
  sourceUri: string;
  mimeType: string;
  fileName: string;
  name?: string;
  description?: string;
}) {
  const id = localId();
  const now = new Date().toISOString();
  const localUri = await durableUri(input.communityId, id, input.sourceUri, input.fileName);
  const asset: LocalAsset = {
    id,
    communityId: input.communityId,
    localUri,
    mimeType: input.mimeType,
    fileName: input.fileName,
    name: input.name?.trim() || input.fileName.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
    description: input.description?.trim() || "",
    kind: input.mimeType.startsWith("image/") ? "image" : "video",
    status: "saved",
    remoteMaterialId: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  await persist([asset, ...(await loadAll())]);
  return asset;
}

export async function updateLocalAsset(
  id: string,
  patch: Partial<Pick<LocalAsset, "status" | "remoteMaterialId" | "error" | "name" | "description">>,
) {
  const assets = await loadAll();
  let updated: LocalAsset | null = null;
  const next = assets.map((asset) => {
    if (asset.id !== id) return asset;
    updated = { ...asset, ...patch, updatedAt: new Date().toISOString() };
    return updated;
  });
  await persist(next);
  return updated;
}

export async function removeLocalAsset(id: string) {
  const assets = await loadAll();
  const asset = assets.find((candidate) => candidate.id === id);
  if (!asset) return;
  await deleteAsync(asset.localUri, { idempotent: true }).catch(() => undefined);
  await persist(assets.filter((candidate) => candidate.id !== id));
}
