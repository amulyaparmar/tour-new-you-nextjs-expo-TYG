import "server-only";

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { getSupabaseServiceClient } from "./supabase";

export type MaterialType = "rubric" | "training" | "recording" | "other";

export type TourMaterialMedia = {
  sourceKey: string;
  videoUrl: string | null;
  imageUrl: string | null;
  gifUrl: string | null;
  iframeUrl: string | null;
};

export type Material = {
  id: string;
  name: string;
  type: MaterialType;
  description: string;
  fileUrl: string | null;
  parsedText: string | null;
  sessionId: string | null;
  propertyId: string | null;
  createdAt: string;
  media?: TourMaterialMedia;
};

export type TourLibraryLink = {
  available: true;
  source: "property" | "gmb_fallback";
  communityId: number | null;
  magnetUuid: string | null;
  alias: string | null;
  url: string;
};

export type PropertyHeroMedia = {
  url: string;
  kind: "video" | "image";
  posterUrl: string | null;
  sourceKey: string;
};

type MaterialRow = {
  id: string;
  name: string;
  type: MaterialType;
  description: string;
  file_url: string | null;
  parsed_text: string | null;
  session_id: string | null;
  property_id: string | null;
  created_at: string;
};

// ── Local fallback ──────────────────────────────────────
const STORE_PATH = path.join(process.cwd(), ".codex", "materials-store.json");
const TOUR_MATERIAL_CREATED_AT = "2026-05-22T00:00:00.000Z";
const EXCLUDED_TOUR_SOURCE_KEYS = new Set([
  "floor_plans.floor_plans_video_5",
  "floor_plans.form_screen",
  "floor_plans.matterport",
  "floor_plans.new",
  "thank_you.contact_us",
  "thank_you.scheduler"
]);
const EXCLUDED_TOUR_TEXT_PATTERNS = [
  "floor plan form submission",
  "floor plans video 5",
  "form_screen",
  "sample_640x360"
];

type TourApiAsset = {
  title?: unknown;
  video?: unknown;
  img?: unknown;
  gif?: unknown;
  iframe?: unknown;
};

type PropertyTourRow = {
  id: string;
  place_id: string | null;
  tour_video_id: unknown;
};

type LegacyCommunityRow = {
  id: number;
  alias: string | null;
  gmbId: unknown;
  community_magnets: unknown;
};

async function readLocalStore(): Promise<Material[]> {
  try {
    const raw = await readFile(STORE_PATH, "utf-8");
    return JSON.parse(raw) as Material[];
  } catch {
    return getDefaultMaterials();
  }
}

async function writeLocalStore(materials: Material[]) {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(materials, null, 2));
}

function mapRow(row: MaterialRow): Material {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description,
    fileUrl: row.file_url,
    parsedText: row.parsed_text,
    sessionId: row.session_id,
    propertyId: row.property_id ?? null,
    createdAt: row.created_at
  };
}

// ── Public API ──────────────────────────────────────────

export async function listMaterials(propertyId?: string): Promise<Material[]> {
  try {
    const supabase = getSupabaseServiceClient();
    let query = supabase
      .from("materials")
      .select("*")
      .order("created_at", { ascending: false });
    if (propertyId) query = query.or(`property_id.eq.${propertyId},property_id.is.null`);
    const { data, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) {
      const defaults = getDefaultMaterials();
      const rows = defaults.map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type,
        description: m.description,
        file_url: m.fileUrl,
        parsed_text: m.parsedText,
        session_id: m.sessionId
      }));
      await supabase.from("materials").insert(rows as never);
      return defaults;
    }

    return (data as MaterialRow[]).map(mapRow);
  } catch {
    return readLocalStore();
  }
}

export async function listVisibleMaterials(propertyId?: string): Promise<Material[]> {
  return (await listVisibleMaterialsWithLink(propertyId)).materials;
}

export async function listVisibleMaterialsWithLink(propertyId?: string): Promise<{
  materials: Material[];
  tourLibrary: TourLibraryLink | null;
}> {
  const tourLibrary = propertyId ? await resolveTourLibraryLink(propertyId) : null;
  const tourMaterialsPromise = tourLibrary && propertyId
    ? listTourMaterials(tourLibrary, propertyId)
    : Promise.resolve([] as Material[]);
  const [materials, tourMaterials] = await Promise.all([
    listMaterials(propertyId),
    tourMaterialsPromise
  ]);

  return {
    materials: [
      ...tourMaterials,
      ...materials.filter((material) => material.type !== "recording")
    ],
    tourLibrary,
  };
}

