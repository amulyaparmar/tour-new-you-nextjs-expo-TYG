import "server-only";

import { createClient, type User } from "@supabase/supabase-js";

import { compareCommunityDisplayName, formatCommunityDisplayName } from "./community-display";
import { getSupabaseServiceClient } from "./supabase";

export const ADMIN_ACCESS_COOKIE = "tour_admin_access_token";
export const ADMIN_REFRESH_COOKIE = "tour_admin_refresh_token";
export const ADMIN_COMMUNITY_COOKIE = "tour_admin_community";
const DEFAULT_TOUR_COMMUNITY_ID = "community:548";
const DEFAULT_GLOBAL_PROPERTY_ADMIN_DOMAINS = ["leasemagnets.com"];
const LEASEMAGNETS_EMAIL_DOMAIN = "leasemagnets.com";
const COOKIE_CHUNK_SIZE = 3500;
const MAX_ACCESS_COOKIE_CHUNKS = 6;

type CookieResponse = {
  cookies: {
    set(name: string, value: string, options?: ReturnType<typeof adminCookieOptions>): unknown;
    delete(name: string): unknown;
  };
};

export type AdminRole = "admin" | "manager" | "member";

export type PropertyTeamMember = {
  id: string | null;
  alias: string | null;
  name: string;
  email: string;
  role: string;
  accessRole: AdminRole;
  title: string | null;
  phone: string | null;
  cardAccent: string | null;
  verified: boolean | null;
  userId: string | null;
  notificationPreferences: Record<string, boolean> | null;
};

export type AdminCommunity = {
  id: string;
  propertyTygId: string;
  portalCommunityId: string | null;
  name: string;
  companyName: string | null;
  companySlug: string | null;
  tourCommunityId: number | null;
  gmbId: string | null;
  alias: string | null;
  entrataPropertyId: string | null;
  teamMembers: PropertyTeamMember[];
};

export type AdminWorkspace = {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    title: string | null;
    phone: string | null;
    cardAccent: string | null;
    aiTrainingDataFeedback?: boolean;
  };
  teamMember: PropertyTeamMember;
  organization: {
    id: string;
    name: string;
  };
  community: AdminCommunity;
  communities: AdminCommunity[];
};

export type AdminBusinessOption = {
  id: string;
  name: string;
  companyName: string;
  gmbId: string | null;
  alias: string | null;
  calendarConnected: boolean;
};

export function isGlobalPropertyAdminEmail(value: string | null | undefined) {
  const domain = emailDomain(value);
  if (!domain) return false;
  const configured = (
    process.env.TOUR_GLOBAL_PROPERTY_ADMIN_DOMAINS
    ?? DEFAULT_GLOBAL_PROPERTY_ADMIN_DOMAINS.join(",")
  )
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return configured.includes(domain);
}

/** Exact product capability gate; unlike global-admin access, this is not env-configurable. */
export function isLeaseMagnetsEmail(value: string | null | undefined) {
  const normalized = normalizeEmail(value);
  const parts = normalized.split("@");
  return (
    parts.length === 2
    && Boolean(parts[0])
    && parts[1] === LEASEMAGNETS_EMAIL_DOMAIN
  );
}

/** Canonical storage key first, followed by any legacy session key still in use. */
export function propertySessionKeys(community: AdminCommunity) {
  return Array.from(new Set([
    community.propertyTygId,
    community.tourCommunityId === null ? null : `community:${community.tourCommunityId}`,
  ].filter((value): value is string => Boolean(value))));
}

