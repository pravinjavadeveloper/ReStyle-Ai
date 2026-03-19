// frontend/app/agent-jobs.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { acceptDelivery, getAvailableDeliveries } from "../services/api";
import { Ionicons } from "@expo/vector-icons";

// ✅ BRUTALIST LOGISTICS PALETTE
const COLORS = {
  bg: "#FFFFFF",
  black: "#000000",
  border: "#E2E8F0",
  muted: "#666666",
  soft: "#F9F9F9",
  white: "#FFFFFF",
  orange: "#FF4500", // Logistics action color
  neon: "#CCFF00",   // Active radar color
};

export default function AgentJobsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const agentId = await AsyncStorage.getItem("userId");
      if (!agentId) {
        Alert.alert("Login needed", "Please login first.");
        router.push("/login");
        return;
      }

      const res = await getAvailableDeliveries(agentId, 8);

      if (res?.error) {
        setItems([]);
        return;
      }

      setItems(Array.isArray(res?.items) ? res.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // poll every 8s
    return () => clearInterval(t);
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const accept = async (deliveryId: string) => {
    try {
      const agentId = await AsyncStorage.getItem("userId");
      if (!agentId) return;

      const res = await acceptDelivery(deliveryId, agentId);
      if (res?.error) {
        Alert.alert("Could not accept", res.error);
        return;
      }

      Alert.alert("DISPATCH ACCEPTED", "This route is now assigned to your manifest.");
      await load();
    } catch {
      Alert.alert("Error", "Failed to accept job.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      
      {/* 🌟 LOGISTICS HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          {/* <Text style={styles.headerMono}>// DEPT: LOGISTICS</Text> */}
          <Text style={styles.headerTitle}>ACTIVE RADAR</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* 📡 RADAR STATUS BAR */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={styles.pulseDot} />
          <Text style={styles.statusText}>SCANNING 8M RADIUS</Text>
        </View>
        <Text style={styles.statusCount}>{items.length} FOUND</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.black} size="large" />
          <Text style={styles.loadingText}>PINGING NETWORK...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.black} />
          }
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="scan-outline" size={40} color={COLORS.muted} style={{ marginBottom: 16 }} />
              <Text style={styles.emptyText}>NO ROUTES DETECTED</Text>
              <Text style={styles.emptySubText}>
                Keep location services active on the Ambassador portal. The network will ping you when a dispatch is ready.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.ticketCard}>
              
              {/* TICKET HEADER: PAYOUT & DISTANCE */}
              <View style={styles.ticketHeader}>
                <View>
                  <Text style={styles.payoutLabel}>BOUNTY</Text>
                  <Text style={styles.payoutValue}>£{Number(item.payout_gbp || 4.99).toFixed(2)}</Text>
                </View>
                <View style={styles.distanceBadge}>
                  <Ionicons name="navigate-outline" size={12} color={COLORS.white} style={{ marginRight: 4 }} />
                  <Text style={styles.distanceText}>{item.distance_km} KM</Text>
                </View>
              </View>

              {/* TICKET BODY: ROUTE INFO */}
              <View style={styles.ticketBody}>
                <View style={styles.routeLeg}>
                  <View style={styles.routeIconBox}>
                    <Text style={styles.routeIconText}>A</Text>
                  </View>
                  <View style={styles.routeInfo}>
                    <Text style={styles.routeLabel}>ORIGIN (PICKUP)</Text>
                    <Text style={styles.routeAddress}>{item.pickup_address || "AWAITING DATA"}</Text>
                  </View>
                </View>

                <View style={styles.routeConnector} />

                <View style={styles.routeLeg}>
                  <View style={[styles.routeIconBox, { backgroundColor: COLORS.black }]}>
                    <Text style={[styles.routeIconText, { color: COLORS.white }]}>B</Text>
                  </View>
                  <View style={styles.routeInfo}>
                    <Text style={styles.routeLabel}>DESTINATION (DROP)</Text>
                    <Text style={styles.routeAddress}>{item.drop_address || "AWAITING DATA"}</Text>
                  </View>
                </View>
              </View>

              {/* ACTION FOOTER */}
              <TouchableOpacity
                style={styles.ctaBtn}
                onPress={() => accept(String(item.id))}
                activeOpacity={0.9}
              >
                <Text style={styles.ctaText}>ACCEPT DISPATCH</Text>
                <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} />
              </TouchableOpacity>
              
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  
  // Brutalist Logistics Header
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.black,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerMono: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 9,
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.black,
    letterSpacing: 1.5,
  },
  backBtn: { padding: 4 },

  // Radar Status Bar
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.black,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.neon,
    marginRight: 10,
  },
  statusText: {
    color: COLORS.neon,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statusCount: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // State Views
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: COLORS.black, marginTop: 16, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },

  listContainer: { padding: 20, paddingBottom: 40 },

  emptyContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 40,
    marginTop: 40,
    borderWidth: 2,
    borderColor: COLORS.black,
    borderStyle: 'dashed',
  },
  emptyText: { 
    color: COLORS.black, 
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptySubText: {
    color: COLORS.muted, 
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },

  // Waybill / Dispatch Ticket
  ticketCard: {
    borderWidth: 2,
    borderColor: COLORS.black,
    marginBottom: 24,
    backgroundColor: COLORS.white,
    borderRadius: 0,
  },
  
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.soft,
  },
  payoutLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.orange,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  payoutValue: {
    fontSize: 28,
    fontFamily: 'IntegralCF-Bold',
    color: COLORS.black,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.black,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  distanceText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  ticketBody: {
    padding: 16,
  },
  routeLeg: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeIconBox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  routeIconText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.black,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  routeAddress: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.black,
    textTransform: 'uppercase',
    lineHeight: 18,
  },
  routeConnector: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.border,
    marginLeft: 11, // Aligns under the center of the 24px icon box
    marginVertical: 4,
  },

  // Action Footer
  ctaBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.black,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: 'center',
    gap: 10,
  },
  ctaText: { 
    color: COLORS.white, 
    fontWeight: "900", 
    fontSize: 13, 
    letterSpacing: 1.5 
  },
});