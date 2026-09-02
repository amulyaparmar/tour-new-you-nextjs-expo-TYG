import "server-only";

import {
  normalizeAudioInsights,
  normalizeParticipantName,
  normalizeParticipantNameConfidence,
  type AudioAnalysisMode,
  type AudioInsights,
  type GeminiAudioFileRef,
} from "@tour/shared";

import {
  geminiGenerateJson,
  geminiChatWithAudioFile,
  getGeminiAudioInsightsTimeoutMs,
  getGeminiConfig,
  parseGeminiTimestamp,
  uploadGeminiAudioFile,
  type GeminiChatMessage,
} from "./gemini-client";

const GEMINI_FILE_TTL_MS = 48 * 60 * 60 * 1000;
const GEMINI_FILE_EXPIRY_SAFETY_MS = 10 * 60 * 1000;

const AUDIO_INSIGHTS_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    topicSummary: {
      type: "string",
      description:
        "Concise 1-4 word subject; for tours prefer unit type(s), for calls state the purpose",
    },
    overallSentiment: {
      type: "string",
      enum: ["positive", "neutral", "negative", "mixed"],
    },
    speakerDynamics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          speaker: {
            type: "string",
            description:
              "Role inferred from the voice's behavior across the full audio",
          },
          talkTimeSeconds: { type: "number" },
          dominantEmotion: {
            type: "string",
            enum: ["happy", "sad", "angry", "neutral", "excited", "concerned"],
          },
          notes: { type: "string" },
        },
        required: ["speaker", "talkTimeSeconds", "dominantEmotion", "notes"],
      },
    },
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          speaker: {
            type: "string",
            description:
              "Agent or Prospect after tracking the same voice across the recording; split turns whenever the voice changes",
          },
          timestamp: { type: "string" },
          endTimestamp: { type: "string" },
          content: { type: "string" },
          language: { type: "string" },
          emotion: {
            type: "string",
            enum: ["happy", "sad", "angry", "neutral", "excited", "concerned"],
          },
          energy: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
          translation: { type: "string" },
        },
        required: ["speaker", "timestamp", "content", "emotion", "energy"],
      },
    },
    ambienceCues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          timestamp: { type: "string" },
          endTimestamp: { type: "string" },
          label: { type: "string" },
          description: { type: "string" },
        },
        required: ["timestamp", "label", "description"],
      },
    },
    highlights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          timestamp: { type: "string" },
          label: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["timestamp", "label", "explanation"],
      },
    },
    participants: {
      type: "object",
      properties: {
        agentName: {
          type: "string",
          description:
            "Name bound by voice continuity to the person conducting the session; empty string if unknown",
        },
        prospectName: {
          type: "string",
          description:
            "Name bound by voice continuity to the person shopping for housing; empty string if unknown",
        },
        agentNameConfidence: {
          type: "number",
          description:
            "0-100 confidence the agent name is correct; 0 when unknown",
        },
        prospectNameConfidence: {
          type: "number",
          description:
            "0-100 confidence the prospect name is correct; 0 when unknown",
        },
        agentNameFirstMentionTimestamp: {
          type: "string",
          description:
            "MM:SS of the earliest audible mention of the agent's name; empty string if unavailable",
        },
        prospectNameFirstMentionTimestamp: {
          type: "string",
          description:
            "MM:SS of the earliest audible mention of the prospect's name; empty string if unavailable",
        },
      },
      required: [
        "agentName",
        "prospectName",
        "agentNameConfidence",
        "prospectNameConfidence",
        "agentNameFirstMentionTimestamp",
        "prospectNameFirstMentionTimestamp",
      ],
    },
    conversationStats: {
      type: "object",
      properties: {
        talkRatioPercent: {
          type: "number",
          description: "Rep/agent share of total talk time, 0-100",
        },
        repTalkTimeSeconds: {
          type: "number",
          description: "Total seconds the rep/agent spoke",
        },
        longestProspectTalkSeconds: {
          type: "number",
          description:
            "Longest uninterrupted prospect/customer monologue in seconds",
        },
        longestTalkSeconds: {
          type: "number",
          description:
            "Longest uninterrupted monologue by either party in seconds",
        },
        interactivityScore: {
          type: "number",
          description:
            "Meaningful back-and-forth quality score from 0-5; passive acks should not count",
        },
        interactivityTotal: {
          type: "number",
          description: "Interactivity denominator; always return 5",
        },
        patienceSeconds: {
          type: "number",
          description:
            "Average pause in seconds after prospect stops before rep responds",
        },
        talkSpeedWordsPerMinute: {
          type: "number",
          description: "Rep/agent speaking rate in words per minute",
        },
        interactivityNotes: {
          type: "string",
          description:
            "Brief note on engagement quality and turn-taking patterns",
        },
      },
      required: [
        "talkRatioPercent",
        "repTalkTimeSeconds",
        "longestProspectTalkSeconds",
        "longestTalkSeconds",
        "interactivityScore",
        "interactivityTotal",
        "patienceSeconds",
        "talkSpeedWordsPerMinute",
      ],
    },
  },
  required: [
    "summary",
    "topicSummary",
    "overallSentiment",
    "segments",
    "participants",
    "conversationStats",
  ],
} as const;

