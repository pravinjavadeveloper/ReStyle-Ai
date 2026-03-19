// // frontend/app/wardrobe-analytics.tsx
// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   ActivityIndicator,
//   ScrollView,
//   Platform,
// } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { useRouter } from "expo-router";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { LinearGradient } from "expo-linear-gradient";
// import { Ionicons } from "@expo/vector-icons";

// // ✅ USE SINGLE SOURCE OF TRUTH (NO HARDCODED localhost / 10.0.2.2)
// import { API_URL } from "../services/config";

// const safeText = (v: any) => {
//   if (v === null || v === undefined) return "N/A";
//   if (typeof v === "object") {
//     if ("key" in v && "value" in v) return `${(v as any).key}`;
//     return JSON.stringify(v);
//   }
//   return String(v);
// };

// // 🌟 PREMIUM DYNAMIC SPEEDOMETER
// const Speedometer = ({ score }: { score: number }) => {
//   const clampedScore = Math.min(100, Math.max(0, Number(score) || 0));
//   const rotation = (clampedScore / 100) * 180 - 90;

//   return (
//     <View style={styles.speedometerContainer}>
//       <View style={styles.speedometerGauge}>
//         <LinearGradient
//           colors={["#D95F57", "#E5AC4D", "#7EBA68"]}
//           start={{ x: 0, y: 0.5 }}
//           end={{ x: 1, y: 0.5 }}
//           style={styles.gaugeBackground}
//         />

//         <View style={styles.gaugeInnerCutout} />

//         <Text style={styles.gaugeLabelBad}>Bad</Text>
//         <Text style={styles.gaugeLabelAvg}>Avg</Text>
//         <Text style={styles.gaugeLabelExc}>Excellent</Text>

//         <View style={[styles.needleWrapper, { transform: [{ rotate: `${rotation}deg` }] }]}>
//           <View style={styles.needleLine} />
//         </View>

//         <View style={styles.needleBase} />
//       </View>

//       <Text style={styles.scoreText}>
//         {clampedScore}
//         <Text style={styles.scoreTextMax}>/100</Text>
//       </Text>
//     </View>
//   );
// };

// export default function WardrobeAnalyticsScreen() {
//   const router = useRouter();
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [data, setData] = useState<any>(null);

//   const fetchAnalytics = async () => {
//     try {
//       setLoading(true);
//       setError(null);

//       const userId = await AsyncStorage.getItem("userId");
//       if (!userId) {
//         setError("User not logged in");
//         setLoading(false);
//         return;
//       }

//       // ✅ uses API_URL from config.ts
//       const res = await fetch(`${API_URL}/analytics/${userId}`);

//       // ✅ safe json parse
//       const json = await res.json().catch(() => null);

//       if (!res.ok || json?.error) {
//         setError(json?.error || "Analytics failed");
//         setLoading(false);
//         return;
//       }

//       setData(json);
//       setLoading(false);
//     } catch (e) {
//       setError("Analytics failed");
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchAnalytics();
//   }, []);

//   const categoryBreakdown = Array.isArray(data?.categoryBreakdown) ? data.categoryBreakdown : [];
//   const colorBreakdown = Array.isArray(data?.colorBreakdown) ? data.colorBreakdown : [];

//   const rawScore = data?.healthScore ?? data?.score ?? 0;
//   const parsedScore =
//     typeof rawScore === "number" ? rawScore : parseInt(String(rawScore), 10) || 0;

//   return (
//     <SafeAreaView style={styles.safeArea}>
//       {/* HEADER */}
//       <View style={styles.header}>
//         <TouchableOpacity onPress={() => router.back()} style={styles.backButtonWrapper}>
//           <Ionicons name="arrow-back" size={24} color="#1F3A34" />
//         </TouchableOpacity>
//         <Text style={styles.title}>Wardrobe Analytics</Text>
//         <View style={{ width: 40 }} />
//       </View>

//       {loading ? (
//         <View style={styles.center}>
//           <ActivityIndicator size="large" color="#1F3A34" />
//           <Text style={styles.muted}>Analyzing wardrobe...</Text>
//         </View>
//       ) : error ? (
//         <View style={styles.center}>
//           <Text style={styles.error}>{error}</Text>
//           <TouchableOpacity style={styles.retryBtn} onPress={fetchAnalytics}>
//             <Text style={styles.retryText}>Retry</Text>
//           </TouchableOpacity>
//         </View>
//       ) : (
//         <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
//           {/* 🌟 PREMIUM DASHBOARD WIDGET */}
//           <View style={styles.dashboardCard}>
//             <Text style={styles.dashTitle}>Wardrobe Overview</Text>