export async function getPropertyHeroMedia(propertyId: string): Promise<PropertyHeroMedia | null> {
  const link = await resolveTourLibraryLink(propertyId);
  if (!link) return null;
  const materials = await listTourMaterials(link, propertyId);
  const ranked = materials
    .filter((material) => material.media?.videoUrl || material.media?.imageUrl)
    .sort((left, right) => heroAssetScore(right) - heroAssetScore(left));
  const selected = ranked[0]?.media;
  if (!selected) return null;
  if (selected.videoUrl) {
    return {
      url: selected.videoUrl,
      kind: "video",
      posterUrl: selected.imageUrl,
      sourceKey: selected.sourceKey,
    };
  }
  if (selected.imageUrl) {
    return {
      url: selected.imageUrl,
      kind: "image",
      posterUrl: null,
      sourceKey: selected.sourceKey,
    };
  }
  return null;
}

function heroAssetScore(material: Material) {
  const searchable = `${material.media?.sourceKey ?? ""} ${material.name}`.toLowerCase();
  let score = material.media?.videoUrl ? 30 : 10;
  if (/intro|welcome|overview|hero|community/.test(searchable)) score += 100;
  if (/amenit|clubhouse|exterior|lobby/.test(searchable)) score += 30;
  if (/floor.?plan|form|contact|thank/.test(searchable)) score -= 80;
  return score;
}

export async function getMaterial(id: string, propertyId?: string): Promise<Material | null> {
  if (id.startsWith("tour-api-")) {
    if (!propertyId) return null;
    const link = await resolveTourLibraryLink(propertyId);
    if (!link) return null;
    const tourMaterials = await listTourMaterials(link, propertyId);
    return tourMaterials.find((material) => material.id === id) ?? null;
  }

  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .eq("id", id)
      .maybeSingle<MaterialRow>();

    if (error) throw error;
    return data ? mapRow(data) : null;
  } catch {
    const materials = await readLocalStore();
    return materials.find((m) => m.id === id) ?? null;
  }
}

async function listTourMaterials(link: TourLibraryLink, propertyId: string): Promise<Material[]> {
  const listId = link.alias
    ? `@${link.alias.replace(/^@/, "")}`
    : link.magnetUuid ?? String(link.communityId);
  try {
    const response = await fetch(`https://tour.video/api/list?id=${encodeURIComponent(listId)}`, {
      next: { revalidate: 300 }
    });

    if (!response.ok) throw new Error(`Tour API returned ${response.status}`);

    const payload = (await response.json()) as Record<string, TourApiAsset>;
    return Object.entries(payload)
      .map(([sourceKey, asset]) => mapTourAsset(sourceKey, asset, propertyId, listId))
      .filter((asset): asset is Material => asset !== null);
  } catch {
    return [];
  }
}

function mapTourAsset(
  sourceKey: string,
  asset: TourApiAsset,
  propertyId: string,
  tourListId: string
): Material | null {
  const videoUrl = stringOrNull(asset.video);
  const imageUrl = stringOrNull(asset.img);
  const gifUrl = stringOrNull(asset.gif);
  const iframeUrl = stringOrNull(asset.iframe);
  const title = stringOrNull(asset.title) ?? formatTourSourceKey(sourceKey);

  if (!videoUrl && !iframeUrl) return null;
  if (shouldHideTourAsset(sourceKey, title, videoUrl, imageUrl, iframeUrl)) return null;

  const includes = [
    videoUrl ? "video" : null,
    iframeUrl ? "embed link" : null
  ].filter(Boolean).join(" and ");

  return {
    id: `tour-api-${Buffer.from(sourceKey).toString("base64url")}`,
    name: title,
    type: "other",
    description: `Tour.video ${includes} from ${tourListId}.`,
    fileUrl: videoUrl ?? iframeUrl,
    parsedText: iframeUrl ? `Embed link: ${iframeUrl}` : null,
    sessionId: null,
    propertyId,
    createdAt: TOUR_MATERIAL_CREATED_AT,
    media: {
      sourceKey,
      videoUrl,
      imageUrl,
      gifUrl,
      iframeUrl
    }
  };
}

