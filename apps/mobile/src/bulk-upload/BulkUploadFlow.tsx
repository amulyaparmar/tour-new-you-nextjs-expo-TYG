import { Ionicons } from "@expo/vector-icons";
import type { Rubric } from "@tour/shared";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Reanimated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadingDots } from "@/components/loading-dots";
import { fetchRubrics } from "../api";
import { tourColors as C, scoreColor } from "../theme/tour-brand";
import {
  appendBulkBatchAssets,
  bulkBatchCounts,
  cancelQueuedBulkItems,
  createBulkBatch,
  deleteBulkBatch,
  getBulkBatch,
  getLatestActiveBulkBatch,
  listBulkBatches,
  refreshBulkBatch,
  removeBulkBatchItem,
  runBulkBatch,
  subscribeBulkBatches,
  updateBulkBatch,
  updateBulkBatchItem,
  type BulkBatch,
  type BulkBatchItem,
  type BulkBatchItemStatus,
} from "./batch-store";

type FlowStep = "select" | "configure" | "review" | "progress" | "summary";
type BatchDraft = {
  name: string;
  location: string;
  notes: string;
  rubricId: string | null;
  uploaderIsAgent: boolean;
  items: Record<string, { title: string; prospectName: string }>;
};

type BulkUploadFlowProps = {
  communityId: string;
  propertyName: string;
  agentName: string;
  initialBatchId?: string;
  onBack: () => void;
  onOpenSession: (sessionId: string) => void;
  onNotify?: (message: string, kind?: "success" | "error" | "info") => void;
};

function stepForBatch(batch: BulkBatch | null): FlowStep {
  if (!batch) return "select";
  if (batch.status === "draft") return "configure";
  if (batch.status === "complete" || batch.status === "partial") return "summary";
  return "progress";
}

function draftForBatch(batch: BulkBatch): BatchDraft {
  return {
    name: batch.name,
    location: batch.location,
    notes: batch.notes,
    rubricId: batch.rubricId,
    uploaderIsAgent: batch.uploaderIsAgent,
    items: Object.fromEntries(batch.items.map((item) => [
      item.id,
      { title: item.title, prospectName: item.prospectName },
    ])),
  };
}

