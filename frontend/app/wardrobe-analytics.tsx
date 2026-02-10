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

const API_URL =
  Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const safeText = (v: any) => {
  if (v === null || v === undefined) return "N/A";
  if (typeof v === "object") {
    if ("key" in v && "value" in v) return `${v.key} (${v.value})`;
    return JSON.stringify(v);
  }
  return String(v);
};

export default function WardrobeAnalyticsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const userId = await AsyncStorage.getItem("userId");
      if (!userId) {
        setError("User not logged in");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/analytics/${userId}`);
      const json = await res.json();

      if (!res.ok || json?.error) {
        setError(json?.error || "Analytics failed");
        setLoading(false);
        return;
      }

      setData(json);
      setLoading(false);
    } catch (e) {
      setError("Analytics failed");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const categoryBreakdown = Array.isArray(data?.categoryBreakdown)
    ? data.categoryBreakdown
    : [];

  const colorBreakdown = Array.isArray(data?.colorBreakdown)
    ? data.colorBreakdown
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Wardrobe Analytics</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.muted}>Loading analytics...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchAnalytics}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Wardrobe Health Score</Text>
            <Text style={styles.big}>{safeText(data?.healthScore ?? 0)}</Text>
            <Text style={styles.muted}>
              Total items: {safeText(data?.totalItems ?? 0)}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Category</Text>
            <Text style={styles.lineLeft}>{safeText(data?.topCategory)}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Color</Text>
            <Text style={styles.lineLeft}>{safeText(data?.topColor)}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Category Breakdown</Text>
            {categoryBreakdown.length === 0 ? (
              <Text style={styles.muted}>No data</Text>
            ) : (
              categoryBreakdown.map((c: any, idx: number) => (
                <View key={idx} style={styles.line}>
                  <Text style={styles.lineLeft}>{safeText(c?.key)}</Text>
                  <Text style={styles.lineRight}>{safeText(c?.value)}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Color Breakdown</Text>
            {colorBreakdown.length === 0 ? (
              <Text style={styles.muted}>No data</Text>
            ) : (
              colorBreakdown.map((c: any, idx: number) => (
                <View key={idx} style={styles.line}>
                  <Text style={styles.lineLeft}>{safeText(c?.key)}</Text>
                  <Text style={styles.lineRight}>{safeText(c?.value)}</Text>
                </View>
              ))
            )}
          </View>
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
    marginBottom: 18,
  },
  back: { color: "#888", fontSize: 18 },
  title: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#aaa", marginTop: 10 },
  error: { color: "red", fontSize: 16, marginBottom: 12 },
  retryBtn: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  retryText: { color: "#000", fontWeight: "bold" },
  card: {
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { color: "#fff", fontWeight: "bold", marginBottom: 10 },
  big: { color: "#fff", fontSize: 46, fontWeight: "bold", marginBottom: 6 },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  lineLeft: { color: "#ddd" },
  lineRight: { color: "#fff", fontWeight: "bold" },
});
