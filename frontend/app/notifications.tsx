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
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "./services/api";

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

      // ✅ Navigate based on type
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Notifications</Text>

        <TouchableOpacity onPress={markAll}>
          <Text style={styles.markAll}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.muted}>Loading…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.err}>{error}</Text>
          <TouchableOpacity style={styles.btn} onPress={load}>
            <Text style={styles.btnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>No notifications yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          {items.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[styles.card, !n.is_read && styles.unread]}
              activeOpacity={0.9}
              onPress={() => openNotif(n)}
            >
              <View style={styles.row}>
                <Text style={styles.cardTitle}>{n.title}</Text>
                {!n.is_read && <Text style={styles.dot}>●</Text>}
              </View>
              <Text style={styles.cardBody}>{n.body}</Text>
              <Text style={styles.time}>
                {new Date(n.created_at).toLocaleString()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  back: { color: "#888", fontSize: 18 },
  title: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  markAll: { color: "#E0B0FF", fontWeight: "bold", fontSize: 12 },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  muted: { color: "#aaa", marginTop: 10 },
  err: { color: "red", marginBottom: 12 },

  btn: { backgroundColor: "#fff", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: "#000", fontWeight: "bold" },

  card: {
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  unread: {
    borderColor: "#E0B0FF",
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  dot: { color: "#E0B0FF", fontSize: 14 },
  cardBody: { color: "#bbb", marginTop: 8 },
  time: { color: "#777", marginTop: 10, fontSize: 11 },
});
