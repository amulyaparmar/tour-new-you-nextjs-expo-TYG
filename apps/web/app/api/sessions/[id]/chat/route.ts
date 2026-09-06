import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";

import { getBedrockLanguageModelForAnalysis } from "@/lib/bedrock-language-model";
import { getTranscriptForSession } from "@/lib/evidence";
import { safeAiChatError } from "@/lib/safe-ai-error";
import { buildSessionAiInstructions } from "@/lib/session-ai-context";
import { getAnalysisBySessionId } from "@/lib/sessions";
import { normalizeAnalysisModelId } from "@tour/shared";

export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const { id: sessionId } = await context.params;

  try {
    const { messages, model }: { messages: UIMessage[]; model?: string } = await request.json();
    const [analysis, transcript] = await Promise.all([
      getAnalysisBySessionId(sessionId),
      getTranscriptForSession(sessionId),
    ]);

    if (!analysis) {
      return Response.json({ error: "Analysis not available for this session." }, { status: 404 });
    }

    const instructions = buildSessionAiInstructions(analysis, transcript);
    const analysisModel = normalizeAnalysisModelId(model);

    const result = streamText({
      model: getBedrockLanguageModelForAnalysis(analysisModel),
      instructions,
      messages: await convertToModelMessages(messages),
      temperature: 0.4,
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (error) {
    console.error("Session AI chat failed", error);
    return Response.json(
      { error: safeAiChatError(error) },
      { status: 500 }
    );
  }
}