//             <Speedometer score={parsedScore} />

//             <View style={styles.dashStatsRow}>
//               <View style={styles.dashStatItem}>
//                 <Text style={styles.dashStatVal}>{safeText(data?.totalItems ?? 0)}</Text>
//                 <Text style={styles.dashStatLabel}>Total Items</Text>
//               </View>
//               <View style={styles.dashStatItem}>
//                 <Text style={styles.dashStatVal} numberOfLines={1}>
//                   {safeText(data?.topCategory)}
//                 </Text>
//                 <Text style={styles.dashStatLabel}>Top Category</Text>
//               </View>
//               <View style={styles.dashStatItem}>
//                 <Text style={styles.dashStatVal} numberOfLines={1}>
//                   {safeText(data?.topColor)}
//                 </Text>
//                 <Text style={styles.dashStatLabel}>Top Color</Text>
//               </View>
//             </View>
//           </View>

//           {/* CATEGORY BREAKDOWN */}
//           <View style={styles.breakdownCard}>
//             <Text style={styles.breakdownTitle}>Category Breakdown</Text>
//             {categoryBreakdown.length === 0 ? (
//               <Text style={styles.muted}>No data</Text>
//             ) : (
//               categoryBreakdown.map((c: any, idx: number) => (
//                 <View key={idx} style={styles.line}>
//                   <Text style={styles.lineLeft}>{safeText(c?.key)}</Text>
//                   <Text style={styles.lineRight}>{safeText(c?.value)} items</Text>
//                 </View>
//               ))
//             )}
//           </View>

