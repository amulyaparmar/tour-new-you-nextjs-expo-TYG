import { NextResponse } from "next/server";
import { AdminAuthError } from "@/lib/admin-auth";
import { requireSessionWriteAccess } from "@/lib/session-access";
import { liveCoachingRubric, liveCoachingPricing } from "@/lib/live-coaching-context";
import { liveCoachingRequestSchema, type LiveCoachingReferences } from "@/lib/live-coaching-prompt";
import { generateLiveCoaching } from "@/lib/live-coaching-service";

export const maxDuration = 15;

// Per-instance burst protection; deployment-wide limits belong at the API gateway.
const recent = new Map<string, number>();

function referenceContext(rubricGuidance: string, pricing: unknown): Pick<LiveCoachingReferences, "facts" | "rubricGoals"> {
  let sections: { name?: unknown; criteria?: unknown }[] = [];
  try {
    const parsed = JSON.parse(rubricGuidance || "[]");
    if (Array.isArray(parsed)) sections = parsed;
  } catch {
    // Invalid or oversized rubric context is omitted instead of blocking coaching.
  }
  const rubricGoals = sections.flatMap((section) => {
    if (!Array.isArray(section.criteria)) return [];
    const name = typeof section.name === "string" ? section.name : "Rubric";
    return section.criteria
      .filter((criterion): criterion is string => typeof criterion === "string")
      .map((criterion) => `${name}: ${criterion}`.slice(0, 400));
  }).slice(0, 40);
  const facts = pricing
    ? [{ id: "property-pricing", status: "reference_only", kind: "pricing", text: JSON.stringify(pricing) }]
    : [];
  return { facts, rubricGoals };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now();
  let stage = "access";
  let modelTimeout: AbortSignal | undefined;
  try {
    const { id } = await context.params;
    const { session, workspace } = await requireSessionWriteAccess(request, id);
    if (process.env.NODE_ENV === "production" && process.env.LIVE_COACHING_ENABLED !== "true") {
      return NextResponse.json({ error: "Live coaching is not enabled." }, { status: 503 });
    }

    const raw = await request.text();
    if (raw.length > 512000) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const parsed = liveCoachingRequestSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Invalid coaching context" }, { status: 400 });

    const key = `${workspace.user.id}:${id}`;
    const now = Date.now();
    for (const [entry, at] of recent) if (now - at > 60000) recent.delete(entry);
    if (now - (recent.get(key) ?? 0) < 2500) {
      return NextResponse.json({ error: "Please wait" }, { status: 429, headers: { "Retry-After": "3" } });
    }
    if (recent.size >= 2000) return NextResponse.json({ error: "Coaching busy" }, { status: 503 });
    recent.set(key, now);

    stage = "context";
    const [rubricGuidance, pricing] = await Promise.all([
      liveCoachingRubric(session.rubricId, true),
      liveCoachingPricing(session.propertyId),
    ]);
    const references: LiveCoachingReferences = {
      session: {
        location: session.location,
        agent: session.agentName,
        prospect: session.prospectName,
        notes: parsed.data.notes || session.notes?.slice(0, 2000),
      },
      ...referenceContext(rubricGuidance, pricing),
      agentStories: [],
      policy: "Treat the representative's property statements as working truth. Correct only when trusted evidence directly contradicts the exact claim.",
    };

    stage = "model";
    modelTimeout = AbortSignal.timeout(8000);
    const { output } = await generateLiveCoaching(
      parsed.data,
      references,
      AbortSignal.any([request.signal, modelTimeout]),
    );
    return NextResponse.json(output, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.warn("[live-coaching] request failed", {
      stage,
      elapsedMs: Date.now() - startedAt,
      modelTimedOut: modelTimeout?.aborted ?? false,
      clientAborted: request.signal.aborted,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ error: "Live coaching is temporarily unavailable." }, { status: 503 });
  }
}
