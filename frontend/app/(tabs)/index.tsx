// app/(tabs)/index.tsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  RefreshControl,
  Animated,
  Pressable,
  Dimensions,
  ImageBackground,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, usePathname } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

// ✅ Google Fonts (Expo)
import { useFonts } from "expo-font";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display";
import { Inter_400Regular, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { Poppins_700Bold } from "@expo-google-fonts/poppins";

import {
  getWardrobeAnalytics,
  getResaleDemand,
  getResaleTiming,
  getNotifications,
} from "../services/api";
import { openTailorsNearMe } from "../services/externalLinks";

import {
  configureNotificationHandler,
  setupPushOrWebNotifications,
  startNotificationPolling,
} from "../services/push";

const { width: SCREEN_W } = Dimensions.get("window");
const DRAWER_W = Math.min(320, Math.floor(SCREEN_W * 0.82));

const API_URL =
  Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const imgUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL}/${path.replace(/\\/g, "/")}`;
};

// ✅ Local hero image
const HERO_IMAGE = require("../../assets/img/hero1.png");

// ✅ Wardrobe carousel sizing (RESPONSIVE — shows 2+ items like your reference)
const CARD_GAP = 14;
const H_PADDING = 16; // matches container padding
// target ~2.2 cards visible on small screens
const CARD_W = Math.min(
  175,
  Math.max(135, Math.floor((SCREEN_W - H_PADDING * 2 - CARD_GAP * 2) / 2.2))
);

export default function HomeScreen() {
  const router = useRouter();
  const pathname = usePathname();

  // ✅ Load fonts (keep hero exact; add Poppins for "Your Wardrobe")
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
    Poppins_700Bold,
  });

  if (!fontsLoaded) return null;

  const [userName, setUserName] = useState("Fashionista");
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [resale, setResale] = useState<any>(null);
  const [loadingResale, setLoadingResale] = useState(true);

  const [timingLoading, setTimingLoading] = useState(true);
  const [timingTop, setTimingTop] = useState<any>(null);

  // ✅ Your Wardrobe items
  const [wardrobeItems, setWardrobeItems] = useState<any[]>([]);

  // ✅ Drawer state + animation
  const [drawerOpen, setDrawerOpen] = useState(false);
  const translateX = useRef(new Animated.Value(-DRAWER_W)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -DRAWER_W,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
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

  // ✅ Load username once
  useEffect(() => {
    (async () => {
      const n = await AsyncStorage.getItem("userName");
      if (n) setUserName(n);
    })();
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const userId = await AsyncStorage.getItem("userId");
      if (!userId) {
        setUnreadCount(0);
        return;
      }
      const data = await getNotifications(userId);
      const list = Array.isArray(data?.items) ? data.items : [];
      const unread = list.filter((n: any) => !n.is_read);
      setUnreadCount(unread.length);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    let stopPopupPolling: any = null;
    let countInterval: any = null;
    let cancelled = false;

    (async () => {
      const userId = await AsyncStorage.getItem("userId");
      if (!userId) return;
      if (cancelled) return;

      configureNotificationHandler();
      await setupPushOrWebNotifications(userId);

      stopPopupPolling = startNotificationPolling(userId, 5000);

      await refreshUnreadCount();
      countInterval = setInterval(() => {
        refreshUnreadCount();
      }, 5000);
    })();

    return () => {
      cancelled = true;
      if (stopPopupPolling) stopPopupPolling();
      if (countInterval) clearInterval(countInterval);
    };
  }, [refreshUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setTimingLoading(true);
          const userId = await AsyncStorage.getItem("userId");
          if (!userId) return;

          const data = await getResaleTiming(userId);
          const first = Array.isArray(data?.recommendations)
            ? data.recommendations[0]
            : null;
          setTimingTop(first || null);
        } catch {
          setTimingTop(null);
        } finally {
          setTimingLoading(false);
        }
      })();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      loadHomeData();
      refreshUnreadCount();
    }, [refreshUnreadCount])
  );

  const loadHomeData = async () => {
    setLoadingStats(true);
    setLoadingResale(true);

    const userId = await AsyncStorage.getItem("userId");
    if (!userId) {
      setLoadingStats(false);
      setLoadingResale(false);
      return;
    }

    const analytics = await getWardrobeAnalytics(userId);
    if (analytics && !analytics.error) setStats(analytics);
    setLoadingStats(false);

    const demand = await getResaleDemand(userId);
    if (demand && !demand.error) setResale(demand);
    setLoadingResale(false);
  };

  // ✅ Fill wardrobe carousel (works now)
  useEffect(() => {
    const top = Array.isArray(resale?.topItems) ? resale.topItems : [];
    setWardrobeItems(top);
  }, [resale]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadHomeData(), refreshUnreadCount()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshUnreadCount]);

  const handleLogout = async () => {
    try {
      await AsyncStorage.clear();
      Alert.alert("Logged out", "You have been logged out.");
      closeDrawer();
      router.replace("/login");
    } catch {
      Alert.alert("Error", "Logout failed. Try again.");
    }
  };

  const topItems = Array.isArray(resale?.topItems) ? resale.topItems : [];

  return (
    <SafeAreaView style={styles.safe}>
      {/* ✅ SIDE DRAWER OVERLAY */}
      {drawerOpen && (
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
        </Animated.View>
      )}

      {/* ✅ DRAWER */}
      <Animated.View
        pointerEvents={drawerOpen ? "auto" : "none"}
        style={[styles.drawer, { transform: [{ translateX }] }]}
      >
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>RE-STYLE AI</Text>
            <Text style={styles.drawerSub}>Hello, {userName} 👋</Text>
          </View>

          <ScrollView contentContainerStyle={styles.drawerList}>
            <DrawerItem label="Home" emoji="🏠" active={isActive("/(tabs)")} onPress={() => go("/(tabs)")} />
            <DrawerItem label="My Wardrobe" emoji="🧥" active={isActive("/my-closet")} onPress={() => go("/my-closet")} />
            <DrawerItem label="Add Item" emoji="➕" active={isActive("/add-item")} onPress={() => go("/add-item")} />
            <DrawerItem label="AI Outfits" emoji="✨" active={isActive("/recommend")} onPress={() => go("/recommend")} />
            <DrawerItem label="Virtual Try-on" emoji="👕" active={isActive("/virtual-tryon")} onPress={() => go("/virtual-tryon")} />
            <DrawerItem label="Marketplace" emoji="🛍️" active={isActive("/marketplace")} onPress={() => go("/marketplace")} />
            <DrawerItem label="My Orders" emoji="📦" active={isActive("/my-orders")} onPress={() => go("/my-orders")} />
            <DrawerItem label="Circular Score" emoji="⭐" active={isActive("/circular-score")} onPress={() => go("/circular-score")} />
            <DrawerItem label="Eco Impact" emoji="🌿" active={isActive("/carbon-impact")} onPress={() => go("/carbon-impact")} />
            <DrawerItem label="Resale Timing" emoji="⏳" active={isActive("/resale-timing")} onPress={() => go("/resale-timing")} />
            <DrawerItem label="Notifications" emoji="🔔" active={isActive("/notifications")} onPress={() => go("/notifications")} />

            <DrawerItem
              label="Care to Wear (Tailors)"
              emoji="🧵"
              active={false}
              onPress={() => {
                closeDrawer();
                openTailorsNearMe();
              }}
            />

            <DrawerItem label="Be an Ambassador" emoji="📣" active={isActive("/ambassador")} onPress={() => go("/ambassador")} />

            <View style={styles.drawerDivider} />

            <DrawerItem label="Logout" emoji="🚪" danger active={false} onPress={handleLogout} />
          </ScrollView>
        </SafeAreaView>
      </Animated.View>

      {/* ✅ TOP HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={styles.headerIconBtn} activeOpacity={0.8}>
          <Text style={styles.headerIcon}>☰</Text>
        </TouchableOpacity>

        <Text style={styles.brand}>HOUSE OF REVERA</Text>

        <TouchableOpacity
          onPress={() => router.push("/notifications")}
          style={styles.headerIconBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.headerIcon}>🔔</Text>
          {unreadCount > 0 && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      </View>

      {/* ✅ MAIN CONTENT */}
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      >
        {/* ✅ HERO (UNCHANGED) */}
        <View style={styles.heroContainer}>
          <ImageBackground source={HERO_IMAGE} style={styles.heroImage} resizeMode="cover" imageStyle={styles.heroImgStyle}>
            <LinearGradient
              colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.58)"]}
              start={{ x: 0.5, y: 0.0 }}
              end={{ x: 0.5, y: 1.0 }}
              style={styles.heroGradient}
            />

            <View style={styles.heroOverlay}>
              <Text style={styles.heroTag}>TODAY&apos;S EDIT</Text>

              <Text style={styles.heroTitle}>
                Sustainable outfit{"\n"}from your wardrobe
              </Text>

              <Text style={styles.heroSubtitle}>
                Picked by AI from what you already own
              </Text>

              <View style={styles.heroButtons}>
                <TouchableOpacity style={styles.heroBtnPrimary} onPress={() => router.push("/virtual-tryon")} activeOpacity={0.9}>
                  <Text style={styles.heroBtnTextPrimary}>Wear this</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.heroBtnSecondary} onPress={() => router.push("/my-closet")} activeOpacity={0.9}>
                  <Text style={styles.heroBtnTextSecondary}>See more looks</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ImageBackground>
        </View>

        {/* ✅ YOUR WARDROBE (ONLY SIZE FIXED — same design/logic) */}
        <View style={styles.wardrobeHeader}>
          <Text style={styles.wardrobeTitle}>Your Wardrobe</Text>
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.push("/my-closet")}>
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={wardrobeItems}
          keyExtractor={(item, idx) => String(item?.id ?? idx)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.wardrobeList}
          decelerationRate="fast"
          snapToInterval={CARD_W + CARD_GAP}
          snapToAlignment="start"
          renderItem={({ item }) => (
            <View style={styles.trapOuter}>
              <View style={styles.trapShell}>
                <View style={styles.trapContent}>
                  <View style={styles.trapImgBox}>
                    <Image
                      source={{ uri: imgUrl(item?.image_url) }}
                      style={styles.trapImg}
                      resizeMode="contain"
                    />
                  </View>

                  <Text style={styles.trapName} numberOfLines={1}>
                    {item?.name || item?.title || item?.category || "Stone Gray T-Shirt"}
                  </Text>

                  <TouchableOpacity
                    style={styles.trapResellBtn}
                    activeOpacity={0.9}
                    onPress={() => router.push("/my-closet")}
                  >
                    <Text style={styles.trapResellText}>RESELL</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />

        {/* Existing content (UNCHANGED) */}
        <Text style={styles.greeting}>Hello, {userName}! 👋</Text>
        <Text style={styles.sub}>Your Closet Pulse.</Text>

        <TouchableOpacity style={styles.dashboardWidget} onPress={() => router.push("/wardrobe-analytics")} activeOpacity={0.9}>
          <View style={styles.dashHeader}>
            <Text style={styles.dashTitle}>Wardrobe Overview</Text>
            <Text style={styles.dashLink}>See Full Report →</Text>
          </View>

          {loadingStats ? (
            <ActivityIndicator color="#E0B0FF" style={{ marginTop: 10 }} />
          ) : (
            <View style={styles.dashRow}>
              <View style={styles.scoreBox}>
                <Text style={styles.scoreNum}>{stats?.score || 0}</Text>
                <Text style={styles.scoreLabel}>Score</Text>
              </View>

              <View style={styles.statsCol}>
                <Text style={styles.statLine}>👗 {stats?.totalItems || 0} Total Items</Text>
                <Text style={styles.statLine}>💰 {stats?.forSaleCount || 0} Listed for Sale</Text>
                <Text style={styles.statLine}>
                  {stats?.topCategory?.key ? `🏆 Top: ${stats.topCategory.key}` : "📉 No Data"}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.miniNote}>
            {stats?.totalItems > 0 ? "Your closet is active. Keep styling!" : "Add items to unlock insights."}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resaleWidget} onPress={() => router.push("/my-closet")} activeOpacity={0.9}>
          <View style={styles.dashHeader}>
            <Text style={styles.dashTitle}>Resale Hot Picks</Text>
            <Text style={styles.dashLink}>View in My Closet →</Text>
          </View>

          {loadingResale ? (
            <ActivityIndicator color="#ffcc66" style={{ marginTop: 10 }} />
          ) : topItems.length === 0 ? (
            <Text style={styles.miniNote}>
              No items to suggest right now (maybe everything is already listed).
            </Text>
          ) : (
            <>
              <Text style={styles.resaleMsg}>
                These items have the highest demand — list them now inside the app.
              </Text>

              {topItems.map((it: any) => (
                <View key={it.id} style={styles.resaleRow}>
                  <Image source={{ uri: imgUrl(it.image_url) }} style={styles.resaleImg} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resaleTitle}>
                      {it.category || "Item"} • {it.color || "Color"}
                    </Text>
                    <Text style={styles.resaleSub}>Demand Score: {it.demandScore || 0}/100</Text>
                    <Text style={styles.resaleSub}>{it.demandMessage}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.timingCard} onPress={() => router.push("/resale-timing")} activeOpacity={0.9}>
          <View style={styles.timingHeader}>
            <Text style={styles.timingTitle}>⏳ Best Time To Sell</Text>
            <Text style={styles.timingLink}>View All →</Text>
          </View>

          {timingLoading ? (
            <ActivityIndicator color="#E0B0FF" style={{ marginTop: 8 }} />
          ) : !timingTop ? (
            <Text style={styles.timingMuted}>No timing suggestions yet.</Text>
          ) : (
            <>
              <Text style={styles.timingMain}>
                {timingTop.timing === "SELL_NOW"
                  ? "🔥 Sell now"
                  : timingTop.timing === "SELL_SOON"
                  ? "✨ Sell soon"
                  : "⏸️ Wait"}
                : {timingTop.category}
                {timingTop.color ? ` • ${timingTop.color}` : ""}
              </Text>
              <Text style={styles.timingMuted}>{timingTop.reason}</Text>
              <Text style={styles.timingSmall}>Best window: {timingTop.bestWindow}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

/** ✅ Drawer item component */
function DrawerItem({
  label,
  emoji,
  onPress,
  danger,
  active,
}: {
  label: string;
  emoji: string;
  onPress: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.drawerItem,
        active ? styles.drawerItemActive : null,
        pressed ? styles.drawerItemPressed : null,
      ]}
    >
      <Text style={styles.drawerEmoji}>{emoji}</Text>

      <Text
        style={[
          styles.drawerLabel,
          active ? styles.drawerLabelActive : null,
          danger ? { color: "#ff5252" } : null,
        ]}
      >
        {label}
      </Text>

      {active ? <View style={styles.activePill} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },

  // ✅ TOP BAR
  header: {
    height: 56,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E6E6E6",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: { fontSize: 20, color: "#111" },
  brand: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#111",
  },
  unreadDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "red",
  },

  // ✅ Drawer overlay + panel
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 10,
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_W,
    backgroundColor: "#fff",
    zIndex: 11,
    borderRightWidth: 1,
    borderRightColor: "#E6E6E6",
  },
  drawerHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  drawerTitle: { fontSize: 18, fontWeight: "800", color: "#111" },
  drawerSub: { marginTop: 4, color: "#666", fontSize: 12 },
  drawerList: { padding: 10 },

  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    position: "relative",
  },
  drawerEmoji: { fontSize: 18 },

  drawerItemPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.92,
  },
  drawerItemActive: {
    backgroundColor: "#F3F4F6",
  },

  drawerLabel: {
    fontSize: 14,
    color: "#111",
    fontWeight: "600",
  },
  drawerLabelActive: {
    color: "#111",
    fontWeight: "800",
  },
  activePill: {
    position: "absolute",
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#111",
    opacity: 0.9,
  },

  drawerDivider: {
    height: 1,
    backgroundColor: "#EEE",
    marginVertical: 10,
    marginHorizontal: 6,
  },

  // ✅ MAIN CONTENT
  container: { padding: 16, paddingBottom: 120 },

  /* ===== HERO (REFERENCE STYLE) ===== */
  heroContainer: {
    height: 300,
    width: "100%",
    marginBottom: 14,
    borderRadius: 18,
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
    justifyContent: "flex-end",
  },
  heroImgStyle: { resizeMode: "cover" },
  heroGradient: { ...StyleSheet.absoluteFillObject },
  heroOverlay: { padding: 18, paddingBottom: 16 },

  heroTag: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    letterSpacing: 1.4,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 20,
    lineHeight: 20,
    fontFamily: "PlayfairDisplay_700Bold",
    marginBottom: 8,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    marginBottom: 15,
  },
  heroButtons: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 5,
  },
  heroBtnPrimary: {
    backgroundColor: "rgba(15,15,20,0.92)",
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBtnTextPrimary: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  heroBtnSecondary: {
    borderWidth: 1,
    borderColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 30,
  },
  heroBtnTextSecondary: {
    color: "#fff",
    fontWeight: "600",
  },

  // ✅ YOUR WARDROBE (same design, just responsive width so it doesn't zoom)
  wardrobeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 5,
    marginBottom: 10,
  },
  wardrobeTitle: {
    fontSize: 25,
    color: "#111",
    fontFamily: "Poppins_700Bold",
  },
  viewAll: {
    color: "#777",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  wardrobeList: {
    paddingRight: 0,
    paddingBottom: 8,
  },

  trapOuter: {
    width: CARD_W,
    marginRight: CARD_GAP,
  },

  trapShell: {
    backgroundColor: "#ffffff",
    borderRadius: 34,
    padding: 9,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },

  trapContent: {
    alignItems: "center",
  },

  trapImgBox: {
    width: "100%",
    height: 120,
    borderRadius: 28,
    backgroundColor: "#D9D9D9",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 12,
  },
  trapImg: {
    width: "86%",
    height: "86%",
  },

  trapName: {
    fontSize: 17,
    color: "#111",
    marginBottom: 3,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },

  trapResellBtn: {
    backgroundColor: "#111",
    paddingHorizontal: 19,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  trapResellText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    fontSize: 9,
  },

  // Rest (your existing)
  greeting: { color: "#3b3b3b", fontSize: 26, fontWeight: "bold", marginTop: 10 },
  sub: { color: "#888", marginBottom: 20 },

  dashboardWidget: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  resaleWidget: {
    backgroundColor: "#151515",
    borderRadius: 16,
    padding: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#333",
  },
  dashHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dashTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  dashLink: { color: "#E0B0FF", fontSize: 12, fontWeight: "bold" },

  dashRow: { flexDirection: "row", alignItems: "center" },
  scoreBox: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 20,
  },
  scoreNum: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  scoreLabel: { color: "#888", fontSize: 10 },

  statsCol: { flex: 1 },
  statLine: { color: "#ccc", fontSize: 14, marginBottom: 4 },

  divider: {
    height: 1,
    backgroundColor: "#222",
    marginTop: 16,
    marginBottom: 12,
  },

  miniNote: { color: "#aaa", fontStyle: "italic" },
  resaleMsg: { color: "#ddd", marginBottom: 12 },

  resaleRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  resaleImg: { width: 64, height: 64, borderRadius: 10, backgroundColor: "#222" },
  resaleTitle: { color: "#fff", fontWeight: "bold" },
  resaleSub: { color: "#aaa", fontSize: 12, marginTop: 2 },

  timingCard: {
    width: "100%",
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#333",
  },
  timingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  timingTitle: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  timingLink: { color: "#E0B0FF", fontSize: 12, fontWeight: "bold" },
  timingMain: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 6,
    flexShrink: 1,
  },
  timingMuted: { color: "#aaa", flexShrink: 1 },
  timingSmall: { color: "#888", marginTop: 8, fontSize: 12 },
});
