// frontend/app/resale-timing.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getResaleTiming, generateListingAI, listForResale } from "./services/api";

const SERVER_URL =
  Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const openImageUri = (imgPath: string) => {
  const clean = (imgPath || "").replace(/\\/g, "/");
  return `${SERVER_URL}/${clean}`;
};

const badgeColor = (timing: string) => {
  if (timing === "SELL_NOW") return "#4CAF50";
  if (timing === "SELL_SOON") return "#E0B0FF";
  return "#666";
};

export default function ResaleTimingScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recs, setRecs] = useState<any[]>([]);

  // ✅ per-item loading when auto-listing
  const [sellingId, setSellingId] = useState<string | null>(null);

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

      const data = await getResaleTiming(userId);

      if (data?.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      setRecs(Array.isArray(data?.recommendations) ? data.recommendations : []);
      setLoading(false);
    } catch (e) {
      setError("Failed to load resale timing");
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ✅ SELL NOW/SELL SOON => AI generate => auto list inside app
  const handleSellNow = async (r: any) => {
    try {
      const userId = await AsyncStorage.getItem("userId");
      if (!userId) {
        Alert.alert("Error", "Please login again.");
        return;
      }

      const itemId = String(r.itemId || r.id || "");
      if (!itemId) {
        Alert.alert("Error", "Item id missing");
        return;
      }

      // Only allow for SELL_NOW or SELL_SOON
      if (!(r.timing === "SELL_NOW" || r.timing === "SELL_SOON")) return;

      setSellingId(itemId);

      // 1) Generate listing with AI
      const ai = await generateListingAI(userId, itemId);
      if (ai?.error) {
        Alert.alert("Listing AI failed", ai.error);
        return;
      }

      // 2) Pick final price (middle of range)
      const min = Number(ai.priceMin ?? ai.min ?? 0);
      const max = Number(ai.priceMax ?? ai.max ?? 0);
      let finalPrice = Math.round((min + max) / 2);

      // fallback
      if (!Number.isFinite(finalPrice) || finalPrice <= 0) finalPrice = 15;

      // 3) List inside your app marketplace (existing closet route)
      const result = await listForResale(
        itemId,
        finalPrice,
        "", // size (optional - keep blank)
        "Good", // default condition
        ai.description || ""
      );

      if (result?.error) {
        Alert.alert("Error", result.error);
        return;
      }

      Alert.alert("Listed ✅", `Your item is now listed for $${finalPrice}`);

      // refresh
      load();
    } catch (e) {
      Alert.alert("Error", "Auto-list failed");
    } finally {
      setSellingId(null);
    }
  };

  const badgeLabel = (timing: string) => {
    if (timing === "SELL_NOW") return "SELL NOW";
    if (timing === "SELL_SOON") return "SELL SOON";
    return "WAIT";
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Best Time To Sell</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.muted}>Loading suggestions…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          {recs.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No suggestions right now</Text>
              <Text style={styles.muted}>
                Add more items or keep using the marketplace to generate demand signals.
              </Text>
              <TouchableOpacity
                style={[styles.cta, { marginTop: 14 }]}
                onPress={() => router.push("/my-closet")}
              >
                <Text style={styles.ctaText}>Go to My Closet</Text>
              </TouchableOpacity>
            </View>
          ) : (
            recs.map((r, idx) => {
              const itemId = String(r.itemId || r.id || `${idx}`);
              const isClickable = r.timing === "SELL_NOW" || r.timing === "SELL_SOON";
              const isSelling = sellingId === itemId;

              return (
                <View key={`${itemId}-${idx}`} style={styles.card}>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>
                        {r.category} {r.color ? `• ${r.color}` : ""}
                      </Text>
                      <Text style={styles.muted}>{r.reason}</Text>
                    </View>

                    <TouchableOpacity
                      disabled={!isClickable || isSelling}
                      onPress={() => handleSellNow(r)}
                      style={[
                        styles.badgeBtn,
                        { borderColor: badgeColor(r.timing) },
                        (!isClickable || isSelling) && { opacity: 0.7 },
                      ]}
                      activeOpacity={0.85}
                    >
                      {isSelling ? (
                        <ActivityIndicator size="small" color={badgeColor(r.timing)} />
                      ) : (
                        <Text style={[styles.badgeText, { color: badgeColor(r.timing) }]}>
                          {badgeLabel(r.timing)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.detailRow}>
                    {!!r.image_url && (
                      <Image source={{ uri: openImageUri(r.image_url) }} style={styles.img} />
                    )}

                    <View style={{ flex: 1 }}>
                      <Text style={styles.line}>Best window: {r.bestWindow}</Text>
                      <Text style={styles.line}>
                        Confidence: {Number(r.confidence * 100).toFixed(0)}%
                      </Text>

                      <TouchableOpacity
                        style={[styles.cta, { marginTop: 10 }]}
                        onPress={() => router.push("/my-closet")}
                      >
                        <Text style={styles.ctaText}>Open Closet</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
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

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#aaa", marginTop: 8 },
  error: { color: "red", marginBottom: 12 },

  retry: { backgroundColor: "#fff", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: "#000", fontWeight: "bold" },

  card: {
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { color: "#fff", fontWeight: "bold", fontSize: 16, marginBottom: 6 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  // ✅ clickable badge button (SELL NOW/SELL SOON)
  badgeBtn: {
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 90,
  },
  badgeText: { fontWeight: "bold", fontSize: 12 },

  detailRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },

  line: { color: "#ddd", marginTop: 6 },

  img: { width: 74, height: 74, borderRadius: 12, borderWidth: 1, borderColor: "#333" },

  cta: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  ctaText: { color: "#000", fontWeight: "bold" },
});
