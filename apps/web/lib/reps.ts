/**
 * Typed registry of leasing reps and their tour cards.
 *
 * This is a config-file source of truth for now. It is intentionally shaped so a
 * Supabase `reps` table can replace `REPS` later without touching consumers:
 * `getRepCard(slug)` is the only lookup callers should use.
 */

export type RepProfile = {
  slug: string;
  name: string;
  /** Single-letter avatar fallback when `avatarUrl` is absent. */
  initials: string;
  title: string;
  company: string;
  email: string;
  /** E.164 for tel: links and SMS. */
  phoneValue: string;
  /** Human-friendly phone for display. */
  phoneDisplay: string;
  website?: string;
  websiteDisplay?: string;
  linkedin?: string;
  linkedinDisplay?: string;
  avatarUrl?: string;
  brandLogoUrl?: string;
  /** Profile card accent color for CTAs (property_team.card_accent). */
  cardAccent?: string | null;
};

export type PropertyProfile = {
  id?: string;
  name: string;
  /** Looping hero video/image shown behind the card header. */
  mediaUrl: string;
  mediaKind?: "video" | "image";
  /** Still apartment/property photos used in generated social/MMS cards. */
  galleryImageUrls?: string[];
};

export type CheckInQuestion = {
  id: string;
  label: string;
  type: "select" | "text";
  /** Options for `select` questions. */
  options?: string[];
  placeholder?: string;
  required?: boolean;
};

export type RepCard = {
  rep: RepProfile;
  property: PropertyProfile;
  questions: CheckInQuestion[];
};

/** The mockup's three qualifying questions — the default per-property set. */
export const DEFAULT_QUESTIONS: CheckInQuestion[] = [
  {
    id: "hear_about",
    label: "Where did you hear about us?",
    type: "select",
    options: ["Google", "Apartments.com", "Drive by", "Referral", "Social media", "Other"],
    placeholder: "Select one"
  },
  {
    id: "move_in",
    label: "When are you looking to move in?",
    type: "select",
    options: ["ASAP", "Within 1 month", "1–3 months", "3–6 months", "Just browsing"],
    placeholder: "Select a timeframe"
  },
  {
    id: "floor_plan",
    label: "Which floor plan interests you most?",
    type: "select",
    options: ["1 bedroom", "2 bedroom", "3 bedroom", "4 bedroom", "Not sure yet"],
    placeholder: "Select a floor plan"
  }
];

const REPS: Record<string, RepCard> = {
  amulya: {
    rep: {
      slug: "amulya",
      name: "Amulya Parmar",
      initials: "A",
      title: "Leasing Agent",
      company: "TYG Apartments",
      email: "amulya@leasemagnets.com",
      phoneValue: "+15862588588",
      phoneDisplay: "1 (586) 258-8588",
      website: "https://leasemagnets.com",
      websiteDisplay: "leasemagnets.com",
      linkedin: "https://linkedin.com/in/amulyaparmar",
      linkedinDisplay: "linkedin.com/in/amulyaparmar"
    },
    property: {
      name: "TYG Apartments",
      mediaUrl:
        "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/44/intro_revamp_intro/27_North_intro_2024_mp4_1.mp4#t=8",
      galleryImageUrls: [
        "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/44/magnet/f020cff3-ba56-4d5c-ab20-f0d37ca493c6/amenities_Pool/27NPool.mp4.jpg",
        "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/44/magnet/f020cff3-ba56-4d5c-ab20-f0d37ca493c6/amenities_Gym/27NFitness20Center.mp4.jpg",
        "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/44/magnet/f020cff3-ba56-4d5c-ab20-f0d37ca493c6/amenities_Clubhouse/27NClubhouse.mp4.jpg"
      ]
    },
    questions: DEFAULT_QUESTIONS
  },
  alex: {
    rep: {
      slug: "alex",
      name: "Alex Johnson",
      initials: "A",
      title: "Sales Agent",
      company: "Tour.video",
      email: "alex@tour.video",
      phoneValue: "+13135550148",
      phoneDisplay: "(313) 555-0148",
      website: "https://tour.you/p/alex",
      websiteDisplay: "tour.you/p/alex"
    },
    property: {
      name: "27 North",
      mediaUrl:
        "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/44/intro_revamp_intro/27_North_intro_2024_mp4_1.mp4#t=8",
      galleryImageUrls: [
        "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/44/magnet/f020cff3-ba56-4d5c-ab20-f0d37ca493c6/amenities_Pool/27NPool.mp4.jpg",
        "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/44/magnet/f020cff3-ba56-4d5c-ab20-f0d37ca493c6/amenities_Gym/27NFitness20Center.mp4.jpg",
        "https://storage.googleapis.com/leasemagnets---dummy-db.appspot.com/community/44/magnet/f020cff3-ba56-4d5c-ab20-f0d37ca493c6/amenities_Clubhouse/27NClubhouse.mp4.jpg"
      ]
    },
    questions: DEFAULT_QUESTIONS
  }
};

export function getRepCard(slug: string): RepCard | null {
  return REPS[slug.toLowerCase()] ?? null;
}

/** Splits a vCard family/given name out of a display name. */
function splitName(name: string): { given: string; family: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { given: parts[0] ?? "", family: "" };
  }
  return { given: parts.slice(0, -1).join(" "), family: parts[parts.length - 1] ?? "" };
}

/** A vCard (VERSION 3.0) string for the rep — used for "Save Agent Contact". */
export function buildVCard(rep: RepProfile): string {
  const { given, family } = splitName(rep.name);
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${family};${given};;;`,
    `FN:${rep.name}`,
    `ORG:${rep.company}`,
    `TITLE:${rep.title}`,
    `TEL;TYPE=CELL:${rep.phoneValue}`,
    `EMAIL:${rep.email}`
  ];
  if (rep.website) lines.push(`URL:${rep.website}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

/** A `data:` URL that downloads the rep's contact card as a `.vcf`. */
export function vCardDownloadUrl(rep: RepProfile): string {
  return `data:text/vcard;charset=utf-8,${encodeURIComponent(buildVCard(rep))}`;
}

/** A QR code SVG (via api.qrserver.com) encoding the rep's vCard for offline saving. */
export function offlineContactQrUrl(rep: RepProfile): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=196x196&margin=12&format=svg&data=${encodeURIComponent(
    buildVCard(rep)
  )}`;
}

/** A QR code SVG that points at the rep's public tour card / check-in form. */
export function tourRequestQrUrl(rep: RepProfile): string {
  const url = new URL(rep.website ?? `https://tour.you/p/${rep.slug}`);
  url.searchParams.set("check-in", "true");
  return `https://api.qrserver.com/v1/create-qr-code/?size=196x196&margin=12&format=svg&data=${encodeURIComponent(
    url.toString()
  )}`;
}
