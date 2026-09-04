import { Feather, Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { MobileAuthSession } from "../../auth";
import { getCurrentSession, updateWorkspaceAliases } from "../../auth";
import { getSiteBaseUrl } from "../../config";
import { useProfileQuery, useUpdateProfileMutation } from "../../queries";
import { CustomText, customTextVariants } from "@/components/custom-text";
import { GlassNavHeader, glassNavContentInset } from "@/components/glass-nav-header";
import { LoadingDots } from "@/components/loading-dots";
import { ACCENT, BACKGROUND, CARD, SMALL_CORNER, TEXT } from "@/theme/tokens";
import { defaultMemberPublicAlias, defaultPropertyPublicAlias } from "@tour/shared";

const SEPARATOR = "rgba(60, 60, 67, 0.18)";
const MUTED = "rgba(0, 0, 0, 0.45)";

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
        <CustomText textStyle="caption" style={styles.previewBrand}>tour.you</CustomText>
        <CustomText textStyle="title" numberOfLines={1} style={styles.previewCommunity}>{community}</CustomText>
      </View>
      <View style={styles.previewBody}>
        <View style={[styles.previewAvatar, { backgroundColor: accent }]}>
          <CustomText textStyle="hero" style={styles.previewAvatarText}>{initialsFrom(name || "Agent")}</CustomText>
        </View>
        <CustomText textStyle="hero">{name || "Your name"}</CustomText>
        <CustomText textStyle="body" style={styles.previewTitle}>{title || "Leasing Consultant"}</CustomText>
        <View style={styles.previewMeta}>
          <CustomText textStyle="label" numberOfLines={1} style={styles.previewMetaText}>{email || "email@community.com"}</CustomText>
          <CustomText textStyle="label" numberOfLines={1} style={styles.previewMetaText}>{phone || "Add a phone number"}</CustomText>
        </View>
        <View style={[styles.previewCta, { backgroundColor: accent }]}>
          <CustomText textStyle="label" style={styles.previewCtaText}>Check in for your tour</CustomText>
        </View>
      </View>
    </View>
  );
}

