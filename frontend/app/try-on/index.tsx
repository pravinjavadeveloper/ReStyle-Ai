import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

const BG = "#F4F8F9";
const DARK = "#111111";
const MUTED = "#3E6F63";

export default function TryOnHome() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // garment passed from closet/marketplace
  const garment = useMemo(() => {
    try {
      if (!params?.garment) return null;
      return JSON.parse(String(params.garment));
    } catch {
      return null;
    }
  }, [params]);

  const goEditor = (mode: "upload" | "camera") => {
    router.push({
      pathname: "/try-on/editor",
      params: {
        mode,
        garment: garment ? JSON.stringify(garment) : "",
      },
    });
  };

  const goLive = () => {
    router.push({
      pathname: "/try-on/live",
      params: {
        garment: garment ? JSON.stringify(garment) : "",
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Virtual Try-On</Text>
        <Text style={styles.sub}>
          Upload a full body photo, take a photo, or try live.
        </Text>

        <TouchableOpacity style={styles.btn} onPress={() => goEditor("upload")}>
          <Text style={styles.btnText}>Upload Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={() => goEditor("camera")}>
          <Text style={styles.btnText}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={goLive}>
          <Text style={[styles.btnText, styles.outlineText]}>
            Live Try-On {Platform.OS === "web" ? "(Preview)" : ""}
          </Text>
        </TouchableOpacity>

        {garment ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Selected Item</Text>
            <Text style={styles.infoText}>
              {garment?.title || garment?.name || "Garment"}{" "}
              {garment?.category ? `• ${garment.category}` : ""}
            </Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { flex: 1, padding: 18 },
  title: { fontSize: 26, fontWeight: "800", color: DARK, marginTop: 8 },
  sub: { marginTop: 8, fontSize: 14, color: MUTED, lineHeight: 20, marginBottom: 18 },

  btn: {
    backgroundColor: DARK,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
    alignItems: "center",
  },
  btnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: DARK,
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  outlineText: { color: DARK },

  infoCard: {
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E6E6E6",
  },
  infoTitle: { fontWeight: "800", color: DARK, marginBottom: 6 },
  infoText: { color: MUTED },
});