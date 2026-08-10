import type { FollowUpAction, SessionDetail } from "@tour/shared";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { sendSessionFollowUp, updateActionStatus } from "../api";
import { getSiteBaseUrl } from "../config";
import { LoadingDots } from "@/components/loading-dots";

const C = {
  brand: "#006CE5",
  brandSoft: "#EAF4FF",
  green: "#16A34A",
  greenBg: "#EEFAF3",
  text: "#101828",
  textSec: "#667085",
  textMuted: "#94A3B8",
  border: "rgba(16, 24, 40, 0.08)",
  card: "#FFFFFF",
  purple: "#7C3AED",
  purpleBg: "#F3E8FF",
};

type Props = {
  session: SessionDetail;
  actions: FollowUpAction[];
  sessionId: string;
  onActionsUpdated: () => void;
  onToast?: (message: string, type?: "success" | "error") => void;
};

export function SessionFollowUpPanel({ session, actions, sessionId, onActionsUpdated, onToast }: Props) {
  const [phone, setPhone] = useState(
    session.leads?.[0]?.phone ?? ""
  );
  const [sending, setSending] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const followUpUrl = `${getSiteBaseUrl()}/follow-up/${sessionId}`;
  const prospectName =
    session.leads?.[0]?.name ?? session.prospectName ?? "Prospect";
  const openActions = useMemo(() => actions.filter((a) => a.status === "open"), [actions]);

  async function handleSendFollowUp() {
    if (!phone.trim()) {
      onToast?.("Enter a phone number for the prospect", "error");
      return;
    }
    setSending(true);
    try {
      const result = await sendSessionFollowUp(sessionId, { phone: phone.trim() });
      if (result.skipped) {
        onToast?.("SMS is not configured on the server yet", "error");
        return;
      }
      onToast?.("Follow-up text sent", "success");
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : "Could not send follow-up", "error");
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    await Clipboard.setStringAsync(followUpUrl);
    onToast?.("Follow-up link copied", "success");
  }

  async function copyMessage(message: string) {
    await Clipboard.setStringAsync(message);
    onToast?.("Message copied", "success");
  }

  async function handleActionStatus(actionId: string, status: "completed" | "dismissed") {
    setUpdatingId(actionId);
    try {
      await updateActionStatus(sessionId, actionId, status);
      onActionsUpdated();
      onToast?.(status === "completed" ? "Marked complete" : "Dismissed", "success");
    } catch {
      onToast?.("Could not update action", "error");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.heroCard}>
        <View style={styles.heroBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.heroBadgeText}>Post-tour follow-up</Text>
        </View>
        <Text style={styles.heroTitle}>Send {prospectName} their recap</Text>
        <Text style={styles.heroSub}>
          Share the tour follow-up page with recap, media, and next steps — the same experience as web.
        </Text>

        <View style={styles.linkPreview}>
          <Ionicons name="link-outline" size={16} color={C.brand} />
          <Text style={styles.linkText} numberOfLines={2}>{followUpUrl}</Text>
          <Pressable onPress={() => void copyLink()} style={styles.linkCopy}>
            <Ionicons name="copy-outline" size={16} color={C.brand} />
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Prospect phone</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="(555) 555-0100"
          placeholderTextColor={C.textMuted}
          keyboardType="phone-pad"
          style={styles.phoneInput}
        />

        <Pressable
          disabled={sending}
          onPress={() => void handleSendFollowUp()}
          style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.9 }]}
        >
          {sending ? (
            <LoadingDots color="#fff" />
          ) : (
            <>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
              <Text style={styles.sendBtnText}>Send follow-up text</Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={() => void Linking.openURL(followUpUrl)} style={styles.previewLink}>
          <Text style={styles.previewLinkText}>Preview follow-up page</Text>
          <Ionicons name="open-outline" size={14} color={C.brand} />
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>AI follow-up actions</Text>
      {openActions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>All follow-up actions are complete.</Text>
        </View>
      ) : (
        openActions.map((action) => (
          <View key={action.id} style={styles.actionCard}>
            <Text style={styles.actionTitle}>{action.title}</Text>
            <Text style={styles.actionBody}>{action.description}</Text>
            {action.suggestedMessage ? (
              <View style={styles.messageBox}>
                <Text style={styles.messageLabel}>Suggested message</Text>
                <Text style={styles.messageText}>{action.suggestedMessage}</Text>
                <Pressable onPress={() => void copyMessage(action.suggestedMessage!)} style={styles.copyMsg}>
                  <Ionicons name="copy-outline" size={14} color={C.brand} />
                  <Text style={styles.copyMsgText}>Copy</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.actionRow}>
              <Pressable
                disabled={updatingId === action.id}
                onPress={() => void handleActionStatus(action.id, "completed")}
                style={styles.doneBtn}
              >
                {updatingId === action.id ? (
                  <LoadingDots size="small" color={C.green} />
                ) : (
                  <Text style={styles.doneBtnText}>Done</Text>
                )}
              </Pressable>
              <Pressable
                disabled={updatingId === action.id}
                onPress={() => void handleActionStatus(action.id, "dismissed")}
                style={styles.dismissBtn}
              >
                <Text style={styles.dismissBtnText}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  heroCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 12,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: C.purpleBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.purple },
  heroBadgeText: { fontSize: 11, fontWeight: "900", color: C.purple },
  heroTitle: { fontSize: 18, fontWeight: "900", color: C.text },
  heroSub: { fontSize: 13, fontWeight: "600", color: C.textSec, lineHeight: 20 },
  linkPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.brandSoft,
    borderRadius: 10,
    padding: 10,
  },
  linkText: { flex: 1, fontSize: 12, fontWeight: "700", color: C.brand },
  linkCopy: { padding: 4 },
  fieldLabel: { fontSize: 11, fontWeight: "900", color: C.textMuted, textTransform: "uppercase" },
  phoneInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "600",
    color: C.text,
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.brand,
    borderRadius: 12,
    paddingVertical: 14,
  },
  sendBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  previewLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  previewLinkText: { fontSize: 13, fontWeight: "700", color: C.brand },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: C.text },
  empty: { padding: 16, alignItems: "center" },
  emptyText: { fontSize: 13, fontWeight: "600", color: C.textSec },
  actionCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 8,
  },
  actionTitle: { fontSize: 15, fontWeight: "800", color: C.text },
  actionBody: { fontSize: 13, fontWeight: "600", color: C.textSec, lineHeight: 20 },
  messageBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  messageLabel: { fontSize: 10, fontWeight: "900", color: C.textMuted, textTransform: "uppercase" },
  messageText: { fontSize: 13, fontWeight: "600", color: C.text, lineHeight: 20, fontStyle: "italic" },
  copyMsg: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  copyMsgText: { fontSize: 12, fontWeight: "700", color: C.brand },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  doneBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.greenBg,
  },
  doneBtnText: { fontSize: 13, fontWeight: "800", color: C.green },
  dismissBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  dismissBtnText: { fontSize: 13, fontWeight: "800", color: C.textSec },
});
