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
import {
  getResaleTiming,
  generateListingAI,
  listForResale,
} from "../services/api";
import { Ionicons } from "@expo/vector-icons";

// USE CONFIG (AWS / LOCAL auto via .env)
import { imgUrl } from "../services/config";

/* BRUTALIST MONOCHROME PALETTE */
const COLORS = {
  bg: "#FFFFFF",
  text: "#000000",
  border: "#E2E8F0",
  muted: "#666666",
  black: "#000000",
  white: "#FFFFFF",
  soft: "#F9F9F9",
};

// Dynamic styling for the timing tags
const getTimingStyle = (timing: string) => {
  if (timing === "SELL_NOW") {
    return {
      bg: COLORS.black,
      text: COLORS.white,
      border: COLORS.black,
      icon: "trending-up" as const,
    };
  }
  if (timing === "SELL_SOON") {
    return {
      bg: COLORS.white,
      text: COLORS.black,
      border: COLORS.black,
      icon: "time-outline" as const,
    };
  }
  return {
    bg: COLORS.soft,
    text: COLORS.muted,
    border: COLORS.border,
    icon: "trending-down" as const,
  };
};

type RecItem = {
  itemId?: number | string;
  id?: number | string;
  category?: string;
  color?: string;
  image_url?: string;
  timing: "SELL_NOW" | "SELL_SOON" | "WAIT" | string;
  bestWindow?: string;
  confidence?: number;
  reason?: string;
  score?: number;
};

