import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { getApiBaseUrl } from "./config";

const SESSION_KEY = "tour.mobile.session.v2";

function apiBaseUrl() {
  return getApiBaseUrl();
}

export type MobileWorkspace = {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    title?: string | null;
    phone?: string | null;
    cardAccent?: string | null;
    aiTrainingDataFeedback?: boolean;
  };
  teamMember: {
    id: string | null;
    alias: string | null;
    name: string;
    email: string;
    role: string;
    accessRole: "admin" | "manager" | "member";
    title?: string | null;
    phone: string | null;
    cardAccent?: string | null;
    verified: boolean | null;
    userId?: string | null;
    notificationPreferences?: Record<string, boolean> | null;
  };
  organization: {
    id: string;
    name: string;
  };
  community: {
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
    teamMembers: Array<{
      id: string | null;
      alias: string | null;
      name: string;
      email: string;
      role: string;
      accessRole: "admin" | "manager" | "member";
      title?: string | null;
      phone: string | null;
      cardAccent?: string | null;
      verified: boolean | null;
      userId?: string | null;
      notificationPreferences?: Record<string, boolean> | null;
    }>;
  };
  communities: Array<{
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
    teamMembers: MobileWorkspace["community"]["teamMembers"];
  }>;
};

export type BusinessOption = {
  id: string;
  name: string;
  companyName: string;
  gmbId: string | null;
  alias: string | null;
  calendarConnected: boolean;
};

export type MobileAuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  workspace: MobileWorkspace;
};

export type MobileSignInChallenge = {
  email: string;
  challengeId: string;
  emailSent: boolean;
};

export type CommunityEnrichment = {
  communityId: string;
  state: "enriched" | "indexed" | "not_linked";
  match: "property_id" | "place_id" | "normalized_name" | null;
  reportPropertyId: string | null;
  marketKey: string | null;
  thumbnailUrl: string | null;
  unitCount: number | string | null;
  propertyManager: string | null;
  teamRole: string | null;
};

export type PropertyOnboardingCandidate = {
  placeId: string;
  name: string;
  address: string;
  website: string | null;
  state: "new" | "indexed" | "enriched";
  alreadyAssigned: boolean;
  thumbnailUrl: string | null;
};

let currentSession: MobileAuthSession | null = null;
let refreshPromise: Promise<MobileAuthSession | null> | null = null;

export function getCurrentSession() {
  return currentSession;
}

export function authorizedCommunitiesForSession(
  session: MobileAuthSession
): MobileWorkspace["communities"] {
  const communities = Array.isArray(session.workspace?.communities)
    ? session.workspace.communities
    : [];

  // Server already filtered to properties this email belongs to; don't require
  // embedded teamMembers on non-active properties.
  const seen = new Set<string>();
  return communities.filter((community) => {
    if (!community?.id || seen.has(community.id)) return false;
    seen.add(community.id);
    return true;
  });
}

export async function restoreSession() {
  const storedSession = await readPersistedSession();
  if (!storedSession) return null;

  currentSession = storedSession;
  const tokenStillValid = storedSession.expiresAt > Math.floor(Date.now() / 1000) + 30;
  // A valid access token does not need a network round-trip on every launch.
  // Returning the persisted session immediately also keeps a temporary API
  // outage from turning an ordinary app restart into a sign-out.
  if (tokenStillValid && hasCanonicalWorkspace(storedSession)) {
    return storedSession;
  }

  try {
    // The access token expired, so rotate it with the persisted refresh token.
    // Cap the wait so a slow API cannot leave the app on the splash forever.
    const refreshed = await Promise.race([
      refreshSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 12_000)),
    ]);
    if (refreshed) return refreshed;
    if (!currentSession) return null;
    // Keep the saved login during transient server/network failures. API calls
    // will retry the refresh; only a definitive auth rejection clears storage.
    currentSession = storedSession;
    return storedSession;
  } catch {
    if (!currentSession) return null;
    currentSession = storedSession;
    return storedSession;
  }
}

