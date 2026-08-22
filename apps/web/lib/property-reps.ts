import "server-only";

import { toPublicAlias } from "@tour/shared";

import { DEFAULT_QUESTIONS, type PropertyProfile, type RepCard } from "./reps";
import { getPropertyHeroMedia } from "./materials";
import { getSupabaseServiceClient } from "./supabase";

type PropertyRepRow = {
  id: string;
  name: string | null;
  alias: string | null;
  website: string | null;
  thumbnail_url: string | null;
  property_manager: string | null;
  metadata: unknown;
};

export async function getPropertyProfile(propertyId: string): Promise<PropertyProfile | null> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("propertiesTYG")
    .select("id,name,thumbnail_url")
    .eq("id", propertyId)
    .maybeSingle<Pick<PropertyRepRow, "id" | "name" | "thumbnail_url">>();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const mediaUrl = cleanString(data.thumbnail_url);
  return {
    id: data.id,
    name: cleanString(data.name) || "Property",
    mediaUrl,
    mediaKind: mediaUrl ? "image" : undefined,
  };
}

/** Property-level public check-in card used when a session has no matched agent. */
export async function getPropertyCheckInCard(propertyIdentity: string): Promise<RepCard | null> {
  const property = await findPropertyByIdentity(propertyIdentity);
  if (!property) return null;

  const propertyName = cleanString(property.name) || "Property";
  const heroMedia = await getPropertyHeroMedia(property.id).catch(() => null);
  return {
    rep: {
      // An empty slug intentionally keeps property-only check-ins unassigned.
      slug: "",
      name: "Leasing Team",
      initials: "LT",
      title: "Property Team",
      company: cleanString(property.property_manager) || propertyName,
      email: "",
      phoneValue: "",
      phoneDisplay: "",
      website: property.website || undefined,
      websiteDisplay: property.website ? property.website.replace(/^https?:\/\//, "").replace(/\/$/, "") : undefined,
      cardAccent: null,
    },
    property: {
      id: property.id,
      name: propertyName,
      mediaUrl: heroMedia?.url || property.thumbnail_url || "",
      mediaKind: heroMedia?.kind ?? (property.thumbnail_url ? "image" : undefined),
    },
    questions: DEFAULT_QUESTIONS,
  };
}

export async function getPropertyRepCard(
  propertyIdentity: string,
  memberIdentity: string
): Promise<RepCard | null> {
  // Strip accidental query/hash fragments if a shared URL stuffed them into the path segment.
  const memberKey = memberIdentity.trim().replace(/^@/, "").split(/[?#]/)[0]!.toLowerCase();
  if (!memberKey) return null;

  const property = await findPropertyByIdentity(propertyIdentity);
  if (!property || !isRecord(property.metadata) || !Array.isArray(property.metadata.property_team)) return null;

  const member = property.metadata.property_team.find((candidate) => {
    if (!isRecord(candidate)) return false;
    const email = cleanString(candidate.email).toLowerCase();
    const emailKey = email.split("@")[0] ?? "";
    const nameKey = toPublicAlias(cleanString(candidate.name) || null);
    return [candidate.alias, candidate.id, candidate.user_id, candidate.userId]
      .map((value) => cleanString(value).replace(/^@/, "").toLowerCase())
      .concat(emailKey, nameKey)
      .filter(Boolean)
      .includes(memberKey);
  });
  if (!isRecord(member)) return null;

  const email = cleanString(member.email);
  const name = cleanString(member.name)
    || email.split("@")[0]
    || "Property team member";
  const phoneValue = normalizePhone(cleanString(member.phone));
  const title = cleanString(member.title) || cleanString(member.role) || "Property Team";
  const slug = toPublicAlias(cleanString(member.alias) || null)
    || toPublicAlias(name)
    || toPublicAlias(email.split("@")[0])
    || cleanString(member.id ?? member.user_id ?? member.userId)
    || memberKey;
  const cardAccent = cleanString(member.card_accent ?? member.cardAccent) || null;
  const propertyName = cleanString(property.name) || "Property";
  const heroMedia = await getPropertyHeroMedia(property.id).catch(() => null);
  return {
    rep: {
      slug,
      name,
      initials: initialsForName(name),
      title,
      company: cleanString(property.property_manager) || propertyName,
      email,
      phoneValue,
      phoneDisplay: formatPhone(phoneValue),
      website: property.website || undefined,
      websiteDisplay: property.website ? property.website.replace(/^https?:\/\//, "").replace(/\/$/, "") : undefined,
      cardAccent,
    },
    property: {
      id: property.id,
      name: propertyName,
      mediaUrl: heroMedia?.url || property.thumbnail_url || "",
      mediaKind: heroMedia?.kind ?? (property.thumbnail_url ? "image" : undefined),
    },
    questions: DEFAULT_QUESTIONS,
  };
}

async function findPropertyByIdentity(propertyIdentity: string): Promise<PropertyRepRow | null> {
  const supabase = getSupabaseServiceClient();
  const rawIdentity = propertyIdentity.trim().replace(/^@/, "").split(/[?#]/)[0]!;
  const propertyKey = toPublicAlias(rawIdentity);
  if (!propertyKey) return null;

  const { data: byId, error: idError } = await supabase
    .from("propertiesTYG")
    .select("id,name,alias,website,thumbnail_url,property_manager,metadata")
    .eq("id", rawIdentity)
    .maybeSingle<PropertyRepRow>();
  if (idError) throw new Error(idError.message);
  if (byId) return byId;

  const { data: byAlias, error: aliasError } = await supabase
    .from("propertiesTYG")
    .select("id,name,alias,website,thumbnail_url,property_manager,metadata")
    .ilike("alias", propertyKey)
    .maybeSingle<PropertyRepRow>();
  if (aliasError) throw new Error(aliasError.message);
  if (byAlias) return byAlias;

  const { data: prefixedAlias, error: prefixedAliasError } = await supabase
    .from("propertiesTYG")
    .select("id,name,alias,website,thumbnail_url,property_manager,metadata")
    .ilike("alias", `@${propertyKey}`)
    .maybeSingle<PropertyRepRow>();
  if (prefixedAliasError) throw new Error(prefixedAliasError.message);
  if (prefixedAlias) return prefixedAlias;

  // The link generator falls back to a slug of the live property name when an
  // alias has not been saved. Narrow by its words, then confirm the exact slug.
  const namePattern = propertyKey.split("-").filter(Boolean).join("%");
  const { data: nameMatches, error: nameError } = await supabase
    .from("propertiesTYG")
    .select("id,name,alias,website,thumbnail_url,property_manager,metadata")
    .ilike("name", namePattern)
    .order("id", { ascending: true })
    .limit(100);
  if (nameError) throw new Error(nameError.message);
  const propertyRows: PropertyRepRow[] = Array.isArray(nameMatches as unknown)
    ? (nameMatches as unknown[]).filter(isPropertyRepRow)
    : [];
  return propertyRows.find((row) =>
    toPublicAlias(row.alias) === propertyKey || toPublicAlias(row.name) === propertyKey
  ) ?? null;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPropertyRepRow(value: unknown): value is PropertyRepRow {
  if (!isRecord(value) || typeof value.id !== "string") return false;
  return [value.name, value.alias, value.website, value.thumbnail_url, value.property_manager]
    .every((field) => field === null || typeof field === "string");
}

function initialsForName(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "T";
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  return phone.startsWith("+") ? `+${digits}` : digits;
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return phone || "Phone not provided";
}
