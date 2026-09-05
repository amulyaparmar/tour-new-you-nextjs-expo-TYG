import React, { useEffect } from "react";
import { BackHandler, StyleSheet } from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { RecordingExperience } from "./RecordingExperience";
import { useRecording } from "./RecordingProvider";

/**
 * Keeps RecordingExperience mounted for the life of a live session so speech
 * continues while the UI is minimized and the user navigates the app.
 */
export function RecordingExperienceHost() {
  const {
    experienceVisible,
    liveMeta,
    draft,
    isRecording,
    setDraftNotes,
    setDraftUploaderIsAgent,
    addDraftAsset,
    addDraftParticipant,
    updateDraftParticipantNotes,
    runBeforeRecordingStart,
    requestUploadFile,
    requestCancel,
    requestFinish,
    setLiveSessionId,
    minimizeExperience,
  } = useRecording();
  const presentation = useSharedValue(0);

  useEffect(() => {
    if (!experienceVisible) {
      presentation.value = withTiming(0, { duration: 180 });
      return;
    }
    presentation.value = withSpring(1, {
      damping: 18,
      stiffness: 190,
      mass: 0.72,
      overshootClamping: false,
    });
  }, [experienceVisible, presentation]);

  useEffect(() => {
    if (!experienceVisible) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      minimizeExperience();
      return true;
    });
    return () => subscription.remove();
  }, [experienceVisible, minimizeExperience]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: presentation.value,
    transform: [
      { translateY: (1 - presentation.value) * 72 },
      { scale: 0.985 + presentation.value * 0.015 },
    ],
  }));

  if (!liveMeta || !draft) return null;

  // Stay mounted while the sheet is open or a recording is in progress.
  if (!experienceVisible && !isRecording) return null;

  return (
    <Reanimated.View
      pointerEvents={experienceVisible ? "auto" : "none"}
      style={[styles.host, animatedStyle]}
      accessibilityElementsHidden={!experienceVisible}
      importantForAccessibility={experienceVisible ? "yes" : "no-hide-descendants"}
    >
      <RecordingExperience
        title={liveMeta.title}
        caption={liveMeta.source === "session-detail" ? "Recording to this session" : undefined}
        sessionId={liveMeta.sessionId}
        agentName={liveMeta.agentName}
        prospectName={liveMeta.prospectName}
        propertyName={liveMeta.propertyName}
        notes={draft.notes}
        onNotesChange={setDraftNotes}
        uploaderIsAgent={Boolean(draft.uploaderIsAgent)}
        onUploaderIsAgentChange={setDraftUploaderIsAgent}
        assets={draft.assets}
        selectedAssetIds={draft.selectedAssetIds}
        attachments={draft.attachments}
        participants={draft.participants}
        onAddAsset={addDraftAsset}
        onAddParticipant={addDraftParticipant}
        onUpdateParticipantNotes={updateDraftParticipantNotes}
        onBeforeRecordingStart={runBeforeRecordingStart}
        onUploadFile={liveMeta.source === "create-session" ? requestUploadFile : undefined}
        onSessionCreated={setLiveSessionId}
        presentation={presentation}
        onSwipeDown={minimizeExperience}
        autoStart
        cancelIcon={liveMeta.source === "session-detail" ? "close" : "chevron-down"}
        minimizeOnClose={liveMeta.source === "session-detail"}
        onCancel={requestCancel}
        onFinish={requestFinish}
      />
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 100,
    backgroundColor: "#F7F8FB",
  },
});