//           {/* COLOR BREAKDOWN */}
//           <View style={styles.breakdownCard}>
//             <Text style={styles.breakdownTitle}>Color Breakdown</Text>
//             {colorBreakdown.length === 0 ? (
//               <Text style={styles.muted}>No data</Text>
//             ) : (
//               colorBreakdown.map((c: any, idx: number) => (
//                 <View key={idx} style={styles.line}>
//                   <Text style={styles.lineLeft}>{safeText(c?.key)}</Text>
//                   <Text style={styles.lineRight}>{safeText(c?.value)} items</Text>
//                 </View>
//               ))
//             )}
//           </View>
//         </ScrollView>
//       )}
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   safeArea: {
//     flex: 1,
//     backgroundColor: "#F4F8F9",
//   },
//   header: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     borderBottomWidth: 1,
//     borderBottomColor: "#DCEFEA",
//     backgroundColor: "#F4F8F9",
//   },
//   backButtonWrapper: {
//     padding: 8,
//     marginLeft: -8,
//   },
//   title: {
//     color: "#1F3A34",
//     fontSize: 20,
//     fontWeight: "700",
//     fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
//     letterSpacing: 0.5,
//   },

//   center: { flex: 1, alignItems: "center", justifyContent: "center" },
//   muted: { color: "#6F9F93", marginTop: 12, fontSize: 14, fontWeight: "500" },
//   error: { color: "#D9534F", fontSize: 16, marginBottom: 12, fontWeight: "600" },
//   retryBtn: { backgroundColor: "#1F3A34", paddingVertical: 12, paddingHorizontal: 25, borderRadius: 10 },
//   retryText: { color: "#FFF", fontWeight: "bold" },

//   scrollContainer: { padding: 16, paddingBottom: 40 },

//   dashboardCard: {
//     backgroundColor: "#FFFFFF",
//     borderRadius: 16,
//     padding: 24,
//     borderWidth: 1,
//     borderColor: "#DCEFEA",
//     shadowColor: "#1F3A34",
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.05,
//     shadowRadius: 10,
//     elevation: 3,
//     marginBottom: 20,
//   },
//   dashTitle: {
//     color: "#1F3A34",
//     fontSize: 22,
//     fontWeight: "800",
//     fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
//     marginBottom: 20,
//     textAlign: "center",
//   },
//   dashStatsRow: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     paddingTop: 2,
//     borderTopWidth: 1,
//     borderTopColor: "#F4F8F9",
//   },
//   dashStatItem: { alignItems: "center", flex: 1 },
//   dashStatVal: { color: "#1F3A34", fontSize: 15, fontWeight: "900" },
//   dashStatLabel: { color: "#6F9F93", fontSize: 11, marginTop: 4, textAlign: "center", fontWeight: "600" },

//   speedometerContainer: { alignItems: "center", marginBottom: 10 },
//   speedometerGauge: {
//     width: 260,
//     height: 130,
//     overflow: "hidden",
//     position: "relative",
//     alignItems: "center",
//   },
//   gaugeBackground: {
//     width: 260,
//     height: 260,
//     borderRadius: 130,
//     position: "absolute",
//     top: 0,
//   },
//   gaugeInnerCutout: {
//     position: "absolute",
//     top: 15,
//     width: 200,
//     height: 200,
//     borderRadius: 100,
//     backgroundColor: "#FFFFFF",
//   },

//   gaugeLabelBad: { position: "absolute", bottom: 15, left: 35, color: "rgba(0,0,0,0.3)", fontWeight: "800", fontSize: 13 },
//   gaugeLabelAvg: { position: "absolute", top: 20, alignSelf: "center", color: "#E89D3C", fontWeight: "800", fontSize: 13 },
//   gaugeLabelExc: { position: "absolute", bottom: 15, right: 35, color: "rgba(0,0,0,0.3)", fontWeight: "800", fontSize: 13 },

//   needleWrapper: {
//     position: "absolute",
//     top: 0,
//     left: 0,
//     width: 260,
//     height: 260,
//     alignItems: "center",
//   },
//   needleLine: {
//     width: 4,
//     height: 115,
//     backgroundColor: "#111",
//     alignSelf: "center",
//     marginTop: 15,
//     borderRadius: 2,
//     shadowColor: "#000",
//     shadowOffset: { width: 4, height: 2 },
//     shadowOpacity: 0.2,
//     shadowRadius: 4,
//   },
//   needleBase: {
//     position: "absolute",
//     bottom: -12,
//     alignSelf: "center",
//     width: 24,
//     height: 24,
//     backgroundColor: "#111",
//     borderRadius: 12,
//   },

//   scoreText: { color: "#1F3A34", fontSize: 40, fontWeight: "800", marginTop: 10 },
//   scoreTextMax: { fontSize: 24, color: "#6F9F93" },

//   breakdownCard: {
//     backgroundColor: "#FFFFFF",
//     borderWidth: 1,
//     borderColor: "#DCEFEA",
//     borderRadius: 16,
//     padding: 20,
//     marginBottom: 16,
//   },
//   breakdownTitle: {
//     color: "#1F3A34",
//     fontWeight: "700",
//     fontSize: 16,
//     marginBottom: 16,
//   },
//   line: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     paddingVertical: 12,
//     borderBottomWidth: 1,
//     borderBottomColor: "#F4F8F9",
//   },
//   lineLeft: { color: "#3E6F63", fontWeight: "600", fontSize: 14, textTransform: "capitalize" },
//   lineRight: { color: "#1F3A34", fontWeight: "800", fontSize: 14 },
// });















































// frontend/app/wardrobe-analytics.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

// ✅ single source of truth
import { API_URL } from "../services/config";

const safeText = (v: any) => {
  if (v === null || v === undefined) return "N/A";
  if (typeof v === "object") {
    if ("key" in v && "value" in v) return `${(v as any).key}`;
    return JSON.stringify(v);
  }
  return String(v);
};

type KV = { key: string; value: number };

function toBreakdown(obj: any): KV[] {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj)
    .map(([k, v]) => ({ key: String(k), value: Number(v) || 0 }))
    .sort((a, b) => (b.value || 0) - (a.value || 0));
}