export async function resolveTourLibraryLink(propertyId: string): Promise<TourLibraryLink | null> {
  const supabase = getSupabaseServiceClient();
  const { data: property, error: propertyError } = await supabase
    .from("propertiesTYG")
    .select("id,place_id,tour_video_id")
    .eq("id", propertyId)
    .maybeSingle<PropertyTourRow>();
  if (propertyError) throw new Error(propertyError.message);
  if (!property) return null;

  const direct = parseDirectTourLink(property.tour_video_id);
  if (direct.communityId || direct.magnetUuid) {
    let community: LegacyCommunityRow | null = null;
    if (direct.communityId) {
      const { data } = await supabase
        .from("Community")
        .select("id,alias,gmbId,community_magnets")
        .eq("id", direct.communityId)
        .maybeSingle<LegacyCommunityRow>();
      community = data ?? null;
    }
    const magnetUuid = direct.magnetUuid ?? normalizeMagnetUuid(community?.community_magnets);
    return buildTourLibraryLink({
      source: "property",
      communityId: direct.communityId ?? community?.id ?? null,
      magnetUuid,
      // A canonical magnet UUID from propertiesTYG must win over a legacy
      // @alias. Only use the alias when no magnet identifier is available.
      alias: direct.alias ?? (magnetUuid ? null : (cleanString(community?.alias) || null)),
    });
  }

  const matchIds = new Set([property.id, property.place_id].map(cleanString).filter(Boolean));
  if (matchIds.size === 0) return null;
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("Community")
      .select("id,alias,gmbId,community_magnets")
      .not("gmbId", "is", null)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as LegacyCommunityRow[];
    const match = rows.find((row) => matchIds.has(normalizeGmbId(row.gmbId)));
    if (match) return linkFromCommunity(match, "gmb_fallback");
    if (rows.length < pageSize) break;
  }
  return null;
}

function parseDirectTourLink(value: unknown) {
  if (isRecord(value)) {
    return {
      communityId: positiveInteger(value.community_id ?? value.communityId ?? value.tourCommunityId),
      magnetUuid: cleanString(value.magnet_uuid ?? value.magnetUuid ?? value.uuid) || null,
      alias: cleanString(value.alias ?? value.tour_alias ?? value.tourAlias) || null,
    };
  }
  return { communityId: positiveInteger(value), magnetUuid: null, alias: null };
}

function linkFromCommunity(
  community: LegacyCommunityRow,
  source: TourLibraryLink["source"]
): TourLibraryLink {
  return buildTourLibraryLink({
    source,
    communityId: community.id,
    magnetUuid: normalizeMagnetUuid(community.community_magnets),
    alias: cleanString(community.alias) || null,
  });
}

function buildTourLibraryLink(input: Omit<TourLibraryLink, "available" | "url">): TourLibraryLink {
  const routeId = input.alias
    ? `@${input.alias.replace(/^@/, "")}`
    : input.magnetUuid ?? String(input.communityId);
  return { ...input, available: true, url: `https://tour.video/${routeId}` };
}

function normalizeGmbId(value: unknown) {
  const raw = cleanString(value);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "string" ? parsed.trim() : raw;
  } catch {
    return raw;
  }
}

function normalizeMagnetUuid(value: unknown): string | null {
  if (Array.isArray(value)) {
    return value.map((item) => isRecord(item) ? item.uuid ?? item.id : item)
      .map(cleanString)
      .find(Boolean) ?? null;
  }
  if (isRecord(value)) return cleanString(value.uuid ?? value.id) || null;
  return cleanString(value) || null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shouldHideTourAsset(
  sourceKey: string,
  title: string,
  videoUrl: string | null,
  imageUrl: string | null,
  iframeUrl: string | null
): boolean {
  if (EXCLUDED_TOUR_SOURCE_KEYS.has(sourceKey)) return true;
  if (sourceKey.startsWith("communications.")) return true;
  if (videoUrl?.includes("/black-TYG.mp4")) return true;
  if (iframeUrl && isUtilityIframeUrl(iframeUrl)) return true;
  if (!imageUrl && !isMatterportIframeUrl(iframeUrl)) return true;

  const searchableText = [sourceKey, title, videoUrl, imageUrl, iframeUrl]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (EXCLUDED_TOUR_TEXT_PATTERNS.some((pattern) => searchableText.includes(pattern))) return true;

  return false;
}

function isUtilityIframeUrl(url: string): boolean {
  return [
    "app.usetour.com/cta/",
    "livechat.boldchat.com/",
    "tour.video/referrers/",
    "tour.video/scheduler"
  ].some((pattern) => url.includes(pattern));
}

function isMatterportIframeUrl(url: string | null): boolean {
  return Boolean(url?.includes("my.matterport.com/show/"));
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatTourSourceKey(sourceKey: string): string {
  return sourceKey
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" - ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function createMaterial(input: {
  name: string;
  type: MaterialType;
  description: string;
  fileUrl?: string;
  parsedText?: string;
  sessionId?: string;
  propertyId?: string | null;
}): Promise<Material> {
  const payload = {
    name: input.name,
    type: input.type,
    description: input.description,
    file_url: input.fileUrl ?? null,
    parsed_text: input.parsedText ?? null,
    session_id: input.sessionId ?? null,
    property_id: input.propertyId ?? null
  };

  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("materials")
      .insert(payload as never)
      .select("*")
      .single<MaterialRow>();

    if (error || !data) throw error;
    return mapRow(data);
  } catch {
    const materials = await readLocalStore();
    const material: Material = {
      id: randomUUID(),
      name: input.name,
      type: input.type,
      description: input.description,
      fileUrl: input.fileUrl ?? null,
      parsedText: input.parsedText ?? null,
      sessionId: input.sessionId ?? null,
      propertyId: input.propertyId ?? null,
      createdAt: new Date().toISOString()
    };
    materials.push(material);
    await writeLocalStore(materials);
    return material;
  }
}

