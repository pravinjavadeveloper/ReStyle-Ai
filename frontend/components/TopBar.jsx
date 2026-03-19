import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * ✅ TopBar (same vibe as Home header)
 * - Left: menu OR back
 * - Center: brand text
 * - Right: notification icon + optional unread dot
 *
 * HOW TO USE:
 * <TopBar
 *   title="HOUSE OF REVERA"
 *   leftType="menu"              // "menu" | "back"
 *   onLeftPress={openDrawer}     // function
 *   onRightPress={() => router.push("/notifications")}
 *   unreadCount={unreadCount}    // number
 * />
 */
export default function TopBar({
  title = "HOUSE OF REVERA",
  leftType = "menu", // "menu" | "back"
  onLeftPress,
  onRightPress,
  unreadCount = 0,
}) {
  return (
    <View style={styles.header}>
      {/* LEFT ICON */}
      <TouchableOpacity
        onPress={onLeftPress}
        style={styles.headerIconBtn}
        activeOpacity={0.8}
      >
        <Ionicons
          name={leftType === "back" ? "arrow-back" : "menu"}
          size={leftType === "back" ? 24 : 25}
          color="#000000"
        />
      </TouchableOpacity>

      {/* CENTER BRAND */}
      <Text style={styles.brand}>{title}</Text>

      {/* RIGHT ICON */}
      <TouchableOpacity
        onPress={onRightPress}
        style={styles.headerIconBtn}
        activeOpacity={0.8}
      >
        <Ionicons name="notifications-outline" size={22} color="#111111" />
        {Number(unreadCount) > 0 && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // ✅ EXACT same header style you used on Home
  header: {
    height: 56,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E6E6E6",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerIconBtn: {
    width: 40,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  brand: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#000000",
    fontFamily: "Tactics-Bold", // ✅ same as Home
  },

  unreadDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#111111",
  },
});