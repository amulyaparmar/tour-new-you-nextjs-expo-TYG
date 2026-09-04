/** Design tokens for the page-by-page visual pass. Reuse these on each screen as it is redesigned. */

export const BACKGROUND = "#F2F2F7";
export const CARD = "#FFFFFF";
/** Brand blue already used on Home (Check-In / New Session, links, time pills). */
export const ACCENT = "#006ce5";
export const TEXT = "#000000";
export const LARGE_CORNER = 32;
export const SMALL_CORNER = 16;

/**
 * Plus Jakarta Sans (Google Fonts).
 * Use `fontFamily: FONT.regular` (or `.medium` / `.semibold` / `.bold` / `.extrabold`).
 * ExtraBold covers 800 and 900 — this family has no 900 cut.
 */
export const FONT = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
} as const;
