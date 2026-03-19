// frontend/components/DrawerShell.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { openTailorsNearMe } from "../services/externalLinks";

export default function DrawerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { width: SCREEN_W } = useWindowDimensions();
  const DRAWER_W = useMemo(() => Math.min(320, Math.floor(SCREEN_W * 0.82)), [SCREEN_W]);

  const [userName, setUserName] = useState("Fashionista");
  const [unreadCount, setUnreadCount] = useState(0);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const translateX = useRef(new Animated.Value(-DRAWER_W)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    translateX.setValue(drawerOpen ? 0 : -DRAWER_W);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [DRAWER_W]);

  useEffect(() => {
    (async () => {
      const n = await AsyncStorage.getItem("userName");
      if (n) setUserName(n);
    })();
  }, []);

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.timing(translateX, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.timing(translateX, { toValue: -DRAWER_W, duration: 220, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setDrawerOpen(false);
    });
  };

  const isActive = (target: string) => {
    if (target === "/(tabs)") return pathname === "/(tabs)" || pathname === "/";
    return pathname === target || pathname.startsWith(target + "/");
  };

  const go = (path: string) => {
    closeDrawer();
    router.push(path as any);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.clear();
      closeDrawer();
      router.replace("/login");
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* ✅ Drawer overlay */}
      {drawerOpen && (
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
        </Animated.View>
      )}

      {/* ✅ Drawer (EXACT SAME STYLE LIKE index.tsx) */}
      <Animated.View
        pointerEvents={drawerOpen ? "auto" : "none"}
        style={[styles.drawer, { width: DRAWER_W, transform: [{ translateX }] }]}
      >
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>RE-STYLE AI</Text>
            <Text style={styles.drawerSub}>Hello, {userName} 👋</Text>
          </View>

          <ScrollView contentContainerStyle={styles.drawerList}>
            <DrawerItem label="Home" icon="home-outline" active={isActive("/(tabs)")} onPress={() => go("/(tabs)")} />
            <DrawerItem label="My Wardrobe" icon="shirt-outline" active={isActive("/my-closet")} onPress={() => go("/my-closet")} />
            <DrawerItem label="Add Item" icon="add-circle-outline" active={isActive("/add-item")} onPress={() => go("/add-item")} />
            <DrawerItem label="AI Outfits" icon="sparkles-outline" active={isActive("/recommend")} onPress={() => go("/recommend")} />
            <DrawerItem label="Virtual Try-on" icon="body-outline" active={isActive("/virtual-tryon")} onPress={() => go("/virtual-tryon")} />
            <DrawerItem label="Marketplace" icon="bag-handle-outline" active={isActive("/marketplace")} onPress={() => go("/marketplace")} />
            <DrawerItem label="My Orders" icon="cube-outline" active={isActive("/my-orders")} onPress={() => go("/my-orders")} />
            <DrawerItem label="Circular Score" icon="star-outline" active={isActive("/circular-score")} onPress={() => go("/circular-score")} />
            <DrawerItem label="Eco Impact" icon="leaf-outline" active={isActive("/carbon-impact")} onPress={() => go("/carbon-impact")} />
            <DrawerItem label="Resale Timing" icon="hourglass-outline" active={isActive("/resale-timing")} onPress={() => go("/resale-timing")} />
            <DrawerItem label="Notifications" icon="notifications-outline" active={isActive("/notifications")} onPress={() => go("/notifications")} />
            <DrawerItem label="Profile" icon="person-circle-outline" active={isActive("/profile")} onPress={() => go("/profile")} />
            <DrawerItem label="Become an Agent" icon="bicycle-outline" active={isActive("/drop-collect")} onPress={() => go("/drop-collect")} />
            <DrawerItem label="Agents-jobs" icon="briefcase-outline" active={isActive("/agent-jobs")} onPress={() => go("/agent-jobs")} />
            <DrawerItem label="Create a delivery" icon="navigate-outline" active={isActive("/create-delivery")} onPress={() => go("/create-delivery")} />
            <DrawerItem label="Rewards" icon="gift-outline" active={isActive("/rewards")} onPress={() => go("/rewards")} />

            <DrawerItem
              label="Care to Wear"
              icon="cut-outline"
              active={false}
              onPress={() => {
                closeDrawer();
                openTailorsNearMe();
              }}
            />

            <DrawerItem label="Be an Ambassador" icon="megaphone-outline" active={isActive("/ambassador")} onPress={() => go("/ambassador")} />

            <View style={styles.drawerDivider} />
            <DrawerItem label="Logout" icon="log-out-outline" danger active={false} onPress={handleLogout} />
          </ScrollView>
        </SafeAreaView>
      </Animated.View>

      {/* ✅ TOP BAR (EXACT LIKE HOME) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={styles.headerIconBtn} activeOpacity={0.8}>
          <Ionicons name="menu" size={25} color="#000000" />
        </TouchableOpacity>

        <Text style={styles.brand}>HOUSE OF REVERA</Text>

        <TouchableOpacity onPress={() => router.push("/notifications")} style={styles.headerIconBtn} activeOpacity={0.8}>
          <Ionicons name="notifications-outline" size={22} color="#111111" />
          {unreadCount > 0 && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      </View>

      {/* ✅ Render current screen below the top bar */}
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}

function DrawerItem({ label, icon, onPress, danger, active }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.drawerItem,
        active && styles.drawerItemActive,
        pressed && styles.drawerItemPressed,
      ]}
    >
      <View style={styles.drawerItemLeft}>
        <Ionicons name={icon} size={20} color={danger ? "#D90429" : "#111111"} />
        <Text style={[styles.drawerLabel, active && styles.drawerLabelActive, danger && { color: "#D90429" }]}>
          {label}
        </Text>
      </View>
      {active && <View style={styles.activePill} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F5F5" },

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
  headerIconBtn: { width: 40, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  brand: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#000000",
    fontFamily: "Tactics-Bold",
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

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0, 0, 0, 0.55)", zIndex: 10 },

  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    zIndex: 11,
    borderRightWidth: 1,
    borderRightColor: "#E6E6E6",
  },
  drawerHeader: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  drawerTitle: {
    fontSize: 22,
    fontFamily: "IntegralCF-Bold",
    fontWeight: "900",
    color: "#111111",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  drawerSub: { marginTop: 6, color: "#777777", fontSize: 13, fontWeight: "500" },
  drawerList: { paddingHorizontal: 12, paddingBottom: 40 },

  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  drawerItemLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  drawerItemPressed: { opacity: 0.7 },
  drawerItemActive: { backgroundColor: "#F3F4F6" },
  drawerLabel: { fontSize: 15, color: "#111111", fontWeight: "500" },
  drawerLabelActive: { fontWeight: "800" },
  activePill: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#111111" },
  drawerDivider: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 10, marginHorizontal: 16 },
});