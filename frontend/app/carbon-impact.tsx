// frontend/app/carbon-impact.tsx

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
import { getSustainabilityReport } from "../services/api";
import { Ionicons } from "@expo/vector-icons";

// ✅ BRUTALIST ECO-PALETTE
const COLORS = {
  bg: "#FFFFFF",
  primary: "#000000",
  secondary: "#666666",
  border: "#E2E8F0",
  white: "#FFFFFF",
  
  // Brutalist Eco Greens
  ecoDark: "#064E3B",   // Deep, serious green for the hero block
  ecoNeon: "#34D399",   // High-contrast green for data points
  ecoLight: "#F0FDF4",  // Very subtle green for backgrounds
};

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
        setReport(null);
      } else {
        setReport(data);
      }

      setLoading(false);
    } catch (e) {
      setError("Failed to load sustainability report.");
      setReport(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const breakdownKeys = report?.breakdown ? Object.keys(report.breakdown) : [];
  const treesPlanted = (safeNum(report?.savings?.co2Kg) / 20).toFixed(1);

  const tipsArray: string[] = Array.isArray(report?.tips) ? report.tips : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* 🌟 BRUTALIST EDITORIAL HEADER */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          {/* <Text style={styles.headerMono}>// DOC: ENV-AUDIT</Text> */}
          <Text style={styles.headerTitle}>ECO IMPACT</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>COMPILING AUDIT...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>RETRY</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          {/* ✅ GREEN HERO CARD (BRUTALIST REDESIGN) */}
          <View style={styles.heroCard}>
            <View style={styles.heroHeaderRow}>
              <Text style={styles.heroLabel}>TOTAL CARBON SAVED</Text>
              <Ionicons name="earth" size={20} color={COLORS.ecoNeon} />
            </View>
            
            <Text style={styles.heroValue}>
              {safeNum(report?.savings?.co2Kg).toFixed(1)} <Text style={styles.heroUnit}>KG</Text>
            </Text>
            <Text style={styles.heroSub}>VIA CIRCULAR FASHION & RESALE.</Text>

            <View style={styles.treeBadge}>
              <Ionicons name="leaf" size={14} color={COLORS.primary} />
              <Text style={styles.treeText}>EQUIVALENT: {treesPlanted} TREES PLANTED</Text>
            </View>
          </View>

          {/* 💧 WATER & TOP IMPACT ROW */}
          <View style={styles.row}>
            <View style={styles.statCard}>
              <Ionicons name="water-outline" size={24} color={COLORS.primary} style={styles.statIcon} />
              <Text style={styles.statVal}>{Math.round(safeNum(report?.savings?.waterLiters))}</Text>
              <Text style={styles.statLabel}>LITERS WATER SAVED</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="analytics-outline" size={24} color={COLORS.primary} style={styles.statIcon} />
              <Text style={styles.statVal} numberOfLines={1} adjustsFontSizeToFit>
                {report?.topImpactCategory?.key || "N/A"}
              </Text>
              <Text style={styles.statLabel}>HIGHEST IMPACT</Text>
            </View>
          </View>

          {/* 👣 WARDROBE FOOTPRINT */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>WARDROBE FOOTPRINT</Text>
              <Text style={styles.sectionSub}>ESTIMATED ENVIRONMENTAL COST OF CURRENT INVENTORY.</Text>
            </View>

            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>TOTAL CO₂ LOAD</Text>
              <Text style={styles.dataVal}>{safeNum(report?.wardrobeFootprint?.co2Kg).toFixed(1)} KG</Text>
            </View>

            <View style={[styles.dataRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.dataLabel}>TOTAL WATER LOAD</Text>
              <Text style={styles.dataVal}>{Math.round(safeNum(report?.wardrobeFootprint?.waterLiters))} L</Text>
            </View>
          </View>

          {/* 📊 CATEGORY BREAKDOWN */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>IMPACT BREAKDOWN</Text>
            </View>

            {breakdownKeys.length === 0 ? (
              <Text style={styles.mutedText}>NO INVENTORY SCANNED YET.</Text>
            ) : (
              breakdownKeys.map((k, i) => {
                // ✅ FIX: safe fallback (prevents crash)
                const b = report?.breakdown?.[k] || {};
                const count = safeNum(b.count, 0);
                const co2 = safeNum(b.co2, 0);

                return (
                  <View key={k} style={[styles.dataRow, i === breakdownKeys.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.breakdownLeft}>
                      <Ionicons name="pricetag-outline" size={14} color={COLORS.primary} style={{ marginRight: 8 }} />
                      <Text style={styles.dataLabel}>
                        {k.toUpperCase()}{" "}
                        <Text style={styles.dataCount}>({count})</Text>
                      </Text>
                    </View>
                    <Text style={styles.dataVal}>{co2.toFixed(1)} KG</Text>
                  </View>
                );
              })
            )}
          </View>

          {/* 💡 SMART TIPS (Advisory Note Style) */}
          <View style={styles.tipBox}>
            <View style={styles.tipHeader}>
              <Ionicons name="information-circle" size={18} color={COLORS.primary} />
              <Text style={styles.tipTitle}>SUSTAINABILITY ADVISORY</Text>
            </View>

            <Text style={styles.tipText}>
              {tipsArray.length > 0
                ? tipsArray[0].toUpperCase()
                : "EXTENDING THE LIFE OF CLOTHES BY JUST 9 MONTHS REDUCES CARBON, WASTE, AND WATER FOOTPRINTS BY 20-30%."}
            </Text>
          </View>

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
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    marginBottom: 20,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerMono: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 9,
    color: COLORS.secondary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: 1.5,
  },
  backBtn: { padding: 4, marginLeft: -4 },

  // State Views
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: COLORS.primary, marginTop: 16, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  errorText: { color: COLORS.primary, marginBottom: 16, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  retryBtn: { borderWidth: 2, borderColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: COLORS.primary, fontWeight: "900", letterSpacing: 1 },

  scrollContainer: { paddingHorizontal: 20, paddingBottom: 40 },

  // ✅ GREEN HERO CARD (BRUTALIST STYLE)
  heroCard: {
    backgroundColor: COLORS.ecoDark,
    borderRadius: 0, // Sharp edges
    padding: 24,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroLabel: { 
    color: COLORS.ecoNeon, 
    fontSize: 10, 
    fontWeight: "900", 
    letterSpacing: 2, 
  },
  heroValue: { 
    color: COLORS.white, 
    fontSize: 64, 
    fontFamily: 'IntegralCF-Bold',
    lineHeight: 68,
    letterSpacing: -2,
    marginBottom: 4,
  },
  heroUnit: {
    fontSize: 24,
    letterSpacing: 0,
  },
  heroSub: { 
    color: COLORS.border, 
    fontSize: 10, 
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 24,
  },
  treeBadge: {
    backgroundColor: COLORS.ecoNeon,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 8,
  },
  treeText: { 
    color: COLORS.primary, 
    fontWeight: "900", 
    fontSize: 10, 
    letterSpacing: 1 
  },

  // Stats Row
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  statCard: {
    width: "48%",
    backgroundColor: COLORS.white,
    borderRadius: 0,
    padding: 20,
    alignItems: "flex-start",
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  statIcon: {
    marginBottom: 12,
  },
  statVal: { 
    color: COLORS.primary, 
    fontSize: 24, 
    fontFamily: 'IntegralCF-Bold',
  },
  statLabel: { 
    color: COLORS.secondary, 
    fontSize: 9, 
    marginTop: 6, 
    fontWeight: "800",
    letterSpacing: 1,
  },

  // Sections (Data Ledgers)
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 0,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  sectionHeader: { 
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingBottom: 12,
  },
  sectionTitle: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  sectionSub: { 
    color: COLORS.secondary, 
    fontSize: 9, 
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dataLabel: { 
    color: COLORS.primary, 
    fontSize: 11, 
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  dataVal: { 
    color: COLORS.primary, 
    fontWeight: "900", 
    fontSize: 13,
  },

  // Breakdown Specific
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dataCount: {
    color: COLORS.secondary,
    fontWeight: '600',
  },
  mutedText: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Tip Box (Advisory Note)
  tipBox: {
    backgroundColor: COLORS.ecoLight,
    borderRadius: 0,
    padding: 20,
    borderWidth: 2,
    borderColor: COLORS.ecoDark,
    marginBottom: 20,
  },
  tipHeader: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 12, 
    gap: 8 
  },
  tipTitle: { 
    color: COLORS.primary, 
    fontWeight: "900", 
    fontSize: 12,
    letterSpacing: 1.5,
  },
  tipText: { 
    color: COLORS.ecoDark, 
    lineHeight: 20, 
    fontSize: 11, 
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});