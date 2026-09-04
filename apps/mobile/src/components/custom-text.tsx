import React from "react";
import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";

import { FONT, TEXT } from "@/theme/tokens";

export type CustomTextStyle = "hero" | "title" | "body" | "label" | "caption" | "micro";

const variants = StyleSheet.create({
  /** Profile card name — Plus Jakarta ExtraBold 22. */
  hero: { fontFamily: FONT.extrabold, fontSize: 22, color: TEXT },
  /** Section, card, and button titles — Plus Jakarta ExtraBold 16. */
  title: { fontFamily: FONT.extrabold, fontSize: 16, color: TEXT },
  /** Primary body copy — system 14 / semibold. */
  body: { fontSize: 14, fontWeight: "600", color: TEXT },
  /** Actions and secondary emphasis — system 13 / bold. */
  label: { fontSize: 13, fontWeight: "700", color: TEXT },
  /** Supporting copy — system 12 / semibold. */
  caption: { fontSize: 12, fontWeight: "600", color: TEXT },
  /** Badges, chips, and tiny meta — system 11 / bold. */
  micro: { fontSize: 11, fontWeight: "700", color: TEXT },
});

export function CustomText({
  textStyle = "body",
  style,
  ...props
}: TextProps & { textStyle?: CustomTextStyle }) {
  return <Text style={[variants[textStyle], style]} {...props} />;
}

export const customTextVariants: Record<CustomTextStyle, TextStyle> = variants;