export async function listBusinesses(query = "", options: { email?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  const normalizedQuery = query.trim();
  if (normalizedQuery) params.set("q", normalizedQuery);
  if (options.email?.trim()) params.set("email", options.email.trim().toLowerCase());
  params.set("limit", String(options.limit ?? 50));
  const path = `/api/admin/auth/businesses?${params.toString()}`;
  const response = currentSession
    ? await authenticatedFetch(path, { cache: "no-store" })
    : await fetch(`${apiBaseUrl()}${path}`, { cache: "no-store" });
  let body = await response.json().catch(() => null) as {
    businesses?: BusinessOption[];
    hasMore?: boolean;
    error?: string;
  } | null;
  if (!response.ok) throw new Error(body?.error ?? "Could not load communities.");
  return body?.businesses ?? [];
}

export async function signIn(email: string, password: string, communityId: string) {
  const response = await fetch(`${apiBaseUrl()}/api/admin/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tour-client": "mobile",
    },
    body: JSON.stringify({ email, password, communityId }),
  });
  let body = await response.json().catch(() => null) as {
    workspace?: MobileWorkspace;
    session?: Omit<MobileAuthSession, "workspace">;
    error?: string;
  } | null;
  if (!response.ok || !body?.workspace || !body.session) {
    throw new Error(body?.error ?? "Sign in failed.");
  }
  return persistSession({ ...body.session, workspace: body.workspace });
}

export async function requestSignInCode(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  assertWorkEmail(normalizedEmail);

  const request = () => fetch(`${apiBaseUrl()}/api/admin/auth/otp/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tour-client": "mobile",
    },
    body: JSON.stringify({ email: normalizedEmail }),
  });

  let response: Response;
  try {
    response = await request();
  } catch {
    // The server can deliver the email before a mobile connection times out.
    // Retry once so the app can receive the challenge and show code entry.
    await new Promise((resolve) => setTimeout(resolve, 700));
    try {
      response = await request();
    } catch {
      throw new Error("Could not send a sign-in code. Check your connection and try again.");
    }
  }

  let body = await response.json().catch(() => null) as {
    sent?: boolean;
    email?: string;
    challengeId?: string;
    error?: string;
  } | null;
  const challengeId = body?.challengeId?.trim() ?? "";
  // A recent request is rate-limited, but the API may return the still-active
  // challenge so the user can enter the code that was already delivered.
  if (challengeId) {
    return {
      email: body?.email ?? normalizedEmail,
      challengeId,
      emailSent: body?.sent !== false,
    } satisfies MobileSignInChallenge;
  }

  if (!response.ok && response.status >= 500) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const retryResponse = await request().catch(() => null);
    if (retryResponse) {
      const retryBody = await retryResponse.json().catch(() => null) as typeof body;
      const retryChallengeId = retryBody?.challengeId?.trim() ?? "";
      if (retryChallengeId) {
        return {
          email: retryBody?.email ?? normalizedEmail,
          challengeId: retryChallengeId,
          emailSent: retryBody?.sent !== false,
        } satisfies MobileSignInChallenge;
      }
      response = retryResponse;
      body = retryBody;
    }
  }
  const responseError = body?.error
    ?? (response.ok
      ? "The sign-in service did not return a verification challenge."
      : `${deliveryErrorForStatus(response.status)} (HTTP ${response.status})`);
  throw new Error(`${responseError} [${response.status} ${apiBaseUrl()}]`);
}

