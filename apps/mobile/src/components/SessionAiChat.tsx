import { appendDictationText, type AnalysisResult } from "@tour/shared";
import { ArrowUp, Sparkles } from "lucide-react-native";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getApiBaseUrl } from "../config";
import { getCurrentSession } from "../auth";
import { aiResponseCompleteHaptic, aiResponseStartHaptic } from "../lib/haptics";
import {
  filterMentionPrompts,
  SESSION_AI_DEFAULT_PROMPTS,
  type SessionAiPrompt,
} from "../session-ai-prompts";
import { AiChatText } from "./AiChatText";
import { ElevenLabsDictationButton } from "./ElevenLabsDictationButton";
import { Icon } from "@/components/ui/icon";
import { LoadingDots } from "@/components/loading-dots";

const C = {
  brand: "#006CE5",
  brandSoft: "#EAF4FF",
  text: "#101828",
  textSec: "#667085",
  textMuted: "#94A3B8",
  border: "rgba(16, 24, 40, 0.08)",
  card: "#FFFFFF",
};

function messageText(parts: { type: string; text?: string }[]) {
  return parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("");
}

type Props = {
  sessionId: string;
  analysis: AnalysisResult;
  onSeek?: (seconds: number) => void;
  showHeader?: boolean;
  bottomInset?: number;
};