export async function findPropertyForSessionKey(propertyKey: string | null | undefined) {
  const key = cleanString(propertyKey);
  if (!key) return null;
  const supabase = getSupabaseServiceClient();
  type PropertyIdentityRow = { id: string; name: string | null };

  if (!key.toLowerCase().startsWith("community:")) {
    const { data, error } = await supabase
      .from("propertiesTYG")
      .select("id,name")
      .eq("id", key)
      .maybeSingle<PropertyIdentityRow>();
    if (error) throw new Error(error.message);
    return data ? { id: data.id, name: cleanString(data.name) || `Property ${data.id}` } : null;
  }

  const communityId = Number(key.slice("community:".length));
  if (!Number.isSafeInteger(communityId) || communityId <= 0) return null;
  const { data: scalarDirect } = await supabase
    .from("propertiesTYG")
    .select("id,name")
    .eq("tour_video_id", communityId)
    .limit(1)
    .maybeSingle<PropertyIdentityRow>();
  if (scalarDirect) {
    return { id: scalarDirect.id, name: cleanString(scalarDirect.name) || `Property ${scalarDirect.id}` };
  }
  const directShapes: Array<Record<string, unknown>> = [
    { community_id: communityId },
    { communityId },
    { tourCommunityId: communityId },
  ];
  for (const shape of directShapes) {
    const { data } = await supabase
      .from("propertiesTYG")
      .select("id,name")
      .contains("tour_video_id", shape)
      .limit(1)
      .maybeSingle<PropertyIdentityRow>();
    if (data) return { id: data.id, name: cleanString(data.name) || `Property ${data.id}` };
  }

  const { data: legacy } = await supabase
    .from("Community")
    .select("gmbId")
    .eq("id", communityId)
    .maybeSingle<{ gmbId: unknown }>();
  const placeId = normalizeLegacyGmbId(legacy?.gmbId);
  if (!placeId) return null;
  const { data: byId, error: byIdError } = await supabase
    .from("propertiesTYG")
    .select("id,name")
    .eq("id", placeId)
    .limit(1)
    .maybeSingle<PropertyIdentityRow>();
  if (byIdError) throw new Error(byIdError.message);
  if (byId) return { id: byId.id, name: cleanString(byId.name) || `Property ${byId.id}` };
  const { data: fallback, error: fallbackError } = await supabase
    .from("propertiesTYG")
    .select("id,name")
    .eq("place_id", placeId)
    .limit(1)
    .maybeSingle<PropertyIdentityRow>();
  if (fallbackError) throw new Error(fallbackError.message);
  return fallback ? { id: fallback.id, name: cleanString(fallback.name) || `Property ${fallback.id}` } : null;
}

type PropertyTeamRow = {
  id: string;
  name: string | null;
  alias: string | null;
  place_id: string | null;
  tour_video_id: unknown;
  property_manager: string | null;
  metadata: unknown;
};

type LegacyTourCommunityRow = {
  id: number;
  alias: string | null;
  gmbId: unknown;
};

type CommunityRow = {
  id: string;
  name: string;
  tour_community_id: number | null;
  gmb_id: string | null;
  alias: string | null;
  entrata_property_id: string | null;
  company_id: string;
  companies?: { id: string; name: string; slug: string } | Array<{ id: string; name: string; slug: string }> | null;
};

const fallbackCommunityRows: CommunityRow[] = [
  {
    id: "community:548",
    name: "40Fifty Lofts",
    tour_community_id: 548,
    gmb_id: null,
    alias: "4050lofts",
    entrata_property_id: null,
    company_id: "company:leasemagnets-demo",
  },
  {
    id: "community:517",
    name: "20 Hawley",
    tour_community_id: 517,
    gmb_id: null,
    alias: "20hawley",
    entrata_property_id: null,
    company_id: "company:leasemagnets-demo",
  },
];

export class AdminAuthError extends Error {
  constructor(message: string, public status: 401 | 403 = 401) {
    super(message);
  }
}

export function createSupabaseAnonClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing Supabase Auth environment variables.");
  }
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function requireAdminContext(request: Request): Promise<AdminWorkspace> {
  const token = readBearerToken(request) ?? readChunkedCookie(request, ADMIN_ACCESS_COOKIE);
  if (!token) throw new AdminAuthError("Sign in is required.");

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new AdminAuthError("Your session has expired.");

  const requestedCommunityId =
    request.headers.get("x-admin-community-id") ??
    readCookie(request, ADMIN_COMMUNITY_COOKIE);

  return resolveAdminContextForUser(data.user, requestedCommunityId);
}

