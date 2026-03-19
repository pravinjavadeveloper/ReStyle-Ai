// frontend/app/(tabs)/add-item.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  ImageBackground,
  Linking,
  Image,
  Modal,
  Pressable,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

// AI AUTO ADD API
import { autoAddWithAI } from "../services/api";

const COLORS = {
  text: "#000000",
  muted: "#555555",
  black: "#000000",
  white: "#FFFFFF",
};

function showMsg(title: string, message: string) {
  if (Platform.OS === "web") {
    // @ts-ignore
    if (typeof window !== "undefined" && window?.alert) window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

async function openAppSettings() {
  try {
    // @ts-ignore
    if (Linking.openSettings) return await Linking.openSettings();
  } catch {}
}

/**
 * Extract a human friendly message from many possible error shapes
 */
function parseScanError(err: any, fallback = "AI scan failed. Try again.") {
  const status = err?.response?.status;
  const data = err?.response?.data;

  // ✅ ADD THIS (rate limit / quota)
  if (status === 429 || data?.error === "AI_RATE_LIMIT") {
    return {
      title: "AI Busy",
      message:
        data?.message ||
        "AI quota limit reached. Please retry after 60 seconds.",
    };
  }

  // ✅ your existing 422
  if (status === 422 && (data?.error === "NO_CLOTHING_DETECTED" || data?.message)) {
    return {
      title: "Photo not clear",
      message:
        data?.message ||
        "AI couldn't detect a clothing item. Retake the photo with the FULL garment visible (not cut), good lighting, and plain background.",
    };
  }

  // typical backend errors
  if (data?.error && typeof data.error === "string") {
    return { title: "Scan Failed", message: data.error };
  }
  if (data?.message && typeof data.message === "string") {
    return { title: "Scan Failed", message: data.message };
  }

  // network error
  const msg = String(err?.message || "");
  if (msg.toLowerCase().includes("network error") || msg.toLowerCase().includes("timeout")) {
    return {
      title: "Network Error",
      message:
        "Could not reach server. Please check your internet and make sure backend is running and accessible from your phone.",
    };
  }

  return { title: "Error", message: fallback };
}

export default function AddItemScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  // holds the logged-in user id (re-checked on focus)
  const [userId, setUserId] = useState<string | null>(null);

  // preview workflow
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUris, setPreviewUris] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  // prevent double confirm taps
  const [submitting, setSubmitting] = useState(false);

  // re-check auth whenever screen comes back (after camera tick)
  const readUserId = useCallback(async () => {
    try {
      const uid = await AsyncStorage.getItem("userId");
      setUserId(uid || null);
      return uid || null;
    } catch {
      setUserId(null);
      return null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      readUserId();
    }, [readUserId])
  );

  useEffect(() => {
    readUserId();
  }, [readUserId]);

  /**
   * CAMERA PERMISSION
   */
  const ensureCameraPermission = async () => {
    if (Platform.OS === "web") {
      showMsg("Camera not supported on Web", "Please use the mobile app (Android/iOS) to open camera.");
      return false;
    }

    const current = await ImagePicker.getCameraPermissionsAsync();
    if (current.granted) return true;

    const req = await ImagePicker.requestCameraPermissionsAsync();
    if (req.granted) return true;

    if (req.canAskAgain === false) {
      showMsg("Permission blocked", "Camera permission is blocked. Please allow it from Settings to continue.");
      await openAppSettings();
    } else {
      showMsg("Permission required", "Camera access is needed.");
    }
    return false;
  };

  /**
   * GALLERY PERMISSION
   */
  const ensureGalleryPermission = async () => {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (current.granted) return true;

    const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (req.granted) return true;

    if (req.canAskAgain === false) {
      showMsg("Permission blocked", "Gallery permission is blocked. Please allow it from Settings to continue.");
      await openAppSettings();
    } else {
      showMsg("Permission required", "Gallery access is needed.");
    }
    return false;
  };

  // open preview with selected images
  const openPreview = (uris: string[]) => {
    const clean = (uris || []).filter(Boolean);
    if (!clean.length) return;

    setPreviewUris(clean);
    setPreviewIndex(0);
    setPreviewOpen(true);
  };

  // 📸 CAMERA FLOW
  const openCamera = async () => {
    const ok = await ensureCameraPermission();
    if (!ok) return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      openPreview([result.assets[0].uri]);
    }
  };

  // 🖼️ GALLERY FLOW (single OR multiple)
  const openGallery = async () => {
    const ok = await ensureGalleryPermission();
    if (!ok) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled && Array.isArray(result.assets) && result.assets.length > 0) {
      const uris = result.assets.map((a) => a.uri).filter(Boolean);
      if (uris.length > 0) openPreview(uris);
    }
  };

  // ✅ Confirm + run AI
  const confirmAndScan = async () => {
    // stop double tap
    if (submitting) return;
    setSubmitting(true);

    // Close preview first (so UI is clean)
    setPreviewOpen(false);

    setLoading(true);
    try {
      // Re-check userId right before upload (important after camera tick)
      const uid = (await readUserId()) || userId;

      if (!uid) {
        showMsg("Session missing", "Please log in again, then try adding items.");
        return;
      }

      const imageUris = previewUris;
      if (!imageUris.length) {
        showMsg("No image", "Please select or capture an image first.");
        return;
      }

      const result: any = await autoAddWithAI(uid, imageUris);

      /**
       * ✅ New backend behavior:
       * - success: { count, items }
       * - fail: throws axios error (422) OR returns { error }
       */

      // if service returns error in body (some implementations)
      if (result?.error) {
        // handle your new backend error better
        if (result.error === "NO_CLOTHING_DETECTED") {
          showMsg(
            "Photo not clear",
            result?.message ||
              "AI couldn't detect a clothing item. Retake the photo with the FULL garment visible (not cut), good lighting, and plain background."
          );
          return;
        }
        showMsg("Scan Failed", result?.message || result?.error);
        return;
      }

      const addedCount =
        Array.isArray(result?.items) ? result.items.length : Number(result?.count || 0);

      // ✅ Do not show success when 0 items
      if (!addedCount || addedCount <= 0) {
        showMsg(
          "Photo not clear",
          "AI could not detect clothing in these images. Please retake with full garment visible, good lighting, and plain background."
        );
        return;
      }

      showMsg("Success", `Added ${addedCount} items to your closet.`);

      // Go to closet
      router.push("/my-closet");
    } catch (err: any) {
      const parsed = parseScanError(err);
      showMsg(parsed.title, parsed.message);
    } finally {
      setLoading(false);
      setPreviewUris([]);
      setPreviewIndex(0);
      setSubmitting(false);
    }
  };

  // retake/choose again from preview
  const retake = async () => {
    setPreviewOpen(false);
    setPreviewUris([]);
    setPreviewIndex(0);
    await openCamera();
  };

  const chooseAgain = async () => {
    setPreviewOpen(false);
    setPreviewUris([]);
    setPreviewIndex(0);
    await openGallery();
  };

  const currentPreview = previewUris[previewIndex];

  return (
    <View style={styles.wrapper}>
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1583846401064-07e15467431f?auto=format&fit=crop&q=80&w=800",
        }}
        style={styles.backgroundImage}
        imageStyle={{ opacity: 0.35 }}
      >
        <LinearGradient
          colors={["rgba(255,255,255,1)", "rgba(255,255,255,0.7)", "rgba(255,255,255,0.1)"]}
          start={{ x: 0.5, y: 0.0 }}
          end={{ x: 0.5, y: 0.8 }}
          style={StyleSheet.absoluteFillObject}
        />

        <SafeAreaView style={styles.container}>
          {/* HEADER */}
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.backBtn}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>DIGITIZE</Text>
            <Text style={styles.subtitle}>Let AI auto-tag and appraise your items.</Text>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={COLORS.black} />
              <Text style={styles.loadingText}>AI IS ANALYZING PIECES...</Text>
            </View>
          ) : (
            <View style={styles.content}>
              {/* BUTTONS CONTAINER */}
              <View style={styles.actionContainer}>
                {/* CAMERA */}
                <TouchableOpacity style={styles.cameraBtn} onPress={openCamera} activeOpacity={0.85}>
                  <Text style={styles.cameraBtnText}>CAPTURE NEW</Text>
                  <Ionicons name="camera-outline" size={22} color={COLORS.white} />
                </TouchableOpacity>

                {/* GALLERY */}
                <TouchableOpacity style={styles.galleryBtn} onPress={openGallery} activeOpacity={0.6}>
                  <Text style={styles.galleryBtnText}>UPLOAD ITEMS</Text>
                  <Text style={styles.galleryArrow}>↗</Text>
                </TouchableOpacity>
              </View>

              {/* FOOTER TEXT */}
              <View style={styles.footerNoteWrap}>
                <Text style={styles.footerNote}>
                  For best results, place items flat on a contrasting background.
                </Text>
              </View>
            </View>
          )}

          {/* PREVIEW MODAL */}
          <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={() => setPreviewOpen(false)}>
            <View style={styles.previewOverlay}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setPreviewOpen(false)} />

              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewTitle}>PREVIEW</Text>
                  <Text style={styles.previewCount}>
                    {previewUris.length > 0 ? `${previewIndex + 1}/${previewUris.length}` : ""}
                  </Text>
                </View>

                <View style={styles.previewImageWrap}>
                  {!!currentPreview ? (
                    <Image source={{ uri: currentPreview }} style={styles.previewImage} resizeMode="contain" />
                  ) : (
                    <View style={styles.previewPlaceholder}>
                      <Ionicons name="image-outline" size={28} color={COLORS.muted} />
                    </View>
                  )}
                </View>

                {/* nav for multi */}
                {previewUris.length > 1 && (
                  <View style={styles.previewNavRow}>
                    <TouchableOpacity
                      onPress={() => setPreviewIndex((p) => Math.max(0, p - 1))}
                      disabled={previewIndex === 0}
                      activeOpacity={0.85}
                      style={[styles.navBtn, previewIndex === 0 && styles.navBtnDisabled]}
                    >
                      <Ionicons name="chevron-back" size={18} color={COLORS.black} />
                      <Text style={styles.navBtnText}>Prev</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setPreviewIndex((p) => Math.min(previewUris.length - 1, p + 1))}
                      disabled={previewIndex === previewUris.length - 1}
                      activeOpacity={0.85}
                      style={[styles.navBtn, previewIndex === previewUris.length - 1 && styles.navBtnDisabled]}
                    >
                      <Text style={styles.navBtnText}>Next</Text>
                      <Ionicons name="chevron-forward" size={18} color={COLORS.black} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* actions */}
                <View style={styles.previewActions}>
                  <TouchableOpacity onPress={retake} activeOpacity={0.9} style={styles.previewSecondaryBtn}>
                    <Text style={styles.previewSecondaryText}>RETAKE</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={chooseAgain} activeOpacity={0.9} style={styles.previewSecondaryBtn}>
                    <Text style={styles.previewSecondaryText}>CHOOSE</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={confirmAndScan}
                    activeOpacity={0.9}
                    style={[styles.previewPrimaryBtn, submitting && { opacity: 0.6 }]}
                    disabled={submitting}
                  >
                    <Ionicons name="checkmark" size={18} color={COLORS.white} />
                    <Text style={styles.previewPrimaryText}>
                      {submitting ? "UPLOADING..." : "CONFIRM"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  container: {
    flex: 1,
    paddingTop: 16,
  },

  headerContainer: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  backBtn: {
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  backButton: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    color: COLORS.text,
    fontSize: 34,
    fontFamily: "IntegralCF-Bold",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 6,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.5,
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
    paddingBottom: 40,
  },

  actionContainer: {
    alignItems: "center",
    gap: 24,
  },

  cameraBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.black,
    width: "80%",
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
  },
  cameraBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  galleryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "70%",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: COLORS.black,
  },
  galleryBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  galleryArrow: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "400",
  },

  footerNoteWrap: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
  },
  footerNote: {
    color: COLORS.muted,
    fontSize: 10,
    textAlign: "center",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    lineHeight: 16,
  },

  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 100,
  },
  loadingText: {
    color: COLORS.text,
    marginTop: 20,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
  },

  // Preview modal styles
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  previewCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFF",
    borderRadius: 0,
    borderWidth: 1,
    borderColor: "#000",
    padding: 14,
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 10,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#000",
    textTransform: "uppercase",
  },
  previewCount: {
    fontSize: 12,
    fontWeight: "800",
    color: "#555",
  },
  previewImageWrap: {
    width: "100%",
    height: 340,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F9F9F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  previewNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 10,
    paddingHorizontal: 12,
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navBtnText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: "#000",
    textTransform: "uppercase",
  },
  previewActions: {
    flexDirection: "row",
    gap: 10,
  },
  previewSecondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  previewSecondaryText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#000",
    textTransform: "uppercase",
  },
  previewPrimaryBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  previewPrimaryText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#FFF",
    textTransform: "uppercase",
  },
});