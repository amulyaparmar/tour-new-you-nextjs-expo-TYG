import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { CustomText } from "@/components/custom-text";
import { CoachIcon } from "@/components/coach-icon";
import { ACCENT, CARD, TEXT } from "@/theme/tokens";
import type { CoachingTip } from "./liveCoachingController";
import type { CoachingItem } from "@tour/shared";
import { impactHaptic } from "@/lib/haptics";

const SIZE = 56;
const MARGIN = 16;
const PREVIEW: CoachingItem[] = [
  {
    kind: "ask",
    type: "discovery",
    text: "Turn their reaction into discovery",
    preparedGuidance: {
      feedback: "They reacted positively, which gives you a natural opening to learn what matters.",
      whyNow: "Their answer can help you personalize the rest of the tour.",
      options: [
        { type: "ask", label: "Explore the reaction", sayThis: "What stands out most to you about this space?" },
        { type: "try", label: "Use their answer", sayThis: "Connect their answer to the next feature you show." },
      ],
    },
  },
  {
    kind: "adjust",
    type: "connection",
    text: "Make the benefit personal",
    preparedGuidance: {
      feedback: "You explained the feature clearly, but have not connected it to their routine yet.",
      whyNow: "A personal connection makes the benefit easier to remember.",
      options: [
        { type: "ask", label: "Learn their routine", sayThis: "How would you see yourself using this day to day?" },
        { type: "try", label: "Build the connection", sayThis: "Link the feature to a priority they mentioned earlier." },
      ],
    },
  },
].map(item => ({ ...item, whyNow: "Preview example", topic: "preview", sourceTurnIds: [] })) as CoachingItem[];

