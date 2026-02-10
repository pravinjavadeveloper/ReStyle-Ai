// frontend/app/home.tsx
import React, { useState, useCallback, useEffect } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getWardrobeAnalytics,
  getResaleDemand,
  getResaleTiming,
  getNotifications, // ✅ needed for unread dot count
} from "./services/api";
import { openTailorsNearMe, openAmbassadorEmail } from "./services/externalLinks";

import {
  configureNotificationHandler,
  setupPushOrWebNotifications,
  startNotificationPolling,
} from "./services/push";

// ✅ helper to convert "uploads/..." to full URL in web/android emulator
const API_URL =
  Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const imgUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL}/${path.replace(/\\/g, "/")}`;
};

export default function HomeScreen() {
  const router = useRouter();

  // ✅ NEW: show username in greeting
  const [userName, setUserName] = useState("Fashionista");

  // ✅ NEW: unread notifications count for red dot
  const [unreadCount, setUnreadCount] = useState(0);

  // ✅ NEW: pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);

  // Wardrobe overview stats
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Resale demand widget
  const [resale, setResale] = useState<any>(null);
  const [loadingResale, setLoadingResale] = useState(true);

  // Timing widget
  const [timingLoading, setTimingLoading] = useState(true);
  const [timingTop, setTimingTop] = useState<any>(null);

  // ✅ Load username once
  useEffect(() => {
    (async () => {
      const n = await AsyncStorage.getItem("userName");
      if (n) setUserName(n);
    })();
  }, []);

  // ✅ Function: fetch unread count (for dot)
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
    } catch (e) {
      // silent
    }
  }, []);

  // ✅ Setup push + popup polling + unread polling
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

      // ✅ Popup polling (shows alert + marks read)
      stopPopupPolling = startNotificationPolling(userId, 5000);

      // ✅ Count polling (updates dot only, no popup)
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
        } catch (e) {
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
      refreshUnreadCount(); // ✅ also update dot on focus
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

    // 1) Wardrobe analytics
    const analytics = await getWardrobeAnalytics(userId);
    if (analytics && !analytics.error) {
      setStats(analytics);
    }
    setLoadingStats(false);

    // 2) Resale demand
    const demand = await getResaleDemand(userId);
    if (demand && !demand.error) {
      setResale(demand);
    }
    setLoadingResale(false);
  };

  // ✅ Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadHomeData(), refreshUnreadCount()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshUnreadCount]);

  const handleLogout = async () => {
    await AsyncStorage.clear();
    Alert.alert("Logged out", "You have been logged out.");
    router.replace("/");
  };

  const topItems = Array.isArray(resale?.topItems) ? resale.topItems : [];

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Home</Text>

        <View style={{ flexDirection: "row", gap: 12 }}>
          {/* 🔔 Notifications */}
          <TouchableOpacity
            onPress={() => router.push("/notifications")}
            style={styles.bellBtn}
          >
            <Text style={styles.bellIcon}>🔔</Text>

            {/* ✅ REAL unread dot */}
            {unreadCount > 0 && <View style={styles.unreadDot} />}
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
      >
        {/* ✅ USERNAME GREETING */}
        <Text style={styles.greeting}>Hello, {userName}! 👋</Text>
        <Text style={styles.sub}>Your Closet Pulse.</Text>

        {/* WARDROBE OVERVIEW WIDGET */}
        <TouchableOpacity
          style={styles.dashboardWidget}
          onPress={() => router.push("/wardrobe-analytics")}
          activeOpacity={0.9}
        >
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
                <Text style={styles.statLine}>
                  👗 {stats?.totalItems || 0} Total Items
                </Text>
                <Text style={styles.statLine}>
                  💰 {stats?.forSaleCount || 0} Listed for Sale
                </Text>
                <Text style={styles.statLine}>
                  {stats?.topCategory?.key
                    ? `🏆 Top: ${stats.topCategory.key}`
                    : "📉 No Data"}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.miniNote}>
            {stats?.totalItems > 0
              ? "Your closet is active. Keep styling!"
              : "Add items to unlock insights."}
          </Text>
        </TouchableOpacity>

        {/* RESALE DEMAND WIDGET */}
        <TouchableOpacity
          style={styles.resaleWidget}
          onPress={() => router.push("/my-closet")}
          activeOpacity={0.9}
        >
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
                These items have the highest demand — list them now inside the
                app.
              </Text>

              {topItems.map((it: any) => (
                <View key={it.id} style={styles.resaleRow}>
                  <Image source={{ uri: imgUrl(it.image_url) }} style={styles.resaleImg} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resaleTitle}>
                      {it.category || "Item"} • {it.color || "Color"}
                    </Text>
                    <Text style={styles.resaleSub}>
                      Demand Score: {it.demandScore || 0}/100
                    </Text>
                    <Text style={styles.resaleSub}>{it.demandMessage}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </TouchableOpacity>

        {/* GRID NAV */}
        <View style={styles.grid}>
          <TouchableOpacity style={styles.card} onPress={() => router.push("/add-item")}>
            <Text style={styles.icon}>➕</Text>
            <Text style={styles.cardTitle}>Add Item</Text>
            <Text style={styles.cardSub}>Upload to Closet</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => router.push("/my-closet")}>
            <Text style={styles.icon}>👗</Text>
            <Text style={styles.cardTitle}>My Closet</Text>
            <Text style={styles.cardSub}>View All Items</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.card, styles.fullCard]} onPress={() => router.push("/recommend")}>
            <Text style={styles.icon}>✨</Text>
            <Text style={styles.cardTitle}>Complete The Look</Text>
            <Text style={styles.cardSub}>AI styling suggestions</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => router.push("/marketplace")}>
            <Text style={styles.icon}>🛍️</Text>
            <Text style={styles.cardTitle}>Marketplace</Text>
            <Text style={styles.cardSub}>Buy Pre-loved</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => router.push("/my-orders")}>
            <Text style={styles.icon}>📦</Text>
            <Text style={styles.cardTitle}>My Orders</Text>
            <Text style={styles.cardSub}>Bought & Sold</Text>
          </TouchableOpacity>

          {/* CARBON IMPACT BUTTON */}
          <TouchableOpacity
            style={[styles.card, styles.fullCard, { borderColor: "#2E7D32" }]}
            onPress={() => router.push("/carbon-impact")}
          >
            <Text style={styles.icon}>🌍</Text>
            <Text style={styles.cardTitle}>My Eco Impact</Text>
            <Text style={styles.cardSub}>Track your carbon footprint</Text>
          </TouchableOpacity>

          {/* TIMING CARD */}
          <TouchableOpacity
            style={styles.timingCard}
            onPress={() => router.push("/resale-timing")}
            activeOpacity={0.9}
          >
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

          <TouchableOpacity
            style={[styles.card, styles.fullCard, { borderColor: "#E0B0FF" }]}
            onPress={() => router.push("/circular-score")}
          >
            <Text style={styles.icon}>⭐</Text>
            <Text style={styles.cardTitle}>Circular Score</Text>
            <Text style={styles.cardSub}>Points + badges + eco progress</Text>
          </TouchableOpacity>


{/* ✅ Local Tailors & Repair Directory */}
<TouchableOpacity
  style={[styles.card, styles.fullCard, { borderColor: "#4CAF50" }]}
  onPress={openTailorsNearMe}
>
  <Text style={styles.icon}>🧵</Text>
  <Text style={styles.cardTitle}>Care to Wear</Text>
  <Text style={styles.cardSub}>Open map and find local tailors & repair shops</Text>
</TouchableOpacity>

{/* ✅ Sustainable Fashion Ambassadors */}
<TouchableOpacity
  style={[styles.card, styles.fullCard, { borderColor: "#D4AF37" }]}
  onPress={() => router.push("/ambassador")}
>
  <Text style={styles.icon}>📣</Text>
  <Text style={styles.cardTitle}>Be an Ambassador</Text>
  <Text style={styles.cardSub}>Apply via email (resume + contact info)</Text>
</TouchableOpacity>



        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },

  header: {
    height: 56,
    backgroundColor: "#000",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ff4444",
  },
  logoutText: { color: "#ff4444", fontSize: 13, fontWeight: "bold" },

  container: { padding: 16, paddingBottom: 120 },

  greeting: { color: "#fff", fontSize: 26, fontWeight: "bold", marginTop: 10 },
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

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },

  card: {
    width: "48%",
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  fullCard: { width: "100%" },
  icon: { fontSize: 26, marginBottom: 10 },
  cardTitle: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  cardSub: { color: "#888", fontSize: 12, marginTop: 4, textAlign: "center" },

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

  bellBtn: {
    position: "relative",
    padding: 6,
  },
  bellIcon: {
    fontSize: 20,
  },
  unreadDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "red",
  },
});