export function hasAdminSession(request: Request) {
  return Boolean(readBearerToken(request) ?? readChunkedCookie(request, ADMIN_ACCESS_COOKIE));
}

export function readAdminCookie(request: Request, name: string) {
  return readCookie(request, name);
}

export function readAdminAccessCookie(request: Request) {
  return readChunkedCookie(request, ADMIN_ACCESS_COOKIE);
}

export async function resolveAdminContextForUser(
  user: User,
  requestedCommunityId?: string | null
): Promise<AdminWorkspace> {
  const email = normalizeEmail(user.email);
  if (!email) throw new AdminAuthError("A work email is required.", 403);
  const globalAdmin = isGlobalPropertyAdminEmail(email);
  const requestedPropertyId = cleanString(requestedCommunityId);

  if (requestedPropertyId && !requestedPropertyId.startsWith("community:")) {
    const requestedAccess = await resolvePropertyAccessById(requestedPropertyId, email, globalAdmin);
    if (!requestedAccess) {
      throw new AdminAuthError("You do not have access to the selected business.", 403);
    }
    return buildWorkspaceForAccess(user, email, [requestedAccess], requestedAccess);
  }

  let teamProperties = await listPropertyTeamRows({ email });
  if (globalAdmin && teamProperties.length === 0) {
    // Give a global operator a bounded landing workspace. The full catalog is
    // searched server-side rather than serialized into auth responses.
    teamProperties = await listPropertyTeamRows({ includeAll: true, stopAfterMatches: 25 });
  }
  const preliminary = teamProperties
    .map((row) => resolvePropertyAccess(row, email, new Map(), globalAdmin))
    .filter((entry): entry is ResolvedPropertyAccess => Boolean(entry));

  const placeIdsNeedingLegacy = preliminary
    .filter((entry) => !entry.community.tourCommunityId && entry.community.gmbId)
    .map((entry) => entry.community.gmbId);

  const legacyTourCommunities = await listLegacyTourCommunities(placeIdsNeedingLegacy);

  const accessible = preliminary
    .map((entry) => {
      if (entry.community.tourCommunityId || !entry.community.gmbId) return entry;
      const legacy = legacyTourCommunities.get(entry.community.gmbId!);
      if (!legacy) return entry;
      return {
        ...entry,
        community: {
          ...entry.community,
          tourCommunityId: parseTourCommunityId(legacy.id) ?? entry.community.tourCommunityId,
          alias: entry.community.alias || cleanString(legacy.alias) || null,
        },
      };
    })
    .sort((left, right) => left.community.name.localeCompare(right.community.name, undefined, { sensitivity: "base" }));

  if (accessible.length === 0) {
    throw new AdminAuthError("This email is not listed on a Tour.report property team.", 403);
  }

  const selected = accessible.find((entry) => communityMatches(entry.community, requestedCommunityId)) ?? accessible[0];
  if (!selected) throw new AdminAuthError("No available property was found.", 403);

  return buildWorkspaceForAccess(user, email, accessible, selected);
}

function buildWorkspaceForAccess(
  user: User,
  email: string,
  accessible: ResolvedPropertyAccess[],
  selected: ResolvedPropertyAccess
): AdminWorkspace {
  const hasPersistedTeamMember = selected.community.teamMembers.some(
    (member) => member.email === email
  );
  // Stamp auth user id onto the active property-team member when missing (do not block auth).
  if (hasPersistedTeamMember && (!selected.teamMember.userId || selected.teamMember.userId !== user.id)) {
    selected.teamMember = { ...selected.teamMember, userId: user.id };
    void import("./property-team")
      .then(({ patchPropertyTeamMember }) =>
        patchPropertyTeamMember({
          propertyId: selected.community.propertyTygId,
          email,
          patch: { user_id: user.id },
        }),
      )
      .catch(() => {});
  }

  const profileName = selected.teamMember.name || displayNameFromUser(user);

  return {
    user: {
      id: user.id,
      email,
      fullName: profileName || null,
      title: selected.teamMember.title,
      phone: selected.teamMember.phone,
      cardAccent: selected.teamMember.cardAccent,
      aiTrainingDataFeedback: user.user_metadata?.ai_training_data_feedback === true,
    },
    teamMember: slimTeamMember(selected.teamMember, true),
    organization: {
      id: selected.organizationId,
      name: selected.community.companyName ?? "Property team",
    },
    community: slimCommunity(selected.community, email),
    // Other properties: metadata only — full team lists blow mobile SecureStore (>2KB).
    communities: accessible.map((entry) => ({
      ...entry.community,
      teamMembers: [],
    })),
  };
}

