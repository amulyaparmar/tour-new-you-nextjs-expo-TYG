import {
  buildPhaseTracks,
  findPhaseForTimestamp,
  shortPhaseLabel,
  tourSegmentColor,
  type ConversationPhaseSegmentation,
  type PhaseTrackSegment,
} from "@tour/shared";

export { buildPhaseTracks, findPhaseForTimestamp, shortPhaseLabel, tourSegmentColor };
export type { ConversationPhaseSegmentation, PhaseTrackSegment };

/** @deprecated Use tourSegmentColor(track.colorIndex) for dynamic segments. */
export const PHASE_COLORS = {
  greeting: "#6366f1",
  discovery: "#0ea5e9",
  tour: "#10b981",
  objections: "#f59e0b",
  closing: "#ef4444",
  follow_up: "#8b5cf6",
} as const;

export function segmentTrackColor(track: PhaseTrackSegment): string {
  if (track.phaseId && track.phaseId in PHASE_COLORS) {
    return PHASE_COLORS[track.phaseId as keyof typeof PHASE_COLORS];
  }
  return tourSegmentColor(track.colorIndex);
}

export function processingTitle(status: string): string {
  switch (status) {
    case "uploaded":
      return "Preparing your tour";
    case "transcribing":
      return "Creating a transcript";
    case "segmenting":
      return "Organizing tour moments";
    case "analyzing":
      return "Scoring the conversation";
    default:
      return "Preparing insights";
  }
}

export function processingStatusMessage(status: string): string {
  switch (status) {
    case "transcribing":
      return "Transcribing speech and detecting speakers…";
    case "segmenting":
      return "Mapping tour segments and locations…";
    case "analyzing":
      return "Scoring the tour against your rubric…";
    default:
      return "Preparing the recording for transcript, segments, and insights…";
  }
}
