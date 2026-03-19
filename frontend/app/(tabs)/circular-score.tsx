// frontend/app/circular-score.tsx

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

// ✅ FIX: correct relative path (this file is inside /app)
import { getRewardsProfile } from "../../services/api";

// ✅ BRUTALIST MONOCHROME PALETTE
const COLORS = {
  bg: "#FFFFFF",
  primary: "#000000",
  secondary: "#666666",
  border: "#E2E8F0",
  white: "#FFFFFF",
  black: "#000000",
};

type RewardsProfile = {
  circular_score?: number;
  points_balance?: number;
  co2_saved_kg?: number;
  items_listed?: number;
  items_sold?: number;
  items_bought?: number;
};

type RewardsResponse = {
  profile?: RewardsProfile;
  tier?: string;
  recommendations?: string[];
  badges?: { badge_code?: string }[];
  error?: string;
};

export default function CircularScoreScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RewardsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const userId = await AsyncStorage.getItem("userId");
      if (!userId) {
        setError("Not logged in");
        setData(null);
        setLoading(false);
        return;
      }

      const res: RewardsResponse = await getRewardsProfile(userId);

      if (res?.error) {
        setError(res.error);
        setData(null);
        setLoading(false);
        return;
      }

      setData(res);
      setLoading(false);
    } catch (e) {
      setError("Failed to load circular score");
      setData(null);
      setLoading(false);
    }
  }, []);

  // ✅ Loads first time
  useEffect(() => {
    load();
  }, [load]);

  // ✅ Also refresh when user comes back to this screen (score changes after selling/buying)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const p = data?.profile || {};
  const tier = (data?.tier || "STARTER").toUpperCase();
  const recs: string[] = Array.isArray(data?.recommendations) ? data!.recommendations! : [];
  const badges = Array.isArray(data?.badges) ? data!.badges! : [];

  const circularScore = Number(p.circular_score ?? 0);
  const pointsBalance = Number(p.points_balance ?? 0);
  const co2Saved = Number(p.co2_saved_kg ?? 0);
  const listed = Number(p.items_listed ?? 0);
  const sold = Number(p.items_sold ?? 0);
  const bought = Number(p.items_bought ?? 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.backBtn}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>CIRCULAR SCORE</Text>
        <Text style={styles.subtitle}>YOUR SUSTAINABILITY RANKING</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.muted}>CALCULATING SCORE...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.8}>
            <Text style={styles.retryText}>RETRY</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* HERO SCORE */}
          <View style={styles.scoreHero}>
            <Text style={styles.heroLabel}>CURRENT RATING</Text>
            
            <Text style={styles.scoreBig}>{Number.isFinite(circularScore) ? circularScore : 0}</Text>
            <View style={styles.tierBox}>
              <Text style={styles.tierText}>TIER: {tier}</Text>
            </View>
          </View>

          {/* METRICS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACTIVITY METRICS</Text>

            <View style={styles.statRow}>
              <View style={styles.statLeft}>
                <Ionicons name="star-outline" size={16} color={COLORS.primary} style={styles.statIcon} />
                <Text style={styles.statLabel}>POINTS BALANCE</Text>
              </View>
              <Text style={styles.statValue}>{Number.isFinite(pointsBalance) ? pointsBalance : 0}</Text>
            </View>

            <View style={styles.statRow}>
              <View style={styles.statLeft}>
                <Ionicons name="leaf-outline" size={16} color={COLORS.primary} style={styles.statIcon} />
                <Text style={styles.statLabel}>CO₂ SAVED</Text>
              </View>
              <Text style={styles.statValue}>{Number.isFinite(co2Saved) ? co2Saved.toFixed(1) : "0.0"} KG</Text>
            </View>

            <View style={styles.statRow}>
              <View style={styles.statLeft}>
                <Ionicons name="pricetag-outline" size={16} color={COLORS.primary} style={styles.statIcon} />
                <Text style={styles.statLabel}>ITEMS LISTED</Text>
              </View>
              <Text style={styles.statValue}>{Number.isFinite(listed) ? listed : 0}</Text>
            </View>

            <View style={styles.statRow}>
              <View style={styles.statLeft}>
                <Ionicons name="checkmark-done-outline" size={16} color={COLORS.primary} style={styles.statIcon} />
                <Text style={styles.statLabel}>ITEMS SOLD</Text>
              </View>
              <Text style={styles.statValue}>{Number.isFinite(sold) ? sold : 0}</Text>
            </View>

            <View style={[styles.statRow, { borderBottomWidth: 0 }]}>
              <View style={styles.statLeft}>
                <Ionicons name="bag-handle-outline" size={16} color={COLORS.primary} style={styles.statIcon} />
                <Text style={styles.statLabel}>SECOND-HAND BUYS</Text>
              </View>
              <Text style={styles.statValue}>{Number.isFinite(bought) ? bought : 0}</Text>
            </View>
          </View>

          {/* IMPROVE */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>HOW TO IMPROVE</Text>

            {recs.length === 0 ? (
              <Text style={styles.mutedText}>Keep buying and reselling to grow your score.</Text>
            ) : (
              recs.map((r, i) => (
                <View key={`${i}-${r}`} style={styles.tipRow}>
                  <Ionicons name="arrow-forward-outline" size={14} color={COLORS.primary} style={{ marginTop: 2 }} />
                  <Text style={styles.tipText}>{r}</Text>
                </View>
              ))
            )}

            <TouchableOpacity style={styles.ctaPrimary} onPress={() => router.push("/my-closet")} activeOpacity={0.9}>
              <Text style={styles.ctaPrimaryText}>GO TO MY CLOSET</Text>
            </TouchableOpacity>
          </View>

          {/* BADGES */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>YOUR BADGES</Text>

            {badges.length === 0 ? (
              <Text style={styles.mutedText}>No badges yet. Your first listing unlocks one.</Text>
            ) : (
              <View style={styles.badgeContainer}>
                {badges.slice(0, 12).map((b, i) => (
                  <View key={`${i}-${b?.badge_code || "badge"}`} style={styles.badgeTag}>
                    <Ionicons name="trophy-outline" size={12} color={COLORS.black} />
                    <Text style={styles.badgeText}>{String(b?.badge_code || "BADGE")}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.ctaSecondary} onPress={() => router.push("/rewards")} activeOpacity={0.9}>
              <Text style={styles.ctaSecondaryText}>VIEW REWARDS</Text>
            </TouchableOpacity>
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

  headerContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  backBtn: {
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    color: COLORS.primary,
    fontSize: 32,
    fontFamily: "IntegralCF-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  subtitle: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: {
    color: COLORS.secondary,
    marginTop: 12,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  error: {
    color: COLORS.primary,
    fontSize: 13,
    marginBottom: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  retryText: { color: COLORS.white, fontWeight: "900", letterSpacing: 1 },

  scrollContainer: { paddingHorizontal: 16, paddingBottom: 40 },

  scoreHero: {
    backgroundColor: COLORS.primary,
    borderRadius: 0,
    padding: 32,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  heroLabel: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 8,
  },
  scoreBig: {
    color: COLORS.white,
    fontSize: 80,
    fontFamily: "IntegralCF-Bold",
    letterSpacing: -2,
    marginBottom: 16,
  },
  tierBox: { borderWidth: 1, borderColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 8 },
  tierText: { color: COLORS.white, fontWeight: "800", fontSize: 12, letterSpacing: 1.5 },

  section: {
    backgroundColor: COLORS.white,
    borderRadius: 0,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 16,
    fontFamily: "IntegralCF-Bold",
    letterSpacing: 1,
  },
  mutedText: { color: COLORS.secondary, fontSize: 13, fontWeight: "500", lineHeight: 20 },

  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statLeft: { flexDirection: "row", alignItems: "center" },
  statIcon: { marginRight: 10 },
  statLabel: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statValue: { color: COLORS.primary, fontSize: 14, fontWeight: "900" },

  // ✅ FIX: no gap
  tipRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  tipText: { color: COLORS.primary, fontSize: 13, lineHeight: 20, fontWeight: "500", flex: 1, marginLeft: 10 },

  // ✅ FIX: no gap
  badgeContainer: { flexDirection: "row", flexWrap: "wrap" },
  badgeTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 0,
    marginRight: 10,
    marginBottom: 10,
  },
  badgeText: {
    color: COLORS.primary,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginLeft: 6,
  },

  ctaPrimary: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 0,
    alignItems: "center",
    marginTop: 20,
  },
  ctaPrimaryText: { color: COLORS.white, fontWeight: "900", fontSize: 12, letterSpacing: 1 },

  ctaSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 0,
    alignItems: "center",
    marginTop: 20,
  },
  ctaSecondaryText: { color: COLORS.primary, fontWeight: "900", fontSize: 12, letterSpacing: 1 },
});
