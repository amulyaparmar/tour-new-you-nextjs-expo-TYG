import { AudioLines, MessageCircle } from "lucide-react-native";
import { View } from "react-native";

/** Tour's conversation mark, composed from the existing icon library. */
export function CoachIcon({ size = 24, color }: { size?: number; color: string }) {
  return <View pointerEvents="none" accessible={false} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    <MessageCircle size={size} color={color} strokeWidth={1.8} style={{ position: "absolute" }} />
    <AudioLines size={size * 0.48} color={color} strokeWidth={2} style={{ marginTop: -size * 0.06 }} />
  </View>;
}
