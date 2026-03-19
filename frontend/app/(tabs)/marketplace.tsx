// frontend/app/(tabs)/marketplace.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  AppState,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getMarketplaceItems } from "../../services/api";
import { API_URL, imgUrl } from "../../services/config";

const COLORS = {
  bg: "#FFFFFF",
  text: "#000000",
  border: "#E2E8F0",
  muted: "#666666",
  soft: "#F9F9F9",
  black: "#000000",
  white: "#FFFFFF",
};

export default function MarketplaceScreen() {
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buyingId, setBuyingId] = useState<string | number | null>(null);

  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const normalizeItems = (data: any) => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  };

  const loadMarketplace = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);

      const myId = await AsyncStorage.getItem("userId");
      if (!myId) {
        if (!alive.current) return;
        setItems([]);
        return;
      }

      const data = await getMarketplaceItems(myId);
      const list = normalizeItems(data);

      if (!alive.current) return;
      setItems(list);
    } catch {
      if (!alive.current) return;
      setItems([]);
    } finally {
      if (!alive.current) return;
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarketplace();
  }, [loadMarketplace]);

  useFocusEffect(
    useCallback(() => {
      loadMarketplace({ silent: true });
    }, [loadMarketplace])
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        loadMarketplace({ silent: true });
      }
    });
    return () => sub.remove();
  }, [loadMarketplace]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadMarketplace({ silent: true });
    } finally {
      if (alive.current) setRefreshing(false);
    }
  }, [loadMarketplace]);

  const checkBuyerReady = async (userId: string) => {
    const res = await fetch(`${API_URL}/payments/buyer-ready/${userId}`);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  };

  const handleQuickBuy = async (item: any) => {
    if (!item?.id) return;
    if (buyingId) return;

    try {
      setBuyingId(item.id);

      const myId = await AsyncStorage.getItem("userId");
      if (!myId) {
        Alert.alert("Login required", "Please login to continue.");
        router.replace("/login");
        return;
      }

      const ready = await checkBuyerReady(myId);

      if (!ready.ok && ready.data?.error === "PHONE_NOT_VERIFIED") {
        Alert.alert(
          "Verify phone number",
          "Please verify your phone number before buying from Marketplace.",
          [
            { text: "Verify Now", onPress: () => router.push("/profile") },
            { text: "Cancel", style: "cancel" },
          ]
        );
        return;
      }

      if (!ready.ok) {
        Alert.alert(
          "Checkout",
          ready.data?.message || ready.data?.error || "Could not continue to checkout."
        );
        return;
      }

      router.push(`/checkout/${item.id}`);
    } catch {
      Alert.alert("Checkout", "Could not continue to checkout.");
    } finally {
      if (alive.current) setBuyingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.backBtn}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <Text style={styles.title}>MARKETPLACE</Text>
        </View>

        <Text style={styles.itemCount}>DISCOVER SUSTAINABLE FINDS • {items.length} ITEMS</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.black} />
          <Text style={styles.loadingText}>CURATING COLLECTION...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContainer}
          data={items}
          numColumns={2}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.row}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const isBuying = buyingId === item?.id;

            return (
              <View style={styles.card}>
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: imgUrl(item.image_url) }}
                    style={styles.image}
                    resizeMode="contain"
                  />

                  <View style={styles.priceTag}>
                    <Text style={styles.priceText}>£{item.price}</Text>
                  </View>
                </View>

                <View style={styles.info}>
                  <Text style={styles.category} numberOfLines={1}>
                    {item.category || "PRE-LOVED ITEM"}
                  </Text>

                  <Text style={styles.details} numberOfLines={1}>
                    {item.size ? `${item.size} • ` : ""}
                    {item.condition || "USED"}
                  </Text>

                  <TouchableOpacity
                    style={[styles.buyButton, isBuying && { opacity: 0.55 }]}
                    onPress={() => handleQuickBuy(item)}
                    activeOpacity={0.6}
                    disabled={isBuying}
                  >
                    {isBuying ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <ActivityIndicator size="small" color={COLORS.black} />
                        <Text style={styles.buyButtonText}>LOADING...</Text>
                      </View>
                    ) : (
                      <Text style={styles.buyButtonText}>QUICK BUY</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>THE MARKETPLACE IS EMPTY.</Text>
              <Text style={styles.emptySubText}>Pull down to refresh or check back soon.</Text>
            </View>
          }
        />
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
    marginBottom: 16,
  },
  backBtn: {
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    color: COLORS.text,
    fontSize: 32,
    fontFamily: "IntegralCF-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  itemCount: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  card: {
    width: "48%",
    backgroundColor: COLORS.white,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 0,
    shadowOpacity: 0,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 0.85,
    backgroundColor: COLORS.soft,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  priceTag: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: COLORS.white,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.black,
  },
  priceText: {
    color: COLORS.black,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  info: { padding: 12, paddingBottom: 16 },
  category: {
    color: COLORS.black,
    fontWeight: "500",
    marginBottom: 4,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  details: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  buyButton: {
    width: "100%",
    paddingVertical: 10,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: COLORS.black,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  buyButtonText: {
    fontWeight: "600",
    fontSize: 10,
    color: COLORS.black,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 40,
  },
  emptyText: {
    color: COLORS.black,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptySubText: {
    color: COLORS.muted,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "500",
  },
});