export function createMobileWorkspacePayload(workspace: AdminWorkspace, limit = 25): AdminWorkspace {
  const selectedId = workspace.community.id;
  const summaries = workspace.communities.map((community) => ({
    ...community,
    teamMembers: [],
  }));
  const selected =
    workspace.community;
  const remaining = summaries.filter((community) => !communityMatches(community, selectedId));
  return {
    ...workspace,
    communities: [selected, ...remaining].slice(0, Math.max(1, limit)),
  };
}

export async function listAccessibleBusinessOptionsForEmail(input: {
  email: string;
  query?: string;
  limit?: number;
}): Promise<AdminBusinessOption[]> {
  const email = normalizeEmail(input.email);
  if (!email) return [];
  const query = cleanString(input.query).toLowerCase();
  const limit = Math.max(1, Math.min(input.limit ?? 50, 1000));
  const globalAdmin = isGlobalPropertyAdminEmail(email);
  const rows = await listPropertyTeamRows({
    query,
    stopAfterMatches: limit,
    email: globalAdmin && query ? undefined : email,
    includeAll: globalAdmin && Boolean(query),
  });
  const businesses: AdminBusinessOption[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    const access = resolvePropertyAccess(row, email, new Map(), globalAdmin);
    if (!access) continue;
    if (query && !businessMatchesQuery(access.community, query)) continue;
    seen.add(row.id);
    businesses.push({
      id: access.community.id,
      name: access.community.name,
      companyName: access.community.companyName ?? emailDomain(email) ?? "Property team",
      gmbId: access.community.gmbId,
      alias: access.community.alias,
      calendarConnected: false,
    });
    if (businesses.length >= limit) break;
  }

  return businesses.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
  );
}

async function listLegacyTourCommunities(placeIds: Array<string | null>) {
  const wanted = Array.from(new Set(placeIds.map(cleanString).filter(Boolean)));
  const byGmbId = new Map<string, LegacyTourCommunityRow>();
  if (wanted.length === 0) return byGmbId;

  const supabase = getSupabaseServiceClient();
  await Promise.all(
    wanted.map(async (placeId) => {
      try {
        // Community.gmbId is json — PostgREST equality requires a JSON-encoded string.
        const { data, error } = await supabase
          .from("Community")
          .select("id,alias,gmbId")
          .eq("gmbId", JSON.stringify(placeId))
          .limit(1)
          .maybeSingle<LegacyTourCommunityRow>();
        if (!error && data) {
          byGmbId.set(placeId, data);
          return;
        }
      } catch {
        // Legacy bridge is optional; auth must not fail if Tour Community lookup breaks.
      }
    }),
  );
  return byGmbId;
}

function slimTeamMember(member: PropertyTeamMember, includePrefs = false): PropertyTeamMember {
  return {
    ...member,
    notificationPreferences: includePrefs ? member.notificationPreferences : null,
  };
}

function slimCommunity(community: AdminCommunity, prefsEmail: string | null): AdminCommunity {
  return {
    ...community,
    teamMembers: community.teamMembers.map((member) =>
      slimTeamMember(member, Boolean(prefsEmail && member.email === prefsEmail)),
    ),
  };
}

type ResolvedPropertyAccess = {
  community: AdminCommunity;
  teamMember: PropertyTeamMember;
  organizationId: string;
};

