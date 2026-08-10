import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { MobileAuthSession } from "../../auth";
import { getCurrentSession } from "../../auth";
import { useProfileQuery, useUpdateProfileMutation } from "../../queries";
import { LoadingDots } from "@/components/loading-dots";

const C = {
  bg: "#F7F8FB",
  text: "#101828",
  textSec: "#667085",
  textMuted: "#98A2B3",
  brand: "#006CE5",
  line: "rgba(16,24,40,0.1)",
  card: "#FFFFFF",
} as const;

export const CARD_ACCENTS = [
  "#006CE5",
  "#0F766E",
  "#B45309",
  "#BE123C",
  "#7C3AED",
  "#1D4ED8",
  "#334155",
  "#047857",
] as const;

export function resolveCardAccent(value: string | null | undefined): string {
  if (value && (CARD_ACCENTS as readonly string[]).includes(value)) return value;
  return CARD_ACCENTS[0];
}

function initialsFrom(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

function ContactCardPreview({
  name,
  title,
  email,
  phone,
  community,
  accent,
}: {
  name: string;
  title: string;
  email: string;
  phone: string;
  community: string;
  accent: string;
}) {
  return (
    <View style={[styles.previewCard, { borderColor: accent }]}>
      <View style={[styles.previewHeader, { backgroundColor: accent }]}>
        <Text style={styles.previewBrand}>tour.you</Text>
        <Text style={styles.previewCommunity} numberOfLines={1}>{community}</Text>
      </View>
      <View style={styles.previewBody}>
        <View style={[styles.previewAvatar, { backgroundColor: accent }]}>
          <Text style={styles.previewAvatarText}>{initialsFrom(name || "Agent")}</Text>
        </View>
        <Text style={styles.previewName}>{name || "Your name"}</Text>
        <Text style={styles.previewTitle}>{title || "Leasing Consultant"}</Text>
        <View style={styles.previewMeta}>
          <Text style={styles.previewMetaText} numberOfLines={1}>{email || "email@community.com"}</Text>
          <Text style={styles.previewMetaText} numberOfLines={1}>{phone || "Add a phone number"}</Text>
        </View>
        <View style={[styles.previewCta, { backgroundColor: accent }]}>
          <Text style={styles.previewCtaText}>Check in for your tour</Text>
        </View>
      </View>
    </View>
  );
}

export function ProfileEditorScreen({
  session,
  onBack,
  onSaved,
  onStartTour,
  presentation = "screen",
}: {
  session: MobileAuthSession;
  onBack: () => void;
  onSaved: (next: MobileAuthSession) => void;
  onStartTour: () => void;
  presentation?: "screen" | "tab";
}) {
  const profileQuery = useProfileQuery();
  const updateProfileMutation = useUpdateProfileMutation();
  const profile = profileQuery.data;
  const user = session.workspace.user;

  const [name, setName] = useState(user.fullName ?? "");
  const [title, setTitle] = useState(user.title ?? "Leasing Consultant");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [accent, setAccent] = useState(resolveCardAccent(user.cardAccent));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setTitle(profile.title ?? "Leasing Consultant");
    setPhone(profile.phone ?? "");
    setAccent(resolveCardAccent(profile.cardAccent));
    const next = getCurrentSession();
    if (next) onSaved(next);
    // Sync form when cached/remote profile arrives — avoid looping on onSaved identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const baselineName = profile?.name ?? user.fullName ?? "";
  const baselineTitle = profile?.title ?? user.title ?? "Leasing Consultant";
  const baselinePhone = profile?.phone ?? user.phone ?? "";
  const baselineAccent = resolveCardAccent(profile?.cardAccent ?? user.cardAccent);

  const dirty = useMemo(() => {
    return (
      name.trim() !== baselineName.trim() ||
      title.trim() !== baselineTitle.trim() ||
      phone.trim() !== baselinePhone.trim() ||
      accent !== baselineAccent
    );
  }, [accent, baselineAccent, baselineName, baselinePhone, baselineTitle, name, phone, title]);

  async function save() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setError(null);
    try {
      await updateProfileMutation.mutateAsync({
        name: name.trim(),
        title: title.trim() || null,
        phone: phone.trim() || null,
        cardAccent: accent,
      });
      const next = getCurrentSession();
      if (next) onSaved(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save profile.");
    }
  }

  const loadingProfile = profileQuery.isLoading && !profile;
  const saving = updateProfileMutation.isPending;
  const isTab = presentation === "tab";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scroll, isTab && styles.tabScroll]}
    >
      <View style={styles.page}>
        {!isTab && (
          <Pressable onPress={onBack} style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.7 }]}>
            <Ionicons name="chevron-back" size={20} color={C.brand} />
            <Text style={styles.backText}>Home</Text>
          </Pressable>
        )}

        <Text style={styles.pageTitle}>{isTab ? "My card" : "Your profile"}</Text>
        <Text style={styles.pageSub}>Update how you appear on your contact card and check-in experience.</Text>

        {loadingProfile ? (
          <View style={styles.loadingBox}>
            <LoadingDots color={C.brand} />
          </View>
        ) : (
          <ContactCardPreview
            name={name.trim() || "Your name"}
            title={title.trim()}
            email={user.email}
            phone={phone.trim()}
            community={session.workspace.community.name}
            accent={accent}
          />
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profile details</Text>
          <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="Leasing Consultant" />
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="(555) 123-4567" />
          <View style={styles.readOnly}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.readOnlyValue}>{user.email}</Text>
          </View>
          <View style={styles.readOnly}>
            <Text style={styles.label}>Community</Text>
            <Text style={styles.readOnlyValue}>{session.workspace.community.name}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact card color</Text>
          <Text style={styles.sectionHint}>Preview updates live as you pick an accent.</Text>
          <View style={styles.swatchRow}>
            {CARD_ACCENTS.map((color) => {
              const selected = color === accent;
              return (
                <Pressable
                  key={color}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Accent ${color}`}
                  onPress={() => setAccent(color)}
                  style={[
                    styles.swatch,
                    { backgroundColor: color },
                    selected && styles.swatchSelected,
                  ]}
                >
                  {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          disabled={saving || !dirty}
          onPress={() => void save()}
          style={({ pressed }) => [
            styles.primaryBtn,
            (!dirty || saving) && styles.primaryBtnDisabled,
            pressed && dirty && !saving && { opacity: 0.9 },
          ]}
        >
          {saving ? <LoadingDots color="#fff" /> : <Text style={styles.primaryBtnText}>Save profile</Text>}
        </Pressable>

        <Pressable
          onPress={onStartTour}
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="swap-horizontal-outline" size={18} color={C.text} />
          <Text style={styles.secondaryBtnText}>Exchange contact and start tour</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad" | "email-address";
  autoCapitalize?: "none" | "sentences" | "words";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  tabScroll: { paddingBottom: 120 },
  page: { paddingHorizontal: 18, paddingTop: 8, gap: 14 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
  backText: { color: C.brand, fontSize: 16, fontWeight: "700" },
  pageTitle: { fontSize: 28, fontWeight: "900", color: C.text },
  pageSub: { fontSize: 14, fontWeight: "600", color: C.textSec, marginTop: -6, lineHeight: 20 },
  loadingBox: {
    minHeight: 220,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  previewCard: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: C.card,
    borderWidth: 1.5,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  previewHeader: { paddingHorizontal: 18, paddingVertical: 16, gap: 4 },
  previewBrand: { color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
  previewCommunity: { color: "#fff", fontSize: 18, fontWeight: "900" },
  previewBody: { padding: 18, alignItems: "center", gap: 8 },
  previewAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -36,
    borderWidth: 3,
    borderColor: "#fff",
  },
  previewAvatarText: { color: "#fff", fontSize: 22, fontWeight: "900" },
  previewName: { fontSize: 22, fontWeight: "900", color: C.text },
  previewTitle: { fontSize: 14, fontWeight: "700", color: C.textSec, marginTop: -4 },
  previewMeta: { alignSelf: "stretch", gap: 4, marginTop: 6 },
  previewMetaText: { fontSize: 13, fontWeight: "600", color: C.textSec, textAlign: "center" },
  previewCta: {
    alignSelf: "stretch",
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  previewCtaText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  card: {
    backgroundColor: C.card,
    borderRadius: 22,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: C.text },
  sectionHint: { fontSize: 12, fontWeight: "600", color: C.textMuted, marginTop: -6 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: "800", color: C.textSec, textTransform: "uppercase", letterSpacing: 0.4 },
  input: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600",
    color: C.text,
    backgroundColor: "#F8FAFC",
  },
  readOnly: { gap: 4 },
  readOnlyValue: { fontSize: 15, fontWeight: "700", color: C.text },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchSelected: {
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  error: { color: "#D92D20", fontSize: 13, fontWeight: "700" },
  primaryBtn: {
    backgroundColor: C.brand,
    borderRadius: 16,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  secondaryBtn: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: { color: C.text, fontSize: 14, fontWeight: "800" },
});
