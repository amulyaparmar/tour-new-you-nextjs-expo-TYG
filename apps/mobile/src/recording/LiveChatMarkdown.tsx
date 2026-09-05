import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Linking, StyleSheet, View } from "react-native";

import { CustomText } from "@/components/custom-text";
import { ACCENT, HINT, SMALL_CORNER, TEXT } from "@/theme/tokens";
import { tourColors as C } from "@/theme/tour-brand";
import { linkifyTimestampsInMarkdown, parseSeekHref } from "../session-ai-timestamps";

type InlinePart =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; label: string; href: string };

type Block =
  | { type: "paragraph"; parts: InlinePart[] }
  | { type: "bullet"; parts: InlinePart[] }
  | { type: "ordered"; index: number; parts: InlinePart[] }
  | { type: "heading"; level: 1 | 2 | 3; parts: InlinePart[] }
  | { type: "code"; value: string };

function parseInline(input: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input))) {
    if (match.index > last) {
      parts.push({ type: "text", value: input.slice(last, match.index) });
    }
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push({ type: "bold", value: token.slice(2, -2) });
    } else if (token.startsWith("*")) {
      parts.push({ type: "italic", value: token.slice(1, -1) });
    } else if (token.startsWith("`")) {
      parts.push({ type: "code", value: token.slice(1, -1) });
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (link) {
        parts.push({ type: "link", label: link[1]!, href: link[2]! });
      } else {
        parts.push({ type: "text", value: token });
      }
    }
    last = match.index + token.length;
  }
  if (last < input.length) {
    parts.push({ type: "text", value: input.slice(last) });
  }
  return parts.length ? parts : [{ type: "text", value: input }];
}

function parseMarkdown(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i += 1;
      }
      i += 1;
      blocks.push({ type: "code", value: codeLines.join("\n") });
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1]!.length as 1 | 2 | 3,
        parts: parseInline(heading[2]!),
      });
      i += 1;
      continue;
    }

    const bullet = /^[-*•]\s+(.+)$/.exec(trimmed);
    if (bullet) {
      blocks.push({ type: "bullet", parts: parseInline(bullet[1]!) });
      i += 1;
      continue;
    }

    const ordered = /^(\d+)[.)]\s+(.+)$/.exec(trimmed);
    if (ordered) {
      blocks.push({
        type: "ordered",
        index: Number(ordered[1]),
        parts: parseInline(ordered[2]!),
      });
      i += 1;
      continue;
    }

    const paragraphLines = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = (lines[i] ?? "").trim();
      if (
        !next ||
        next.startsWith("```") ||
        /^#{1,3}\s+/.test(next) ||
        /^[-*•]\s+/.test(next) ||
        /^\d+[.)]\s+/.test(next)
      ) {
        break;
      }
      paragraphLines.push(next);
      i += 1;
    }
    blocks.push({ type: "paragraph", parts: parseInline(paragraphLines.join(" ")) });
  }

  return blocks;
}

function InlineText({ parts, onSeek }: { parts: InlinePart[]; onSeek?: (seconds: number) => void }) {
  return (
    <CustomText textStyle="body" style={styles.body}>
      {parts.map((part, index) => {
        if (part.type === "bold") {
          return (
            <CustomText key={index} textStyle="body" style={styles.bold}>
              {part.value}
            </CustomText>
          );
        }
        if (part.type === "italic") {
          return (
            <CustomText key={index} textStyle="body" style={styles.italic}>
              {part.value}
            </CustomText>
          );
        }
        if (part.type === "code") {
          return (
            <CustomText key={index} textStyle="label" style={styles.codeInline}>
              {part.value}
            </CustomText>
          );
        }
        if (part.type === "link") {
          const seekSeconds = parseSeekHref(part.href);
          return (
            <CustomText
              key={index}
              textStyle="label"
              style={styles.link}
              onPress={() => {
                if (seekSeconds != null) {
                  onSeek?.(seekSeconds);
                  return;
                }
                void Linking.openURL(part.href).catch(() => {});
              }}
            >
              {part.label}
            </CustomText>
          );
        }
        return (
          <CustomText key={index} textStyle="body">
            {part.value}
          </CustomText>
        );
      })}
    </CustomText>
  );
}

