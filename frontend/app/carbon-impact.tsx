import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSustainabilityReport } from "./services/api";

const safeNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export default function CarbonImpactScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const userId = await AsyncStorage.getItem("userId");
      if (!userId) {
        setError("Please login again.");
        setLoading(false);
        return;
      }

      const data = await getSustainabilityReport(userId);
      if (data?.error) {
        setError(data.error);
      } else {
        setReport(data);
      }
      setLoading(false);
    } catch (e) {
      setError("Failed to load sustainability report.");
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const breakdownKeys = report?.breakdown ? Object.keys(report.breakdown) : [];

  // 🌳 Calculation: 1 Tree absorbs ~20kg CO2 per year
  const treesPlanted = (safeNum(report?.savings?.co2Kg) / 20).toFixed(1);

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Eco Impact 🌱</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.muted}>Calculating your impact...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}>
          
          {/* 🌟 HERO CARD: POSITIVE IMPACT */}
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>TOTAL CARBON SAVED</Text>
            <Text style={styles.heroValue}>
              {safeNum(report?.savings?.co2Kg).toFixed(1)} <Text style={{fontSize: 24}}>kg</Text>
            </Text>
            <Text style={styles.heroSub}>Through circular fashion & resale.</Text>

            {/* Tree Badge */}
            <View style={styles.treeBadge}>
                <Text style={styles.treeText}>🌳 Equals {treesPlanted} Trees Planted</Text>
            </View>
          </View>

          {/* 💧 WATER & TOP IMPACT ROW */}
          <View style={styles.row}>
            <View style={styles.statCard}>
                <Text style={styles.statIcon}>💧</Text>
                <Text style={styles.statVal}>{Math.round(safeNum(report?.savings?.waterLiters))}</Text>
                <Text style={styles.statLabel}>Liters Water Saved</Text>
            </View>
            <View style={styles.statCard}>
                <Text style={styles.statIcon}>🏆</Text>
                <Text style={styles.statVal} numberOfLines={1} adjustsFontSizeToFit>
                   {report?.topImpactCategory?.key || "N/A"}
                </Text>
                <Text style={styles.statLabel}>Highest Impact</Text>
            </View>
          </View>

          {/* 👣 WARDROBE FOOTPRINT */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Wardrobe Footprint 👣</Text>
                <Text style={styles.sectionSub}>Estimated cost of items you own.</Text>
            </View>

            <View style={styles.footprintRow}>
                <Text style={styles.fpLabel}>Total CO₂ Load</Text>
                <Text style={styles.fpVal}>{safeNum(report?.wardrobeFootprint?.co2Kg).toFixed(1)} kg</Text>
            </View>
            <View style={[styles.footprintRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.fpLabel}>Total Water Load</Text>
                <Text style={styles.fpVal}>{Math.round(safeNum(report?.wardrobeFootprint?.waterLiters))} L</Text>
            </View>
          </View>

          {/* 📊 CATEGORY BREAKDOWN */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Impact Breakdown</Text>
            {breakdownKeys.length === 0 ? (
              <Text style={styles.muted}>No items scanned yet.</Text>
            ) : (
              breakdownKeys.map((k, i) => {
                const b = report.breakdown[k];
                return (
                  <View key={k} style={[styles.line, i === breakdownKeys.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.left}>{k} <Text style={{color:'#666'}}>({b.count})</Text></Text>
                    </View>
                    <Text style={styles.right}>{Number(b.co2).toFixed(1)} kg</Text>
                  </View>
                );
              })
            )}
          </View>

          {/* 💡 SMART TIPS */}
          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>💡 AI Sustainability Tip</Text>
            <Text style={styles.tipText}>
                {(report?.tips && report.tips.length > 0) 
                    ? report.tips[0] 
                    : "Extending the life of clothes by just 9 months reduces carbon, waste, and water footprints by 20-30%."}
            </Text>
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    marginBottom: 10,
  },
  back: { color: "#888", fontSize: 16 },
  title: { color: "#4CAF50", fontSize: 18, fontWeight: "bold" },

  // States
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#666", marginTop: 10, fontStyle: "italic" },
  error: { color: "#ff6666", fontSize: 16, marginBottom: 12 },
  retryBtn: { backgroundColor: "#fff", padding: 12, borderRadius: 8 },
  retryText: { fontWeight: "bold" },

  // 🌟 Hero Card (Green)
  heroCard: {
    backgroundColor: "#1B5E20", // Deep Green
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#2E7D32",
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  heroLabel: { color: "#81C784", fontSize: 12, fontWeight: "bold", letterSpacing: 1, marginBottom: 8 },
  heroValue: { color: "#fff", fontSize: 42, fontWeight: "bold" },
  heroSub: { color: "#C8E6C9", fontSize: 14, marginBottom: 16 },
  
  treeBadge: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  treeText: { color: "#1B5E20", fontWeight: "bold", fontSize: 14 },

  // 💧 Stats Row
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  statCard: {
    width: "48%",
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  statIcon: { fontSize: 28, marginBottom: 8 },
  statVal: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  statLabel: { color: "#888", fontSize: 12, marginTop: 4 },

  // Sections
  section: {
    backgroundColor: "#111",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#222",
  },
  sectionHeader: { marginBottom: 15 },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  sectionSub: { color: "#666", fontSize: 12 },

  // Rows inside sections
  footprintRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  fpLabel: { color: "#ccc", fontSize: 15 },
  fpVal: { color: "#fff", fontWeight: "bold", fontSize: 15 },

  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  bullet: { color: "#4CAF50", marginRight: 8, fontSize: 16 },
  left: { color: "#ddd", fontSize: 15 },
  right: { color: "#fff", fontWeight: "bold", fontSize: 15 },

  // 💡 Tip Box
  tipBox: {
    backgroundColor: "#263238", // Dark Blue-Grey
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#4FC3F7",
  },
  tipTitle: { color: "#4FC3F7", fontWeight: "bold", marginBottom: 8, fontSize: 16 },
  tipText: { color: "#E0F7FA", lineHeight: 22, fontSize: 14 },
});