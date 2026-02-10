// components/ui/icon-symbol.tsx
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, StyleProp, TextStyle } from "react-native";

type IconMapping = Record<
  SymbolViewProps["name"],
  ComponentProps<typeof MaterialIcons>["name"]
>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * SF Symbols name -> Material Icons name (Android/Web)
 * Use ONLY keys from this MAPPING in your app.
 */
const MAPPING = {
  // ----- CORE / NAV -----
  "house.fill": "home",
  "magnifyingglass": "search",
  "bell.fill": "notifications",
  "gearshape.fill": "settings",
  "person.fill": "person",
  "person.2.fill": "groups",
  "info.circle.fill": "info",
  "questionmark.circle.fill": "help",
  "xmark": "close",
  "chevron.left": "chevron-left",
  "chevron.right": "chevron-right",
  "arrow.right": "arrow-forward",
  "arrow.left": "arrow-back",

  // ----- WARDROBE / CLOSET -----
  // best “wardrobe” style icons
  "hanger": "checkroom", // closet / wardrobe
  "tshirt.fill": "checkroom", // fallback (material doesn't have tshirt)
  "tag.fill": "local-offer",
  "camera.fill": "photo-camera",
  "photo.fill": "photo",
  "square.grid.2x2.fill": "grid-view",
  "square.grid.3x3.fill": "apps",

  // ----- OUTFITS / AI / STYLE -----
  "sparkles": "auto-awesome",
  "wand.and.stars": "auto-fix-high",
  "brain.head.profile": "psychology",
  "slider.horizontal.3": "tune",

  // ----- MARKET / RESELL -----
  "bag.fill": "shopping-bag",
  "cart.fill": "shopping-cart",
  "creditcard.fill": "credit-card",
  "receipt.fill": "receipt",
  "truck.box.fill": "local-shipping",
  "cube.box.fill": "inventory-2",
  "clock.fill": "schedule",

  // ----- IMPACT / ECO / SCORE -----
  "leaf.fill": "eco",
  "globe.asia.australia.fill": "public",
  "drop.fill": "water-drop",
  "bolt.fill": "bolt",
  "chart.bar.fill": "bar-chart",
  "chart.line.uptrend.xyaxis": "show-chart",
  "star.fill": "star",
  "trophy.fill": "emoji-events",

  // ----- SOCIAL / SHARE -----
  "paperplane.fill": "send",
  "square.and.arrow.up": "ios-share",
  "link": "link",
  "message.fill": "chat",

  // ----- UTILITIES -----
  "plus": "add",
  "plus.circle.fill": "add-circle",
  "pencil": "edit",
  "trash.fill": "delete",
  "checkmark.circle.fill": "check-circle",
  "xmark.circle.fill": "cancel",

  // ----- YOUR OLD ONES (keep) -----
  "chevron.left.forwardslash.chevron.right": "code",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={MAPPING[name]}
      style={style}
    />
  );
}