function formatBytes(bytes: number | null) {
  if (!bytes || bytes <= 0) return "Size unavailable";
  const mb = bytes / 1024 / 1024;
  return mb >= 100 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

function batchProgress(batch: BulkBatch) {
  if (batch.items.length === 0) return 0;
  const points = batch.items.reduce((total, item) => {
    if (item.status === "ready") return total + 100;
    if (item.status === "processing") return total + 88;
    if (item.status === "uploading") return total + Math.max(10, Math.min(75, item.progress * 0.75));
    if (item.status === "creating") return total + 5;
    return total;
  }, 0);
  return Math.round(points / batch.items.length);
}

function statusPresentation(status: BulkBatchItemStatus) {
  switch (status) {
    case "queued":
      return { label: "Ready to upload", icon: "time-outline" as const, color: C.textMuted, bg: "#f1f5f9" };
    case "creating":
      return { label: "Creating session", icon: "sparkles-outline" as const, color: C.brand, bg: "#eaf4ff" };
    case "uploading":
      return { label: "Uploading", icon: "cloud-upload-outline" as const, color: C.brand, bg: "#eaf4ff" };
    case "processing":
      return { label: "Analyzing", icon: "analytics-outline" as const, color: C.purple, bg: C.purpleBg };
    case "ready":
      return { label: "Report ready", icon: "checkmark" as const, color: C.green, bg: C.greenBg };
    case "error":
      return { label: "Needs attention", icon: "alert" as const, color: C.red, bg: C.redBg };
    case "cancelled":
      return { label: "Cancelled", icon: "close" as const, color: C.textMuted, bg: "#f1f5f9" };
  }
}

export function BulkUploadFlow({
  communityId,
  propertyName,
  agentName,
  initialBatchId,
  onBack,
  onOpenSession,
  onNotify,
}: BulkUploadFlowProps) {
  const [batchId, setBatchId] = useState<string | null>(initialBatchId ?? null);
  const [batch, setBatch] = useState<BulkBatch | null>(null);
  const [recentBatches, setRecentBatches] = useState<BulkBatch[]>([]);
  const [step, setStep] = useState<FlowStep>("select");
  const [draft, setDraft] = useState<BatchDraft | null>(null);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [rubricOpen, setRubricOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [next, recent] = await Promise.all([
      batchId ? getBulkBatch(batchId) : getLatestActiveBulkBatch(communityId),
      listBulkBatches(communityId),
    ]);
    setRecentBatches(recent.slice(0, 5));
    if (!next) {
      setBatch(null);
      setStep("select");
      return;
    }
    setBatchId(next.id);
    setBatch(next);
    setDraft((current) => current ?? draftForBatch(next));
    setStep((current) => current === "review" ? current : stepForBatch(next));
  }, [batchId, communityId]);

  useEffect(() => {
    void Promise.all([
      reload(),
      fetchRubrics()
        .then((result) => setRubrics(result.rubrics))
        .catch(() => undefined),
    ]).finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    return subscribeBulkBatches(() => {
      void reload();
    });
  }, [reload]);

  useEffect(() => {
    if (!batch || step !== "progress") return;
    const poll = setInterval(() => {
      if (AppState.currentState === "active") void refreshBulkBatch(batch.id);
    }, 5000);
    return () => clearInterval(poll);
  }, [batch, step]);

  useEffect(() => {
    if (!batch || step !== "progress") return;
    const counts = bulkBatchCounts(batch);
    if (counts.queued > 0 && counts.active === 0) {
      void runBulkBatch(batch.id);
    }
  }, [batch, step]);

  async function pickFiles(append = false) {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["video/*", "audio/*"],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled || !result.assets.length) return;
      setBusy(true);
      const next = append && batch
        ? await appendBulkBatchAssets(batch.id, result.assets)
        : await createBulkBatch({
            communityId,
            propertyName,
            agentName,
            assets: result.assets,
          });
      setBatchId(next.id);
      setBatch(next);
      setDraft(draftForBatch(next));
      setStep("configure");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add these recordings.");
      onNotify?.("Could not add these recordings", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!batch || !draft) return null;
    const next = await updateBulkBatch(batch.id, {
      name: draft.name.trim() || batch.name,
      location: draft.location.trim(),
      notes: draft.notes.trim(),
      rubricId: draft.rubricId,
      uploaderIsAgent: draft.uploaderIsAgent,
      agentName,
    });
    await Promise.all(next.items.map((item) => {
      const itemDraft = draft.items[item.id];
      if (!itemDraft) return Promise.resolve(null);
      return updateBulkBatchItem(next.id, item.id, {
        title: itemDraft.title.trim(),
        prospectName: itemDraft.prospectName.trim(),
      });
    }));
    return getBulkBatch(batch.id);
  }

  async function openReview() {
    if (!batch?.items.length) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveDraft();
      if (saved) {
        setBatch(saved);
        setDraft(draftForBatch(saved));
      }
      setStep("review");
      void Haptics.selectionAsync();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this batch.");
    } finally {
      setBusy(false);
    }
  }

  async function startBatch() {
    if (!batch) return;
    setBusy(true);
    setError(null);
    setStep("progress");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await updateBulkBatch(batch.id, { status: "running" });
      await runBulkBatch(batch.id);
      onNotify?.("Your recordings are uploading in the background", "success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the batch.");
      onNotify?.("Could not start the batch", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(item: BulkBatchItem) {
    if (!batch || batch.items.length <= 1) return;
    Alert.alert("Remove recording?", item.fileName, [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void removeBulkBatchItem(batch.id, item.id).then((next) => {
            if (next) {
              setBatch(next);
              setDraft(draftForBatch(next));
            }
          });
        },
      },
    ]);
  }

  async function discardBatch() {
    if (!batch) return;
    Alert.alert("Discard this batch?", "The saved device copies will be removed. Sessions already uploaded will remain.", [
      { text: "Keep batch", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          void deleteBulkBatch(batch.id).then(() => {
            setBatchId(null);
            setBatch(null);
            setDraft(null);
            setStep("select");
          });
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <LoadingDots size="large" color={C.brand} />
        <Text style={styles.loadingText}>Restoring your upload workspace…</Text>
      </View>
    );
  }

  const title = step === "select" ? "Bulk analysis"
    : step === "configure" ? "Set up batch"
    : step === "review" ? "Review batch"
    : step === "progress" ? "Batch progress"
    : "Batch summary";

  return (
    <View style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <FlowHeader
          title={title}
          eyebrow={batch?.name ?? "Mobile upload workspace"}
          onBack={step === "review" ? () => setStep("configure") : onBack}
          onCloseBatch={batch && step !== "progress" ? () => void discardBatch() : undefined}
        />
        {error ? (
          <Reanimated.View entering={FadeIn.duration(180)} style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={C.red} />
            <Text style={styles.errorText}>{error}</Text>
          </Reanimated.View>
        ) : null}

        {step === "select" ? (
          <SelectStep
            busy={busy}
            recentBatches={recentBatches}
            onPick={() => void pickFiles()}
            onOpenBatch={(next) => {
              setBatchId(next.id);
              setBatch(next);
              setDraft(draftForBatch(next));
              setStep(stepForBatch(next));
            }}
          />
        ) : null}
        {step === "configure" && batch && draft ? (
          <ConfigureStep
            agentName={agentName}
            batch={batch}
            draft={draft}
            rubrics={rubrics}
            rubricOpen={rubricOpen}
            busy={busy}
            onDraft={setDraft}
            onToggleRubrics={() => setRubricOpen((current) => !current)}
            onPickRubric={(rubricId) => {
              setDraft({ ...draft, rubricId });
              setRubricOpen(false);
            }}
            onAddFiles={() => void pickFiles(true)}
            onRemove={(item) => void removeItem(item)}
            onContinue={() => void openReview()}
          />
        ) : null}
        {step === "review" && batch ? (
          <ReviewStep
            batch={batch}
            rubricName={rubrics.find((rubric) => rubric.id === batch.rubricId)?.name ?? null}
            busy={busy}
            onEdit={() => setStep("configure")}
            onStart={() => void startBatch()}
          />
        ) : null}
        {step === "progress" && batch ? (
          <ProgressStep
            batch={batch}
            busy={busy}
            onOpenSession={onOpenSession}
            onRetry={() => void runBulkBatch(batch.id)}
            onCancel={() => void cancelQueuedBulkItems(batch.id)}
            onRefresh={() => void refreshBulkBatch(batch.id)}
            onSummary={() => setStep("summary")}
          />
        ) : null}
        {step === "summary" && batch ? (
          <SummaryStep
            batch={batch}
            onOpenSession={onOpenSession}
            onRetry={() => {
              setStep("progress");
              void runBulkBatch(batch.id);
            }}
            onDone={onBack}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function FlowHeader({
  title,
  eyebrow,
  onBack,
  onCloseBatch,
}: {
  title: string;
  eyebrow: string;
  onBack: () => void;
  onCloseBatch?: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerNav}>
        <Pressable accessibilityLabel="Go back" onPress={onBack} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={styles.headerBrand}>
          <View style={styles.headerMark}><Ionicons name="layers" size={15} color="#fff" /></View>
          <Text style={styles.headerBrandText}>Tour</Text>
        </View>
        {onCloseBatch ? (
          <Pressable accessibilityLabel="Discard batch" onPress={onCloseBatch} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Ionicons name="trash-outline" size={19} color={C.textSec} />
          </Pressable>
        ) : <View style={styles.iconButtonSpacer} />}
      </View>
      <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text>
      <Text style={styles.pageTitle}>{title}</Text>
    </View>
  );
}

function SelectStep({
  busy,
  recentBatches,
  onPick,
  onOpenBatch,
}: {
  busy: boolean;
  recentBatches: BulkBatch[];
  onPick: () => void;
  onOpenBatch: (batch: BulkBatch) => void;
}) {
  return (
    <Reanimated.View entering={FadeInDown.duration(280).springify()} style={styles.stepGap}>
      <LinearGradient colors={["#006ce5", "#4D8AE5", "#7c3aed"]} style={styles.hero}>
        <View style={styles.heroGlow} />
        <View style={styles.heroIcon}><Ionicons name="albums-outline" size={28} color="#fff" /></View>
        <Text style={styles.heroTitle}>Turn a folder of recordings into a clear review queue.</Text>
        <Text style={styles.heroCopy}>Pick audio or video files once. Tour preserves the batch on this device and creates a separate analysis for every recording.</Text>
        <Pressable disabled={busy} onPress={onPick} style={({ pressed }) => [styles.heroButton, pressed && styles.pressed, busy && styles.disabled]}>
          {busy ? <LoadingDots size="small" color={C.brand} /> : <Ionicons name="add" size={19} color={C.brand} />}
          <Text style={styles.heroButtonText}>{busy ? "Preparing files…" : "Choose recordings"}</Text>
        </Pressable>
      </LinearGradient>
      <View style={styles.promiseGrid}>
        <PromiseCard icon="shield-checkmark-outline" title="Safe to leave" copy="The queue is saved locally and can resume after a restart." />
        <PromiseCard icon="options-outline" title="Review first" copy="Add shared context and customize every session before upload." />
        <PromiseCard icon="document-text-outline" title="Individual reports" copy="Each completed session keeps its own analysis and PDF report." />
      </View>
      {recentBatches.length > 0 ? (
        <View style={styles.recentSection}>
          <View>
            <Text style={styles.sectionKicker}>RECENT BATCHES</Text>
            <Text style={styles.sectionTitle}>Return to a saved summary</Text>
          </View>
          <View style={styles.recentList}>
            {recentBatches.map((batch) => {
              const counts = bulkBatchCounts(batch);
              return (
                <Pressable key={batch.id} onPress={() => onOpenBatch(batch)} style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]}>
                  <View style={styles.recentIcon}><Ionicons name="layers-outline" size={18} color={C.brand} /></View>
                  <View style={styles.flex}>
                    <Text style={styles.fileName} numberOfLines={1}>{batch.name}</Text>
                    <Text style={styles.fileMeta}>{counts.ready} ready · {counts.total} total · {new Date(batch.updatedAt).toLocaleDateString()}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={C.textMuted} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </Reanimated.View>
  );
}

function PromiseCard({ icon, title, copy }: { icon: keyof typeof Ionicons.glyphMap; title: string; copy: string }) {
  return (
    <View style={styles.promise}>
      <View style={styles.promiseIcon}><Ionicons name={icon} size={19} color={C.brand} /></View>
      <View style={styles.flex}>
        <Text style={styles.promiseTitle}>{title}</Text>
        <Text style={styles.promiseCopy}>{copy}</Text>
      </View>
    </View>
  );
}

function ConfigureStep({
  agentName,
  batch,
  draft,
  rubrics,
  rubricOpen,
  busy,
  onDraft,
  onToggleRubrics,
  onPickRubric,
  onAddFiles,
  onRemove,
  onContinue,
}: {
  agentName: string;
  batch: BulkBatch;
  draft: BatchDraft;
  rubrics: Rubric[];
  rubricOpen: boolean;
  busy: boolean;
  onDraft: (draft: BatchDraft) => void;
  onToggleRubrics: () => void;
  onPickRubric: (rubricId: string) => void;
  onAddFiles: () => void;
  onRemove: (item: BulkBatchItem) => void;
  onContinue: () => void;
}) {
  return (
    <Reanimated.View entering={FadeInDown.duration(240)} style={styles.stepGap}>
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionKicker}>SHARED DETAILS</Text>
            <Text style={styles.sectionTitle}>Apply once to every session</Text>
          </View>
          <View style={styles.countBadge}><Text style={styles.countBadgeText}>{batch.items.length} files</Text></View>
        </View>
        <Field label="Batch name" value={draft.name} onChangeText={(name) => onDraft({ ...draft, name })} placeholder="July tour reviews" />
        <Field label="Location" value={draft.location} onChangeText={(location) => onDraft({ ...draft, location })} placeholder="Property or community" />
        <Field label="Notes / focus" value={draft.notes} onChangeText={(notes) => onDraft({ ...draft, notes })} placeholder="What should the analysis focus on?" multiline />
        <Pressable
          onPress={() => {
            onDraft({ ...draft, uploaderIsAgent: !draft.uploaderIsAgent });
            void Haptics.selectionAsync();
          }}
          style={({ pressed }) => [styles.identityRow, draft.uploaderIsAgent && styles.identityRowActive, pressed && styles.pressed]}
        >
          <View style={[styles.check, draft.uploaderIsAgent && styles.checkActive]}>
            {draft.uploaderIsAgent ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
          </View>
          <View style={styles.flex}>
            <Text style={styles.identityTitle}>I’m the leasing agent</Text>
            <Text style={styles.identityCopy}>Use {agentName} as the agent across this batch.</Text>
          </View>
        </Pressable>
        {rubrics.length > 0 ? (
          <View>
            <Text style={styles.fieldLabel}>Evaluation rubric</Text>
            <Pressable onPress={onToggleRubrics} style={({ pressed }) => [styles.selectField, pressed && styles.pressed]}>
              <Ionicons name="clipboard-outline" size={18} color={C.textMuted} />
              <Text style={styles.selectFieldText} numberOfLines={1}>
                {rubrics.find((rubric) => rubric.id === draft.rubricId)?.name ?? "Choose a rubric"}
              </Text>
              <Ionicons name={rubricOpen ? "chevron-up" : "chevron-down"} size={17} color={C.textMuted} />
            </Pressable>
            {rubricOpen ? (
              <View style={styles.rubricList}>
                {rubrics.map((rubric) => (
                  <Pressable key={rubric.id} onPress={() => onPickRubric(rubric.id)} style={({ pressed }) => [styles.rubricRow, draft.rubricId === rubric.id && styles.rubricRowActive, pressed && styles.pressed]}>
                    <Text style={styles.rubricName}>{rubric.name}</Text>
                    {draft.rubricId === rubric.id ? <Ionicons name="checkmark-circle" size={19} color={C.brand} /> : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionKicker}>RECORDINGS</Text>
          <Text style={styles.sectionTitle}>Name them now or later</Text>
        </View>
        <Pressable onPress={onAddFiles} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
          <Ionicons name="add" size={17} color={C.brand} />
          <Text style={styles.textButtonLabel}>Add files</Text>
        </Pressable>
      </View>
      {batch.items.map((item, index) => {
        const itemDraft = draft.items[item.id] ?? { title: "", prospectName: "" };
        return (
          <View key={item.id} style={styles.fileEditor}>
            <View style={styles.fileEditorTop}>
              <View style={styles.fileNumber}><Text style={styles.fileNumberText}>{index + 1}</Text></View>
              <View style={styles.flex}>
                <Text style={styles.fileName} numberOfLines={1}>{item.fileName}</Text>
                <Text style={styles.fileMeta}>{formatBytes(item.fileSize)}</Text>
              </View>
              {batch.items.length > 1 ? (
                <Pressable accessibilityLabel={`Remove ${item.fileName}`} onPress={() => onRemove(item)} hitSlop={8}>
                  <Ionicons name="close-circle-outline" size={21} color={C.textMuted} />
                </Pressable>
              ) : null}
            </View>
            <TextInput
              accessibilityLabel={`Session title for ${item.fileName}`}
              value={itemDraft.title}
              onChangeText={(title) => onDraft({
                ...draft,
                items: { ...draft.items, [item.id]: { ...itemDraft, title } },
              })}
              placeholder="Session title (optional)"
              placeholderTextColor={C.textMuted}
              style={styles.compactInput}
            />
            <TextInput
              accessibilityLabel={`Prospect name for ${item.fileName}`}
              value={itemDraft.prospectName}
              onChangeText={(prospectName) => onDraft({
                ...draft,
                items: { ...draft.items, [item.id]: { ...itemDraft, prospectName } },
              })}
              placeholder="Prospect name (optional)"
              placeholderTextColor={C.textMuted}
              style={styles.compactInput}
            />
          </View>
        );
      })}
      <PrimaryAction label={busy ? "Saving…" : "Review batch"} icon="arrow-forward" disabled={busy || batch.items.length === 0} onPress={onContinue} />
    </Reanimated.View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.field, multiline && styles.fieldMultiline]}
      />
    </View>
  );
}

function ReviewStep({
  batch,
  rubricName,
  busy,
  onEdit,
  onStart,
}: {
  batch: BulkBatch;
  rubricName: string | null;
  busy: boolean;
  onEdit: () => void;
  onStart: () => void;
}) {
  const totalBytes = batch.items.reduce((total, item) => total + (item.fileSize ?? 0), 0);
  return (
    <Reanimated.View entering={FadeInDown.duration(240)} style={styles.stepGap}>
      <LinearGradient colors={["#f7fbff", "#f5f3ff"]} style={styles.reviewHero}>
        <View style={styles.reviewHeroIcon}><Ionicons name="checkmark-done" size={25} color={C.brand} /></View>
        <Text style={styles.reviewHeroTitle}>Ready when you are</Text>
        <Text style={styles.reviewHeroCopy}>Tour will create {batch.items.length} independent sessions and upload up to two recordings at a time.</Text>
      </LinearGradient>
      <View style={styles.reviewStats}>
        <Stat value={String(batch.items.length)} label="Sessions" />
        <Stat value={formatBytes(totalBytes).replace("Size unavailable", "—")} label="Total size" />
        <Stat value="2" label="At a time" />
      </View>
      <View style={styles.sectionCard}>
        <SummaryRow label="Batch" value={batch.name} />
        <SummaryRow label="Location" value={batch.location || "Not set"} />
        <SummaryRow label="Rubric" value={rubricName ?? "Property default"} />
        <SummaryRow label="Agent" value={batch.uploaderIsAgent ? batch.agentName ?? "Current user" : "Identify from audio"} />
      </View>
      <View style={styles.reviewFileList}>
        {batch.items.map((item, index) => (
          <View key={item.id} style={styles.reviewFileRow}>
            <View style={styles.fileNumber}><Text style={styles.fileNumberText}>{index + 1}</Text></View>
            <View style={styles.flex}>
              <Text style={styles.fileName} numberOfLines={1}>{item.title || item.fileName}</Text>
              <Text style={styles.fileMeta}>{item.prospectName || "Prospect not set"} · {formatBytes(item.fileSize)}</Text>
            </View>
          </View>
        ))}
      </View>
      <PrimaryAction label={busy ? "Starting…" : `Start ${batch.items.length} analyses`} icon="sparkles" disabled={busy} onPress={onStart} />
      <Pressable onPress={onEdit} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
        <Ionicons name="create-outline" size={18} color={C.textSec} />
        <Text style={styles.secondaryActionText}>Edit details</Text>
      </Pressable>
    </Reanimated.View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function ProgressStep({
  batch,
  busy,
  onOpenSession,
  onRetry,
  onCancel,
  onRefresh,
  onSummary,
}: {
  batch: BulkBatch;
  busy: boolean;
  onOpenSession: (sessionId: string) => void;
  onRetry: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  onSummary: () => void;
}) {
  const counts = bulkBatchCounts(batch);
  const percent = batchProgress(batch);
  const finished = counts.ready + counts.failed + counts.cancelled === counts.total
    && counts.active === 0
    && counts.processing === 0
    && counts.queued === 0;
  return (
    <Reanimated.View entering={FadeInDown.duration(240)} style={styles.stepGap}>
      <View style={styles.progressHero}>
        <View style={styles.progressRing}>
          <Text style={styles.progressPercent}>{percent}%</Text>
          <Text style={styles.progressRingLabel}>overall</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.progressTitle}>{finished ? "Batch finished" : "Working through your queue"}</Text>
          <Text style={styles.progressCopy}>
            {counts.ready} ready · {counts.processing} analyzing · {counts.active + counts.queued} uploading
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>
        </View>
      </View>
      <View style={styles.backgroundNote}>
        <Ionicons name="phone-portrait-outline" size={18} color={C.brand} />
        <Text style={styles.backgroundNoteText}>You can leave this screen. The batch is saved on this device and will resume when you return.</Text>
      </View>
      <View style={styles.progressList}>
        {batch.items.map((item) => (
          <BatchItemRow key={item.id} item={item} onOpenSession={onOpenSession} />
        ))}
      </View>
      {finished ? (
        <PrimaryAction label="View batch summary" icon="analytics-outline" onPress={onSummary} />
      ) : (
        <View style={styles.actionRow}>
          {counts.failed > 0 ? (
            <Pressable disabled={busy} onPress={onRetry} style={({ pressed }) => [styles.smallAction, pressed && styles.pressed]}>
              <Ionicons name="refresh" size={17} color={C.brand} />
              <Text style={styles.smallActionText}>Retry failed</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onRefresh} style={({ pressed }) => [styles.smallAction, pressed && styles.pressed]}>
            <Ionicons name="sync" size={17} color={C.brand} />
            <Text style={styles.smallActionText}>Refresh</Text>
          </Pressable>
          {counts.queued > 0 ? (
            <Pressable onPress={onCancel} style={({ pressed }) => [styles.smallAction, pressed && styles.pressed]}>
              <Ionicons name="close" size={17} color={C.textSec} />
              <Text style={[styles.smallActionText, styles.smallActionMuted]}>Cancel waiting</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Reanimated.View>
  );
}

function BatchItemRow({
  item,
  onOpenSession,
}: {
  item: BulkBatchItem;
  onOpenSession: (sessionId: string) => void;
}) {
  const presentation = statusPresentation(item.status);
  const openable = Boolean(item.sessionId);
  return (
    <Pressable
      disabled={!openable}
      onPress={() => item.sessionId && onOpenSession(item.sessionId)}
      style={({ pressed }) => [styles.progressRow, pressed && styles.pressed]}
    >
      <View style={[styles.statusIcon, { backgroundColor: presentation.bg }]}>
        {item.status === "creating" || item.status === "uploading" || item.status === "processing"
          ? <LoadingDots size="small" color={presentation.color} />
          : <Ionicons name={presentation.icon} size={18} color={presentation.color} />}
      </View>
      <View style={styles.flex}>
        <Text style={styles.fileName} numberOfLines={1}>{item.title || item.fileName}</Text>
        <Text style={[styles.fileMeta, { color: presentation.color }]}>{presentation.label}{item.status === "uploading" ? ` · ${Math.round(item.progress)}%` : ""}</Text>
        {item.status === "uploading" ? (
          <View style={styles.itemProgressTrack}>
            <View style={[styles.itemProgressFill, { width: `${Math.max(2, item.progress)}%` }]} />
          </View>
        ) : null}
        {item.error ? <Text style={styles.itemError}>{item.error}</Text> : null}
      </View>
      {item.overallScore != null ? (
        <Text style={[styles.rowScore, { color: scoreColor(item.overallScore) }]}>{item.overallScore}%</Text>
      ) : openable ? <Ionicons name="chevron-forward" size={17} color={C.textMuted} /> : null}
    </Pressable>
  );
}

function SummaryStep({
  batch,
  onOpenSession,
  onRetry,
  onDone,
}: {
  batch: BulkBatch;
  onOpenSession: (sessionId: string) => void;
  onRetry: () => void;
  onDone: () => void;
}) {
  const counts = bulkBatchCounts(batch);
  const scored = batch.items.filter((item) => item.overallScore != null);
  const average = scored.length
    ? Math.round(scored.reduce((sum, item) => sum + (item.overallScore ?? 0), 0) / scored.length)
    : null;
  const high = scored.length ? Math.max(...scored.map((item) => item.overallScore ?? 0)) : null;
  const low = scored.length ? Math.min(...scored.map((item) => item.overallScore ?? 0)) : null;
  return (
    <Reanimated.View entering={FadeInDown.duration(260).springify()} style={styles.stepGap}>
      <LinearGradient colors={["#0f172a", "#172554"]} style={styles.summaryHero}>
        <View style={styles.summarySparkle}><Ionicons name="sparkles" size={22} color="#bfdbfe" /></View>
        <Text style={styles.summaryHeroKicker}>BATCH COMPLETE</Text>
        <Text style={styles.summaryHeroTitle}>{counts.ready} reports are ready to review.</Text>
        <Text style={styles.summaryHeroCopy}>This summary is calculated from the individual completed session scores.</Text>
      </LinearGradient>
      <View style={styles.reviewStats}>
        <Stat value={average == null ? "—" : `${average}%`} label="Average" />
        <Stat value={high == null ? "—" : `${high}%`} label="Highest" />
        <Stat value={low == null ? "—" : `${low}%`} label="Lowest" />
      </View>
      {counts.failed > 0 ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={C.red} />
          <Text style={styles.errorText}>{counts.failed} {counts.failed === 1 ? "recording needs" : "recordings need"} attention. Completed reports are still available.</Text>
        </View>
      ) : null}
      <View style={styles.progressList}>
        {[...batch.items]
          .sort((left, right) => (right.overallScore ?? -1) - (left.overallScore ?? -1))
          .map((item) => (
            <BatchItemRow key={item.id} item={item} onOpenSession={onOpenSession} />
          ))}
      </View>
      {counts.failed > 0 ? (
        <Pressable onPress={onRetry} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
          <Ionicons name="refresh" size={18} color={C.brand} />
          <Text style={[styles.secondaryActionText, styles.retryText]}>Retry failed recordings</Text>
        </Pressable>
      ) : null}
      <PrimaryAction label="Done" icon="checkmark" onPress={onDone} />
    </Reanimated.View>
  );
}

function PrimaryAction({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryAction, pressed && styles.primaryActionPressed, disabled && styles.disabled]}>
      <Text style={styles.primaryActionText}>{label}</Text>
      <Ionicons name={icon} size={19} color="#fff" />
    </Pressable>
  );
}

export function BulkUploadDock({
  communityId,
  hidden,
  onOpen,
}: {
  communityId: string;
  hidden?: boolean;
  onOpen: (batchId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [batch, setBatch] = useState<BulkBatch | null>(null);
  const reload = useCallback(() => {
    void getLatestActiveBulkBatch(communityId).then(setBatch);
  }, [communityId]);

  useEffect(() => {
    reload();
    return subscribeBulkBatches(reload);
  }, [reload]);

  const counts = useMemo(() => batch ? bulkBatchCounts(batch) : null, [batch]);
  if (hidden || !batch || !counts) return null;
  return (
    <View pointerEvents="box-none" style={[styles.dockWrap, { bottom: Math.max(insets.bottom, 10) + 126 }]}>
      <Pressable accessibilityLabel="Open bulk upload progress" onPress={() => onOpen(batch.id)} style={({ pressed }) => [styles.dock, pressed && styles.dockPressed]}>
        <View style={styles.dockIcon}><Ionicons name="layers" size={17} color="#fff" /></View>
        <View style={styles.flex}>
          <Text style={styles.dockTitle} numberOfLines={1}>{batch.name}</Text>
          <Text style={styles.dockMeta} numberOfLines={1}>
            {counts.ready} ready · {counts.processing + counts.active + counts.queued} in progress{counts.failed ? ` · ${counts.failed} failed` : ""}
          </Text>
        </View>
        <Text style={styles.dockPercent}>{batchProgress(batch)}%</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scrollContent: { padding: 18, paddingBottom: 52, gap: 16 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: C.bg },
  loadingText: { color: C.textSec, fontSize: 13, fontWeight: "700" },
  header: { gap: 2, marginBottom: 4 },
  headerNav: { minHeight: 44, flexDirection: "row", alignItems: "center", marginBottom: 10 },
  headerBrand: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  headerMark: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: C.brand },
  headerBrandText: { color: C.text, fontSize: 15, fontWeight: "900" },
  iconButton: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  iconButtonSpacer: { width: 40, height: 40 },
  eyebrow: { color: C.brand, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  pageTitle: { color: C.text, fontSize: 28, lineHeight: 34, fontWeight: "900", letterSpacing: -0.6 },
  stepGap: { gap: 14 },
  hero: { minHeight: 326, padding: 24, borderRadius: 28, overflow: "hidden", justifyContent: "flex-end", gap: 12 },
  heroGlow: { position: "absolute", width: 220, height: 220, borderRadius: 110, top: -70, right: -60, backgroundColor: "rgba(255,255,255,0.13)" },
  heroIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)", marginBottom: 12 },
  heroTitle: { color: "#fff", fontSize: 27, lineHeight: 32, fontWeight: "900", letterSpacing: -0.7 },
  heroCopy: { color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 21, fontWeight: "600" },
  heroButton: { minHeight: 52, marginTop: 6, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: "#fff" },
  heroButtonText: { color: C.brand, fontSize: 15, fontWeight: "900" },
  promiseGrid: { gap: 10 },
  promise: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  promiseIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#eaf4ff" },
  promiseTitle: { color: C.text, fontSize: 14, fontWeight: "900" },
  promiseCopy: { marginTop: 2, color: C.textSec, fontSize: 12, lineHeight: 17, fontWeight: "600" },
  recentSection: { marginTop: 8, gap: 10 },
  recentList: { overflow: "hidden", borderRadius: 19, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  recentRow: { minHeight: 62, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  recentIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#eaf4ff" },
  flex: { flex: 1, minWidth: 0 },
  sectionCard: { gap: 14, padding: 17, borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionKicker: { color: C.brand, fontSize: 10, lineHeight: 14, fontWeight: "900", letterSpacing: 0.9 },
  sectionTitle: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: "900", letterSpacing: -0.3 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "#eaf4ff" },
  countBadgeText: { color: C.brand, fontSize: 11, fontWeight: "900" },
  fieldLabel: { marginBottom: 7, color: C.textSec, fontSize: 11, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" },
  field: { minHeight: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: "#dce3ec", backgroundColor: "#fbfcfe", color: C.text, fontSize: 14, fontWeight: "700" },
  fieldMultiline: { minHeight: 86, paddingTop: 13 },
  identityRow: { minHeight: 64, padding: 13, borderRadius: 15, flexDirection: "row", alignItems: "center", gap: 11, borderWidth: 1, borderColor: C.border, backgroundColor: "#fbfcfe" },
  identityRowActive: { borderColor: "rgba(0,108,229,0.28)", backgroundColor: "#f2f8ff" },
  check: { width: 23, height: 23, borderRadius: 8, borderWidth: 1.5, borderColor: "#cbd5e1", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  checkActive: { borderColor: C.brand, backgroundColor: C.brand },
  identityTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  identityCopy: { marginTop: 2, color: C.textSec, fontSize: 11, lineHeight: 16, fontWeight: "600" },
  selectField: { minHeight: 48, paddingHorizontal: 13, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: "#dce3ec", backgroundColor: "#fbfcfe" },
  selectFieldText: { flex: 1, color: C.text, fontSize: 14, fontWeight: "700" },
  rubricList: { marginTop: 7, gap: 5 },
  rubricRow: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.bg },
  rubricRowActive: { backgroundColor: "#eaf4ff" },
  rubricName: { flex: 1, color: C.text, fontSize: 13, fontWeight: "800" },
  textButton: { minHeight: 38, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 4 },
  textButtonLabel: { color: C.brand, fontSize: 13, fontWeight: "900" },
  fileEditor: { gap: 9, padding: 14, borderRadius: 19, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  fileEditorTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  fileNumber: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#eaf4ff" },
  fileNumberText: { color: C.brand, fontSize: 12, fontWeight: "900" },
  fileName: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: "900" },
  fileMeta: { marginTop: 1, color: C.textMuted, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  compactInput: { minHeight: 42, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", color: C.text, fontSize: 13, fontWeight: "700" },
  primaryAction: { minHeight: 54, paddingHorizontal: 18, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: C.brand, shadowColor: C.brand, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 5 },
  primaryActionPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  primaryActionText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  secondaryAction: { minHeight: 48, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  secondaryActionText: { color: C.textSec, fontSize: 14, fontWeight: "900" },
  retryText: { color: C.brand },
  reviewHero: { padding: 22, borderRadius: 24, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(0,108,229,0.10)" },
  reviewHeroIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", marginBottom: 4 },
  reviewHeroTitle: { color: C.text, fontSize: 23, fontWeight: "900", letterSpacing: -0.4 },
  reviewHeroCopy: { color: C.textSec, textAlign: "center", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  reviewStats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, minWidth: 0, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 17, alignItems: "center", borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  statValue: { color: C.text, fontSize: 18, fontWeight: "900" },
  statLabel: { marginTop: 2, color: C.textMuted, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  summaryRow: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  summaryLabel: { color: C.textSec, fontSize: 12, fontWeight: "700" },
  summaryValue: { flex: 1, color: C.text, textAlign: "right", fontSize: 12, fontWeight: "900" },
  reviewFileList: { overflow: "hidden", borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  reviewFileRow: { minHeight: 62, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  progressHero: { padding: 18, borderRadius: 23, flexDirection: "row", alignItems: "center", gap: 15, backgroundColor: "#0f172a" },
  progressRing: { width: 74, height: 74, borderRadius: 37, alignItems: "center", justifyContent: "center", borderWidth: 5, borderColor: "#60a5fa", backgroundColor: "#172554" },
  progressPercent: { color: "#fff", fontSize: 18, fontWeight: "900" },
  progressRingLabel: { color: "#93c5fd", fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  progressTitle: { color: "#fff", fontSize: 17, lineHeight: 22, fontWeight: "900" },
  progressCopy: { marginTop: 3, color: "#94a3b8", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  progressTrack: { height: 5, marginTop: 10, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.14)" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: "#60a5fa" },
  backgroundNote: { padding: 13, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#eaf4ff" },
  backgroundNoteText: { flex: 1, color: "#35516f", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  progressList: { overflow: "hidden", borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  progressRow: { minHeight: 72, padding: 13, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  statusIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  itemProgressTrack: { height: 4, marginTop: 6, borderRadius: 999, overflow: "hidden", backgroundColor: "#dbeafe" },
  itemProgressFill: { height: "100%", borderRadius: 999, backgroundColor: C.brand },
  itemError: { marginTop: 4, color: C.red, fontSize: 10, lineHeight: 14, fontWeight: "700" },
  rowScore: { fontSize: 15, fontWeight: "900" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  smallAction: { minHeight: 42, paddingHorizontal: 13, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  smallActionText: { color: C.brand, fontSize: 12, fontWeight: "900" },
  smallActionMuted: { color: C.textSec },
  summaryHero: { minHeight: 214, padding: 22, borderRadius: 26, justifyContent: "flex-end", overflow: "hidden" },
  summarySparkle: { position: "absolute", top: 20, right: 20, width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.09)" },
  summaryHeroKicker: { color: "#93c5fd", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  summaryHeroTitle: { marginTop: 7, color: "#fff", fontSize: 26, lineHeight: 32, fontWeight: "900", letterSpacing: -0.5 },
  summaryHeroCopy: { marginTop: 7, color: "#94a3b8", fontSize: 12, lineHeight: 18, fontWeight: "600" },
  errorBanner: { padding: 13, borderRadius: 15, flexDirection: "row", alignItems: "flex-start", gap: 9, borderWidth: 1, borderColor: "rgba(185,28,28,0.12)", backgroundColor: C.redBg },
  errorText: { flex: 1, color: C.red, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.55 },
  dockWrap: { position: "absolute", left: 16, right: 16, zIndex: 38 },
  dock: { minHeight: 58, paddingHorizontal: 13, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", backgroundColor: "#172554", shadowColor: "#000", shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.18, shadowRadius: 17, elevation: 8 },
  dockPressed: { opacity: 0.94, transform: [{ scale: 0.995 }] },
  dockIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.brand },
  dockTitle: { color: "#fff", fontSize: 12, fontWeight: "900" },
  dockMeta: { marginTop: 1, color: "#a5b4fc", fontSize: 10, fontWeight: "700" },
  dockPercent: { color: "#bfdbfe", fontSize: 13, fontWeight: "900" },
});