export function ProfileEditorForm({
  session,
  onSaved,
  onStartTour,
  showPreview = true,
  showStartTour = true,
  showSaveButton = true,
  appearance = "page",
  saveActionRef,
  onSaveStateChange,
}: {
  session: MobileAuthSession;
  onSaved: (next: MobileAuthSession) => void;
  onStartTour?: () => void;
  showPreview?: boolean;
  showStartTour?: boolean;
  showSaveButton?: boolean;
  appearance?: "page" | "modal";
  saveActionRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
  onSaveStateChange?: (state: { dirty: boolean; saving: boolean }) => void;
}) {
  const profileQuery = useProfileQuery();
  const updateProfileMutation = useUpdateProfileMutation();
  const profile = profileQuery.data;
  const user = session.workspace.user;
  const grouped = appearance === "modal";

  const [name, setName] = useState(user.fullName ?? "");
  const [title, setTitle] = useState(user.title ?? "Leasing Consultant");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [accent, setAccent] = useState(resolveCardAccent(user.cardAccent));
  const [userAlias, setUserAlias] = useState(defaultMemberPublicAlias({
    alias: session.workspace.teamMember?.alias,
    name: session.workspace.teamMember?.name || user.fullName,
    email: user.email,
    id: session.workspace.teamMember?.id || user.id,
  }));
  const [propertyAlias, setPropertyAlias] = useState(defaultPropertyPublicAlias({
    alias: session.workspace.community.alias,
    name: session.workspace.community.name,
    propertyTygId: session.workspace.community.propertyTygId,
  }));
  const [error, setError] = useState<string | null>(null);
  const [aliasError, setAliasError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    setUserAlias(defaultMemberPublicAlias({
      alias: session.workspace.teamMember?.alias,
      name: session.workspace.teamMember?.name || user.fullName,
      email: user.email,
      id: session.workspace.teamMember?.id || user.id,
    }));
    setPropertyAlias(defaultPropertyPublicAlias({
      alias: session.workspace.community.alias,
      name: session.workspace.community.name,
      propertyTygId: session.workspace.community.propertyTygId,
    }));
  }, [session.workspace.community.alias, session.workspace.community.name, session.workspace.community.propertyTygId, session.workspace.teamMember?.alias, session.workspace.teamMember?.id, session.workspace.teamMember?.name, user.email, user.fullName, user.id]);

  const baselineName = profile?.name ?? user.fullName ?? "";
  const baselineTitle = profile?.title ?? user.title ?? "Leasing Consultant";
  const baselinePhone = profile?.phone ?? user.phone ?? "";
  const baselineAccent = resolveCardAccent(profile?.cardAccent ?? user.cardAccent);
  const baselineUserAlias = defaultMemberPublicAlias({
    alias: session.workspace.teamMember?.alias,
    name: session.workspace.teamMember?.name || user.fullName,
    email: user.email,
    id: session.workspace.teamMember?.id || user.id,
  });
  const baselinePropertyAlias = defaultPropertyPublicAlias({
    alias: session.workspace.community.alias,
    name: session.workspace.community.name,
    propertyTygId: session.workspace.community.propertyTygId,
  });

  const profileDirty =
    name.trim() !== baselineName.trim() ||
    title.trim() !== baselineTitle.trim() ||
    phone.trim() !== baselinePhone.trim() ||
    accent !== baselineAccent;
  const aliasesDirty =
    userAlias.trim() !== baselineUserAlias.trim() ||
    propertyAlias.trim() !== baselinePropertyAlias.trim();
  const dirty = profileDirty || aliasesDirty;

  async function save(): Promise<boolean> {
    if (!name.trim()) {
      setError("Name is required.");
      return false;
    }
    if (!profileDirty && !aliasesDirty) return true;
    setError(null);
    setAliasError(null);
    setSaving(true);
    let ok = true;
    try {
      if (profileDirty) {
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
          ok = false;
        }
      }
      if (aliasesDirty) {
        try {
          const nextSession = await updateWorkspaceAliases({
            userAlias: userAlias.trim() || null,
            propertyAlias: propertyAlias.trim() || null,
          });
          onSaved(nextSession);
        } catch (caught) {
          setAliasError(caught instanceof Error ? caught.message : "Could not save check-in link.");
          ok = false;
        }
      }
    } finally {
      setSaving(false);
    }
    return ok;
  }

  useEffect(() => {
    if (saveActionRef) saveActionRef.current = save;
  });

  useEffect(() => {
    onSaveStateChange?.({ dirty, saving });
  }, [dirty, onSaveStateChange, saving]);

  const loadingProfile = profileQuery.isLoading && !profile;
  const checkInUrl = `${getSiteBaseUrl().replace(/\/$/, "")}/p/${encodeURIComponent(propertyAlias.trim())}/${encodeURIComponent(userAlias.trim())}`;

  const details = grouped ? (
    <>
      <CustomText textStyle="caption" style={styles.sectionHeader}>Profile details</CustomText>
      <View style={styles.group}>
        <NativeField label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        <NativeField label="Title" value={title} onChangeText={setTitle} placeholder="Leasing Consultant" />
        <NativeField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Phone" />
        <NativeField label="Email" value={user.email} editable={false} />
        <NativeField label="Community" value={session.workspace.community.name} editable={false} last />
      </View>
    </>
  ) : (
    <View style={styles.card}>
      <CustomText textStyle="title">Profile details</CustomText>
      <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Title" value={title} onChangeText={setTitle} placeholder="Leasing Consultant" />
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="(555) 123-4567" />
      <View style={styles.readOnly}>
        <CustomText textStyle="caption" style={styles.label}>Email</CustomText>
        <CustomText textStyle="body">{user.email}</CustomText>
      </View>
      <View style={styles.readOnly}>
        <CustomText textStyle="caption" style={styles.label}>Community</CustomText>
        <CustomText textStyle="body">{session.workspace.community.name}</CustomText>
      </View>
    </View>
  );

  const aliases = grouped ? (
    <>
      <CustomText textStyle="caption" style={styles.sectionHeader}>Public check-in link</CustomText>
      <View style={styles.group}>
        <View style={styles.aliasBlock}>
          <CustomText textStyle="body">Property alias</CustomText>
          <View style={styles.aliasInline}>
            <CustomText textStyle="body" style={styles.aliasPrefix}>tour.you/p/</CustomText>
            <TextInput
              accessibilityLabel="Property alias"
              autoCapitalize="none"
              autoCorrect={false}
              value={propertyAlias}
              onChangeText={setPropertyAlias}
              style={[customTextVariants.title, styles.nativeInputLeft]}
            />
          </View>
        </View>
        <View style={styles.separator} />
        <View style={styles.aliasBlock}>
          <CustomText textStyle="body">Your alias</CustomText>
          <View style={styles.aliasInline}>
            <CustomText textStyle="body" style={styles.aliasPrefix}>/</CustomText>
            <TextInput
              accessibilityLabel="Your check-in alias"
              autoCapitalize="none"
              autoCorrect={false}
              value={userAlias}
              onChangeText={setUserAlias}
              style={[customTextVariants.title, styles.nativeInputLeft]}
            />
          </View>
        </View>
        <View style={styles.separator} />
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open check-in link"
          onPress={() => void Linking.openURL(checkInUrl)}
          style={({ pressed }) => [styles.aliasBlock, styles.aliasLink, pressed && styles.pressed]}
        >
          <CustomText textStyle="caption" numberOfLines={2} style={styles.aliasPreview}>{checkInUrl}</CustomText>
          <Feather name="arrow-up-right" size={14} color={ACCENT} />
        </Pressable>
        {aliasError ? (
          <>
            <View style={styles.separator} />
            <CustomText textStyle="caption" style={styles.error}>{aliasError}</CustomText>
          </>
        ) : null}
      </View>
    </>
  ) : (
    <View style={styles.card}>
      <CustomText textStyle="title">Public check-in link</CustomText>
      <CustomText textStyle="caption" style={styles.sectionHint}>Choose the property and personal aliases guests will use to check in.</CustomText>
      <View style={styles.field}>
        <CustomText textStyle="caption" style={styles.label}>Property alias</CustomText>
        <View style={styles.aliasInputRow}>
          <CustomText textStyle="label" style={styles.aliasPrefix}>tour.you/p/</CustomText>
          <TextInput
            accessibilityLabel="Property alias"
            autoCapitalize="none"
            autoCorrect={false}
            value={propertyAlias}
            onChangeText={setPropertyAlias}
            style={[customTextVariants.title, styles.aliasInput]}
          />
        </View>
      </View>
      <View style={styles.field}>
        <CustomText textStyle="caption" style={styles.label}>Your alias</CustomText>
        <View style={styles.aliasInputRow}>
          <CustomText textStyle="label" style={styles.aliasPrefix}>/</CustomText>
          <TextInput
            accessibilityLabel="Your check-in alias"
            autoCapitalize="none"
            autoCorrect={false}
            value={userAlias}
            onChangeText={setUserAlias}
            style={[customTextVariants.title, styles.aliasInput]}
          />
        </View>
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Open check-in link"
        onPress={() => void Linking.openURL(checkInUrl)}
        style={({ pressed }) => [styles.aliasLink, pressed && styles.pressed]}
      >
        <CustomText textStyle="caption" numberOfLines={2} style={styles.aliasPreview}>{checkInUrl}</CustomText>
        <Feather name="arrow-up-right" size={14} color={ACCENT} />
      </Pressable>
      {aliasError ? <CustomText textStyle="caption" style={styles.error}>{aliasError}</CustomText> : null}
    </View>
  );

  const colors = grouped ? (
    <>
      <CustomText textStyle="caption" style={styles.sectionHeader}>Contact card color</CustomText>
      <View style={styles.group}>
        <View style={styles.swatchWrap}>
          {CARD_ACCENTS.map((color) => {
            const selected = color === accent;
            return (
              <Pressable
                key={color}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Accent ${color}`}
                onPress={() => setAccent(color)}
                style={[styles.swatchFit, { backgroundColor: color }, selected && styles.swatchSelected]}
              >
                {selected ? <Ionicons name="checkmark" size={12} color={CARD} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  ) : (
    <View style={styles.card}>
      <CustomText textStyle="title">Contact card color</CustomText>
      <CustomText textStyle="caption" style={styles.sectionHint}>Preview updates live as you pick an accent.</CustomText>
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
              style={[styles.swatch, { backgroundColor: color }, selected && styles.swatchSelected]}
            >
              {selected ? <Ionicons name="checkmark" size={16} color={CARD} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={[styles.page, grouped && styles.groupedPage]}>
      {grouped ? null : (
        <CustomText textStyle="body" style={styles.pageSub}>
          Update how you appear on your contact card and check-in experience.
        </CustomText>
      )}

      {showPreview ? (
        loadingProfile ? (
          <View style={styles.loadingBox}>
            <LoadingDots color={ACCENT} />
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
        )
      ) : null}

      {details}
      {aliases}
      {colors}

      {error ? <CustomText textStyle="caption" style={styles.error}>{error}</CustomText> : null}

      {showSaveButton ? (
        <Pressable
          disabled={saving || !dirty}
          onPress={() => void save()}
          style={({ pressed }) => [
            styles.primaryBtn,
            (!dirty || saving) && styles.primaryBtnDisabled,
            pressed && dirty && !saving && styles.pressed,
          ]}
        >
          {saving ? <LoadingDots color={CARD} /> : <CustomText textStyle="title" style={styles.primaryBtnText}>Save profile</CustomText>}
        </Pressable>
      ) : null}

      {showStartTour && onStartTour ? (
        <Pressable
          onPress={onStartTour}
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
        >
          <Ionicons name="swap-horizontal-outline" size={18} color={TEXT} />
          <CustomText textStyle="label">Exchange contact and start tour</CustomText>
        </Pressable>
      ) : null}
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
  const isTab = presentation === "tab";
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: glassNavContentInset(insets.top) },
          isTab && styles.tabScroll,
        ]}
      >
        <ProfileEditorForm
          session={session}
          onSaved={onSaved}
          onStartTour={onStartTour}
        />
      </ScrollView>
      <GlassNavHeader
        title={isTab ? "My card" : "Your profile"}
        onBack={isTab ? undefined : onBack}
      />
    </View>
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
      <CustomText textStyle="caption" style={styles.label}>{label}</CustomText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={MUTED}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[customTextVariants.title, styles.input]}
      />
    </View>
  );
}

function NativeField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  editable = true,
  last = false,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad" | "email-address";
  autoCapitalize?: "none" | "sentences" | "words";
  editable?: boolean;
  last?: boolean;
}) {
  return (
    <>
      <View style={styles.groupedRow}>
        <CustomText textStyle="body">{label}</CustomText>
        {editable ? (
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={MUTED}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            style={[customTextVariants.title, styles.nativeInput]}
          />
        ) : (
          <CustomText textStyle="title" numberOfLines={1} style={styles.groupedReadonly}>{value}</CustomText>
        )}
      </View>
      {last ? null : <View style={styles.separator} />}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND },
  scroll: { paddingBottom: 40 },
  tabScroll: { paddingBottom: 120 },
  page: { paddingHorizontal: 18, gap: 14 },
  groupedPage: { gap: 0, paddingHorizontal: 18 },
  pageSub: { color: MUTED, lineHeight: 20 },
  sectionHeader: {
    color: MUTED,
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 16,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sectionHint: { color: MUTED, marginTop: -6 },
  group: {
    backgroundColor: CARD,
    borderRadius: SMALL_CORNER,
    overflow: "hidden",
  },
  groupedRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  groupedReadonly: {
    flex: 1,
    color: MUTED,
    textAlign: "right",
  },
  nativeInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    textAlign: "right",
  },
  nativeInputLeft: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 6,
  },
  aliasBlock: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  aliasInline: {
    flexDirection: "row",
    alignItems: "center",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
    backgroundColor: SEPARATOR,
  },
  loadingBox: {
    minHeight: 220,
    borderRadius: SMALL_CORNER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD,
  },
  previewCard: {
    borderRadius: SMALL_CORNER,
    overflow: "hidden",
    backgroundColor: CARD,
    borderWidth: 1.5,
  },
  previewHeader: { paddingHorizontal: 18, paddingVertical: 16, gap: 4 },
  previewBrand: { color: "rgba(255,255,255,0.82)" },
  previewCommunity: { color: CARD },
  previewBody: { padding: 18, alignItems: "center", gap: 8 },
  previewAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -36,
    borderWidth: 3,
    borderColor: CARD,
  },
  previewAvatarText: { color: CARD },
  previewTitle: { color: MUTED, marginTop: -4 },
  previewMeta: { alignSelf: "stretch", gap: 4, marginTop: 6 },
  previewMetaText: { color: MUTED, textAlign: "center" },
  previewCta: {
    alignSelf: "stretch",
    marginTop: 10,
    borderRadius: SMALL_CORNER,
    paddingVertical: 12,
    alignItems: "center",
  },
  previewCtaText: { color: CARD },
  card: {
    backgroundColor: CARD,
    borderRadius: SMALL_CORNER,
    padding: 16,
    gap: 12,
  },
  field: { gap: 6 },
  label: { color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 },
  aliasInputRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: SMALL_CORNER,
    backgroundColor: BACKGROUND,
  },
  aliasPrefix: { color: MUTED },
  aliasInput: { flex: 1, minWidth: 0, paddingVertical: 10 },
  aliasLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aliasPreview: { flex: 1, minWidth: 0, color: ACCENT, lineHeight: 17 },
  input: {
    borderRadius: SMALL_CORNER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: BACKGROUND,
  },
  readOnly: { gap: 4 },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatchWrap: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  swatchFit: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  swatchSelected: {
    borderColor: CARD,
    shadowColor: TEXT,
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  error: { color: "#FF3B30", paddingHorizontal: 16, paddingVertical: 10 },
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: SMALL_CORNER,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: CARD },
  secondaryBtn: {
    minHeight: 50,
    borderRadius: SMALL_CORNER,
    backgroundColor: CARD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pressed: { opacity: 0.72 },
});
