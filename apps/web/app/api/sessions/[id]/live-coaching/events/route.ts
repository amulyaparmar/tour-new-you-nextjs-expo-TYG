import { NextResponse } from "next/server";
import { AdminAuthError } from "@/lib/admin-auth";
import { requireSessionWriteAccess } from "@/lib/session-access";
import { acceptCoachingInteraction } from "@/lib/coaching-interactions";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { workspace } = await requireSessionWriteAccess(request, id);
    const raw = await request.text();
    if (raw.length > 1000) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    let input: unknown;
    try { input = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid event" }, { status: 400 }); }
    const result = acceptCoachingInteraction(`${workspace.user.id}:${id}`, input);
    if (!result.valid) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    // Structured counts only: never log transcript, names, advice or property details.
    if (result.event) console.info("[live-coaching:interaction]", result.event);
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Event unavailable" }, { status: 503 });
  }
}
