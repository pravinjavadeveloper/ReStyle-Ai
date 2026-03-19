// frontend/app/rewards.tsx

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getRewardsProfile, getRewardsHistory } from "../services/api";
import { Ionicons } from "@expo/vector-icons"; //  Added for premium icons

const nice = (t: string) => {
  if (t === "LISTED") return "LISTED ITEM";
  if (t === "SOLD") return "SOLD ITEM";
  if (t === "BOUGHT") return "BOUGHT 2ND-HAND";
  if (t === "CO2_SAVED") return "CO₂ SAVED";
  return t;
};

const safeDate = (v: any) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

//  BRUTALIST MONOCHROME PALETTE
const COLORS = {
  bg: '#FFFFFF',
  text: '#000000',
  border: '#E2E8F0',
  muted: '#666666',
  black: '#000000',
  white: '#FFFFFF',
  soft: '#F9F9F9',
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

      if (h?.error) {
        setHistory([]);
      } else {
        setHistory(Array.isArray(h?.items) ? h.items : []);
      }

      setProfile(p?.profile || null);
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
    <SafeAreaView style={styles.safeArea}>
      
      {/* 🌟 BRUTALIST HEADER */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.backBtn}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>VIP PROGRAM</Text>
        <Text style={styles.subtitle}>YOUR REWARDS LEDGER</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.black} />
          <Text style={styles.loadingText}>SYNCING LEDGER...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>RETRY</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* 💳 VIP "BLACK CARD" HERO */}
          <View style={styles.blackCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardLabel}>POINTS BALANCE</Text>
              <Ionicons name="star" size={16} color={COLORS.white} />
            </View>
            
            <Text style={styles.pointsBig}>{profile?.points_balance ?? 0}</Text>
            
            <View style={styles.cardFooterRow}>
              <Text style={styles.cardSubText}>MEMBER ID: {profile?.user_id?.toString().padStart(6, '0') || '000000'}</Text>
              <Text style={styles.cardSubText}>STATUS: ACTIVE</Text>
            </View>
          </View>

          {/* EARN CTA */}
          <View style={styles.earnSection}>
            <Text style={styles.earnDesc}>
              Earn points automatically by listing, selling, and buying second-hand items.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/my-closet")} activeOpacity={0.9}>
              <Text style={styles.primaryBtnText}>LIST AN ITEM TO EARN</Text>
              <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {/* 📜 ACTIVITY LEDGER */}
          <View style={styles.ledgerSection}>
            <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>

            {history.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="document-text-outline" size={32} color={COLORS.muted} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyText}>NO ACTIVITY YET.</Text>
              </View>
            ) : (
              <View style={styles.ledgerBox}>
                {history.map((e, i) => {
                  const d = safeDate(e?.created_at);
                  const isLast = i === history.length - 1;
                  return (
                    <View key={i} style={[styles.ledgerRow, isLast && { borderBottomWidth: 0 }]}>
                      
                      <View style={styles.ledgerLeft}>
                        <Text style={styles.rowDate}>
                          {d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase() : "---"}
                        </Text>
                        <Text style={styles.rowTitle}>{nice(String(e?.event_type || ""))}</Text>
                      </View>

                      <View style={styles.ledgerRight}>
                        <Text style={styles.rowPoints}>+{Number(e?.points_delta ?? 0)} PTS</Text>
                        {(Number(e?.co2_delta_kg ?? 0) > 0 || Number(e?.score_delta ?? 0) > 0) && (
                          <Text style={styles.rowSub}>
                            {Number(e?.score_delta ?? 0) > 0 ? `+${Number(e?.score_delta)} SCORE` : ''}
                            {Number(e?.score_delta ?? 0) > 0 && Number(e?.co2_delta_kg ?? 0) > 0 ? ' • ' : ''}
                            {Number(e?.co2_delta_kg ?? 0) > 0 ? `+${Number(e?.co2_delta_kg).toFixed(1)}KG CO₂` : ""}
                          </Text>
                        )}
                      </View>
                      
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* 🎁 REDEEM SECTION (LOCKED AESTHETIC) */}
          <View style={styles.redeemSection}>
            <View style={styles.redeemHeader}>
              <Text style={styles.sectionTitle}>REDEEM POINTS</Text>
              <Ionicons name="lock-closed-outline" size={16} color={COLORS.muted} />
            </View>
            <View style={styles.lockedBox}>
              <Text style={styles.lockedText}>
                CATALOGUE CURRENTLY UNAVAILABLE.{"\n"}UPCOMING REWARDS INCLUDE: FREE LISTING FEES, 24H BOOSTS, AND EXCLUSIVE DISCOUNTS.
              </Text>
            </View>
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
    paddingHorizontal: 20, 
    marginBottom: 24 
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

  // State Views
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: COLORS.black, marginTop: 16, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  errorText: { color: COLORS.black, marginBottom: 16, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  retryBtn: { borderWidth: 1, borderColor: COLORS.black, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: COLORS.black, fontWeight: "800", letterSpacing: 1 },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // 💳 VIP "BLACK CARD" HERO
  blackCard: {
    backgroundColor: COLORS.black,
    padding: 24,
    borderRadius: 0, // Sharp corners
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.black,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardLabel: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    opacity: 0.7,
  },
  pointsBig: {
    color: COLORS.white,
    fontSize: 72,
    fontFamily: 'IntegralCF-Bold',
    letterSpacing: -2,
    lineHeight: 74,
    marginBottom: 24,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 12,
  },
  cardSubText: {
    color: COLORS.white,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 9,
    letterSpacing: 1,
    opacity: 0.8,
  },

  // Earn Section
  earnSection: {
    marginBottom: 40,
  },
  earnDesc: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: COLORS.black,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 0,
    gap: 10,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  // 📜 ACTIVITY LEDGER
  ledgerSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  ledgerBox: {
    borderWidth: 2,
    borderColor: COLORS.black,
    backgroundColor: COLORS.white,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderStyle: 'dashed', // Gives it a receipt feel
  },
  ledgerLeft: {
    flex: 1,
    paddingRight: 10,
  },
  rowDate: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  rowTitle: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ledgerRight: {
    alignItems: 'flex-end',
  },
  rowPoints: {
    color: COLORS.black,
    fontSize: 14,
    fontFamily: 'IntegralCF-Bold',
    marginBottom: 4,
  },
  rowSub: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  emptyBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.black,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // 🎁 REDEEM SECTION
  redeemSection: {
    marginBottom: 40,
  },
  redeemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  lockedBox: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    alignItems: 'center',
  },
  lockedText: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
});