// 🌟 PREMIUM DYNAMIC SPEEDOMETER (Bike-start animation)
const Speedometer = ({ score }: { score: number }) => {
  const clampedScore = Math.min(100, Math.max(0, Number(score) || 0));

  // -90 (left) to +90 (right)
  const targetDeg = (clampedScore / 100) * 180 - 90;

  // Start from left
  const animDeg = useRef(new Animated.Value(-90)).current;

  useEffect(() => {
    // Bike-start: full right then settle to target
    Animated.sequence([
      Animated.timing(animDeg, {
        toValue: 90,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(animDeg, {
        toValue: targetDeg,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [targetDeg, animDeg]);

  const rotate = animDeg.interpolate({
    inputRange: [-90, 90],
    outputRange: ["-90deg", "90deg"],
  });

  return (
    <View style={styles.speedometerContainer}>
      <View style={styles.speedometerGauge}>
        <LinearGradient
          colors={["#D95F57", "#E5AC4D", "#7EBA68"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gaugeBackground}
        />

        <View style={styles.gaugeInnerCutout} />

        <Text style={styles.gaugeLabelBad}>Bad</Text>
        <Text style={styles.gaugeLabelAvg}>Avg</Text>
        <Text style={styles.gaugeLabelExc}>Excellent</Text>

        <Animated.View
          style={[
            styles.needleWrapper,
            {
              transform: [{ rotate }],
            },
          ]}
        >
          <View style={styles.needleLine} />
        </Animated.View>

        <View style={styles.needleBase} />
      </View>

      <Text style={styles.scoreText}>
        {clampedScore}
        <Text style={styles.scoreTextMax}>/100</Text>
      </Text>
    </View>
  );
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
      const json = await res.json().catch(() => null);

      if (!res.ok || json?.error) {
        setError(json?.error || "Analytics failed");
        setLoading(false);
        return;
      }

      setData(json);
      setLoading(false);
    } catch {
      setError("Analytics failed");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // ✅ BACKEND RETURNS categoryCounts/colorCounts (object)
  // ✅ If you later return categoryBreakdown/colorBreakdown arrays, this still works.
  const categoryBreakdown: KV[] = Array.isArray(data?.categoryBreakdown)
    ? data.categoryBreakdown
    : toBreakdown(data?.categoryCounts);

  const colorBreakdown: KV[] = Array.isArray(data?.colorBreakdown)
    ? data.colorBreakdown
    : toBreakdown(data?.colorCounts);

  const rawScore = data?.healthScore ?? data?.score ?? 0;
  const parsedScore =
    typeof rawScore === "number" ? rawScore : parseInt(String(rawScore), 10) || 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonWrapper}>
          <Ionicons name="arrow-back" size={24} color="#1F3A34" />
        </TouchableOpacity>
        <Text style={styles.title}>Wardrobe Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1F3A34" />
          <Text style={styles.muted}>Analyzing wardrobe...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchAnalytics}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* DASHBOARD */}
          <View style={styles.dashboardCard}>
            <Text style={styles.dashTitle}>Wardrobe Overview</Text>

            <Speedometer score={parsedScore} />

            <View style={styles.dashStatsRow}>
              <View style={styles.dashStatItem}>
                <Text style={styles.dashStatVal}>{safeText(data?.totalItems ?? 0)}</Text>
                <Text style={styles.dashStatLabel}>Total Items</Text>
              </View>
              <View style={styles.dashStatItem}>
                <Text style={styles.dashStatVal} numberOfLines={1}>
                  {safeText(data?.topCategory)}
                </Text>
                <Text style={styles.dashStatLabel}>Top Category</Text>
              </View>
              <View style={styles.dashStatItem}>
                <Text style={styles.dashStatVal} numberOfLines={1}>
                  {safeText(data?.topColor)}
                </Text>
                <Text style={styles.dashStatLabel}>Top Color</Text>
              </View>
            </View>
          </View>

          {/* CATEGORY BREAKDOWN */}
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>Category Breakdown</Text>
            {categoryBreakdown.length === 0 ? (
              <Text style={styles.muted}>No data</Text>
            ) : (
              categoryBreakdown.map((c, idx) => (
                <View key={`${c.key}-${idx}`} style={styles.line}>
                  <Text style={styles.lineLeft}>{safeText(c?.key)}</Text>
                  <Text style={styles.lineRight}>{safeText(c?.value)} items</Text>
                </View>
              ))
            )}
          </View>

          {/* COLOR BREAKDOWN */}
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>Color Breakdown</Text>
            {colorBreakdown.length === 0 ? (
              <Text style={styles.muted}>No data</Text>
            ) : (
              colorBreakdown.map((c, idx) => (
                <View key={`${c.key}-${idx}`} style={styles.line}>
                  <Text style={styles.lineLeft}>{safeText(c?.key)}</Text>
                  <Text style={styles.lineRight}>{safeText(c?.value)} items</Text>
                </View>
              ))
            )}
          </View>

          {/* OPTIONAL DEBUG (remove anytime) */}
          {data?.dressCount !== undefined && (
            <View style={styles.debugCard}>
              <Text style={styles.debugTitle}>Debug (optional)</Text>
              <Text style={styles.debugLine}>Bought: {safeText(data?.boughtCount)}</Text>
              <Text style={styles.debugLine}>Sold: {safeText(data?.soldCount)}</Text>
              <Text style={styles.debugLine}>Dress Count: {safeText(data?.dressCount)}</Text>
              <Text style={styles.debugLine}>Dress Ratio: {safeText(data?.dressRatio)}</Text>
              <Text style={styles.debugLine}>Dress Penalty: {safeText(data?.dressPenalty)}</Text>
              <Text style={styles.debugLine}>Activity Bonus: {safeText(data?.activityBonus)}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F8F9" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#DCEFEA",
    backgroundColor: "#F4F8F9",
  },
  backButtonWrapper: { padding: 8, marginLeft: -8 },
  title: {
    color: "#1F3A34",
    fontSize: 20,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    letterSpacing: 0.5,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#6F9F93", marginTop: 12, fontSize: 14, fontWeight: "500" },
  error: { color: "#D9534F", fontSize: 16, marginBottom: 12, fontWeight: "600" },
  retryBtn: {
    backgroundColor: "#1F3A34",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  retryText: { color: "#FFF", fontWeight: "bold" },

  scrollContainer: { padding: 16, paddingBottom: 40 },

  dashboardCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#DCEFEA",
    shadowColor: "#1F3A34",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  dashTitle: {
    color: "#1F3A34",
    fontSize: 22,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    marginBottom: 20,
    textAlign: "center",
  },
  dashStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: "#F4F8F9",
  },
  dashStatItem: { alignItems: "center", flex: 1 },
  dashStatVal: { color: "#1F3A34", fontSize: 15, fontWeight: "900" },
  dashStatLabel: {
    color: "#6F9F93",
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
    fontWeight: "600",
  },

  speedometerContainer: { alignItems: "center", marginBottom: 10 },
  speedometerGauge: {
    width: 260,
    height: 130,
    overflow: "hidden",
    position: "relative",
    alignItems: "center",
  },
  gaugeBackground: {
    width: 260,
    height: 260,
    borderRadius: 130,
    position: "absolute",
    top: 0,
  },
  gaugeInnerCutout: {
    position: "absolute",
    top: 15,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#FFFFFF",
  },

  gaugeLabelBad: {
    position: "absolute",
    bottom: 15,
    left: 35,
    color: "rgba(0,0,0,0.3)",
    fontWeight: "800",
    fontSize: 13,
  },
  gaugeLabelAvg: {
    position: "absolute",
    top: 20,
    alignSelf: "center",
    color: "#E89D3C",
    fontWeight: "800",
    fontSize: 13,
  },
  gaugeLabelExc: {
    position: "absolute",
    bottom: 15,
    right: 35,
    color: "rgba(0,0,0,0.3)",
    fontWeight: "800",
    fontSize: 13,
  },

  needleWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 260,
    height: 260,
    alignItems: "center",
  },
  needleLine: {
    width: 4,
    height: 115,
    backgroundColor: "#111",
    alignSelf: "center",
    marginTop: 15,
    borderRadius: 2,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  needleBase: {
    position: "absolute",
    bottom: -12,
    alignSelf: "center",
    width: 24,
    height: 24,
    backgroundColor: "#111",
    borderRadius: 12,
  },

  scoreText: { color: "#1F3A34", fontSize: 40, fontWeight: "800", marginTop: 10 },
  scoreTextMax: { fontSize: 24, color: "#6F9F93" },

  breakdownCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCEFEA",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  breakdownTitle: {
    color: "#1F3A34",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 16,
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F8F9",
  },
  lineLeft: {
    color: "#3E6F63",
    fontWeight: "600",
    fontSize: 14,
    textTransform: "capitalize",
  },
  lineRight: { color: "#1F3A34", fontWeight: "800", fontSize: 14 },

  debugCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCEFEA",
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
  },
  debugTitle: { color: "#1F3A34", fontWeight: "800", marginBottom: 8 },
  debugLine: { color: "#3E6F63", fontWeight: "600", marginBottom: 4 },
});