async function listPropertyTeamRows(options: {
  query?: string;
  stopAfterMatches?: number;
  email?: string;
  includeAll?: boolean;
} = {}): Promise<PropertyTeamRow[]> {
  const supabase = getSupabaseServiceClient();
  const rows: PropertyTeamRow[] = [];
  const pageSize = 1000;
  const query = cleanString(options.query).toLowerCase();
  const email = normalizeEmail(options.email);
  const stopAfterMatches = options.stopAfterMatches ?? 0;
  let matches = 0;

  for (let from = 0; ; from += pageSize) {
    let request = supabase
      .from("propertiesTYG")
      .select("id,name,alias,place_id,tour_video_id,property_manager,metadata")
      .order("name", { ascending: true });
    if (!options.includeAll) {
      request = request.not("metadata->property_team", "is", null);
    }
    if (email) {
      request = request.filter("metadata->property_team", "cs", JSON.stringify([{ email }]));
    }
    if (query) {
      const pattern = `*${escapePostgrestPattern(query)}*`;
      request = request.or([
        `name.ilike.${pattern}`,
        `alias.ilike.${pattern}`,
        `property_manager.ilike.${pattern}`,
        `id.ilike.${pattern}`,
      ].join(","));
    }
    const { data, error } = await request.range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as PropertyTeamRow[];
    rows.push(...batch);
    if (stopAfterMatches > 0) {
      matches += email
        ? batch.filter((row) => propertyTeamHasEmail(row.metadata, email)).length
        : batch.length;
      if (matches >= stopAfterMatches) break;
    }
    if (batch.length < pageSize) break;
  }

  return stopAfterMatches > 0 ? rows.slice(0, stopAfterMatches) : rows;
}

async function resolvePropertyAccessById(
  propertyId: string,
  email: string,
  globalAdmin = false
): Promise<ResolvedPropertyAccess | null> {
  const row = await loadPropertyTeamRowById(propertyId);
  if (!row) return null;

  const placeId = cleanString(row.place_id);
  const legacyTourCommunities = await listLegacyTourCommunities([placeId || null]);
  return resolvePropertyAccess(row, email, legacyTourCommunities, globalAdmin);
}

async function loadPropertyTeamRowById(propertyId: string): Promise<PropertyTeamRow | null> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("propertiesTYG")
    .select("id,name,alias,place_id,tour_video_id,property_manager,metadata")
    .eq("id", propertyId)
    .maybeSingle<PropertyTeamRow>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

function resolvePropertyAccess(
  row: PropertyTeamRow,
  email: string,
  legacyTourCommunities: Map<string, LegacyTourCommunityRow>,
  globalAdmin = false
): ResolvedPropertyAccess | null {
  const team = normalizePropertyTeam(row.metadata);
  const exactMember = team.find((member) => member.email === email) ?? null;
  if (!exactMember && !globalAdmin) return null;

  const visibleTeam = team;
  const teamMember = exactMember ?? globalAdminPropertyTeamMember(email);
  const domain = emailDomain(email);
  const companyName = cleanString(row.property_manager) || companyNameFromTeam(visibleTeam) || domain;
  const companySlug = slugify(companyName);
  const placeId = cleanString(row.place_id);
  const legacyTourCommunity = placeId ? legacyTourCommunities.get(placeId) ?? null : null;
  const tourCommunityId = parseTourCommunityId(row.tour_video_id) ?? parseTourCommunityId(legacyTourCommunity?.id);

  return {
    teamMember,
    organizationId: `property-team:${companySlug || row.id}`,
    community: {
      id: row.id,
      propertyTygId: row.id,
      portalCommunityId: null,
      name: cleanString(row.name) || `Property ${row.id}`,
      companyName: companyName || null,
      companySlug: companySlug || null,
      tourCommunityId,
      gmbId: placeId || null,
      alias: cleanString(row.alias) || cleanString(legacyTourCommunity?.alias) || null,
      entrataPropertyId: null,
      teamMembers: visibleTeam,
    },
  };
}

