import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getRewardsProfile } from "../services/api";

export default function CircularScoreScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
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
      const res = await getRewardsProfile(userId);
      if (res?.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setData(res);
      setLoading(false);
    } catch (e) {
      setError("Failed to load circular score");
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const p = data?.profile;
  const tier = data?.tier || "Starter";
  const recs: string[] = Array.isArray(data?.recommendations) ? data.recommendations : [];
  const badges: any[] = Array.isArray(data?.badges) ? data.badges : [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Circular Score</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.muted}>Loading…</Text>
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
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Circular Score</Text>
            <Text style={styles.big}>{p?.circular_score ?? 0}</Text>
            <Text style={styles.muted}>Tier: {tier}</Text>

            <View style={styles.hr} />

            <Text style={styles.line}>⭐ Points Balance: {p?.points_balance ?? 0}</Text>
            <Text style={styles.line}>🌍 CO₂ Saved: {Number(p?.co2_saved_kg ?? 0).toFixed(1)} kg</Text>
            <Text style={styles.line}>💰 Items Listed: {p?.items_listed ?? 0}</Text>
            <Text style={styles.line}>✅ Items Sold: {p?.items_sold ?? 0}</Text>
            <Text style={styles.line}>🛍️ Second-hand Buys: {p?.items_bought ?? 0}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>How to improve</Text>
            {recs.length === 0 ? (
              <Text style={styles.muted}>Keep buying/reselling to grow your score.</Text>
            ) : (
              recs.map((r, i) => (
                <Text key={i} style={styles.tip}>• {r}</Text>
              ))
            )}

            <TouchableOpacity style={styles.cta} onPress={() => router.push("/my-closet")}>
              <Text style={styles.ctaText}>Go to My Closet</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Badges</Text>
            {badges.length === 0 ? (
              <Text style={styles.muted}>No badges yet — your first listing unlocks one.</Text>
            ) : (
              badges.slice(0, 12).map((b, i) => (
                <Text key={i} style={styles.badge}>🏅 {b.badge_code}</Text>
              ))
            )}

            <TouchableOpacity style={[styles.cta, { marginTop: 12 }]} onPress={() => router.push("/rewards")}>
              <Text style={styles.ctaText}>View Rewards</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  back: { color: "#888", fontSize: 18 },
  title: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#aaa", marginTop: 8 },
  error: { color: "red", marginBottom: 12 },

  retry: { backgroundColor: "#fff", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: "#000", fontWeight: "bold" },

  card: { backgroundColor: "#141414", borderWidth: 1, borderColor: "#333", borderRadius: 16, padding: 16, marginBottom: 14 },
  cardTitle: { color: "#fff", fontWeight: "bold", fontSize: 16, marginBottom: 8 },
  big: { color: "#fff", fontSize: 52, fontWeight: "bold" },
  hr: { height: 1, backgroundColor: "#222", marginVertical: 12 },
  line: { color: "#ddd", marginTop: 6 },
  tip: { color: "#ddd", marginTop: 8 },
  badge: { color: "#ddd", marginTop: 8 },

  cta: { backgroundColor: "#fff", paddingVertical: 10, borderRadius: 12, alignItems: "center", marginTop: 14 },
  ctaText: { color: "#000", fontWeight: "bold" },
});
