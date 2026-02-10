import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getTodayTrends, markTrendSeen } from "./services/api";

const API_URL = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";
const imgUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL}/${path.replace(/\\/g, "/")}`;
};

function openLink(url?: string) {
  if (!url) return;
  if (Platform.OS === "web") {
    // @ts-ignore
    window.open(url, "_blank");
  } else {
    Linking.openURL(url);
  }
}

export default function TrendsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const userId = await AsyncStorage.getItem("userId");
      const res = await getTodayTrends(userId || undefined);

      if (res?.error) {
        setError(res.error);
        setData(null);
      } else {
        setData(res);
      }
    } catch (e) {
      setError("Failed to load trends");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const items = Array.isArray(data?.items) ? data.items : [];

  const onPressItem = async (it: any) => {
    const userId = await AsyncStorage.getItem("userId");
    if (userId && it?.item_id) {
      await markTrendSeen(userId, it.item_id);
    }
    openLink(it?.product_url);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Today’s Trend Picks</Text>
        <TouchableOpacity onPress={load}>
          <Text style={styles.refresh}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.muted}>Loading today’s picks…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.sub}>
            Updated: {data?.date || "—"} • {items.length} picks
          </Text>

          <FlatList
            data={items}
            numColumns={2}
            keyExtractor={(it, idx) => String(it?.item_id ?? idx)}
            columnWrapperStyle={{ justifyContent: "space-between" }}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => onPressItem(item)}>
                <Image
                  source={{ uri: imgUrl(item.image_url) || "https://via.placeholder.com/300" }}
                  style={styles.img}
                />
                <View style={{ padding: 10 }}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title || "Item"}
                  </Text>
                  <Text style={styles.meta}>
                    {item.price_currency || "GBP"} {Number(item.price_value || 0).toFixed(2)} • {item.source || "source"}
                  </Text>
                  {!!item.eco_badges?.length && (
                    <Text style={styles.badgeText}>♻️ {item.eco_badges.join(", ")}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000", padding: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  back: { color: "#888", fontSize: 18 },
  title: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  refresh: { color: "#E0B0FF", fontWeight: "bold" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#aaa", marginTop: 10 },
  error: { color: "red", marginBottom: 12 },
  retryBtn: { backgroundColor: "#fff", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: "#000", fontWeight: "bold" },

  sub: { color: "#aaa", marginBottom: 12 },

  card: {
    width: "48%",
    backgroundColor: "#141414",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: 14,
    overflow: "hidden",
  },
  img: { width: "100%", height: 170, backgroundColor: "#222" },
  cardTitle: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  meta: { color: "#aaa", fontSize: 12, marginTop: 6 },
  badgeText: { color: "#4CAF50", fontSize: 12, marginTop: 6, fontWeight: "bold" },
});
