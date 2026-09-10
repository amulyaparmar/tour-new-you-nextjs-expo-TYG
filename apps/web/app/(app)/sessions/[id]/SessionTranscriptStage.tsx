"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type {
  ConversationPhaseSegmentation,
  ConversationPhaseSpan,
  SessionParticipants,
} from "@tour/shared";
import { formatSegmentTimeRange, formatSpeakerAnnotation } from "@tour/shared";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Play,
  Search,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";

import styles from "./session-detail.module.css";
import { InlineCommentComposer } from "./InlineCommentComposer";
import { InlineCommentEditor } from "./InlineCommentEditor";
import { InlineKeyMomentComposer } from "./InlineKeyMomentComposer";
import {
  formatTime,
  findNearestSegment,
  initialsFor,
  relativeTime,
  scrollTranscriptRowIntoView,
  SPEAKER_PALETTE,
  type SessionComment,
  type SessionMoment,
  type TranscriptSegment,
} from "./session-detail-utils";

type Props = {
  sessionId: string;
  transcript: TranscriptSegment[];
  participants: SessionParticipants;
  phases?: ConversationPhaseSegmentation | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  moments: SessionMoment[];
  comments: SessionComment[];
  showComments: boolean;
  activeCommentId: string | null;
  selectedMomentId: string | null;
  seekTo: (seconds: number) => void;
  onCommentsUpdated: () => void;
  onInlineComposeOpen?: () => void;
  onCommentSelect: (commentId: string) => void;
  onMomentClick: (moment: SessionMoment) => void;
  chatScrollRequest?: { key: number; seconds: number } | null;
  readOnly?: boolean;
};

type InlineCompose = {
  segmentId: string;
  timestampSec: number;
};

type KeyMomentCompose = {
  segmentId: string;
  timestampSec: number;
};

type PhaseRelation = "current" | "next" | "finished";

type PhasePosition = {
  index: number;
  relation: PhaseRelation;
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, button, a[href], summary, [role='button'], [role='link'], [contenteditable='true']",
    ),
  );
}

function phaseSeekTime(phase: ConversationPhaseSpan) {
  const nudge = Math.min(0.01, (phase.endTime - phase.startTime) / 2);
  return phase.startTime + Math.max(0, nudge);
}

function resolvePhasePosition(
  timestamp: number,
  segmentation: ConversationPhaseSegmentation | null | undefined,
): PhasePosition {
  const spans = segmentation?.spans ?? [];
  if (spans.length === 0) return { index: -1, relation: "current" };

  for (let index = spans.length - 1; index >= 0; index -= 1) {
    const span = spans[index]!;
    if (timestamp >= span.startTime && timestamp <= span.endTime) {
      return { index, relation: "current" };
    }
  }

  const nextIndex = spans.findIndex((span) => timestamp < span.startTime);
  if (nextIndex >= 0) return { index: nextIndex, relation: "next" };
  return { index: spans.length - 1, relation: "finished" };
}

function progressPercent(position: number, total: number) {
  if (!Number.isFinite(position) || !Number.isFinite(total) || total <= 0)
    return 0;
  return Math.min(100, Math.max(0, (position / total) * 100));
}

