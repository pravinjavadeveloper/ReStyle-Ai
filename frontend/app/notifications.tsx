import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "../services/api";
import { Ionicons } from "@expo/vector-icons"; //  Added for premium icons

//  BRUTALIST MONOCHROME PALETTE
const COLORS = {
  bg: "#FFFFFF",
  text: "#000000",
  border: "#E2E8F0",
  muted: "#666666",
  black: "#000000",
  white: "#FFFFFF",
  soft: "#F9F9F9",
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const userId = await AsyncStorage.getItem("userId");
      if (!userId) {
        setError("Not logged in");
        setLoading(false);
        return;
      }

      const data = await getNotifications(userId);
      if (data?.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      setItems(Array.isArray(data?.items) ? data.items : []);
      setLoading(false);
    } catch (e) {
      setError("Failed to load notifications");
      setLoading(false);
    }
  };

  const markAll = async () => {
    const userId = await AsyncStorage.getItem("userId");
    if (!userId) return;
    await markAllNotificationsRead(userId);
    load();
  };

  const openNotif = async (n: any) => {
    try {
      await markNotificationRead(n.id);

      //  Navigate based on type
      if (n.type === "MARKETPLACE_NEW_LISTING") {
        router.push("/marketplace");
        return;
      }

      // fallback
      if (Platform.OS !== "web") {
        // nothing
      }
    } finally {
      load();
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* 🌟 BRUTALIST HEADER */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.backBtn}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>INBOX</Text>
        <Text style={styles.subtitle}>ALERTS & UPDATES</Text>
      </View>

      {/* UTILITY BAR */}
      <View style={styles.utilityBar}>
        <Text style={styles.countText}>
          {items.filter(i => !i.is_read).length} UNREAD
        </Text>
        <TouchableOpacity onPress={markAll} activeOpacity={0.7} style={styles.markAllBtn}>
          <Ionicons name="checkmark-done" size={16} color={COLORS.black} />
          <Text style={styles.markAllText}>MARK ALL READ</Text>
        </TouchableOpacity>
      </View>

      {/* CONTENT */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.black} />
          <Text style={styles.loadingText}>SYNCING LOGS...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.err}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>RETRY</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="mail-open-outline" size={40} color={COLORS.muted} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyText}>NO NEW ALERTS</Text>
          <Text style={styles.emptySubText}>Your inbox is completely clear.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {items.map((n) => {
            const isUnread = !n.is_read;
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.card, isUnread ? styles.cardUnread : styles.cardRead]}
                activeOpacity={0.9}
                onPress={() => openNotif(n)}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, isUnread ? styles.textWhite : styles.textBlack]}>
                    {n.title}
                  </Text>
                  {isUnread && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>NEW</Text>
                    </View>
                  )}
                </View>
                
                <Text style={[styles.cardBody, isUnread ? styles.bodyWhite : styles.bodyMuted]}>
                  {n.body}
                </Text>
                
                <View style={styles.footerRow}>
                  <Text style={[styles.time, isUnread ? styles.timeWhite : styles.timeMuted]}>
                    LOGGED: {new Date(n.created_at).toLocaleString()}
                  </Text>
                  <Ionicons 
                    name="chevron-forward" 
                    size={14} 
                    color={isUnread ? COLORS.white : COLORS.black} 
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: COLORS.bg,
    paddingTop: 16,
  },
  
  // Brutalist Header
  headerContainer: { 
    paddingHorizontal: 20, 
    marginBottom: 16 
  },
  backBtn: { 
    marginBottom: 16, 
    alignSelf: 'flex-start' 
  },
  backButtonText: { 
    color: COLORS.text, 
    fontSize: 14, 
    fontWeight: '600' 
  },
  title: {
    color: COLORS.text,
    fontSize: 32, 
    fontFamily: 'IntegralCF-Bold', 
    textTransform: 'uppercase',
    letterSpacing: 1.5, 
    marginBottom: 4,  
  },
  subtitle: { 
    color: COLORS.text, 
    fontSize: 11, 
    fontWeight: '600', 
    textTransform: 'uppercase',
    letterSpacing: 0.5 
  },

  // Utility Bar (Mark All)
  utilityBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.black,
    marginBottom: 16,
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.black,
    letterSpacing: 1,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  markAllText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.black,
    letterSpacing: 0.5,
  },

  // State Views
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: COLORS.black, marginTop: 16, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  err: { color: COLORS.black, marginBottom: 16, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  retryBtn: { borderWidth: 1, borderColor: COLORS.black, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: COLORS.black, fontWeight: "800", letterSpacing: 1 },

  // Empty State
  emptyContainer: { 
    flex: 1,
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 40,
  },
  emptyText: { 
    color: COLORS.black, 
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptySubText: {
    color: COLORS.muted, 
    fontSize: 12,
    textAlign: 'center',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  //  EDITORIAL NOTIFICATION CARDS
  card: {
    padding: 20,
    marginBottom: 12,
    borderRadius: 0, // Sharp corners
    borderWidth: 1,
  },
  
  // Unread State: Stark Black
  cardUnread: {
    backgroundColor: COLORS.black,
    borderColor: COLORS.black,
  },
  
  // Read State: Stark White
  cardRead: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.black,
  },

  cardHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "flex-start",
    marginBottom: 8,
  },
  cardTitle: { 
    flex: 1,
    fontWeight: "900", 
    fontSize: 14, 
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 10,
  },
  
  newBadge: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  newBadgeText: {
    color: COLORS.black,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  cardBody: { 
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
    fontWeight: '500',
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
    borderColor: 'rgba(128,128,128,0.3)', // Generic border for both themes
  },

  time: { 
    fontSize: 9, 
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Color Modifiers for Read/Unread logic
  textWhite: { color: COLORS.white },
  textBlack: { color: COLORS.black },
  bodyWhite: { color: 'rgba(255,255,255,0.85)' },
  bodyMuted: { color: COLORS.muted },
  timeWhite: { color: 'rgba(255,255,255,0.5)' },
  timeMuted: { color: COLORS.muted },
});