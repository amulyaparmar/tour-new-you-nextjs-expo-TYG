import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Linking, StyleSheet, Text, View } from "react-native";

import { linkifyTimestampsInMarkdown, parseSeekHref } from "../session-ai-timestamps";

const C = {
  brand: "#006CE5",
  text: "#101828",
  textMuted: "#94A3B8",
  codeBg: "#F1F5F9",
  border: "rgba(16,24,40,0.08)",
} as const;

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

function InlineParts({ parts, onSeek }: { parts: InlinePart[]; onSeek?: (seconds: number) => void }) {
  return parts.map((part, index) => {
    if (part.type === "bold") {
      return (
        <Text key={index} style={styles.bold}>
          <InlineParts parts={parseInline(part.value)} onSeek={onSeek} />
        </Text>
      );
    }
    if (part.type === "italic") {
      return (
        <Text key={index} style={styles.italic}>
          <InlineParts parts={parseInline(part.value)} onSeek={onSeek} />
        </Text>
      );
    }
    if (part.type === "code") {
      return <Text key={index} style={styles.codeInline}>{part.value}</Text>;
    }
    if (part.type === "link") {
      const seekSeconds = parseSeekHref(part.href);
      return (
        <Text
          key={index}
          accessibilityRole={seekSeconds != null ? "link" : undefined}
          accessibilityLabel={seekSeconds != null ? `Play recording from ${part.label}` : part.label}
          style={[styles.link, seekSeconds != null && styles.seekLink]}
          onPress={() => {
            if (seekSeconds != null) {
              onSeek?.(seekSeconds);
              return;
            }
            void Linking.openURL(part.href).catch(() => {});
          }}
        >
          {part.label}
        </Text>
      );
    }
    return <Text key={index}>{part.value}</Text>;
  });
}

function InlineText({ parts, onSeek }: { parts: InlinePart[]; onSeek?: (seconds: number) => void }) {
  return <Text style={styles.body}><InlineParts parts={parts} onSeek={onSeek} /></Text>;
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
              <Text style={styles.codeText}>{block.value}</Text>
            </View>
          );
        }
        if (block.type === "heading") {
          return (
            <Text
              key={index}
              style={[
                styles.body,
                block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3,
              ]}
            >
              <InlineText parts={block.parts} onSeek={onSeek} />
            </Text>
          );
        }
        if (block.type === "bullet") {
          return (
            <View key={index} style={styles.listRow}>
              <Text style={styles.bullet}>•</Text>
              <View style={styles.listBody}>
                <InlineText parts={block.parts} onSeek={onSeek} />
              </View>
            </View>
          );
        }
        if (block.type === "ordered") {
          return (
            <View key={index} style={styles.listRow}>
              <Text style={styles.ordered}>{block.index}.</Text>
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
      <Text style={typing.label}>Thinking</Text>
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
  body: { color: C.text, fontSize: 15, lineHeight: 22, fontWeight: "600" },
  bold: { fontWeight: "900", color: C.text },
  italic: { fontStyle: "italic" },
  codeInline: {
    backgroundColor: C.codeBg,
    color: C.text,
    borderRadius: 6,
    overflow: "hidden",
    fontSize: 13,
    fontWeight: "700",
  },
  link: { color: C.brand, fontWeight: "800", textDecorationLine: "underline" },
  seekLink: {
    color: "#075fbe",
    fontVariant: ["tabular-nums"],
    textDecorationLine: "none",
    backgroundColor: "#eaf3ff",
    borderRadius: 5,
    overflow: "hidden",
  },
  h1: { fontSize: 18, fontWeight: "900", marginBottom: 2 },
  h2: { fontSize: 16, fontWeight: "900", marginBottom: 2 },
  h3: { fontSize: 15, fontWeight: "900", marginBottom: 2 },
  listRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  bullet: { color: C.brand, fontSize: 16, lineHeight: 22, fontWeight: "900", width: 12 },
  ordered: { color: C.brand, fontSize: 14, lineHeight: 22, fontWeight: "800", minWidth: 18 },
  listBody: { flex: 1, minWidth: 0 },
  codeBlock: {
    backgroundColor: C.codeBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 10,
  },
  codeText: { color: C.text, fontSize: 13, fontWeight: "600", lineHeight: 18 },
});

const typing = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.brand },
  label: { marginLeft: 4, color: C.textMuted, fontSize: 13, fontWeight: "700" },
});

const caret = StyleSheet.create({
  bar: {
    width: 8,
    height: 16,
    marginTop: 2,
    borderRadius: 2,
    backgroundColor: C.brand,
  },
});