type LiveChatMarkdownProps = {
  content: string;
  streaming?: boolean;
  onSeek?: (seconds: number) => void;
};

/** Lightweight markdown renderer — avoids markdown-it/entities Metro issues. */
export function LiveChatMarkdown({ content, streaming = false, onSeek }: LiveChatMarkdownProps) {
  const blocks = useMemo(() => parseMarkdown(linkifyTimestampsInMarkdown(content)), [content]);
  if (!content.trim() && !streaming) return null;

  return (
    <View style={styles.wrap}>
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return (
            <View key={index} style={styles.codeBlock}>
              <CustomText textStyle="label" style={styles.codeText}>{block.value}</CustomText>
            </View>
          );
        }
        if (block.type === "heading") {
          return (
            <CustomText
              key={index}
              textStyle="title"
              style={[
                styles.body,
                block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3,
              ]}
            >
              <InlineText parts={block.parts} onSeek={onSeek} />
            </CustomText>
          );
        }
        if (block.type === "bullet") {
          return (
            <View key={index} style={styles.listRow}>
              <CustomText textStyle="title" style={styles.bullet}>•</CustomText>
              <View style={styles.listBody}>
                <InlineText parts={block.parts} onSeek={onSeek} />
              </View>
            </View>
          );
        }
        if (block.type === "ordered") {
          return (
            <View key={index} style={styles.listRow}>
              <CustomText textStyle="label" style={styles.ordered}>{block.index}.</CustomText>
              <View style={styles.listBody}>
                <InlineText parts={block.parts} onSeek={onSeek} />
              </View>
            </View>
          );
        }
        return (
          <View key={index} style={styles.paragraph}>
            <InlineText parts={block.parts} onSeek={onSeek} />
          </View>
        );
      })}
      {streaming ? <StreamingCaret /> : null}
    </View>
  );
}

export function ChatTypingIndicator() {
  const a = useRef(new Animated.Value(0.3)).current;
  const b = useRef(new Animated.Value(0.3)).current;
  const c = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const make = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 320, useNativeDriver: true }),
        ]),
      );
    const loops = [make(a, 0), make(b, 140), make(c, 280)];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [a, b, c]);

  return (
    <View style={typing.row} accessibilityLabel="Tour AI is thinking">
      <Animated.View style={[typing.dot, { opacity: a }]} />
      <Animated.View style={[typing.dot, { opacity: b }]} />
      <Animated.View style={[typing.dot, { opacity: c }]} />
      <CustomText textStyle="label" style={typing.label}>Thinking</CustomText>
    </View>
  );
}

function StreamingCaret() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.15, duration: 420, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[caret.bar, { opacity }]} />;
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  paragraph: { marginBottom: 2 },
  body: { color: TEXT, lineHeight: 22 },
  bold: { fontWeight: "700", color: TEXT },
  italic: { fontStyle: "italic" },
  codeInline: {
    backgroundColor: HINT,
    color: TEXT,
    borderRadius: 6,
    overflow: "hidden",
  },
  link: { color: ACCENT },
  h1: { marginBottom: 2 },
  h2: { marginBottom: 2 },
  h3: { marginBottom: 2 },
  listRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  bullet: { color: ACCENT, lineHeight: 22, width: 12 },
  ordered: { color: ACCENT, lineHeight: 22, minWidth: 18 },
  listBody: { flex: 1, minWidth: 0 },
  codeBlock: {
    backgroundColor: HINT,
    borderRadius: SMALL_CORNER,
    borderCurve: "continuous",
    padding: 10,
  },
  codeText: { color: TEXT, lineHeight: 18 },
});

const typing = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ACCENT },
  label: { marginLeft: 4, color: C.textMuted },
});

const caret = StyleSheet.create({
  bar: {
    width: 8,
    height: 16,
    marginTop: 2,
    borderRadius: 2,
    backgroundColor: ACCENT,
  },
});