function globalAdminPropertyTeamMember(email: string): PropertyTeamMember {
  const name = email.split("@")[0]
    ?.split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "LeaseMagnets Admin";
  return {
    id: null,
    alias: slugify(name) || email.split("@")[0] || null,
    name,
    email,
    role: "LeaseMagnets Admin",
    accessRole: "admin",
    title: "Property Team",
    phone: null,
    cardAccent: "#4D8AE5",
    verified: true,
    userId: null,
    notificationPreferences: null,
  };
}

function businessMatchesQuery(community: AdminCommunity, query: string) {
  if (!query) return true;
  return [
    community.name,
    community.alias,
    community.companyName,
    community.propertyTygId,
  ].some((value) => cleanString(value).toLowerCase().includes(query));
}

function propertyTeamHasEmail(metadata: unknown, email: string) {
  return normalizePropertyTeam(metadata).some((member) => member.email === email);
}

function normalizeLegacyGmbId(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === "string" ? parsed.trim() : trimmed;
    } catch {
      return trimmed;
    }
  }
  return cleanString(value);
}

function normalizePropertyTeam(metadata: unknown): PropertyTeamMember[] {
  if (!isRecord(metadata) || !Array.isArray(metadata.property_team)) return [];

  const seen = new Set<string>();
  return metadata.property_team
    .map((value) => {
      if (!isRecord(value)) return null;
      const email = normalizeEmail(value.email);
      if (!email || seen.has(email)) return null;
      seen.add(email);
      const role = cleanString(value.role) || "Property Team";
      const title = cleanString(value.title) || null;
      const prefsRaw = value.notification_preferences ?? value.notificationPreferences;
      const notificationPreferences = isRecord(prefsRaw)
        ? Object.fromEntries(
            Object.entries(prefsRaw).filter(([, pref]) => typeof pref === "boolean")
          ) as Record<string, boolean>
        : null;
      return {
        id: cleanString(value.id ?? value.user_id ?? value.userId) || null,
        alias: cleanString(value.alias ?? value.user_alias ?? value.userAlias) || null,
        name: cleanString(value.name) || email.split("@")[0] || "Team member",
        email,
        role,
        accessRole: accessRoleForPropertyTeamRole(role),
        title,
        phone: cleanString(value.phone) || null,
        cardAccent: cleanString(value.card_accent ?? value.cardAccent) || null,
        verified: typeof value.verified === "boolean" ? value.verified : null,
        userId: cleanString(value.user_id ?? value.userId) || null,
        notificationPreferences,
      } satisfies PropertyTeamMember;
    })
    .filter((member): member is PropertyTeamMember => Boolean(member));
}

function accessRoleForPropertyTeamRole(role: string): AdminRole {
  const normalized = role.toLowerCase();
  if (/owner|corporate|regional|\brm\b|\brsm\b|manager|executive|admin/.test(normalized)) {
    return "manager";
  }
  return "member";
}

function communityMatches(community: AdminCommunity, requested: string | null | undefined) {
  if (!requested) return false;
  const normalized = requested.trim().replace(/^@/, "").toLowerCase();
  return [
    community.id,
    community.propertyTygId,
    community.portalCommunityId,
    community.alias,
    community.tourCommunityId === null ? null : String(community.tourCommunityId),
  ].some((value) => value !== null && String(value).replace(/^@/, "").toLowerCase() === normalized);
}

