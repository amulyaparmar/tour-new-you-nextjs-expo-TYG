import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { BackHandler, Keyboard, StyleSheet, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import Reanimated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  runOnJS,
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
    experiencePreparing,
    liveMeta,
    draft,
    localId,
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
  const { height: windowHeight } = useWindowDimensions();
  const hasSession = Boolean(liveMeta && draft);
  const isPresented = experienceVisible && hasSession;
  const sheetHeight = useSharedValue(windowHeight);
  const sheetOffset = useSharedValue(windowHeight);
  const sheetClosing = useSharedValue(true);
  const mountedRef = useRef(true);
  const closeRequestRef = useRef(0);
  const closePendingRef = useRef(false);
  const latestRef = useRef({ isPresented, hasSession, localId });
  latestRef.current = { isPresented, hasSession, localId };
  const previousRef = useRef({ isPresented: false, hasSession: false, localId: null as string | null });

  const finishMinimize = useCallback((request: number, sessionLocalId: string | null) => {
    const current = latestRef.current;
    if (!mountedRef.current || !closePendingRef.current || request !== closeRequestRef.current
      || !current.isPresented || !current.hasSession
      || (sessionLocalId !== null && current.localId !== sessionLocalId)) return;
    closePendingRef.current = false;
    minimizeExperience();
  }, [minimizeExperience]);

  const animateMinimize = useCallback((request: number, sessionLocalId: string | null) => {
    cancelAnimation(sheetOffset);
    sheetOffset.value = withTiming(sheetHeight.value, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    }, (finished) => {
      if (finished) runOnJS(finishMinimize)(request, sessionLocalId);
    });
  }, [finishMinimize, sheetHeight, sheetOffset]);

  const requestMinimize = useCallback(() => {
    const current = latestRef.current;
    if (!mountedRef.current || !current.isPresented || !current.hasSession || closePendingRef.current) return;
    closePendingRef.current = true;
    sheetClosing.value = true;
    Keyboard.dismiss();
    animateMinimize(++closeRequestRef.current, current.localId);
  }, [animateMinimize, sheetClosing]);

  useLayoutEffect(() => {
    const previous = previousRef.current;
    previousRef.current = { isPresented, hasSession, localId };
    const replacedSession = previous.hasSession && hasSession
      && previous.localId !== null && localId !== null && previous.localId !== localId;
    if (previous.isPresented === isPresented && previous.hasSession === hasSession && !replacedSession) return;

    // Invalidate queued JS callbacks before opening another session or reversing
    // a close. Receiving a remote session ID never resets this presentation.
    closeRequestRef.current += 1;
    closePendingRef.current = false;
    // Disabling a native recognizer can deliver its canceled finalizer after
    // this render. Keep hidden sheets sealed so it cannot spring them open.
    sheetClosing.value = !isPresented;
    cancelAnimation(sheetOffset);

    if (!hasSession) {
      sheetOffset.value = sheetHeight.value;
      return;
    }
    if (isPresented) {
      if (!previous.hasSession || replacedSession) sheetOffset.value = sheetHeight.value;
      sheetOffset.value = withSpring(0, {
        damping: 28,
        stiffness: 240,
        mass: 0.9,
        overshootClamping: true,
        reduceMotion: ReduceMotion.System,
      });
    } else {
      sheetOffset.value = withTiming(sheetHeight.value, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      });
    }
  }, [hasSession, isPresented, localId, sheetClosing, sheetHeight, sheetOffset]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      closeRequestRef.current += 1;
      closePendingRef.current = false;
      sheetClosing.value = true;
      // A development Strict Mode effect replay must re-present the surface
      // after this cleanup cancels its initial opening animation.
      previousRef.current = { isPresented: false, hasSession: false, localId: null };
      cancelAnimation(sheetOffset);
    };
  }, [sheetClosing, sheetOffset]);

  useEffect(() => {
    if (!isPresented) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      requestMinimize();
      return true;
    });
    return () => subscription.remove();
  }, [isPresented, requestMinimize]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (!Number.isFinite(nextHeight) || nextHeight <= 0 || nextHeight === sheetHeight.value) return;
    sheetHeight.value = nextHeight;
    const current = latestRef.current;
    if (!current.isPresented || !current.hasSession) {
      cancelAnimation(sheetOffset);
      sheetOffset.value = nextHeight;
    } else if (closePendingRef.current) {
      // A keyboard/orientation layout change must not leave the sheet partly
      // on screen or allow an obsolete close callback to minimize twice.
      animateMinimize(++closeRequestRef.current, current.localId);
    }
  }, [animateMinimize, sheetHeight, sheetOffset]);

  const animatedStyle = useAnimatedStyle(() => {
    const offset = Math.max(0, sheetOffset.value);
    const cornerRadius = Math.min(22, offset * 0.18);
    return {
      transform: [{ translateY: offset }],
      borderTopLeftRadius: cornerRadius,
      borderTopRightRadius: cornerRadius,
    };
  });

  if (!liveMeta || !draft) return null;

  // The session, not its visibility or recording/paused/startup state, owns
  // this component's lifetime. Minimizing must never restart speech or audio.

  return (
    <Reanimated.View
      pointerEvents={isPresented ? "auto" : "none"}
      onLayout={handleLayout}
      style={[styles.host, animatedStyle]}
      accessibilityElementsHidden={!isPresented}
      importantForAccessibility={isPresented ? "yes" : "no-hide-descendants"}
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
        sheetOffset={sheetOffset}
        sheetHeight={sheetHeight}
        sheetClosing={sheetClosing}
        isPresented={isPresented}
        onSwipeDown={requestMinimize}
        autoStart
        preparing={experiencePreparing}
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
    overflow: "hidden",
  },
});