type GeminiAudioInsightsPayload = {
  summary: string;
  topicSummary: string;
  overallSentiment: AudioInsights["overallSentiment"];
  speakerDynamics?: AudioInsights["speakerDynamics"];
  segments: Array<{
    speaker: string;
    timestamp: string;
    endTimestamp?: string;
    content: string;
    language?: string;
    emotion: AudioInsights["segments"][number]["emotion"];
    energy: AudioInsights["segments"][number]["energy"];
    translation?: string;
  }>;
  ambienceCues?: Array<{
    timestamp: string;
    endTimestamp?: string;
    label: string;
    description: string;
  }>;
  highlights?: Array<{
    timestamp: string;
    label: string;
    explanation: string;
  }>;
  participants: {
    agentName: string;
    prospectName: string;
    agentNameConfidence: number;
    prospectNameConfidence: number;
    agentNameFirstMentionTimestamp: string;
    prospectNameFirstMentionTimestamp: string;
  };
  conversationStats: {
    talkRatioPercent: number;
    repTalkTimeSeconds: number;
    longestProspectTalkSeconds: number;
    longestTalkSeconds: number;
    interactivityScore: number;
    interactivityTotal: number;
    patienceSeconds: number;
    talkSpeedWordsPerMinute: number;
    interactivityNotes?: string;
  };
};

export type AudioInsightsRubricContext = {
  name: string;
  sessionType: string;
  criteria: string[];
  analysisInstructions?: string | null;
  audioAnalysisModes?: readonly AudioAnalysisMode[];
};

