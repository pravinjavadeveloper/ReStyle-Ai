import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { imgUrl } from "../../services/config";
import TryOnOverlay from "../../components/tryon/TryOnOverlay";

const BG = "#F4F8F9";
const DARK = "#111111";
const MUTED = "#3E6F63";

export default function TryOnLive() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  const [autoFitKey, setAutoFitKey] = useState("init");

  const garment = useMemo(() => {
    try {
      if (!params?.garment) return null;
      return JSON.parse(String(params.garment));
    } catch {
      return null;
    }
  }, [params]);

  const garmentUri = useMemo(() => {
    const raw = garment?.tryon_png_url || garment?.image_url || garment?.photo || garment?.image;
    return raw ? imgUrl(String(raw)) : "";
  }, [garment]);

  useEffect(() => {
    (async () => {
      if (!permission?.granted) await requestPermission();
    })();
  }, []);

  const onAutoFit = () => setAutoFitKey(String(Date.now()));

  if (Platform.OS === "web") {
    return (
      <SafeAreaView style={[styles.safe, { padding: 18 }]}>
        <Text style={styles.title}>Live Try-On</Text>
        <Text style={styles.sub}>
          Live camera is limited on web. Use “Take Photo” mode on web.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={[styles.safe, { padding: 18 }]}>
        <Text style={styles.title}>Live Try-On</Text>
        <Text style={styles.sub}>Camera permission is required.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Allow Camera</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.titleSmall}>Live Try-On</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.camWrap}>
        <CameraView style={styles.camera} facing="front">
          <TryOnOverlay garmentUri={garmentUri} autoFitKey={autoFitKey} />
        </CameraView>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.btn} onPress={onAutoFit}>
          <Text style={styles.btnText}>Auto Fit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.outline]}
          onPress={() => router.push({ pathname: "/try-on/index", params: { garment: garment ? JSON.stringify(garment) : "" } })}
        >
          <Text style={[styles.btnText, styles.outlineText]}>Change Mode</Text>
        </TouchableOpacity>
      </View>

      {!garmentUri ? (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            No garment image found. Add tryon_png_url or image_url for item.
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  topBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { color: DARK, fontWeight: "800" },
  title: { fontSize: 22, fontWeight: "900", color: DARK },
  titleSmall: { fontSize: 16, fontWeight: "900", color: DARK },
  sub: { marginTop: 8, color: MUTED, lineHeight: 20 },

  camWrap: { flex: 1, padding: 12 },
  camera: { flex: 1, borderRadius: 18, overflow: "hidden", backgroundColor: "#000" },

  controls: { padding: 12, gap: 10 },
  btn: {
    backgroundColor: DARK,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "900" },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: DARK },
  outlineText: { color: DARK },

  warn: { paddingHorizontal: 12, paddingBottom: 12 },
  warnText: { color: "#B42318", fontWeight: "700" },
});