export default function ResaleTimingScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recs, setRecs] = useState<RecItem[]>([]);

  // per-item loading when auto-listing
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

  // SELL NOW/SELL SOON => AI generate => auto list inside app
  const handleSellNow = async (r: RecItem) => {
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
        "", // size optional
        "Good", // condition default
        ai.description || ""
      );

      if (result?.error) {
        Alert.alert("Error", result.error);
        return;
      }

      Alert.alert("LISTED", `Your item is now live for £${finalPrice}`);

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
      {/* 🌟 BRUTALIST HEADER */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          style={styles.backBtn}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>MARKET TIMING</Text>
        <Text style={styles.subtitle}>AI DEMAND FORECAST</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.black} />
          <Text style={styles.loadingText}>ANALYZING MARKET TRENDS...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={load}
            activeOpacity={0.8}
          >
            <Text style={styles.retryBtnText}>RETRY</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {recs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>NO FORECASTS AVAILABLE</Text>
              <Text style={styles.emptySub}>
                Add more items to your closet to generate market demand signals.
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => router.push("/my-closet")}
                activeOpacity={0.9}
              >
                <Text style={styles.emptyCtaText}>GO TO MY CLOSET</Text>
              </TouchableOpacity>
            </View>
          ) : (
            recs.map((r, idx) => {
              const itemId = String(r.itemId || r.id || `${idx}`);
              const isClickable =
                r.timing === "SELL_NOW" || r.timing === "SELL_SOON";
              const isSelling = sellingId === itemId;
              const timingStyle = getTimingStyle(r.timing);

              return (
                <View key={`${itemId}-${idx}`} style={styles.itemCard}>
                  {/* Top Row: Title & Tag */}
                  <View style={styles.cardHeader}>
                    <View style={styles.titleWrap}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {r.color ? `${r.color} ` : ""}
                        {r.category || "Item"}
                      </Text>
                      <Text style={styles.itemReason} numberOfLines={2}>
                        {r.reason || "Stable demand — list anytime"}
                      </Text>
                    </View>

                    {/* Editorial Timing Tag */}
                    <View
                      style={[
                        styles.timingTag,
                        {
                          backgroundColor: timingStyle.bg,
                          borderColor: timingStyle.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={timingStyle.icon}
                        size={14}
                        color={timingStyle.text}
                      />
                      <Text
                        style={[
                          styles.timingTagText,
                          { color: timingStyle.text },
                        ]}
                      >
                        {badgeLabel(r.timing)}
                      </Text>
                    </View>
                  </View>

                  {/* Bottom Row: Image & Data */}
                  <View style={styles.cardBody}>
                    <View style={styles.imageWrap}>
                      {!!r.image_url ? (
                        <Image
                          source={{ uri: imgUrl(r.image_url) }}
                          style={styles.itemImage}
                        />
                      ) : (
                        <View style={styles.placeholderImage}>
                          <Ionicons
                            name="image-outline"
                            size={24}
                            color={COLORS.muted}
                          />
                        </View>
                      )}
                    </View>

                    <View style={styles.dataWrap}>
                      <View style={styles.dataLine}>
                        <Text style={styles.dataLabel}>TARGET WINDOW</Text>
                        <Text style={styles.dataValue}>
                          {r.bestWindow || "Later"}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.dataLine,
                          { borderBottomWidth: 0, marginBottom: 12 },
                        ]}
                      >
                        <Text style={styles.dataLabel}>CONFIDENCE</Text>
                        <Text style={styles.dataValue}>
                          {Number((r.confidence ?? 0) * 100).toFixed(0)}%
                        </Text>
                      </View>

                      {/* Action Button */}
                      <TouchableOpacity
                        disabled={!isClickable || isSelling}
                        onPress={() => handleSellNow(r)}
                        style={[
                          styles.actionBtn,
                          !isClickable && styles.actionBtnDisabled,
                          isClickable &&
                            r.timing === "SELL_NOW" &&
                            styles.actionBtnPrimary,
                        ]}
                        activeOpacity={0.85}
                      >
                        {isSelling ? (
                          <ActivityIndicator
                            size="small"
                            color={
                              r.timing === "SELL_NOW"
                                ? COLORS.white
                                : COLORS.black
                            }
                          />
                        ) : (
                          <Text
                            style={[
                              styles.actionBtnText,
                              !isClickable && styles.actionBtnTextDisabled,
                              isClickable &&
                                r.timing === "SELL_NOW" &&
                                styles.actionBtnTextPrimary,
                            ]}
                          >
                            {isClickable ? "1-TAP AI LISTING" : "HOLD FOR NOW"}
                          </Text>
                        )}
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
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === "android" ? 16 : 0,
  },

  // Brutalist Header
  headerContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
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
  title: {
    color: COLORS.text,
    fontSize: 30,
    fontFamily: "IntegralCF-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  subtitle: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // State Views
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: {
    color: COLORS.black,
    marginTop: 16,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  errorText: {
    color: COLORS.black,
    marginBottom: 16,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  retryBtn: {
    borderWidth: 1,
    borderColor: COLORS.black,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryBtnText: { color: COLORS.black, fontWeight: "800", letterSpacing: 1 },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Empty State
  emptyCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptySub: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 24,
  },
  emptyCta: {
    backgroundColor: COLORS.black,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  emptyCtaText: {
    color: COLORS.white,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1,
  },

  // Editorial Card Design
  itemCard: {
    borderWidth: 1,
    borderColor: COLORS.black,
    marginBottom: 24,
    backgroundColor: COLORS.white,
    borderRadius: 0,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  titleWrap: {
    flex: 1,
    paddingRight: 16,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.black,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  itemReason: {
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 16,
    fontWeight: "500",
  },
  timingTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    gap: 4,
  },
  timingTagText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  cardBody: {
    flexDirection: "row",
    padding: 16,
  },
  imageWrap: {
    width: 90,
    height: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.soft,
  },
  itemImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  dataWrap: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "space-between",
  },
  dataLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.soft,
  },
  dataLabel: {
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  dataValue: {
    fontSize: 11,
    color: COLORS.black,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  // Call to Action Buttons
  actionBtn: {
    borderWidth: 1,
    borderColor: COLORS.black,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  actionBtnText: {
    color: COLORS.black,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  actionBtnPrimary: {
    backgroundColor: COLORS.black,
  },
  actionBtnTextPrimary: {
    color: COLORS.white,
  },
  actionBtnDisabled: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.soft,
  },
  actionBtnTextDisabled: {
    color: COLORS.muted,
  },
});