function buildAudioInsightsPrompt(
  rubricContext?: AudioInsightsRubricContext,
): string {
  const lines = [
    "Analyze this leasing tour or phone shop recording for coaching insights.",
    "Use the audio directly — tone, pacing, pauses, enthusiasm, and non-speech ambience matter.",
    "Listen through the audio and establish the distinct voices, who conducts the session, and who is shopping before assigning names or computing role-based statistics.",
    "",
    "Requirements:",
    "1. Identify distinct speakers and estimate talk time per speaker.",
    "2. Provide MM:SS timestamps for each segment.",
    "3. Detect primary emotion and energy per segment.",
    "4. Note non-speech ambience cues (background noise, doors, music, HVAC, etc.).",
    "5. Flag 3-6 coaching highlights (rapport wins, hesitation, objections, missed closes).",
    "6. Summarize overall sentiment for the interaction.",
    "7. Return topicSummary as a concise 1-4 word subject:",
    '   - For a tour, prefer the unit type or types discussed (for example, "Studio and 1-Bedroom").',
    '   - For a call, state the purpose (for example, "Availability Inquiry" or "Application Follow-Up").',
    '   - Avoid generic labels like "Tour" or "Call" when the audio supports something more specific.',
    "   - Use an empty string when no specific topic is supported by the recording.",
    "8. Extract participant names from audio understanding:",
    "   - agentName: leasing agent or staff member conducting the tour/call; use empty string if unknown",
    "   - prospectName: prospect, customer, visitor, or shopper; use empty string if unknown",
    "   - agentNameConfidence and prospectNameConfidence: whole-number confidence from 0-100; use 0 when the corresponding name is unknown",
    "   - Use 90-100 only for an explicit introduction or repeated unambiguous address; 60-89 for strong contextual evidence; below 60 for a tentative phonetic/contextual reading.",
    "   - Return names without confidence symbols or prefixes; the application adds its own low-confidence marker.",
    "   - agentNameFirstMentionTimestamp and prospectNameFirstMentionTimestamp: earliest point where the corresponding returned name is audibly spoken by anyone, in MM:SS; use empty string if the name is unknown or is never audibly spoken.",
    "   - Resolve identity in this order: distinguish the voices, attach each audible name to the correct voice, then infer that voice's role from the whole interaction. Apply that same mapping consistently to participants, speaker dynamics, segments, and conversation stats.",
    '   - A self-introduction (for example, "I\'m Camilla") names the speaker. A direct address (for example, "Camilla, ...") names the listener. Do not assign a name to a role merely because the other person spoke it.',
    "   - Around every candidate name, re-listen to the audio immediately before and after the mention, bind the name to that voice, and follow that same voice across the recording before assigning Agent or Prospect.",
    "   - Split turns whenever the voice changes. If the audio cannot support both the name-to-voice link and the voice-to-role link, return the name as unknown.",
    "   - The recording is the only source of truth for participant names. Ignore names in rubric context, criteria, examples, prior metadata or analyses, and tool/schema text.",
    "   - Track the voice that gives a spoken introduction or is unambiguously addressed, then infer that voice's role from what they do across the recording (for example: conducting the tour and explaining the property versus shopping for housing).",
    "   - Prefer spoken introductions and unambiguous direct address. Resolve ambiguous local phrases using voice continuity and the full conversational behavior.",
    "   - agentName must belong to the person conducting this session. Do not use a name heard only when that person addresses or calls a colleague, manager, maintenance worker, or other third party.",
    "9. Compute conversationStats from the audio:",
    "   - talkRatioPercent: rep/agent talk time ÷ total talk time × 100",
    "   - repTalkTimeSeconds: total rep/agent speaking time",
    "   - longestProspectTalkSeconds: longest uninterrupted prospect/customer monologue",
    "   - longestTalkSeconds: longest uninterrupted monologue by either party",
    "   - interactivityScore: score the quality of meaningful back-and-forth from 0-5; ignore passive acks ('yeah', 'uh-huh', 'right') and brief overlaps",
    "   - interactivityTotal: always 5",
    "   - patienceSeconds: average pause after the prospect finishes before the rep starts (lower = more interruptive)",
    "   - talkSpeedWordsPerMinute: rep/agent words per minute",
    "   - interactivityNotes: 1-2 sentences on engagement quality",
    "Return complete structured JSON matching the provided schema. Use empty strings or empty arrays when unknown/not present.",
    "Use MM:SS timestamps. interactivityTotal must be 5.",
  ];

  if (rubricContext) {
    lines.push(
      "",
      "Rubric context for this recording:",
      `- Rubric: ${rubricContext.name}`,
      `- Session type: ${rubricContext.sessionType}`,
      "- Use the criteria below to prioritize coaching highlights and the summary. Do not invent evidence and do not change the quantitative metric definitions above.",
      ...rubricContext.criteria
        .slice(0, 80)
        .map((criterion) => `  - ${criterion}`),
    );
    if (rubricContext.analysisInstructions?.trim()) {
      lines.push(
        "- Additional rubric analysis instructions:",
        rubricContext.analysisInstructions.trim().slice(0, 4_000),
      );
    }
    if (rubricContext.audioAnalysisModes) {
      const requested = new Set(rubricContext.audioAnalysisModes);
      lines.push(
        "- Audio signal scope (return empty fields for any unselected capability):",
        `  - emotion and sentiment: ${requested.has("emotion") ? "selected" : "not selected"}`,
        `  - conversation dynamics and talk statistics: ${requested.has("conversation_dynamics") ? "selected" : "not selected"}`,
        `  - environment and ambience: ${requested.has("ambience") ? "selected" : "not selected"}`,
        `  - participant identity and names: ${requested.has("participant_identity") ? "selected" : "not selected"}`,
      );
    }
  }

  return lines.join("\n");
}

function parseOptionalMentionTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d+):([0-5]\d)$/);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const totalSeconds = minutes * 60 + seconds;
  return Number.isSafeInteger(minutes) && Number.isSafeInteger(totalSeconds)
    ? totalSeconds
    : null;
}

export async function generateAudioInsights(params: {
  audioBuffer: Buffer;
  mimeType: string;
  fileName?: string;
  rubricContext?: AudioInsightsRubricContext;
  model?: string;
}): Promise<AudioInsights> {
  const { model: configuredModel } = getGeminiConfig();
  const uploadedFile = await uploadGeminiAudioFile(
    params.audioBuffer,
    params.mimeType,
    params.fileName ?? "recording",
  );

  const { value: payload, model: resolvedModel } =
    await geminiGenerateJson<GeminiAudioInsightsPayload>({
      prompt: buildAudioInsightsPrompt(params.rubricContext),
      schema: AUDIO_INSIGHTS_SCHEMA,
      audioBuffer: params.audioBuffer,
      mimeType: params.mimeType,
      fileName: params.fileName,
      model: params.model ?? configuredModel,
      uploadedFile,
      requestOptions: {
        timeoutMs: getGeminiAudioInsightsTimeoutMs(),
        // This is the total per-model retry budget; the SDK divides it across
        // bounded attempts before our audio-model fallback advances.
      },
    });

  const insights: AudioInsights = {
    provider: "gemini",
    model: resolvedModel,
    summary: payload.summary,
    topicSummary: payload.topicSummary,
    overallSentiment: payload.overallSentiment,
    audioFile: buildGeminiAudioFileRef(uploadedFile),
    speakerDynamics: (payload.speakerDynamics ?? []).map((item) => ({
      speaker: item.speaker,
      talkTimeSeconds: item.talkTimeSeconds,
      dominantEmotion: item.dominantEmotion,
      notes: item.notes,
    })),
    segments: (payload.segments ?? []).map((segment) => {
      const startTime = parseGeminiTimestamp(segment.timestamp);
      const endTime = segment.endTimestamp
        ? parseGeminiTimestamp(segment.endTimestamp)
        : startTime;
      return {
        speaker: segment.speaker,
        startTime,
        endTime: Math.max(endTime, startTime),
        text: segment.content,
        language: segment.language,
        emotion: segment.emotion,
        energy: segment.energy,
        translation: segment.translation,
      };
    }),
    ambienceCues: (payload.ambienceCues ?? []).map((cue) => {
      const startTime = parseGeminiTimestamp(cue.timestamp);
      const endTime = cue.endTimestamp
        ? parseGeminiTimestamp(cue.endTimestamp)
        : startTime;
      return {
        startTime,
        endTime: Math.max(endTime, startTime),
        label: cue.label,
        description: cue.description,
      };
    }),
    highlights: (payload.highlights ?? []).map((item) => ({
      timestamp: parseGeminiTimestamp(item.timestamp),
      label: item.label,
      explanation: item.explanation,
    })),
    participants: {
      agentName: normalizeParticipantName(payload.participants?.agentName),
      prospectName: normalizeParticipantName(
        payload.participants?.prospectName,
      ),
      agentNameConfidence:
        normalizeParticipantNameConfidence(
          payload.participants?.agentNameConfidence,
        ) ?? 0,
      prospectNameConfidence:
        normalizeParticipantNameConfidence(
          payload.participants?.prospectNameConfidence,
        ) ?? 0,
      agentNameFirstMentionSeconds: parseOptionalMentionTimestamp(
        payload.participants?.agentNameFirstMentionTimestamp,
      ),
      prospectNameFirstMentionSeconds: parseOptionalMentionTimestamp(
        payload.participants?.prospectNameFirstMentionTimestamp,
      ),
    },
    conversationStats: {
      talkRatioPercent: payload.conversationStats.talkRatioPercent,
      repTalkTimeSeconds: payload.conversationStats.repTalkTimeSeconds,
      longestProspectTalkSeconds:
        payload.conversationStats.longestProspectTalkSeconds,
      longestTalkSeconds: payload.conversationStats.longestTalkSeconds,
      interactivityScore: payload.conversationStats.interactivityScore,
      interactivityTotal: payload.conversationStats.interactivityTotal,
      patienceSeconds: payload.conversationStats.patienceSeconds,
      talkSpeedWordsPerMinute:
        payload.conversationStats.talkSpeedWordsPerMinute,
      interactivityNotes: payload.conversationStats.interactivityNotes,
    },
  };

  const normalized = normalizeAudioInsights(insights);
  if (!normalized)
    throw new Error("Gemini audio insights failed normalization");
  return normalized;
}

