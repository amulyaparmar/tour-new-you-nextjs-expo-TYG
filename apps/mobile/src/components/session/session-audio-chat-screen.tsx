import type { GeminiAudioFileRef } from "@tour/shared";
import { ArrowUp, RefreshCw, Sparkles, Volume2 } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { sendAudioInsightsChat, type AudioInsightsChatMessage } from "@/api";
import { AiChatText } from "@/components/AiChatText";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { aiResponseCompleteHaptic, aiResponseStartHaptic } from "@/lib/haptics";
import { useSessionPlayback } from "@/hooks/use-session-playback";
import { tourColors } from "@/theme/tour-brand";

import { SessionMiniPlayer } from "./session-mini-player";
import { TourScreenHeader } from "./tour-screen-header";

type ChatMessage = AudioInsightsChatMessage & { id: string };

const STARTER_PROMPTS = [
  "Where did the prospect's interest change?",
  "What emotional signals mattered most?",
  "Where did the prospect hesitate?",
  "How did the agent's delivery land?",
];

function newMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function SessionAudioChatScreen({
  sessionId,
  sessionTitle,
  onBack,
}: {
  sessionId: string;
  sessionTitle?: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [audioFile, setAudioFile] = useState<GeminiAudioFileRef | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [wasReindexed, setWasReindexed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const listRef = useRef<ScrollView>(null);
  const playback = useSessionPlayback(sessionId);
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [isBusy, messages]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const requestReply = useCallback(async (nextMessages: ChatMessage[]) => {
    setIsBusy(true);
    setError(null);
    setWasReindexed(false);
    aiResponseStartHaptic();

    try {
      const result = await sendAudioInsightsChat(sessionId, {
        messages: nextMessages.map(({ role, content }) => ({ role, content })),
        audioFile,
      });
      if (result.audioFile) setAudioFile(result.audioFile);
      setWasReindexed(result.audioFileRefreshed);
      setMessages((current) => [
        ...current,
        { id: newMessageId(), role: "assistant", content: result.reply },
      ]);
      aiResponseCompleteHaptic();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gemini could not answer about this recording.");
    } finally {
      setIsBusy(false);
    }
  }, [audioFile, sessionId]);

  const submit = useCallback((text: string) => {
    const content = text.trim();
    if (!content || isBusy) return;

    const nextMessages = [...messages, { id: newMessageId(), role: "user" as const, content }];
    setMessages(nextMessages);
    setInput("");
    void requestReply(nextMessages);
  }, [isBusy, messages, requestReply]);

  const retry = useCallback(() => {
    if (isBusy || messages.at(-1)?.role !== "user") return;
    void requestReply(messages);
  }, [isBusy, messages, requestReply]);

  return (
    <View style={styles.screen}>
      <TourScreenHeader
        onBack={onBack}
        title="Ask Gemini"
        subtitle={sessionTitle ? `About ${sessionTitle}` : "Grounded in the recording"}
      />
      <View style={styles.audioContext}>
        <View style={styles.audioContextIcon}>
          <Icon as={Volume2} size={15} color={tourColors.ai} />
        </View>
        <Text numberOfLines={1} style={styles.audioContextText}>Gemini listens to the original recording</Text>
        {messages.length > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear audio chat" onPress={() => {
            setMessages([]);
            setError(null);
            setWasReindexed(false);
          }}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {playback.ready ? (
        <SessionMiniPlayer
          position={playback.position}
          duration={playback.duration}
          playing={playback.playing}
          ready={playback.ready}
          progressPercent={playback.progressPercent}
          onToggle={() => void playback.togglePlayback()}
          onSeek={(ratio) => void playback.seekToSeconds(ratio * playback.duration)}
        />
      ) : null}

      <KeyboardAvoidingView style={styles.chat} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={listRef}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.starter}>
              <View style={styles.starterIcon}>
                <Icon as={Sparkles} size={20} color={tourColors.ai} />
              </View>
              <Text style={styles.starterTitle}>Ask what the recording reveals</Text>
              <Text style={styles.starterBody}>Gemini can use tone, pacing, energy, and the moments you heard.</Text>
              <View style={styles.promptGrid}>
                {STARTER_PROMPTS.map((prompt) => (
                  <Pressable
                    key={prompt}
                    disabled={isBusy}
                    onPress={() => submit(prompt)}
                    style={({ pressed }) => [styles.prompt, pressed && styles.promptPressed]}
                  >
                    <Text style={styles.promptText}>{prompt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            messages.map((message) => (
              <View key={message.id} style={[styles.message, message.role === "user" ? styles.userMessage : styles.assistantMessage]}>
                <Text style={styles.messageRole}>{message.role === "user" ? "You" : "Gemini"}</Text>
                {message.role === "assistant" ? (
                  <AiChatText content={message.content} onSeek={(seconds) => void playback.seekToSeconds(seconds, true)} />
                ) : (
                  <Text style={styles.userMessageText}>{message.content}</Text>
                )}
              </View>
            ))
          )}
          {isBusy ? (
            <View style={[styles.message, styles.assistantMessage]}>
              <Text style={styles.messageRole}>Gemini</Text>
              <Text style={styles.thinking}>Listening to the recording...</Text>
            </View>
          ) : null}
          {wasReindexed ? <Text style={styles.reindexed}>Audio refreshed for this question.</Text> : null}
          {error ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Retry audio question" disabled={isBusy} onPress={retry} style={styles.errorRow}>
              <Icon as={RefreshCw} size={14} color="#b42318" />
              <Text style={styles.errorText}>{error}{messages.at(-1)?.role === "user" ? " Tap to retry." : ""}</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: keyboardHeight > 0 ? 8 : Math.max(insets.bottom, 12) }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.composerPrompts}>
            {STARTER_PROMPTS.slice(0, 3).map((prompt) => (
              <Pressable key={prompt} disabled={isBusy} onPress={() => submit(prompt)} style={styles.composerPrompt}>
                <Text numberOfLines={1} style={styles.composerPromptText}>{prompt}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              editable={!isBusy}
              multiline
              placeholder="Ask about the recording..."
              placeholderTextColor="#98a2b3"
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send audio question"
              disabled={!input.trim() || isBusy}
              onPress={() => submit(input)}
              style={[styles.send, (!input.trim() || isBusy) && styles.sendDisabled]}
            >
              <Icon as={ArrowUp} size={19} color="#fff" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f7fb", paddingTop: 50 },
  audioContext: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, marginHorizontal: 16, marginTop: 4, paddingVertical: 7, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#e5eaf1" },
  audioContextIcon: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: tourColors.aiBg },
  audioContextText: { flex: 1, minWidth: 0, color: "#475467", fontSize: 11, fontWeight: "700" },
  clear: { color: tourColors.aiText, fontSize: 11, fontWeight: "900" },
  chat: { flex: 1, minHeight: 0 },
  chatContent: { flexGrow: 1, gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  starter: { alignItems: "center", paddingHorizontal: 16, paddingTop: 20 },
  starterIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: tourColors.aiBg, marginBottom: 12 },
  starterTitle: { color: "#101828", fontSize: 17, fontWeight: "900", textAlign: "center" },
  starterBody: { maxWidth: 290, marginTop: 5, color: "#667085", fontSize: 12, fontWeight: "600", lineHeight: 18, textAlign: "center" },
  promptGrid: { width: "100%", gap: 8, marginTop: 18 },
  prompt: { paddingHorizontal: 13, paddingVertical: 12, borderWidth: 1, borderColor: tourColors.aiBorder, borderRadius: 10, backgroundColor: "#fff" },
  promptPressed: { opacity: 0.72 },
  promptText: { color: tourColors.aiText, fontSize: 12, fontWeight: "800" },
  message: { maxWidth: "90%", gap: 5, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 12 },
  userMessage: { alignSelf: "flex-end", backgroundColor: "#006ce5" },
  assistantMessage: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#e3e8ef", backgroundColor: "#fff" },
  messageRole: { color: tourColors.aiText, fontSize: 10, fontWeight: "900" },
  userMessageText: { color: "#fff", fontSize: 14, fontWeight: "600", lineHeight: 20 },
  thinking: { color: "#667085", fontSize: 13, fontWeight: "700" },
  reindexed: { alignSelf: "center", color: "#667085", fontSize: 10, fontWeight: "700" },
  errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 7, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#fecdca", backgroundColor: "#fff6f5" },
  errorText: { flex: 1, color: "#b42318", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  composer: { gap: 8, paddingTop: 9, paddingHorizontal: 12, borderTopWidth: 1, borderColor: "#e5eaf1", backgroundColor: "#fff" },
  composerPrompts: { gap: 7, paddingHorizontal: 4 },
  composerPrompt: { maxWidth: 190, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: "#f1f3f7" },
  composerPromptText: { color: "#667085", fontSize: 10, fontWeight: "800" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, minHeight: 48, paddingLeft: 12, paddingRight: 5, paddingVertical: 5, borderWidth: 1, borderColor: "#dfe4ea", borderRadius: 14, backgroundColor: "#fff" },
  input: { flex: 1, maxHeight: 88, paddingTop: 8, paddingBottom: 8, color: "#101828", fontSize: 14, fontWeight: "600", lineHeight: 20, textAlignVertical: "center" },
  send: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: tourColors.brand },
  sendDisabled: { opacity: 0.4 },
});