export async function verifySignInCode(email: string, challengeId: string, code: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedChallengeId = challengeId.trim();
  const normalizedCode = code.replace(/\s+/g, "");

  try {
    const response = await fetch(`${apiBaseUrl()}/api/admin/auth/otp/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tour-client": "mobile",
      },
      body: JSON.stringify({
        email: normalizedEmail,
        challengeId: normalizedChallengeId,
        code: normalizedCode,
      }),
    });
    const body = await response.json().catch(() => null) as {
      workspace?: MobileWorkspace;
      session?: Omit<MobileAuthSession, "workspace">;
      onboardingRequired?: boolean;
      error?: string;
    } | null;
    if (response.ok && body?.workspace && body.session) {
      return persistSession({ ...body.session, workspace: body.workspace });
    }
    if (body?.onboardingRequired) {
      throw new Error("No property is connected to this email yet. Use tour.you to claim or join a property.");
    }
    throw new Error(body?.error ?? "The verification code is invalid or has expired.");
  } catch (caught) {
    if (caught instanceof Error) throw caught;
    throw new Error("Could not finish signing in. Check your connection and try again.");
  }
}

function assertWorkEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) throw new Error("Enter a valid work email address.");
  if (domain === "gmail.com" || domain === "googlemail.com") {
    throw new Error("Use the work email connected to your Tour account.");
  }
}

function deliveryErrorForStatus(status: number) {
  if (status === 429) return "Too many code requests. Wait a minute, then try again.";
  if (status >= 500) return "Email delivery is temporarily unavailable. Please try again shortly.";
  return "Could not send a sign-in code to this email.";
}

export async function switchCommunity(communityId: string) {
  const response = await authenticatedFetch("/api/admin/auth/community", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ communityId }),
  });
  const body = await response.json().catch(() => null) as {
    workspace?: MobileWorkspace;
    error?: string;
  } | null;
  if (!response.ok || !body?.workspace || !currentSession) {
    throw new Error(body?.error ?? "Could not switch community.");
  }
  return persistSession({ ...currentSession, workspace: body.workspace });
}

export async function updateWorkspaceAliases(input: {
  userAlias: string | null;
  propertyAlias: string | null;
}) {
  const response = await authenticatedFetch("/api/admin/settings/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => null) as {
    workspace?: MobileWorkspace;
    error?: string;
  } | null;
  if (!response.ok || !body?.workspace || !currentSession) {
    throw new Error(body?.error ?? "Could not save check-in aliases.");
  }
  return persistSession({ ...currentSession, workspace: body.workspace });
}

export async function listCommunityEnrichment() {
  const response = await authenticatedFetch("/api/admin/properties/enrichment", {
    cache: "no-store",
  });
  const body = await response.json().catch(() => null) as {
    communities?: CommunityEnrichment[];
    error?: string;
  } | null;
  if (!response.ok || !Array.isArray(body?.communities)) {
    throw new Error(body?.error ?? "Could not load property intelligence.");
  }
  return body.communities;
}

export async function searchPropertiesForOnboarding(query: string) {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return [];
  const response = await authenticatedFetch(
    `/api/admin/properties/onboard?q=${encodeURIComponent(normalizedQuery)}`,
    { cache: "no-store" }
  );
  const body = await response.json().catch(() => null) as {
    properties?: PropertyOnboardingCandidate[];
    error?: string;
  } | null;
  if (!response.ok || !Array.isArray(body?.properties)) {
    throw new Error(body?.error ?? "Could not search properties.");
  }
  return body.properties;
}

export async function onboardProperty(placeId: string) {
  const response = await authenticatedFetch("/api/admin/properties/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId }),
  });
  const body = await response.json().catch(() => null) as {
    workspace?: MobileWorkspace;
    property?: {
      id: string;
      name: string | null;
      state: "indexed" | "enriched";
      enrichmentStarted: boolean;
    };
    error?: string;
  } | null;
  if (!response.ok || !body?.workspace || !body.property || !currentSession) {
    throw new Error(body?.error ?? "Could not add this property.");
  }
  const session = await persistSession({ ...currentSession, workspace: body.workspace });
  return { session, property: body.property };
}

export async function clearSession() {
  currentSession = null;
  await deleteStoredSession();
}

export async function authenticatedFetch(path: string, init: RequestInit = {}) {
  const session = currentSession;
  if (!session) throw new Error("Sign in is required.");

  const response = await fetch(`${apiBaseUrl()}${path}`, withAuth(init, session));
  if (response.status !== 401) return response;

  // FormData bodies are consumed on the first request and cannot be retried.
  if (init.body instanceof FormData) {
    return response;
  }

  const refreshed = await refreshSession();
  if (!refreshed) return response;
  return fetch(`${apiBaseUrl()}${path}`, withAuth(init, refreshed));
}

async function refreshSession() {
  if (!currentSession?.refreshToken) return null;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const response = await fetch(`${apiBaseUrl()}/api/admin/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tour-client": "mobile",
      },
      body: JSON.stringify({
        refreshToken: currentSession?.refreshToken,
        communityId: currentSession?.workspace.community.id,
      }),
    });
    const body = await response.json().catch(() => null) as {
      workspace?: MobileWorkspace;
      session?: Omit<MobileAuthSession, "workspace">;
    } | null;
    if (!response.ok || !body?.workspace || !body.session) {
      // 401 means Supabase definitively rejected the refresh token. Preserve
      // the persisted session for temporary 5xx responses and malformed
      // responses so a flaky launch cannot permanently log the user out.
      if (response.status === 401) await clearSession();
      return null;
    }
    return persistSession({ ...body.session, workspace: body.workspace });
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function persistSession(session: MobileAuthSession) {
  if (!hasCanonicalWorkspace(session)) {
    throw new Error("Your property access could not be verified. Please sign in again.");
  }
  currentSession = session;
  try {
    const raw = JSON.stringify(session);
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(SESSION_KEY, raw);
    } else {
      await AsyncStorage.setItem(SESSION_KEY, raw);
    }
  } catch {
    // Disk write failed; in-memory session still works this launch.
  }
  return currentSession;
}

function hasCanonicalWorkspace(session: MobileAuthSession) {
  const workspace = session?.workspace;
  if (
    !workspace?.teamMember?.role ||
    !workspace.community?.id ||
    !Array.isArray(workspace.communities)
  ) return false;
  const authorized = authorizedCommunitiesForSession(session);
  return (
    authorized.length > 0 &&
    authorized.length === workspace.communities.length &&
    authorized.some((community) => community.id === workspace.community.id)
  );
}

/** Update in-memory + persisted session (e.g. after profile edits). */
export async function replaceStoredSession(session: MobileAuthSession) {
  return persistSession(session);
}

function withAuth(init: RequestInit, session: MobileAuthSession): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  headers.set("x-admin-community-id", session.workspace.community.id);
  headers.set("x-tour-client", "mobile");
  // fetch must set multipart boundary itself — a manual Content-Type breaks uploads.
  if (init.body instanceof FormData) {
    headers.delete("Content-Type");
  }
  return { ...init, headers };
}

async function readPersistedSession(): Promise<MobileAuthSession | null> {
  try {
    const raw = Platform.OS === "web"
      ? globalThis.localStorage?.getItem(SESSION_KEY) ?? null
      : await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as MobileAuthSession;
    return session?.accessToken && session?.refreshToken && session?.workspace?.community?.id
      ? session
      : null;
  } catch {
    return null;
  }
}

async function deleteStoredSession() {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(SESSION_KEY);
  } else {
    await AsyncStorage.removeItem(SESSION_KEY);
  }
}