export function SessionAiChat({ sessionId, analysis, onSeek, showHeader = true, bottomInset = 0 }: Props) {
  const [input, setInput] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const listRef = useRef<ScrollView>(null);
  const wasStreamingRef = useRef(false);
  const insets = useSafeAreaInsets();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${getApiBaseUrl()}/api/sessions/${sessionId}/chat`,
        // React Native's global fetch may expose a successful response without a
        // readable body. The AI SDK requires that stream for UI-message events.
        // Expo's fetch provides the readable stream used by the live chat flow.
        fetch: expoFetch as typeof fetch,
        headers: (): Record<string, string> => {
          const session = getCurrentSession();
          if (!session) return {};
          return {
            Authorization: `Bearer ${session.accessToken}`,
            "x-admin-community-id": session.workspace.community.id,
            "x-tour-client": "mobile",
          };
        },
      }),
    [sessionId]
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({ transport });
  const isBusy = status === "submitted" || status === "streaming";
  const mentionOptions = mentionQuery != null ? filterMentionPrompts(mentionQuery) : [];

  void analysis;

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages, status]);

  useEffect(() => {
    const isStreaming = status === "streaming";
    if (isStreaming && !wasStreamingRef.current) aiResponseStartHaptic();
    if (!isStreaming && wasStreamingRef.current) aiResponseCompleteHaptic();
    wasStreamingRef.current = isStreaming;
  }, [status]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener("keyboardWillHide", () => {
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const submitText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isBusy) return;
      void sendMessage({ text: trimmed });
      setInput("");
      setMentionQuery(null);
    },
    [isBusy, sendMessage]
  );

  const insertPrompt = useCallback(
    (prompt: SessionAiPrompt) => {
      if (mentionQuery != null) {
        const atIndex = input.lastIndexOf("@");
        const prefix = atIndex >= 0 ? input.slice(0, atIndex) : "";
        setInput(`${prefix}${prompt.text}`.trimStart());
        setMentionQuery(null);
      } else {
        setInput(prompt.text);
      }
    },
    [input, mentionQuery]
  );

  function handleInputChange(value: string) {
    setInput(value);
    const atMatch = /(?:^|\s)@([\w-]*)$/.exec(value);
    if (atMatch) {
      setMentionQuery(atMatch[1] ?? "");
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.head, !showHeader && styles.headHidden]}>
        {showHeader ? (
          <>
            <Text style={styles.title}>Tour AI</Text>
            {messages.length > 0 && (
              <Pressable disabled={isBusy} onPress={() => setMessages([])}>
                <Text style={styles.clear}>Clear</Text>
              </Pressable>
            )}
          </>
        ) : null}
      </View>

      <ScrollView
        ref={listRef}
        nestedScrollEnabled
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: 8 + bottomInset }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <View style={styles.starter}>
            <Icon as={Sparkles} size={26} color={C.brand} />
            <Text style={styles.emptyTitle}>Ask Tour AI about this tour</Text>
            <Text style={styles.emptyBody}>
              It uses the session, scorecard, transcript, coaching moments, and community context.
            </Text>
            <View style={styles.emptyPromptGrid}>
              {SESSION_AI_DEFAULT_PROMPTS.map((prompt) => (
                <Pressable
                  key={prompt.id}
                  disabled={isBusy}
                  onPress={() => submitText(prompt.text)}
                  style={({ pressed }) => [
                    styles.emptyPromptBubble,
                    pressed && { opacity: 0.76, transform: [{ scale: 0.99 }] },
                    isBusy && { opacity: 0.6 },
                  ]}
                >
                  <Text style={styles.emptyPromptText}>{prompt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          messages.map((message) => (
            <View
              key={message.id}
              style={[styles.message, message.role === "user" ? styles.messageUser : styles.messageAssistant]}
            >
              <Text style={styles.role}>{message.role === "user" ? "You" : "Tour AI"}</Text>
              {message.role === "assistant" ? (
                <>
                  <AiChatText content={messageText(message.parts)} onSeek={onSeek} />
                  {isBusy &&
                    message.id === messages[messages.length - 1]?.id &&
                    !messageText(message.parts) && (
                      <Text style={styles.typing}>Thinking...</Text>
                    )}
                </>
              ) : (
                <Text style={styles.userText}>{messageText(message.parts)}</Text>
              )}
            </View>
          ))
        )}
        {(error || dictationError) && (
          <Text style={styles.error}>
            {dictationError || error?.message || "Something went wrong."}
          </Text>
        )}
      </ScrollView>

      <View
        style={[
          styles.composer,
          {
            paddingBottom: keyboardHeight > 0 ? 8 : Math.max(insets.bottom, bottomInset, 10),
          },
        ]}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.prompts}>
          {SESSION_AI_DEFAULT_PROMPTS.map((prompt) => (
            <Pressable
              key={prompt.id}
              disabled={isBusy}
              onPress={() => submitText(prompt.text)}
              style={({ pressed }) => [styles.prompt, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.promptText}>{prompt.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.inputWrap}>
          {mentionQuery != null && mentionOptions.length > 0 && (
            <View style={styles.mentionMenu}>
              {mentionOptions.slice(0, 6).map((prompt, index) => (
                <Pressable
                  key={prompt.id}
                  onPress={() => insertPrompt(prompt)}
                  style={[styles.mentionItem, index === mentionIndex && styles.mentionItemActive]}
                >
                  <Text style={styles.mentionLabel}>@{prompt.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <TextInput
            value={input}
            onChangeText={handleInputChange}
            placeholder="Ask about this tour…"
            placeholderTextColor={C.textMuted}
            style={styles.input}
            multiline
            editable={!isBusy}
          />
          <ElevenLabsDictationButton
            disabled={isBusy}
            onError={setDictationError}
            onTranscript={(text) => {
              setInput((current) => appendDictationText(current, text));
            }}
          />
          <Pressable
            disabled={!input.trim() || isBusy}
            onPress={() => submitText(input)}
            style={[styles.send, (!input.trim() || isBusy) && styles.sendDisabled]}
          >
            {isBusy ? (
              <LoadingDots size="small" color="#fff" />
            ) : (
              <Icon as={ArrowUp} size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  headHidden: { minHeight: 0, height: 0, overflow: "hidden" },
  title: { fontSize: 17, fontWeight: "900", color: C.text },
  clear: { fontSize: 13, fontWeight: "700", color: C.brand },
  list: { flex: 1 },
  listContent: { gap: 10, paddingBottom: 8 },
  starter: { alignItems: "center", gap: 8, paddingHorizontal: 22, paddingTop: 24 },
  emptyTitle: { color: C.text, fontSize: 19, fontWeight: "900", textAlign: "center" },
  emptyBody: { color: C.textSec, fontSize: 14, lineHeight: 20, fontWeight: "700", textAlign: "center" },
  emptyPromptGrid: { alignSelf: "stretch", gap: 10, marginTop: 14 },
  emptyPromptBubble: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(0,108,229,0.18)",
    borderRadius: 18,
    backgroundColor: "#F8FBFF",
  },
  emptyPromptText: { color: C.text, fontSize: 14, lineHeight: 18, fontWeight: "900", textAlign: "center" },
  message: { borderRadius: 12, padding: 12, gap: 4 },
  messageUser: { backgroundColor: C.brandSoft, alignSelf: "flex-end", maxWidth: "92%" },
  messageAssistant: { backgroundColor: "#f8fafc", alignSelf: "flex-start", maxWidth: "96%" },
  role: { fontSize: 10, fontWeight: "900", color: C.textMuted, textTransform: "uppercase" },
  userText: { fontSize: 14, fontWeight: "600", color: C.text, lineHeight: 20 },
  typing: { fontSize: 13, fontWeight: "600", color: C.textMuted, fontStyle: "italic" },
  error: { fontSize: 13, fontWeight: "700", color: "#DC2626" },
  composer: { gap: 8, paddingTop: 4 },
  prompts: { gap: 8, paddingBottom: 4 },
  prompt: {
    backgroundColor: "#f1f5f9",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  promptText: { fontSize: 12, fontWeight: "700", color: C.textSec },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 8,
  },
  mentionMenu: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: "100%",
    marginBottom: 6,
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    zIndex: 10,
  },
  mentionItem: { paddingHorizontal: 12, paddingVertical: 10 },
  mentionItemActive: { backgroundColor: C.brandSoft },
  mentionLabel: { fontSize: 13, fontWeight: "700", color: C.text },
  input: { flex: 1, fontSize: 15, fontWeight: "600", color: C.text, maxHeight: 100, minHeight: 36 },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.45 },
});