function parseTourCommunityId(value: unknown) {
  const candidate = isRecord(value)
    ? value.community_id ?? value.communityId ?? value.tourCommunityId
    : value;
  const parsed = Number(candidate);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function companyNameFromTeam(team: PropertyTeamMember[]) {
  const domains = team.map((member) => emailDomain(member.email)).filter(Boolean);
  return domains[0] ?? "";
}

function displayNameFromUser(user: User) {
  const metadataName = cleanString(user.user_metadata?.full_name ?? user.user_metadata?.name);
  if (metadataName) return metadataName;
  return (user.email?.split("@")[0] ?? "Tour user")
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeEmail(value: unknown) {
  return cleanString(value).toLowerCase();
}

function emailDomain(value: unknown) {
  return normalizeEmail(value).split("@")[1] ?? "";
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
}

function escapePostgrestPattern(value: string) {
  return value.replace(/[%*_\\]/g, (char) => `\\${char}`).replace(/,/g, "\\,");
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function resolveFallbackAdminContext(
  requestedCommunityId?: string | null
): Promise<AdminWorkspace> {
  const communityRows = await listFallbackCommunities();
  const community =
    communityRows.find((row) => row.id === requestedCommunityId) ??
    communityRows.find((row) => row.id === DEFAULT_TOUR_COMMUNITY_ID) ??
    communityRows[0] ??
    fallbackCommunityRows[0]!;

  return {
    user: {
      id: "tour-demo-user",
      email: "lease@tour.video",
      fullName: "LeaseMagnets",
      title: "Leasing Consultant",
      phone: null,
      cardAccent: "#006CE5",
    },
    teamMember: {
      id: null,
      alias: null,
      name: "LeaseMagnets",
      email: "lease@tour.video",
      role: "LeaseMagnets Admin",
      accessRole: "admin",
      title: "Leasing Consultant",
      phone: null,
      cardAccent: "#006CE5",
      verified: true,
      userId: null,
      notificationPreferences: null,
    },
    organization: {
      id: community.company_id,
      name: "LeaseMagnets",
    },
    community: {
      id: community.id,
      propertyTygId: community.id,
      portalCommunityId: community.id,
      name: community.name,
      companyName: "LeaseMagnets",
      companySlug: "leasemagnets",
      tourCommunityId: community.tour_community_id,
      gmbId: community.gmb_id,
      alias: community.alias,
      entrataPropertyId: community.entrata_property_id,
      teamMembers: [],
    },
    communities: communityRows.map((row) => ({
      id: row.id,
      propertyTygId: row.id,
      portalCommunityId: row.id,
      name: formatCommunityDisplayName(row),
      companyName: "LeaseMagnets",
      companySlug: "leasemagnets",
      tourCommunityId: row.tour_community_id,
      gmbId: row.gmb_id,
      alias: row.alias,
      entrataPropertyId: row.entrata_property_id,
      teamMembers: [],
    })),
  };
}

/** Build a workspace for system jobs (cron) without an authenticated user. */
export async function buildSystemWorkspaceForProperty(propertyId: string): Promise<AdminWorkspace> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("propertiesTYG")
    .select("id,name,alias,place_id,tour_video_id,property_manager,metadata")
    .eq("id", propertyId)
    .maybeSingle<PropertyTeamRow>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Property not found: ${propertyId}`);

  const placeId = cleanString(data.place_id);
  const legacyTourCommunities = await listLegacyTourCommunities([placeId || null]);
  const legacyTourCommunity = placeId ? legacyTourCommunities.get(placeId) ?? null : null;
  const tourCommunityId = parseTourCommunityId(data.tour_video_id) ?? parseTourCommunityId(legacyTourCommunity?.id);
  const team = normalizePropertyTeam(data.metadata);
  const companyName = cleanString(data.property_manager) || companyNameFromTeam(team) || "Property team";
  const companySlug = slugify(companyName);
  const community: AdminCommunity = {
    id: data.id,
    propertyTygId: data.id,
    portalCommunityId: null,
    name: cleanString(data.name) || `Property ${data.id}`,
    companyName: companyName || null,
    companySlug: companySlug || null,
    tourCommunityId,
    gmbId: placeId || null,
    alias: cleanString(data.alias) || cleanString(legacyTourCommunity?.alias) || null,
    entrataPropertyId: null,
    teamMembers: team,
  };

  return {
    user: {
      id: "system-cron",
      email: "cron@tour.you",
      fullName: "System Cron",
      title: null,
      phone: null,
      cardAccent: null,
    },
    teamMember: {
      id: "system-cron",
      alias: "system-cron",
      name: "System Cron",
      email: "cron@tour.you",
      role: "admin",
      accessRole: "admin",
      title: null,
      phone: null,
      cardAccent: null,
      verified: true,
      userId: null,
      notificationPreferences: null,
    },
    organization: {
      id: `property-team:${companySlug || data.id}`,
      name: companyName,
    },
    community,
    communities: [community],
  };
}

export function adminCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function setAdminAccessCookie(
  response: CookieResponse,
  token: string,
  maxAge: number
) {
  deleteAdminAccessCookies(response);
  const options = adminCookieOptions(maxAge);
  if (token.length <= COOKIE_CHUNK_SIZE) {
    response.cookies.set(ADMIN_ACCESS_COOKIE, token, options);
    return;
  }
  const chunks = token.match(new RegExp(`.{1,${COOKIE_CHUNK_SIZE}}`, "g")) ?? [];
  chunks.forEach((chunk, index) => {
    response.cookies.set(`${ADMIN_ACCESS_COOKIE}.${index}`, chunk, options);
  });
}

export function deleteAdminAccessCookies(response: CookieResponse) {
  response.cookies.delete(ADMIN_ACCESS_COOKIE);
  for (let index = 0; index < MAX_ACCESS_COOKIE_CHUNKS; index += 1) {
    response.cookies.delete(`${ADMIN_ACCESS_COOKIE}.${index}`);
  }
}

export function authAccessCookieMaxAge(session: {
  expires_at?: number | null;
  expires_in?: number | null;
}) {
  if (typeof session.expires_at === "number" && Number.isFinite(session.expires_at)) {
    return Math.max(60, session.expires_at - Math.floor(Date.now() / 1000));
  }
  if (typeof session.expires_in === "number" && Number.isFinite(session.expires_in)) {
    return Math.max(60, session.expires_in);
  }
  return 60 * 60;
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }
  return null;
}

function readChunkedCookie(request: Request, name: string) {
  const direct = readCookie(request, name);
  if (direct) return direct;

  const chunks: string[] = [];
  for (let index = 0; index < MAX_ACCESS_COOKIE_CHUNKS; index += 1) {
    const chunk = readCookie(request, `${name}.${index}`);
    if (!chunk) break;
    chunks.push(chunk);
  }
  return chunks.length > 0 ? chunks.join("") : null;
}

function companyForCommunity(row: CommunityRow) {
  if (!row.companies) return null;
  return Array.isArray(row.companies) ? row.companies[0] : row.companies;
}

function communityDisplayInput(
  row: CommunityRow,
  fallbackCompany?: { name: string; slug: string } | null
) {
  const company = companyForCommunity(row) ?? fallbackCompany ?? null;
  return {
    name: row.name,
    companyName: company?.name ?? null,
    companySlug: company?.slug ?? null,
  };
}

async function listFallbackCommunities(): Promise<CommunityRow[]> {
  try {
    const supabase = getSupabaseServiceClient();
    const data: unknown[] = [];
    const pageSize = 1000;

    for (let from = 0; ; from += pageSize) {
      const { data: batch, error } = await supabase
        .from("propertiesTYG")
        .select("id,name,tour_video_id,place_id,alias,property_manager")
        .order("name", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw new Error(error.message);
      data.push(...(batch ?? []));
      if ((batch ?? []).length < pageSize) break;
    }

    const rows = data.map((row) => {
      const property = row as {
        id: string;
        name: string | null;
        tour_video_id: unknown;
        place_id: string | null;
        alias: string | null;
        property_manager: string | null;
      };
      return {
        id: property.id,
        name: property.name?.trim() || `Property ${property.id}`,
        tour_community_id: parseTourCommunityId(property.tour_video_id),
        gmb_id: property.place_id,
        alias: property.alias,
        entrata_property_id: null,
        company_id: `property-team:${slugify(property.property_manager || property.id)}`,
      } satisfies CommunityRow;
    });
    return rows.length > 0 ? rows : fallbackCommunityRows;
  } catch {
    return fallbackCommunityRows;
  }
}

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice(7).trim() || null;
}
