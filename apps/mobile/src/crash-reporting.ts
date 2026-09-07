import type { MobileAuthSession } from "./auth";

type CrashlyticsModule = typeof import("@react-native-firebase/crashlytics");

let crashlyticsModulePromise: Promise<CrashlyticsModule | null> | null = null;

async function loadCrashlytics() {
  if (!crashlyticsModulePromise) {
    crashlyticsModulePromise = import("@react-native-firebase/crashlytics").catch(() => null);
  }
  return crashlyticsModulePromise;
}

export async function initializeCrashReporting() {
  try {
    const api = await loadCrashlytics();
    if (!api) return;
    api.log(api.getCrashlytics(), "App started");
  } catch {
    // Observability must never prevent the app from starting.
  }
}

export async function setCrashReportingContext(session: MobileAuthSession | null) {
  try {
    const api = await loadCrashlytics();
    if (!api) return;

    const crashlytics = api.getCrashlytics();
    await Promise.all([
      api.setUserId(crashlytics, session?.workspace.user.id ?? ""),
      api.setAttributes(crashlytics, {
        community_id: session?.workspace.community.id ?? "",
        property_tyg_id: session?.workspace.community.propertyTygId ?? "",
      }),
    ]);
  } catch {
    // Context enrichment is optional and must not affect authentication.
  }
}

export async function recordUnexpectedError(error: unknown, context?: string) {
  try {
    const api = await loadCrashlytics();
    if (!api) return;

    const crashlytics = api.getCrashlytics();
    if (context) api.log(crashlytics, context);
    api.recordError(
      crashlytics,
      error instanceof Error ? error : new Error(String(error)),
    );
  } catch {
    // Reporting an error must not create another app error.
  }
}
