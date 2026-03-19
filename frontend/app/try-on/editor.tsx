import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { imgUrl } from "../../services/config";
import TryOnOverlay from "../../components/tryon/TryOnOverlay";

const BG = "#F4F8F9";
const DARK = "#111111";
const MUTED = "#3E6F63";

export default function TryOnEditor() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const mode = (params?.mode as string) || "upload";

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

  const [userPhotoUri, setUserPhotoUri] = useState<string>("");
  const [autoFitKey, setAutoFitKey] = useState("init");

  useEffect(() => {
    (async () => {
      try {
        if (mode === "camera") {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permission required", "Camera permission is needed.");
            return;
          }
          const res = await ImagePicker.launchCameraAsync({
            quality: 1,
            allowsEditing: false,
          });
          if (!res.canceled) setUserPhotoUri(res.assets[0].uri);
        } else {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permission required", "Gallery permission is needed.");
            return;
          }
          const res = await ImagePicker.launchImageLibraryAsync({
            quality: 1,
            allowsEditing: false,
          });
          if (!res.canceled) setUserPhotoUri(res.assets[0].uri);
        }
      } catch (e: any) {
        Alert.alert("Error", e?.message || "Failed to pick image");
      }
    })();
  }, [mode]);

  const onAutoFit = () => {
    // v1: just center reset (premium feel) — later we add rule-based offsets by category
    setAutoFitKey(String(Date.now()));
  };

  if (!userPhotoUri) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: MUTED }}>Loading photo…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Try-On Editor</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.previewWrap}>
        <ImageBackground source={{ uri: userPhotoUri }} style={styles.preview} resizeMode="cover">
          <TryOnOverlay garmentUri={garmentUri} autoFitKey={autoFitKey} />
        </ImageBackground>
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
            No garment image found. Make sure the item has a transparent PNG URL.
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
  title: { color: DARK, fontWeight: "900", fontSize: 16 },
  previewWrap: { flex: 1, padding: 12 },
  preview: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#000",
  },
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