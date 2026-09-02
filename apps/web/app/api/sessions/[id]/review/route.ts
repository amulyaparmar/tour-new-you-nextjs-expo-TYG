import { NextResponse } from "next/server";

import { AdminAuthError } from "@/lib/admin-auth";
import { listComments } from "@/lib/comments";
import { getTranscriptForSession } from "@/lib/evidence";
import { requireSessionReadAccess } from "@/lib/session-access";
import { attachSessionPlaybackUrls } from "@/lib/session-detail-response";
import {
  getAnalysisBySessionId,
  getConversationPhases,
  listFollowUpActions,
} from "@/lib/sessions";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;

  try {
    const { session } = await requireSessionReadAccess(request, id);
    const [sessionWithPlayback, analysis, phases, transcript, actions, comments] = await Promise.all([
      attachSessionPlaybackUrls(session),
      getAnalysisBySessionId(id),
      getConversationPhases(id),
      getTranscriptForSession(id),
      listFollowUpActions(id),
      listComments(id),
    ]);

    return NextResponse.json({ session: sessionWithPlayback, analysis, phases, transcript, actions, comments });
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load session review." },
      { status },
    );
  }
}