export function TourCoach({ enabled, ready, active, recordingId, tip, history, busy = false, preview, hidden, top, bottom, onEnable, onOpenGuidance, onDismiss, onInteraction }: {
  enabled: boolean; ready: boolean; active: boolean; recordingId: string | null;
  tip: CoachingTip | null; history: CoachingTip[]; busy?: boolean; preview: boolean; hidden: boolean; top: number; bottom: number;
  onEnable(): void; onOpenGuidance(item: CoachingItem): void; onDismiss(): void;
  onInteraction?(event: "tap" | "dismiss", item: CoachingItem): void;
}) {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [right, setRight] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CoachingItem | null>(null);
  const previousTip = useRef<CoachingTip | null>(null);
  const [invitation, setInvitation] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const invited = useRef<string | null>(null);
  const xy = useRef(new Animated.ValueXY()).current;
  const progress = useRef(new Animated.Value(0)).current;
  const origin = useRef(position);
  const reopen = useRef(false);
  const dragging = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;
  const options = useMemo(() => preview ? PREVIEW : history.flatMap(entry => entry.items), [history, preview]);
  const selectedIndex = Math.max(0, options.indexOf(selectedItem ?? options.at(-1)!));
  const selected = options[selectedIndex];
  const visible = ready && !hidden && (enabled || invitation || preview);

  useEffect(() => {
    setSelectedItem(null); previousTip.current = null; setOpen(false);
  }, [recordingId]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!ready || !active || !recordingId || invited.current === recordingId) return;
    invited.current = recordingId;
    setOpen(false);
    setInvitation(true);
    const timer = setTimeout(() => { setInvitation(false); }, 6000);
    return () => { clearTimeout(timer); setInvitation(false); };
  }, [active, enabled, ready, recordingId]);

  useEffect(() => {
    if (!enabled && !preview) { setOpen(false); return; }
    if (preview) { setInvitation(false); setOpen(true); return; }
    if (!tip || tip === previousTip.current) return;
    const previous = previousTip.current;
    previousTip.current = tip;
    // Do not move the page while the agent is reading an older suggestion.
    setSelectedItem(selected => !openRef.current || !selected || previous?.items.includes(selected) ? tip.items[0] ?? null : selected);
    if (ready && active && !hidden) impactHaptic();
    setInvitation(false);
    setOpen(true);
  }, [enabled, preview, tip, ready, active, hidden]);

  useEffect(() => {
    progress.stopAnimation();
    if (reduceMotion) { progress.setValue(open || invitation ? 1 : 0); return; }
    Animated.timing(progress, { toValue: open || invitation ? 1 : 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [open, invitation, right, reduceMotion, progress]);

  const clamp = (x: number, y: number) => ({
    x: Math.max(MARGIN, Math.min(Math.max(MARGIN, bounds.width - SIZE - MARGIN), x)),
    y: Math.max(Math.min(180, Math.max(0, bounds.height - SIZE)), Math.min(Math.max(0, bounds.height - SIZE), y)),
  });
  const dock = (nextRight: boolean, y: number) => {
    const next = clamp(nextRight ? bounds.width - SIZE - MARGIN : MARGIN, y);
    setRight(nextRight); setPosition(next);
    if (reduceMotion) xy.setValue(next);
    else Animated.spring(xy, { toValue: next, useNativeDriver: false, damping: 24, stiffness: 250, mass: 0.8 }).start();
  };
  const pan = useMemo(() => Gesture.Pan().minDistance(6).runOnJS(true)
    .onStart(() => {
      dragging.current = true;
      xy.stopAnimation(); origin.current = position; reopen.current = openRef.current;
      setOpen(false);
    })
    .onUpdate(event => xy.setValue(clamp(origin.current.x + event.translationX, origin.current.y + event.translationY)))
    .onEnd(event => {
      const next = clamp(origin.current.x + event.translationX, origin.current.y + event.translationY);
      progress.setValue(0);
      dock(next.x + SIZE / 2 >= bounds.width / 2, next.y);
      setOpen(reopen.current);
    })
    .onFinalize((_, success) => {
      if (dragging.current && !success) { dock(right, position.y); setOpen(reopen.current); }
      dragging.current = false;
    }),
  [bounds, position, right, reduceMotion]);

  const dismiss = () => {
    if (!preview && open && selected) onInteraction?.("dismiss", selected);
    setOpen(false); setInvitation(false); onDismiss();
  };
  const navigate = (delta: number) => setSelectedItem(options[Math.max(0, Math.min(options.length - 1, selectedIndex + delta))] ?? null);
  const swipe = Gesture.Pan().activeOffsetX([-24, 24]).failOffsetY([-16, 16]).runOnJS(true)
    .onEnd(event => { if (Math.abs(event.translationX) >= 24) navigate(event.translationX < 0 ? 1 : -1); });
  return (
    <View pointerEvents={visible ? "box-none" : "none"} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      style={[StyleSheet.absoluteFill, { top, bottom, zIndex: 25, opacity: visible ? 1 : 0 }]}
      onLayout={({ nativeEvent: { layout } }) => {
        if (layout.width === bounds.width && layout.height === bounds.height) return;
        setBounds({ width: layout.width, height: layout.height });
        const next = { x: right ? Math.max(MARGIN, layout.width - SIZE - MARGIN) : MARGIN, y: Math.max(0, layout.height - SIZE - 12) };
        setPosition(next); xy.setValue(next);
      }}>
      {(open || invitation) && <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}
        accessibilityRole="button" accessibilityLabel="Dismiss coaching" />}
      <Animated.View style={[styles.anchor, { transform: xy.getTranslateTransform() }]}>
        <Animated.View pointerEvents={open || invitation ? "auto" : "none"} accessibilityElementsHidden={!open && !invitation}
          importantForAccessibility={!open && !invitation ? "no-hide-descendants" : "auto"}
          style={[styles.popover, { width: Math.max(0, Math.min(292, bounds.width - MARGIN * 2 - SIZE - 14)), maxHeight: Math.max(SIZE, position.y + SIZE),
            ...(right ? { right: SIZE + 14 } : { left: SIZE + 14 }), opacity: progress,
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [right ? 16 : -16, 0] }) },
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
          <GestureDetector gesture={swipe}>
          <View style={styles.bubble} onAccessibilityEscape={dismiss}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={styles.options} contentContainerStyle={styles.optionContent}>
            {invitation && enabled ? <View style={styles.option}>
              <CustomText style={[styles.optionText, styles.copy]}>I’m your personal tour coach. I’ll share ideas and give you feedback as you progress.</CustomText>
            </View> : invitation ? <Pressable onPress={onEnable} style={({ pressed }) => [styles.option, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Enable Tour Coach">
              <View style={styles.copy}><CustomText style={styles.introTitle}>Meet Tour Coach</CustomText><CustomText style={styles.optionText}>Support for your conversation.</CustomText><CustomText style={styles.enable}>Enable Tour Coach</CustomText></View>
              <Ionicons name="arrow-forward" size={18} color={ACCENT} />
            </Pressable> : selected ? <Pressable disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => {
              if (!preview) onInteraction?.("tap", selected);
              setOpen(false); onOpenGuidance(selected);
            }}
              accessibilityRole="button" accessibilityLabel={selected.headline ?? selected.text}
              accessibilityHint="Open coaching guidance"
              accessibilityActions={[{ name: "increment", label: "Next suggestion" }, { name: "decrement", label: "Previous suggestion" }]}
              onAccessibilityAction={({ nativeEvent }) => navigate(nativeEvent.actionName === "increment" ? 1 : -1)}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
              <View style={styles.copy}>
                <CustomText style={styles.optionText}>{selected.headline ?? selected.text}</CustomText>
                {selected.preparedGuidance?.options?.map((choice) => (
                  <View key={`${choice.type}:${choice.label}`} style={styles.choice}>
                    <CustomText style={styles.choiceKind}>{choice.type}</CustomText>
                    <View style={styles.choiceCopy}>
                      <CustomText style={styles.choiceLabel}>{choice.label}</CustomText>
                      <CustomText style={styles.choiceText} numberOfLines={3}>{choice.sayThis}</CustomText>
                    </View>
                  </View>
                ))}
              </View>
            </Pressable> : <View style={styles.option}>
              <CustomText style={[styles.optionText, styles.copy]}>Listening. I’ll share ideas when they can help.</CustomText>
            </View>}
          </ScrollView>
          {!invitation && options.length > 1 && <View style={styles.navigation}>
            <Pressable onPress={() => navigate(-1)} disabled={selectedIndex === 0} accessibilityRole="button" accessibilityLabel="Previous coaching suggestions"
              style={[styles.control, selectedIndex === 0 && styles.disabled]}><Ionicons name="chevron-back" size={16} color={ACCENT} /></Pressable>
            <View style={styles.dots} accessible accessibilityLabel={`Suggestion ${selectedIndex + 1} of ${options.length}`}>
              {options.slice(Math.max(0, Math.min(selectedIndex - 2, options.length - 5)), Math.max(0, Math.min(selectedIndex - 2, options.length - 5)) + 5).map((item, i) =>
                <View key={i} style={[styles.pageDot, item === selected && styles.activeDot]} />)}
            </View>
            <Pressable onPress={() => navigate(1)} disabled={selectedIndex === options.length - 1} accessibilityRole="button" accessibilityLabel="Next coaching suggestions"
              style={[styles.control, selectedIndex === options.length - 1 && styles.disabled]}><Ionicons name="chevron-forward" size={16} color={ACCENT} /></Pressable>
          </View>}
          </View>
          </GestureDetector>
          <View pointerEvents="none" style={[styles.tail, right ? { right: -6 } : { left: -6 }]} />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Pressable onPress={() => {
            if (invitation && !enabled) onEnable();
            else if (open || invitation) dismiss();
            else { setInvitation(false); setOpen(true); }
          }}
            accessibilityRole="button" accessibilityLabel={invitation && !enabled ? "Enable Tour Coach" : "Tour Coach"}
            accessibilityState={{ expanded: open || invitation }}
            accessibilityActions={[{ name: "moveLeft", label: "Move coach left" }, { name: "moveRight", label: "Move coach right" }]}
            onAccessibilityAction={({ nativeEvent }) => dock(nativeEvent.actionName === "moveRight", position.y)}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
            <CoachIcon size={28} color={CARD} />
            {enabled && options.length > 0 && !open && <View style={styles.dot} />}
          </Pressable>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: "absolute", width: SIZE, height: SIZE },
  button: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center", shadowColor: "#193C62", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  buttonPressed: { transform: [{ scale: 0.96 }] },
  dot: { position: "absolute", top: 4, right: 3, width: 10, height: 10, borderRadius: 5, backgroundColor: CARD, borderWidth: 2, borderColor: ACCENT },
  popover: { position: "absolute", bottom: 0 },
  bubble: { flexShrink: 1, backgroundColor: CARD, borderRadius: 8, borderWidth: 1, borderColor: "#E0E3EA", shadowColor: "#18202B", shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  tail: { position: "absolute", bottom: 22, width: 12, height: 12, backgroundColor: CARD, transform: [{ rotate: "45deg" }] },
  navigation: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", minWidth: 64 },
  pageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D3D8E1" },
  activeDot: { backgroundColor: ACCENT },
  control: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.35 },
  options: { flexShrink: 1 }, optionContent: { padding: 4 },
  option: { flexDirection: "row", gap: 12, alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, minHeight: 48, borderRadius: 8 },
  copy: { flex: 1 }, optionText: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: TEXT },
  choice: { flexDirection: "row", gap: 8, paddingTop: 9, marginTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E0E3EA" },
  choiceKind: { width: 34, paddingTop: 1, color: ACCENT, fontSize: 9, lineHeight: 14, fontWeight: "700", textTransform: "uppercase" },
  choiceCopy: { flex: 1 },
  choiceLabel: { color: TEXT, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  choiceText: { marginTop: 2, color: "#66758A", fontSize: 11, lineHeight: 16, fontWeight: "500" },
  introTitle: { color: ACCENT, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  enable: { color: ACCENT, fontSize: 13, fontWeight: "600", marginTop: 8 },
  pressed: { backgroundColor: "#F0F6FC" },
});