function buildGeminiAudioFileRef(file: {
  uri: string;
  mimeType: string;
  name?: string;
}): GeminiAudioFileRef {
  const createdAt = new Date();
  return {
    uri: file.uri,
    mimeType: file.mimeType,
    name: file.name,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + GEMINI_FILE_TTL_MS).toISOString(),
  };
}

export function isGeminiAudioFileExpired(
  audioFile: GeminiAudioFileRef | null | undefined,
  now = Date.now(),
): boolean {
  if (!audioFile?.uri || !audioFile.mimeType) return true;
  if (!audioFile.expiresAt) return true;
  const expiresAt = Date.parse(audioFile.expiresAt);
  if (Number.isNaN(expiresAt)) return true;
  return expiresAt - GEMINI_FILE_EXPIRY_SAFETY_MS <= now;
}

export async function createGeminiAudioFileRef(params: {
  audioBuffer: Buffer;
  mimeType: string;
  fileName?: string;
}): Promise<GeminiAudioFileRef> {
  const uploadedFile = await uploadGeminiAudioFile(
    params.audioBuffer,
    params.mimeType,
    params.fileName ?? "recording",
  );
  return buildGeminiAudioFileRef(uploadedFile);
}

export async function chatWithAudioRecording(params: {
  audioFile: GeminiAudioFileRef;
  messages: GeminiChatMessage[];
  model?: string;
  summary?: string | null;
}): Promise<string> {
  const contextLines = [
    "You are a leasing tour coach with direct access to the session recording.",
    "Answer using what you hear in the audio — tone, pacing, pauses, and non-speech cues matter.",
    "When a moment matters, include a standalone timestamp formatted exactly as [MM:SS]. Do not put timestamps inside Markdown links or bold text; the app turns those tokens into playable recording links.",
  ];
  if (params.summary?.trim()) {
    contextLines.push("", `Prior analysis summary: ${params.summary.trim()}`);
  }

  const messages = params.messages.map((message, index) => {
    if (index !== 0 || message.role !== "user") return message;
    return {
      ...message,
      content: `${contextLines.join("\n")}\n\nUser question: ${message.content}`,
    };
  });

  return geminiChatWithAudioFile({
    file: params.audioFile,
    messages,
    model: params.model,
  });
}
