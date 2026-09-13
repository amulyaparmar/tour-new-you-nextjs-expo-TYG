import "server-only";
import type { LiveCoachingRequest, LiveCoachingResponse } from "@tour/shared";
import { liveCoachingPrompt, liveCoachingResponseSchema, validateLiveCoachingResponse, type LiveCoachingReferences } from "./live-coaching-prompt";
import { generateLiveCoachingObject } from "./live-coaching-provider";

export async function generateLiveCoaching(input: LiveCoachingRequest, references: LiveCoachingReferences, signal: AbortSignal) {
  const { instructions, prompt } = liveCoachingPrompt(input, references);
  const result = await generateLiveCoachingObject({
    instructions,
    prompt,
    schema: liveCoachingResponseSchema,
    maxOutputTokens: 2200,
    signal,
  });
  const validated = validateLiveCoachingResponse(result.output, input, references);
  const output: LiveCoachingResponse = {
    protocolVersion: 4,
    revision: input.revision,
    ...validated,
  };
  return { output, usage: result.usage };
}
