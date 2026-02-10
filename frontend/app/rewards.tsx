import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getRewardsProfile, getRewardsHistory } from "./services/api";

const nice = (t: string) => {
  if (t === "LISTED") return "Listed an item";
  if (t === "SOLD") return "Sold an item";
  if (t === "BOUGHT") return "Bought second-hand";
  if (t === "CO2_SAVED") return "CO₂ saved";
  return t;
};

export default function RewardsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
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

      const p = await getRewardsProfile(userId);
      const h = await getRewardsHistory(userId, 60);

      if (p?.error) {
        setError(p.error);
        setLoading(false);
        return;
      }

      setProfile(p?.profile || null);
      setHistory(Array.isArray(h?.items) ? h.items : []);
      setLoading(false);
    } catch (e) {
      setError("Failed to load rewards");
      setLoading(false);
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
        <Text style={styles.title}>Rewards</Text>
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
            <Text style={styles.cardTitle}>Points Balance</Text>
            <Text style={styles.big}>{profile?.points_balance ?? 0}</Text>
            <Text style={styles.muted}>Earn points by listing, selling, and buying second-hand.</Text>

            <TouchableOpacity style={styles.cta} onPress={() => router.push("/my-closet")}>
              <Text style={styles.ctaText}>List more items</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Activity</Text>
            {history.length === 0 ? (
              <Text style={styles.muted}>No activity yet.</Text>
            ) : (
              history.map((e, i) => (
                <View key={i} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{nice(e.event_type)}</Text>
                    <Text style={styles.rowSub}>
                      +{e.points_delta} pts • +{e.score_delta} score
                      {Number(e.co2_delta_kg) > 0 ? ` • +${Number(e.co2_delta_kg).toFixed(1)}kg CO₂` : ""}
                    </Text>
                  </View>
                  <Text style={styles.rowTime}>{new Date(e.created_at).toLocaleDateString()}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Redeem (next)</Text>
            <Text style={styles.muted}>
              Next we can add: “boost listing”, “featured 24h”, “free fee once”, etc.
            </Text>
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

  cta: { backgroundColor: "#fff", paddingVertical: 10, borderRadius: 12, alignItems: "center", marginTop: 14 },
  ctaText: { color: "#000", fontWeight: "bold" },

  row: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#222" },
  rowTitle: { color: "#fff", fontWeight: "bold" },
  rowSub: { color: "#aaa", marginTop: 4, fontSize: 12 },
  rowTime: { color: "#777", fontSize: 11 },
});
