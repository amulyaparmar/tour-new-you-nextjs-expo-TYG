import "server-only";
import { GoogleGenAI, ServiceTier, ThinkingLevel } from "@google/genai";
import { isAnalysisModelId } from "@tour/shared";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getBedrockLanguageModelForAnalysis } from "./bedrock-language-model";

export type LiveCoachingProvider = "gemini" | "bedrock";

function configuredProvider(): LiveCoachingProvider {
  const provider = process.env.LIVE_COACHING_PROVIDER?.trim().toLowerCase() || "gemini";
  if (provider === "gemini" || provider === "bedrock") return provider;
  throw new Error(`Unsupported live coaching provider: ${provider}`);
}

export function liveCoachingModel(provider = configuredProvider()) {
  return process.env.LIVE_COACHING_MODEL
    || (provider === "gemini" ? "gemini-3.5-flash-lite" : "gpt-5.6-luna");
}

export async function generateLiveCoachingObject(input: {
  instructions: string;
  prompt: string;
  schema: z.ZodType;
  signal: AbortSignal;
  maxOutputTokens?: number;
}) {
  const provider = configuredProvider();
  const model = liveCoachingModel(provider);
  const maxOutputTokens = input.maxOutputTokens ?? 2200;

  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini is not configured");
    const responseJsonSchema = z.toJSONSchema(input.schema, { override: ({ jsonSchema }) => {
      delete jsonSchema.minLength;
      delete jsonSchema.maxLength;
      delete jsonSchema.minItems;
      delete jsonSchema.maxItems;
      delete jsonSchema.pattern;
    } });
    const result = await new GoogleGenAI({ apiKey }).models.generateContent({
      model,
      contents: input.prompt,
      config: {
        serviceTier: ServiceTier.PRIORITY,
        systemInstruction: input.instructions,
        responseMimeType: "application/json",
        responseJsonSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        maxOutputTokens,
        abortSignal: input.signal,
        httpOptions: { retryOptions: { attempts: 1 } },
      },
    });
    return {
      output: JSON.parse(result.text || "null") as unknown,
      usage: {
        inputTokens: result.usageMetadata?.promptTokenCount,
        outputTokens: result.usageMetadata?.candidatesTokenCount,
        reasoningTokens: result.usageMetadata?.thoughtsTokenCount,
      },
    };
  }

  if (!isAnalysisModelId(model)) throw new Error("Invalid Bedrock live coaching model");
  const result = await generateText({
    model: getBedrockLanguageModelForAnalysis(model),
    instructions: input.instructions,
    prompt: input.prompt,
    output: Output.object({ schema: input.schema }),
    maxOutputTokens,
    maxRetries: 0,
    abortSignal: input.signal,
  });
  return { output: result.output, usage: result.usage };
}
