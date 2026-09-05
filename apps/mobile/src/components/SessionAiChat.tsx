import { appendDictationText, type AnalysisResult } from "@tour/shared";
import { ArrowUp, Sparkles } from "lucide-react-native";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { CustomText } from "@/components/custom-text";
import { Icon } from "@/components/ui/icon";
import { LoadingDots } from "@/components/loading-dots";
import { ACCENT, BACKGROUND, CARD, HINT, LARGE_CORNER, SMALL_CORNER, TEXT } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";

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
            <CustomText textStyle="title">Tour AI</CustomText>
            {messages.length > 0 && (
              <Pressable disabled={isBusy} onPress={() => setMessages([])}>
                <CustomText textStyle="label" style={styles.clear}>
                  Clear
                </CustomText>
              </Pressable>
            )}
          </>
        ) : null}
      </View>

      <ScrollView
        ref={listRef}
        nestedScrollEnabled
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 8 + Math.max(insets.bottom, bottomInset, 10) + 148 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Icon as={Sparkles} size={22} color={ACCENT} />
            </View>
            <CustomText textStyle="title" style={styles.emptyTitle}>
              Ask Tour AI about this tour
            </CustomText>
            <CustomText textStyle="caption" style={styles.emptyBody}>
              It uses the session, scorecard, transcript, coaching moments, and
              community context.
            </CustomText>
          </View>
        ) : (
          messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.message,
                message.role === "user" ? styles.messageUser : styles.messageAssistant,
              ]}
            >
              <CustomText textStyle="micro" style={styles.role}>
                {message.role === "user" ? "You" : "Tour AI"}
              </CustomText>
              {message.role === "assistant" ? (
                <>
                  <AiChatText content={messageText(message.parts)} onSeek={onSeek} />
                  {isBusy &&
                    message.id === messages[messages.length - 1]?.id &&
                    !messageText(message.parts) && (
                      <CustomText textStyle="caption" style={styles.typing}>
                        Thinking...
                      </CustomText>
                    )}
                </>
              ) : (
                <CustomText textStyle="body" style={styles.userText}>
                  {messageText(message.parts)}
                </CustomText>
              )}
            </View>
          ))
        )}
        {(error || dictationError) && (
          <CustomText textStyle="caption" style={styles.error}>
            {dictationError || error?.message || "Something went wrong."}
          </CustomText>
        )}
      </ScrollView>

      <LinearGradient
        pointerEvents="box-none"
        colors={[
          "rgba(242, 242, 247, 0)",
          "rgba(242, 242, 247, 0.72)",
          BACKGROUND,
        ]}
        locations={[0, 0.4, 1]}
        style={[
          styles.composer,
          {
            paddingBottom:
              keyboardHeight > 0 ? 8 : Math.max(insets.bottom, bottomInset, 10),
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.prompts}
        >
          {SESSION_AI_DEFAULT_PROMPTS.map((prompt) => (
            <Pressable
              key={prompt.id}
              disabled={isBusy}
              onPress={() => submitText(prompt.text)}
              style={({ pressed }) => [
                styles.prompt,
                pressed && styles.promptPressed,
                isBusy && styles.promptDisabled,
              ]}
            >
              <CustomText textStyle="label" style={styles.promptText}>
                {prompt.label}
              </CustomText>
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
                  style={[
                    styles.mentionItem,
                    index === mentionIndex && styles.mentionItemActive,
                  ]}
                >
                  <CustomText textStyle="label">@{prompt.label}</CustomText>
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
            textAlignVertical="top"
            editable={!isBusy}
          />
          <View style={styles.inputActions}>
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
                <LoadingDots size="small" color={CARD} />
              ) : (
                <Icon as={ArrowUp} size={18} color={CARD} />
              )}
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 8 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  headHidden: { minHeight: 0, height: 0, overflow: "hidden" },
  clear: { color: ACCENT },
  list: { flex: 1 },
  listContent: { gap: 10, paddingBottom: 8, paddingTop: 8 },
  emptyCard: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 28,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    backgroundColor: CARD,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(0, 108, 229, 0.08)",
  },
  emptyTitle: { textAlign: "center" },
  emptyBody: {
    color: C.textSec,
    textAlign: "center",
    lineHeight: 18,
  },
  message: {
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    padding: 12,
    gap: 4,
  },
  messageUser: { backgroundColor: HINT, alignSelf: "flex-end", maxWidth: "92%" },
  messageAssistant: { backgroundColor: CARD, alignSelf: "flex-start", maxWidth: "96%" },
  role: {
    color: C.textSec,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  userText: { lineHeight: 20 },
  typing: { color: C.textMuted, fontStyle: "italic" },
  error: { color: C.red },
  composer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: 10,
    paddingTop: 28,
  },
  prompts: { gap: 8, paddingBottom: 2 },
  prompt: {
    minHeight: 40,
    justifyContent: "center",
    backgroundColor: CARD,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  promptPressed: { opacity: 0.8 },
  promptDisabled: { opacity: 0.6 },
  promptText: { color: TEXT },
  inputWrap: {
    minHeight: 80,
    backgroundColor: CARD,
    borderRadius: LARGE_CORNER,
    borderCurve: "continuous",
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  mentionMenu: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: "100%",
    marginBottom: 6,
    backgroundColor: CARD,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    overflow: "hidden",
    zIndex: 10,
  },
  mentionItem: { paddingHorizontal: 12, paddingVertical: 10 },
  mentionItemActive: { backgroundColor: HINT },
  input: {
    minHeight: 58,
    paddingRight: 88,
    fontSize: 15,
    fontWeight: "600",
    color: TEXT,
  },
  inputActions: {
    position: "absolute",
    right: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.45 },
});