export function SessionTranscriptStage({
  sessionId,
  transcript,
  participants,
  phases,
  currentTime,
  duration,
  isPlaying,
  moments,
  comments,
  showComments,
  activeCommentId,
  selectedMomentId,
  seekTo,
  onCommentsUpdated,
  onInlineComposeOpen,
  onCommentSelect,
  onMomentClick,
  chatScrollRequest,
  readOnly = false,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollRafRef = useRef<number | null>(null);
  const skipAutoScrollRef = useRef(false);
  const phaseTriggerRef = useRef<HTMLButtonElement>(null);
  const phasePopoverRef = useRef<HTMLDivElement>(null);
  const phaseOptionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const phasePopoverId = useId();
  const commentTooltipId = useId();
  const keyMomentTooltipId = useId();
  const [query, setQuery] = useState("");
  const [viewedSegmentId, setViewedSegmentId] = useState<string | null>(
    () => transcript[0]?.id ?? null,
  );
  const [isFollowingPlayback, setIsFollowingPlayback] = useState(true);
  const [phasePopoverOpen, setPhasePopoverOpen] = useState(false);
  const [toolbarHint, setToolbarHint] = useState<"comment" | "moment" | null>(
    null,
  );
  const [inlineCompose, setInlineCompose] = useState<InlineCompose | null>(
    null,
  );
  const [keyMomentCompose, setKeyMomentCompose] =
    useState<KeyMomentCompose | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(
    null,
  );

  const useCommentLayout =
    showComments || inlineCompose != null || keyMomentCompose != null;

  const openInlineCompose = useCallback(
    (segment: TranscriptSegment) => {
      onInlineComposeOpen?.();
      setKeyMomentCompose(null);
      setInlineCompose({
        segmentId: segment.id,
        timestampSec: segment.startTime,
      });
    },
    [onInlineComposeOpen],
  );

  const openKeyMomentCompose = useCallback(
    (segment: TranscriptSegment) => {
      setInlineCompose(null);
      setKeyMomentCompose({
        segmentId: segment.id,
        timestampSec: Math.floor(currentTime),
      });
    },
    [currentTime],
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/comments`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentId }),
        });
        if (!res.ok) throw new Error("Failed to delete comment");
        setOpenCommentMenuId(null);
        onCommentsUpdated();
      } catch {
        setOpenCommentMenuId(null);
      }
    },
    [sessionId, onCommentsUpdated],
  );

  const speakerMap = useMemo(() => {
    const speakers = Array.from(
      new Set(transcript.map((seg) => seg.speaker || "Speaker")),
    );
    return new Map(
      speakers.map((speaker, index) => [
        speaker,
        SPEAKER_PALETTE[index % SPEAKER_PALETTE.length]!,
      ]),
    );
  }, [transcript]);

  const activeSegment = useMemo(() => {
    if (transcript.length === 0) return null;
    return (
      transcript.reduce<TranscriptSegment | null>((active, seg) => {
        if (
          currentTime >= seg.startTime &&
          (!active || seg.startTime >= active.startTime)
        )
          return seg;
        return active;
      }, null) ?? transcript[0]!
    );
  }, [currentTime, transcript]);

  const labelForSpeaker = useCallback(
    (speaker: string | null | undefined) =>
      formatSpeakerAnnotation(speaker, participants),
    [participants],
  );

  const filteredTranscript = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return transcript;
    return transcript.filter(
      (seg) =>
        seg.text.toLowerCase().includes(trimmed) ||
        seg.speaker.toLowerCase().includes(trimmed) ||
        labelForSpeaker(seg.speaker).toLowerCase().includes(trimmed),
    );
  }, [query, transcript, labelForSpeaker]);

  const transcriptById = useMemo(
    () => new Map(transcript.map((segment) => [segment.id, segment])),
    [transcript],
  );
  const filteredSegmentIds = useMemo(
    () => new Set(filteredTranscript.map((segment) => segment.id)),
    [filteredTranscript],
  );

  const storedViewedSegment = viewedSegmentId
    ? transcriptById.get(viewedSegmentId)
    : undefined;
  const viewedSegment = isFollowingPlayback
    ? (activeSegment ?? storedViewedSegment ?? transcript[0] ?? null)
    : storedViewedSegment &&
        (filteredTranscript.length === 0 ||
          filteredSegmentIds.has(storedViewedSegment.id))
      ? storedViewedSegment
      : (filteredTranscript[0] ??
        storedViewedSegment ??
        activeSegment ??
        transcript[0] ??
        null);

  const phaseBySegmentId = useMemo(() => {
    const map = new Map<string, ConversationPhaseSpan | undefined>();
    for (const segment of transcript) {
      const position = resolvePhasePosition(segment.startTime, phases);
      map.set(segment.id, phases?.spans[position.index]);
    }
    return map;
  }, [phases, transcript]);

  const phaseCount = phases?.spans.length ?? 0;
  const viewedPositionTime = isFollowingPlayback
    ? currentTime
    : (viewedSegment?.startTime ?? currentTime);
  const viewedPhasePosition = resolvePhasePosition(viewedPositionTime, phases);
  const playbackPhasePosition = resolvePhasePosition(currentTime, phases);
  const viewedPhase = phases?.spans[viewedPhasePosition.index];
  const viewedPhaseId = viewedPhase?.id;
  const viewedProgress = progressPercent(viewedPositionTime, duration);
  const playbackProgress = progressPercent(currentTime, duration);
  const isAwayFromPlayback = Boolean(
    !isFollowingPlayback &&
    viewedSegment &&
    activeSegment &&
    viewedSegment.id !== activeSegment.id,
  );
  const phaseEyebrow =
    viewedPhasePosition.relation === "next"
      ? "Coming next"
      : viewedPhasePosition.relation === "finished"
        ? "Just finished"
        : "Currently viewing";
  const playbackStateLabel = isPlaying ? "Playing" : "Paused";

  const firstSegmentByPhaseId = useMemo(() => {
    const map = new Map<string, TranscriptSegment>();
    for (const segment of transcript) {
      const phase = phaseBySegmentId.get(segment.id);
      if (phase && !map.has(phase.id)) map.set(phase.id, segment);
    }
    return map;
  }, [phaseBySegmentId, transcript]);

  const commentsBySegment = useMemo(() => {
    const map = new Map<string, SessionComment[]>();
    for (const comment of comments.filter(
      (item) => item.timestampSec != null && !item.parentId,
    )) {
      const target = findNearestSegment(comment.timestampSec!, transcript);
      if (!target) continue;
      map.set(target.id, [...(map.get(target.id) ?? []), comment]);
    }
    return map;
  }, [comments, transcript]);

  const momentsBySegment = useMemo(() => {
    const map = new Map<string, SessionMoment[]>();
    for (const moment of moments) {
      const target = findNearestSegment(moment.timestamp, transcript);
      if (!target) continue;
      map.set(target.id, [...(map.get(target.id) ?? []), moment]);
    }
    return map;
  }, [moments, transcript]);

  const scrollToTranscriptSegment = useCallback(
    (segment: TranscriptSegment, fromChat = false) => {
      const scrollToRow = () => {
        const row = rowRefs.current[segment.id];
        const container = scrollRef.current;
        if (!row || !container) return false;
        scrollTranscriptRowIntoView(container, row, {
          anchorRatio: 0.35,
          fromChat,
        });
        return true;
      };

      window.requestAnimationFrame(() => {
        if (!scrollToRow()) window.requestAnimationFrame(scrollToRow);
      });
    },
    [],
  );

  const browseToPhase = useCallback(
    (phaseIndex: number, restoreTriggerFocus = false) => {
      const phase = phases?.spans[phaseIndex];
      if (!phase) return;
      const target =
        firstSegmentByPhaseId.get(phase.id) ??
        findNearestSegment(phase.startTime, transcript);
      if (!target) return;

      setQuery("");
      setIsFollowingPlayback(false);
      setViewedSegmentId(target.id);
      setPhasePopoverOpen(false);
      scrollToTranscriptSegment(target);
      if (restoreTriggerFocus) {
        window.requestAnimationFrame(() => phaseTriggerRef.current?.focus());
      }
    },
    [firstSegmentByPhaseId, phases, scrollToTranscriptSegment, transcript],
  );

  const navigatePhase = useCallback(
    (direction: -1 | 1) => {
      if (viewedPhasePosition.index < 0) return;
      browseToPhase(viewedPhasePosition.index + direction);
    },
    [browseToPhase, viewedPhasePosition.index],
  );

  const playPhaseFromPopover = useCallback(
    (phaseIndex: number) => {
      const phase = phases?.spans[phaseIndex];
      if (!phase) return;
      const target =
        firstSegmentByPhaseId.get(phase.id) ??
        findNearestSegment(phase.startTime, transcript);

      setQuery("");
      setIsFollowingPlayback(true);
      setViewedSegmentId(target?.id ?? null);
      setPhasePopoverOpen(false);
      if (target) scrollToTranscriptSegment(target);
      seekTo(phaseSeekTime(phase));
      window.requestAnimationFrame(() => phaseTriggerRef.current?.focus());
    },
    [
      firstSegmentByPhaseId,
      phases,
      scrollToTranscriptSegment,
      seekTo,
      transcript,
    ],
  );

  const goToPlayingMoment = useCallback(() => {
    if (!activeSegment) return;
    setQuery("");
    setIsFollowingPlayback(true);
    setViewedSegmentId(activeSegment.id);
    setPhasePopoverOpen(false);
    scrollToTranscriptSegment(activeSegment);
  }, [activeSegment, scrollToTranscriptSegment]);

  const seekFromTranscript = useCallback(
    (seconds: number) => {
      const target = findNearestSegment(seconds, transcript);
      setIsFollowingPlayback(true);
      setViewedSegmentId(target?.id ?? null);
      setPhasePopoverOpen(false);
      seekTo(seconds);
    },
    [seekTo, transcript],
  );

  const syncViewedSegmentFromScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const centerY = container.scrollTop + container.clientHeight * 0.35;
    let bestSegment: TranscriptSegment | null = null;
    let bestDist = Infinity;

    for (const seg of filteredTranscript) {
      const row = rowRefs.current[seg.id];
      if (!row) continue;
      const rowTop = row.offsetTop - container.offsetTop;
      const rowCenter = rowTop + row.clientHeight / 2;
      const dist = Math.abs(rowCenter - centerY);
      if (dist < bestDist) {
        bestDist = dist;
        bestSegment = seg;
      }
    }

    if (bestSegment) {
      setViewedSegmentId(bestSegment.id);
    }
  }, [filteredTranscript]);

  const handleScroll = useCallback(() => {
    if (scrollRafRef.current != null) return;
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      syncViewedSegmentFromScroll();
    });
  }, [syncViewedSegmentFromScroll]);

  const beginBrowsingTranscript = useCallback(() => {
    setIsFollowingPlayback(false);
    setPhasePopoverOpen(false);
  }, []);

  const handleTranscriptBrowseKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "PageUp" ||
        event.key === "PageDown" ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === " "
      ) {
        beginBrowsingTranscript();
      }
    },
    [beginBrowsingTranscript],
  );

  useEffect(() => {
    if (skipAutoScrollRef.current) return;
    if (
      !isPlaying ||
      !isFollowingPlayback ||
      !activeSegment ||
      !scrollRef.current
    )
      return;
    const row = rowRefs.current[activeSegment.id];
    if (!row) return;
    scrollTranscriptRowIntoView(scrollRef.current, row);
  }, [activeSegment?.id, isFollowingPlayback, isPlaying]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(syncViewedSegmentFromScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [query, syncViewedSegmentFromScroll]);

  useEffect(() => {
    if (!phasePopoverOpen) return;

    const focusFrame = window.requestAnimationFrame(() => {
      if (viewedPhaseId) phaseOptionRefs.current[viewedPhaseId]?.focus();
    });

    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (phaseTriggerRef.current?.contains(target)) return;
      if (phasePopoverRef.current?.contains(target)) return;
      setPhasePopoverOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setPhasePopoverOpen(false);
      phaseTriggerRef.current?.focus();
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [phasePopoverOpen, viewedPhaseId]);

  useEffect(() => {
    if (!chatScrollRequest || !scrollRef.current) return;
    const segment = findNearestSegment(chatScrollRequest.seconds, transcript);
    if (!segment) return;

    skipAutoScrollRef.current = true;
    setIsFollowingPlayback(true);
    setViewedSegmentId(segment.id);

    const scrollToSegment = () => {
      const row = rowRefs.current[segment.id];
      const container = scrollRef.current;
      if (!row || !container) return false;
      scrollTranscriptRowIntoView(container, row, { fromChat: true });
      return true;
    };

    if (!scrollToSegment()) {
      requestAnimationFrame(scrollToSegment);
    }

    const timer = window.setTimeout(() => {
      skipAutoScrollRef.current = false;
    }, 220);

    return () => window.clearTimeout(timer);
  }, [chatScrollRequest, transcript]);

  useEffect(() => {
    if (!activeCommentId || !scrollRef.current) return;
    for (const [segmentId, segmentComments] of commentsBySegment.entries()) {
      if (!segmentComments.some((comment) => comment.id === activeCommentId))
        continue;
      setIsFollowingPlayback(true);
      setViewedSegmentId(segmentId);
      const row = rowRefs.current[segmentId];
      if (!row) return;
      const container = scrollRef.current;
      const offset =
        row.offsetTop -
        container.offsetTop -
        container.clientHeight / 3 +
        row.clientHeight / 2;
      container.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
      break;
    }
  }, [activeCommentId, commentsBySegment]);

  useEffect(() => {
    if (!openCommentMenuId) return;
    const closeMenu = () => setOpenCommentMenuId(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [openCommentMenuId]);

  useEffect(
    () => () => {
      if (scrollRafRef.current != null)
        window.cancelAnimationFrame(scrollRafRef.current);
    },
    [],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (readOnly) return;
      if (isEditableTarget(event.target)) return;
      if (!activeSegment) return;

      if (event.key === "Enter") {
        event.preventDefault();
        openInlineCompose(activeSegment);
        return;
      }

      if (event.key === "t" || event.key === "T") {
        event.preventDefault();
        openKeyMomentCompose(activeSegment);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSegment, openInlineCompose, openKeyMomentCompose, readOnly]);

  return (
    <div className={styles.stage}>
      <div className={styles.stageToolbar}>
        <div className={styles.transcriptToolbarRailWrap}>
          <div className={styles.transcriptToolbarRail}>
            <div className={styles.stageSearch}>
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                placeholder="Search transcript..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setIsFollowingPlayback(false);
                }}
                aria-label="Search transcript"
              />
            </div>

            <span
              className={styles.transcriptToolbarDivider}
              aria-hidden="true"
            />
            {viewedPhase ? (
              <button
                ref={phaseTriggerRef}
                type="button"
                className={styles.transcriptToolbarPhase}
                onClick={() => setPhasePopoverOpen((open) => !open)}
                aria-label={`Open transcript segments. ${phaseEyebrow} at ${formatTime(viewedPositionTime)} within ${formatSegmentTimeRange(viewedPhase.startTime, viewedPhase.endTime)}. Segment ${viewedPhasePosition.index + 1} of ${phaseCount}: ${viewedPhase.title}`}
                aria-haspopup="dialog"
                aria-expanded={phasePopoverOpen}
                aria-controls={phasePopoverOpen ? phasePopoverId : undefined}
              >
                <span className={styles.transcriptToolbarPhaseCopy}>
                  <span className={styles.transcriptToolbarPhaseEyebrow}>
                    <span>{phaseEyebrow}</span>
                    <span className={styles.transcriptToolbarPhasePosition}>
                      ({formatTime(viewedPositionTime)} / [
                      {formatSegmentTimeRange(
                        viewedPhase.startTime,
                        viewedPhase.endTime,
                      )}
                      ])
                    </span>
                  </span>
                  <span className={styles.transcriptToolbarPhaseTitle}>
                    <strong>
                      Segment {viewedPhasePosition.index + 1} of {phaseCount}:
                    </strong>{" "}
                    <span className={styles.transcriptToolbarPhaseName}>
                      {viewedPhase.title}
                    </span>
                  </span>
                </span>
                <ChevronDown
                  size={14}
                  className={
                    phasePopoverOpen
                      ? styles.transcriptToolbarPhaseChevronOpen
                      : styles.transcriptToolbarPhaseChevron
                  }
                  aria-hidden="true"
                />
              </button>
            ) : (
              <div
                className={`${styles.transcriptToolbarPhase} ${styles.transcriptToolbarPhaseStatic}`}
              >
                <span className={styles.transcriptToolbarPhaseCopy}>
                  <span className={styles.transcriptToolbarPhaseEyebrow}>
                    <span>Currently viewing</span>
                    <span className={styles.transcriptToolbarPhasePosition}>
                      ({formatTime(viewedPositionTime)} / [00:00 -{" "}
                      {formatTime(duration)}])
                    </span>
                  </span>
                  <span className={styles.transcriptToolbarPhaseTitle}>
                    <strong>Full transcript</strong>
                  </span>
                </span>
              </div>
            )}

            {phaseCount > 0 ? (
              <div
                className={styles.transcriptToolbarPhaseNav}
                role="group"
                aria-label="Browse transcript segments"
              >
                <button
                  type="button"
                  onClick={() => navigatePhase(-1)}
                  disabled={viewedPhasePosition.index <= 0}
                  aria-label="Previous transcript segment"
                  title="Previous transcript segment"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => navigatePhase(1)}
                  disabled={viewedPhasePosition.index >= phaseCount - 1}
                  aria-label="Next transcript segment"
                  title="Next transcript segment"
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            ) : null}

            <span
              className={styles.transcriptToolbarPhaseProgress}
              aria-hidden="true"
            >
              <span
                className={styles.transcriptToolbarPlaybackProgress}
                style={{ width: `${playbackProgress}%` }}
              />
              <span
                className={styles.transcriptToolbarViewedProgress}
                style={{ width: `${viewedProgress}%` }}
              />
            </span>
          </div>

          {phasePopoverOpen && viewedPhase ? (
            <div
              ref={phasePopoverRef}
              id={phasePopoverId}
              className={styles.transcriptSegmentPopover}
              role="dialog"
              aria-label="Transcript segments"
            >
              <div className={styles.transcriptSegmentPopoverHead}>
                <span>
                  <strong>Transcript segments</strong>
                  <small>Choose a section to play from there</small>
                </span>
                <span>{phaseCount} total</span>
              </div>
              <div className={styles.transcriptSegmentPopoverList}>
                {phases?.spans.map((phase, index) => {
                  const isViewedPhase = index === viewedPhasePosition.index;
                  const isPlaybackPhase = index === playbackPhasePosition.index;
                  return (
                    <button
                      key={phase.id}
                      ref={(node) => {
                        phaseOptionRefs.current[phase.id] = node;
                      }}
                      type="button"
                      className={`${styles.transcriptSegmentPopoverOption} ${isViewedPhase ? styles.transcriptSegmentPopoverOptionActive : ""}`}
                      onClick={() => playPhaseFromPopover(index)}
                      aria-current={isViewedPhase ? "true" : undefined}
                    >
                      <span className={styles.transcriptSegmentPopoverIndex}>
                        {index + 1}
                      </span>
                      <span className={styles.transcriptSegmentPopoverCopy}>
                        <strong>{phase.title}</strong>
                        <small>
                          {formatSegmentTimeRange(
                            phase.startTime,
                            phase.endTime,
                          )}
                        </small>
                      </span>
                      <span className={styles.transcriptSegmentPopoverMeta}>
                        {isPlaybackPhase ? (
                          <span
                            className={styles.transcriptSegmentPopoverPlaying}
                          >
                            <Play
                              size={10}
                              fill="currentColor"
                              aria-hidden="true"
                            />
                            Playhead
                          </span>
                        ) : null}
                        {isViewedPhase ? (
                          <Check size={15} aria-label="Section in view" />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
        {isAwayFromPlayback ? (
          <button
            type="button"
            className={styles.transcriptToolbarReturnToPlayback}
            onClick={goToPlayingMoment}
            aria-label={`Go to ${playbackStateLabel.toLowerCase()} moment at ${formatTime(currentTime)}`}
            title={`Go to ${playbackStateLabel.toLowerCase()} moment`}
          >
            <Play size={13} fill="currentColor" aria-hidden="true" />
            <span className={styles.transcriptToolbarReturnToPlaybackLabel}>
              {playbackStateLabel}
            </span>
            <span className={styles.transcriptToolbarReturnToPlaybackTime}>
              ({formatTime(currentTime)})
            </span>
          </button>
        ) : null}
        {activeSegment && !readOnly ? (
          <div className={styles.transcriptToolbarActions}>
            <span
              className={styles.transcriptToolbarActionHint}
              onMouseEnter={() => setToolbarHint("comment")}
              onMouseLeave={() => setToolbarHint(null)}
              onFocusCapture={() => setToolbarHint("comment")}
              onBlurCapture={() => setToolbarHint(null)}
            >
              <button
                type="button"
                className={styles.transcriptToolbarAction}
                onClick={() => openInlineCompose(activeSegment)}
                aria-label="Comment on the current line"
                aria-describedby={
                  toolbarHint === "comment" ? commentTooltipId : undefined
                }
                aria-keyshortcuts="Enter"
              >
                <MessageSquare size={15} aria-hidden="true" />
              </button>
              {toolbarHint === "comment" ? (
                <span
                  id={commentTooltipId}
                  className={styles.transcriptToolbarActionTooltip}
                  role="tooltip"
                >
                  <span>
                    <strong>Comment on this line</strong>
                    <small>Add a note at the current playhead.</small>
                  </span>
                  <kbd>Enter</kbd>
                </span>
              ) : null}
            </span>
            <span
              className={styles.transcriptToolbarActionHint}
              onMouseEnter={() => setToolbarHint("moment")}
              onMouseLeave={() => setToolbarHint(null)}
              onFocusCapture={() => setToolbarHint("moment")}
              onBlurCapture={() => setToolbarHint(null)}
            >
              <button
                type="button"
                className={styles.transcriptToolbarAction}
                onClick={() => openKeyMomentCompose(activeSegment)}
                aria-label="Mark the current line as a key moment"
                aria-describedby={
                  toolbarHint === "moment" ? keyMomentTooltipId : undefined
                }
                aria-keyshortcuts="T"
              >
                <Tag size={15} aria-hidden="true" />
              </button>
              {toolbarHint === "moment" ? (
                <span
                  id={keyMomentTooltipId}
                  className={styles.transcriptToolbarActionTooltip}
                  role="tooltip"
                >
                  <span>
                    <strong>Mark a key moment</strong>
                    <small>Save this point for coaching.</small>
                  </span>
                  <kbd>T</kbd>
                </span>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>

      <div className={styles.stageBody}>
        <div
          className={styles.transcriptScroll}
          ref={scrollRef}
          onScroll={handleScroll}
          onWheel={beginBrowsingTranscript}
          onTouchStart={beginBrowsingTranscript}
          onPointerDown={beginBrowsingTranscript}
          onKeyDownCapture={handleTranscriptBrowseKeyDown}
        >
          {filteredTranscript.length === 0 ? (
            <div className={styles.transcriptEmpty}>
              No transcript available yet.
            </div>
          ) : (
            filteredTranscript.map((seg, index) => {
              const palette =
                speakerMap.get(seg.speaker || "Speaker") ?? SPEAKER_PALETTE[0]!;
              const active = activeSegment?.id === seg.id;
              const segMoments = momentsBySegment.get(seg.id) ?? [];
              const segComments = commentsBySegment.get(seg.id) ?? [];
              const phase = phaseBySegmentId.get(seg.id);
              const prevPhase =
                index > 0
                  ? phaseBySegmentId.get(filteredTranscript[index - 1]!.id)
                  : undefined;
              const showSegmentHeader = phase && phase.id !== prevPhase?.id;
              const segmentNumber = phase
                ? (phases?.spans.findIndex((span) => span.id === phase.id) ??
                    -1) + 1
                : 0;

              return (
                <div key={seg.id}>
                  {showSegmentHeader && phase && (
                    <div className={styles.transcriptSegmentLandmark}>
                      <button
                        type="button"
                        className={styles.transcriptSegmentLandmarkButton}
                        onClick={() => seekFromTranscript(phaseSeekTime(phase))}
                      >
                        <span className={styles.transcriptSegmentLandmarkIndex}>
                          {segmentNumber}
                        </span>
                        <span className={styles.transcriptSegmentLandmarkCopy}>
                          <span
                            className={styles.transcriptSegmentLandmarkHead}
                          >
                            <strong>{phase.title}</strong>
                            <span>
                              {formatSegmentTimeRange(
                                phase.startTime,
                                phase.endTime,
                              )}
                            </span>
                          </span>
                          {phase.summary ? (
                            <span
                              className={
                                styles.transcriptSegmentLandmarkSummary
                              }
                            >
                              {phase.summary}
                            </span>
                          ) : null}
                        </span>
                        <span className={styles.transcriptSegmentLandmarkMeta}>
                          {phase.location ? (
                            <span title={phase.location}>
                              <MapPin size={13} />
                              {phase.location}
                            </span>
                          ) : null}
                          {phase.highlights?.length ? (
                            <span
                              title={`${phase.highlights.length} segment highlights`}
                            >
                              <Sparkles size={13} />
                              {phase.highlights.length}
                            </span>
                          ) : null}
                          <ChevronRight size={15} aria-hidden="true" />
                        </span>
                      </button>
                    </div>
                  )}

                  <div
                    className={`${styles.transcriptBlock} ${active ? styles.transcriptBlockActive : ""}`}
                    ref={(node) => {
                      rowRefs.current[seg.id] = node;
                    }}
                  >
                    <div
                      className={`${styles.transcriptRowWrap} ${useCommentLayout ? styles.transcriptRowWrapComments : ""}`}
                    >
                      <div className={styles.transcriptTurn}>
                        <button
                          type="button"
                          className={styles.transcriptRow}
                          onClick={() => seekFromTranscript(seg.startTime)}
                          onDoubleClick={(event) => {
                            if (readOnly) return;
                            event.preventDefault();
                            openInlineCompose(seg);
                          }}
                        >
                          <span
                            className={styles.transcriptAvatar}
                            style={{
                              background: palette.soft,
                              color: palette.color,
                            }}
                          >
                            {initialsFor(labelForSpeaker(seg.speaker))}
                          </span>
                          <span className={styles.transcriptCopy}>
                            <span className={styles.transcriptMeta}>
                              <strong style={{ color: palette.color }}>
                                {labelForSpeaker(seg.speaker)}
                              </strong>
                              <span className={styles.transcriptTimestamp}>
                                {formatTime(seg.startTime)}
                              </span>
                            </span>
                            <span className={styles.transcriptText}>
                              {seg.text}
                            </span>
                          </span>
                        </button>

                        {segMoments.length > 0 ? (
                          <div
                            className={styles.transcriptMomentMarkers}
                            aria-label="Key moments on this line"
                          >
                            {segMoments.map((moment) => (
                              <button
                                key={moment.id}
                                type="button"
                                className={`${styles.transcriptMomentMarker} ${selectedMomentId === moment.id ? styles.transcriptMomentMarkerActive : ""}`}
                                onClick={() => {
                                  setIsFollowingPlayback(true);
                                  setViewedSegmentId(seg.id);
                                  onMomentClick(moment);
                                }}
                                title={`Open key moment: ${moment.label}`}
                                aria-current={
                                  selectedMomentId === moment.id
                                    ? "true"
                                    : undefined
                                }
                              >
                                <span
                                  className={styles.transcriptMomentMarkerIcon}
                                >
                                  <Sparkles size={14} aria-hidden="true" />
                                </span>
                                <span
                                  className={styles.transcriptMomentMarkerCopy}
                                >
                                  <span
                                    className={
                                      styles.transcriptMomentMarkerMeta
                                    }
                                  >
                                    <span>Key moment</span>
                                    <time>{formatTime(moment.timestamp)}</time>
                                  </span>
                                  <span
                                    className={
                                      styles.transcriptMomentMarkerText
                                    }
                                  >
                                    {moment.label}
                                  </span>
                                </span>
                                <ChevronRight
                                  className={
                                    styles.transcriptMomentMarkerChevron
                                  }
                                  size={15}
                                  aria-hidden="true"
                                />
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {!readOnly && inlineCompose?.segmentId === seg.id && (
                        <InlineCommentComposer
                          sessionId={sessionId}
                          timestampSec={inlineCompose.timestampSec}
                          onPosted={() => setInlineCompose(null)}
                          onCancel={() => setInlineCompose(null)}
                          onCommentsUpdated={onCommentsUpdated}
                        />
                      )}

                      {!readOnly && keyMomentCompose?.segmentId === seg.id && (
                        <InlineKeyMomentComposer
                          sessionId={sessionId}
                          timestampSec={keyMomentCompose.timestampSec}
                          onPosted={() => setKeyMomentCompose(null)}
                          onCancel={() => setKeyMomentCompose(null)}
                          onCommentsUpdated={onCommentsUpdated}
                        />
                      )}

                      {showComments &&
                        segComments.map((comment) =>
                          !readOnly && editingCommentId === comment.id ? (
                            <InlineCommentEditor
                              key={comment.id}
                              sessionId={sessionId}
                              commentId={comment.id}
                              initialBody={comment.body}
                              variant="floating"
                              onSaved={() => {
                                setEditingCommentId(null);
                                onCommentsUpdated();
                              }}
                              onCancel={() => setEditingCommentId(null)}
                            />
                          ) : (
                            <div
                              key={comment.id}
                              role="button"
                              tabIndex={0}
                              className={`${styles.floatingComment} ${activeCommentId === comment.id ? styles.floatingCommentActive : ""}`}
                              onClick={() => {
                                if (comment.timestampSec != null)
                                  seekFromTranscript(comment.timestampSec);
                                onCommentSelect(comment.id);
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ")
                                  return;
                                event.preventDefault();
                                if (comment.timestampSec != null)
                                  seekFromTranscript(comment.timestampSec);
                                onCommentSelect(comment.id);
                              }}
                              onDoubleClick={(event) => {
                                if (readOnly) return;
                                event.preventDefault();
                                event.stopPropagation();
                                setEditingCommentId(comment.id);
                              }}
                            >
                              <div className={styles.floatingCommentHead}>
                                <span className={styles.floatingCommentAvatar}>
                                  {initialsFor(comment.authorName)}
                                </span>
                                <span className={styles.floatingCommentAuthor}>
                                  {comment.authorName}
                                </span>
                                <span className={styles.floatingCommentTime}>
                                  {relativeTime(comment.createdAt)}
                                </span>
                                {!readOnly && (
                                  <span
                                    className={`${styles.floatingCommentMenuWrap} ${openCommentMenuId === comment.id ? styles.commentMenuWrapOpen : ""}`}
                                    onClick={(event) => event.stopPropagation()}
                                    onKeyDown={(event) =>
                                      event.stopPropagation()
                                    }
                                  >
                                    <button
                                      type="button"
                                      className={styles.floatingCommentMore}
                                      aria-label="Comment options"
                                      aria-expanded={
                                        openCommentMenuId === comment.id
                                      }
                                      onClick={() =>
                                        setOpenCommentMenuId(
                                          openCommentMenuId === comment.id
                                            ? null
                                            : comment.id,
                                        )
                                      }
                                    >
                                      <MoreHorizontal size={14} />
                                    </button>
                                    {openCommentMenuId === comment.id && (
                                      <span
                                        className={styles.commentMenu}
                                        role="menu"
                                      >
                                        <button
                                          type="button"
                                          role="menuitem"
                                          onClick={() => {
                                            setEditingCommentId(comment.id);
                                            setOpenCommentMenuId(null);
                                          }}
                                        >
                                          <Pencil size={13} />
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          role="menuitem"
                                          className={styles.commentMenuDanger}
                                          onClick={() =>
                                            void handleDeleteComment(comment.id)
                                          }
                                        >
                                          <Trash2 size={13} />
                                          Delete
                                        </button>
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                              <p>{comment.body}</p>
                            </div>
                          ),
                        )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className={styles.stageStatus} aria-live="polite">
        <span>{formatTime(currentTime)}</span>
        <span>
          {activeSegment
            ? `${labelForSpeaker(activeSegment.speaker)} speaking`
            : "Ready"}
        </span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