export async function findMaterialBySessionId(sessionId: string): Promise<Material | null> {
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle<MaterialRow>();

    if (error) throw error;
    return data ? mapRow(data) : null;
  } catch {
    const materials = await readLocalStore();
    return materials.find((m) => m.sessionId === sessionId) ?? null;
  }
}

export async function deleteMaterial(id: string): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) throw error;
  } catch {
    const materials = await readLocalStore();
    const filtered = materials.filter((m) => m.id !== id);
    await writeLocalStore(filtered);
  }
}

function getDefaultMaterials(): Material[] {
  return [
    {
      id: "default-rubric-1",
      name: "Apartment In-Person Tour Rubric",
      type: "rubric",
      description: "Official RBG mystery shopping evaluation rubric — 200 points across 4 sections: The Greeting, Property Tour & Demonstration, Closing Techniques, Follow Up, plus Fair Housing compliance.",
      fileUrl: null,
      parsedText: [
        "=== THE GREETING (50 points) ===",
        "Q110. Stand and greet promptly / acknowledge if busy (10 pts)",
        "Q120. Introduce themselves (5 pts)",
        "Q130. Give undivided attention throughout tour (5 pts)",
        "Q140. Complete guest card / confirm information (10 pts)",
        "Q150. Ask: school classification, move-in date/term, how heard about property, 3 things looking for, telephone number (2 pts each, 10 pts max)",
        "Q160. Ask for photo ID before tour (5 pts)",
        "Q170. Overview of what tour will consist of (5 pts)",
        "",
        "=== PROPERTY TOUR & DEMONSTRATION (80 points) ===",
        "Q205. Take control of the presentation (5 pts)",
        "Q210. Use gathered information to personalize presentation (10 pts)",
        "Q215. Use prospect's name throughout (5 pts)",
        "Q220. Knowledgeable about apartment community (10 pts)",
        "Q225. Sell benefits and features of apartment and community (10 pts)",
        "Q230. Show clean, made-ready, comfortable-temp apartment/model (10 pts)",
        "Q235. Offer snack/refreshment from stocked fridge/freezer (5 pts)",
        "Q240. Highlight apartment features and show how they are beneficial (5 pts)",
        "Q245. Tailor presentation to prospect's needs (5 pts)",
        "Q255. Overcome objection stated during demonstration (10 pts)",
        "Q260. Inquire about other communities visited / positive comparison (5 pts)",
        "",
        "=== CLOSING TECHNIQUES (65 points) ===",
        "Q305. Sit prospect at computer/iPad and explain application details (15 pts)",
        "Q310. Well versed in all rental rates (5 pts)",
        "Q315. Attempt to sell premium amenities (view, carports, etc.) while reviewing floor plans/rates (5 pts)",
        "Q320. Discuss rental guarantor/qualification procedures (5 pts)",
        "Q325. Review floor plan and rate sheet (10 pts)",
        "Q330. Convey strong sense of urgency to rent today (5 pts)",
        "Q335. Ask if ready to sign the lease today (15 pts)",
        "Q340. Effectively uncover and overcome objections for not leasing (5 pts)",
        "",
        "=== FOLLOW UP (5 points) ===",
        "Q410. Follow-up email, phone call, or text within 24 hours (5 pts)",
        "",
        "=== FAIR HOUSING (Compliance — not scored) ===",
        "Q510. No steering or segregation attempts",
        "Q520. No discrimination of any kind"
      ].join("\n"),
      sessionId: null,
      propertyId: null,
      createdAt: new Date().toISOString()
    },
    {
      id: "default-training-1",
      name: "Closing Techniques Guide",
      type: "training",
      description: "Best practices for closing apartment tours: assumptive close, urgency creation, application walkthrough, and lease-signing ask.",
      fileUrl: null,
      parsedText: null,
      sessionId: null,
      propertyId: null,
      createdAt: new Date().toISOString()
    }
  ];
}
