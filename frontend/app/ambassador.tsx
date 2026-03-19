// frontend/app/ambassador.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

// Location (Expo)
import * as Location from "expo-location";

// File pickers (Expo)
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

// Your API functions
import {
  applyAmbassadorForm,
  getAmbassadorStatus,
  updateAmbassadorLocation,
  registerAmbassadorToken,
} from "../services/api";

type Status = {
  exists?: boolean;
  is_approved?: boolean;
  is_rejected?: boolean;
  message?: string;
  payoutPerDelivery?: number;
};

type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
};

function guessMimeFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

function isValidShareCode(v: string) {
  const s = v.trim().toUpperCase();
  if (s.length < 6) return false;
  return /^[A-Z0-9-]+$/.test(s);
}

function isValidNINumber(v: string) {
  const s = v.trim().toUpperCase().replace(/\s/g, "");
  return /^[A-Z]{2}\d{6}[A-D]$/.test(s);
}

function isValidPhone(v: string) {
  const s = v.trim();
  const only = s.replace(/[^\d]/g, "");
  return only.length >= 8 && /^[+\d\s()-]+$/.test(s);
}

async function uriToBlob(uri: string) {
  const r = await fetch(uri);
  return await r.blob();
}

// ✅ BRUTALIST MONOCHROME PALETTE
const COLORS = {
  bg: '#FFFFFF',
  text: '#000000',
  border: '#E2E8F0',
  muted: '#666666',
  black: '#000000',
  white: '#FFFFFF',
  soft: '#F9F9F9',
  danger: '#D90429', // High-end pure red for errors/rejections
};

export default function AmbassadorScreen() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [vehicleType, setVehicleType] = useState(""); 
  const [shareCode, setShareCode] = useState("");
  const [niNumber, setNiNumber] = useState("");

  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [resume, setResume] = useState<PickedFile | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>({});

  const [locPerm, setLocPerm] = useState<"unknown" | "granted" | "denied">("unknown");
  const [tracking, setTracking] = useState(false);
  const [lastCoord, setLastCoord] = useState<{ lat: number; lng: number } | null>(null);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const intervalRef = useRef<any>(null);

  const payoutText = useMemo(() => {
    const p = status?.payoutPerDelivery;
    if (typeof p === "number" && !Number.isNaN(p)) return `£${p.toFixed(2)}`;
    return "£4.99";
  }, [status?.payoutPerDelivery]);

  useEffect(() => {
    (async () => {
      try {
        const uid = await AsyncStorage.getItem("userId");
        setUserId(uid);

        if (!uid) {
          setLoading(false);
          setStatus({ exists: false });
          return;
        }

        const s = await getAmbassadorStatus(uid);
        if (s?.error) {
          setStatus({ exists: false, message: s.error });
        } else {
          setStatus(s || {});
        }
      } catch {
        setStatus({ exists: false, message: "Failed to load status" });
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      stopTracking();
    };
  }, []);

  useEffect(() => {
    (async () => {
      if (!userId) return;
      if (!status?.is_approved) return;

      try {
        const token = await AsyncStorage.getItem("pushToken");
        if (!token) return;

        const plat: "ios" | "android" | "web" =
          Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";

        await registerAmbassadorToken(userId, plat, token);
      } catch {}
    })();
  }, [userId, status?.is_approved]);

  const reloadStatus = async () => {
    if (!userId) return;
    try {
      const s = await getAmbassadorStatus(userId);
      if (!s?.error) setStatus(s || {});
    } catch {}
  };

  const validateForm = () => {
    if (!fullName.trim()) return "Full name is required";
    if (!phone.trim()) return "Phone/WhatsApp is required";
    if (!isValidPhone(phone)) return "Enter a valid phone number";
    if (!city.trim()) return "City is required";
    if (!shareCode.trim()) return "Share Code is required";
    if (!isValidShareCode(shareCode)) return "Share Code looks invalid (use letters/numbers)";
    if (!niNumber.trim()) return "NI Number is required";
    if (!isValidNINumber(niNumber)) return "NI Number looks invalid (example: QQ123456C)";
    if (!photo) return "Photo upload is required";
    return null;
  };

  const pickPhoto = async () => {
    try {
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== "granted") {
          Alert.alert("Permission needed", "Allow photo access to upload your photo.");
          return;
        }
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;

      const name = asset.fileName || `photo-${Date.now()}.jpg`;
      const mimeType = asset.mimeType || guessMimeFromName(name) || "image/jpeg";

      setPhoto({ uri: asset.uri, name, mimeType });
    } catch {
      Alert.alert("Error", "Could not pick photo");
    }
  };

  const pickResume = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (res.canceled) return;
      const f = res.assets?.[0];
      if (!f?.uri) return;

      const name = f.name || `resume-${Date.now()}.pdf`;
      const mimeType = f.mimeType || guessMimeFromName(name);

      setResume({ uri: f.uri, name, mimeType });
    } catch {
      Alert.alert("Error", "Could not pick resume");
    }
  };

  const submitApplication = async () => {
    if (!userId) {
      Alert.alert("Login needed", "Please login first.");
      router.push("/login");
      return;
    }

    const err = validateForm();
    if (err) {
      Alert.alert("Missing / Invalid info", err);
      return;
    }

    try {
      setSubmitting(true);

      const form = new FormData();
      form.append("userId", userId);
      form.append("fullName", fullName.trim());
      form.append("phone", phone.trim());
      form.append("city", city.trim());
      form.append("vehicleType", vehicleType.trim());
      form.append("shareCode", shareCode.trim().toUpperCase());
      form.append("niNumber", niNumber.trim().toUpperCase().replace(/\s/g, ""));

      if (photo) {
        if (Platform.OS === "web") {
          const blob = await uriToBlob(photo.uri);
          // @ts-ignore
          form.append("photo", blob, photo.name);
        } else {
          // @ts-ignore
          form.append("photo", { uri: photo.uri, name: photo.name, type: photo.mimeType });
        }
      }

      if (resume) {
        if (Platform.OS === "web") {
          const blob = await uriToBlob(resume.uri);
          // @ts-ignore
          form.append("resume", blob, resume.name);
        } else {
          // @ts-ignore
          form.append("resume", { uri: resume.uri, name: resume.name, type: resume.mimeType });
        }
      }

      const res = await applyAmbassadorForm(form);

      if (res?.error) {
        Alert.alert("Failed", res.error);
        return;
      }

      Alert.alert("Submitted", "Application submitted. You will be notified once approved.");
      await reloadStatus();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Application failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== "granted") {
        setLocPerm("denied");
        Alert.alert("Permission needed", "Location permission is required to receive nearby delivery jobs.");
        return false;
      }

      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status !== "granted") {
        // still ok while app open
      }

      setLocPerm("granted");
      return true;
    } catch {
      setLocPerm("denied");
      return false;
    }
  };

  const startTracking = async () => {
    if (!userId) return;

    if (!status?.is_approved) {
      Alert.alert("Not approved", "You can start tracking after approval.");
      return;
    }

    const ok = await requestLocationPermission();
    if (!ok) return;

    try {
      setTracking(true);

      watcherRef.current?.remove?.();
      watcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 15,
        },
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLastCoord({ lat, lng });
        }
      );

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(async () => {
        try {
          const current =
            lastCoord ||
            (await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            }).then((p) => ({ lat: p.coords.latitude, lng: p.coords.longitude })));

          if (!current) return;

          await updateAmbassadorLocation(userId, current.lat, current.lng);
        } catch {}
      }, 30000);

      try {
        const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        setLastCoord({ lat, lng });
        await updateAmbassadorLocation(userId, lat, lng);
      } catch {}

      Alert.alert("TRACKING ACTIVE", "You are now transmitting telemetry to the network.");
    } catch {
      setTracking(false);
      Alert.alert("Error", "Could not start tracking.");
    }
  };

  const stopTracking = () => {
    try {
      watcherRef.current?.remove?.();
      watcherRef.current = null;

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;

      setTracking(false);
    } catch {}
  };

  const isApproved = !!status?.is_approved;
  const isRejected = !!status?.is_rejected;
  const isApplied = !!status?.exists || isApproved || isRejected;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            {/* <Text style={styles.headerMono}>// DEPT: LOGISTICS</Text> */}
            <Text style={styles.headerTitle}>AGENT NETWORK</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.black} size="large" />
          <Text style={styles.loadingText}>SYNCING RECORDS...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      
      {/* 🌟 BRUTALIST LOGISTICS HEADER */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerMono}>// DEPT: LOGISTICS</Text>
          <Text style={styles.headerTitle}>AGENT NETWORK</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>
              EARN <Text style={styles.highlight}>{payoutText}</Text>{"\n"}PER DROP.
            </Text>
            <Text style={styles.sub}>
              Turn your free time into earnings. Once approved, the network will ping you with local assignments based on your telemetry data.
            </Text>
          </View>

          {/* 📊 STATUS DASHBOARD */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionIndex}>01</Text>
              <Text style={styles.sectionTitle}>CLEARANCE STATUS</Text>
            </View>
            <View style={styles.cardBody}>
              {!userId ? (
                <Text style={styles.statusTextMuted}>USER AUTHENTICATION REQUIRED.</Text>
              ) : isApproved ? (
                <View>
                  <View style={[styles.statusBadge, { backgroundColor: COLORS.black }]}>
                    <Text style={[styles.statusBadgeText, { color: COLORS.white }]}>APPROVED & ACTIVE</Text>
                  </View>
                  <Text style={styles.statusHint}>You are cleared for assignments.</Text>
                </View>
              ) : isRejected ? (
                <View>
                  <View style={[styles.statusBadge, { backgroundColor: COLORS.danger, borderColor: COLORS.danger }]}>
                    <Text style={[styles.statusBadgeText, { color: COLORS.white }]}>CLEARANCE DENIED</Text>
                  </View>
                  <Text style={styles.statusHint}>{status?.message || "Please contact dispatch."}</Text>
                </View>
              ) : isApplied ? (
                <View>
                  <View style={[styles.statusBadge, { backgroundColor: COLORS.soft }]}>
                    <Text style={[styles.statusBadgeText, { color: COLORS.black }]}>PENDING REVIEW</Text>
                  </View>
                  <Text style={styles.statusHint}>{status?.message || "Data transmitted. Awaiting dispatch clearance."}</Text>
                </View>
              ) : (
                <Text style={styles.statusTextMuted}>NO MANIFEST FOUND. SUBMIT DATA BELOW.</Text>
              )}
            </View>
          </View>

          {/* 📍 APPROVED: LOCATION TRACKING */}
          {isApproved && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.sectionIndex}>02</Text>
                <Text style={styles.sectionTitle}>LIVE TELEMETRY</Text>
                <View style={[styles.pulseDot, tracking && styles.pulseDotActive]} />
              </View>
              
              <View style={styles.cardBody}>
                <Text style={styles.trackSub}>
                  Maintain active telemetry to receive localized assignment pings.
                </Text>

                <View style={styles.trackGrid}>
                  <View style={styles.trackRow}>
                    <Text style={styles.trackLabel}>GPS ACCESS</Text>
                    <Text style={styles.trackValue}>
                      {locPerm === "granted" ? "GRANTED" : locPerm === "denied" ? "DENIED" : "UNKNOWN"}
                    </Text>
                  </View>
                  <View style={styles.trackRow}>
                    <Text style={styles.trackLabel}>NETWORK STATUS</Text>
                    <Text style={styles.trackValue}>
                      {tracking ? "TRANSMITTING" : "OFFLINE"}
                    </Text>
                  </View>
                  {tracking && lastCoord && (
                    <View style={[styles.trackRow, { borderBottomWidth: 0 }]}>
                      <Text style={styles.trackLabel}>LAST PING</Text>
                      <Text style={[styles.trackValue, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>
                        {`${lastCoord.lat.toFixed(4)}, ${lastCoord.lng.toFixed(4)}`}
                      </Text>
                    </View>
                  )}
                </View>

                {!tracking ? (
                  <TouchableOpacity style={styles.primaryBtn} onPress={startTracking} activeOpacity={0.9}>
                    <Ionicons name="radio-outline" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
                    <Text style={styles.primaryBtnText}>ENABLE TELEMETRY</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.outlineBtn} onPress={stopTracking} activeOpacity={0.9}>
                    <Text style={styles.outlineBtnText}>GO OFFLINE</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* 📝 NOT APPLIED: APPLICATION FORM */}
          {!isApproved && !isApplied && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.sectionIndex}>02</Text>
                <Text style={styles.sectionTitle}>ONBOARDING MANIFEST</Text>
              </View>

              <View style={styles.cardBody}>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>LEGAL NAME</Text>
                  <TextInput value={fullName} onChangeText={setFullName} placeholder="JOHN DOE" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="characters" />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>COMMS NUMBER</Text>
                  <TextInput value={phone} onChangeText={setPhone} placeholder="+44 7123 456789" placeholderTextColor={COLORS.muted} keyboardType="phone-pad" style={styles.input} />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>OPERATIONAL ZONE (CITY)</Text>
                  <TextInput value={city} onChangeText={setCity} placeholder="LONDON" placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="characters" />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>TRANSPORT TYPE</Text>
                  <TextInput value={vehicleType} onChangeText={setVehicleType} placeholder="BICYCLE, SCOOTER..." placeholderTextColor={COLORS.muted} style={styles.input} autoCapitalize="characters" />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>RIGHT-TO-WORK CODE</Text>
                  <TextInput value={shareCode} onChangeText={setShareCode} placeholder="ABCD-EFGH-IJKL" placeholderTextColor={COLORS.muted} autoCapitalize="characters" style={[styles.input, styles.monoInput]} />
                  {!!shareCode.trim() && !isValidShareCode(shareCode) && <Text style={styles.warn}>INVALID FORMAT</Text>}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>NI NUMBER</Text>
                  <TextInput value={niNumber} onChangeText={setNiNumber} placeholder="QQ123456C" placeholderTextColor={COLORS.muted} autoCapitalize="characters" style={[styles.input, styles.monoInput]} />
                  {!!niNumber.trim() && !isValidNINumber(niNumber) && <Text style={styles.warn}>INVALID FORMAT (EX: QQ123456C)</Text>}
                </View>

                {/* File Uploads (Stark Block Design) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>ID VERIFICATION (REQ)</Text>
                  <TouchableOpacity style={styles.fileBtn} onPress={pickPhoto} activeOpacity={0.8}>
                    <Ionicons name="camera-outline" size={18} color={COLORS.black} style={{ marginRight: 8 }} />
                    <Text style={styles.fileBtnText}>{photo ? "OVERWRITE PHOTO" : "UPLOAD PHOTO ID"}</Text>
                  </TouchableOpacity>

                  {photo && (
                    <View style={styles.previewBox}>
                      <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                      <View style={{ flex: 1, paddingLeft: 12 }}>
                        <Text style={styles.fileName} numberOfLines={1}>{photo.name}</Text>
                        <TouchableOpacity onPress={() => setPhoto(null)} activeOpacity={0.8}>
                          <Text style={styles.removeText}>[ REMOVE ]</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>DOSSIER / CV (OPTIONAL)</Text>
                  <TouchableOpacity style={styles.fileBtn} onPress={pickResume} activeOpacity={0.8}>
                    <Ionicons name="document-text-outline" size={18} color={COLORS.black} style={{ marginRight: 8 }} />
                    <Text style={styles.fileBtnText}>{resume ? "OVERWRITE DOCUMENT" : "UPLOAD DOCUMENT"}</Text>
                  </TouchableOpacity>

                  {resume && (
                    <View style={styles.previewBox}>
                      <View style={styles.fileIcon}>
                        <Text style={{ color: COLORS.white, fontWeight: "900", fontSize: 10 }}>DOC</Text>
                      </View>
                      <View style={{ flex: 1, paddingLeft: 12 }}>
                        <Text style={styles.fileName} numberOfLines={1}>{resume.name}</Text>
                        <TouchableOpacity onPress={() => setResume(null)} activeOpacity={0.8}>
                          <Text style={styles.removeText}>[ REMOVE ]</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, submitting && { opacity: 0.7 }, { marginTop: 16 }]}
                  onPress={submitApplication}
                  activeOpacity={0.9}
                  disabled={submitting}
                >
                  {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryBtnText}>TRANSMIT MANIFEST</Text>}
                </TouchableOpacity>

                <Text style={styles.note}>
                  // BY SUBMITTING, YOU AUTHORIZE DISPATCH TO CONDUCT NECESSARY SECURITY CLEARANCES.
                </Text>
              </View>
            </View>
          )}

          {/* Pending Applied view */}
          {!isApproved && isApplied && !isRejected && (
            <TouchableOpacity style={styles.outlineBtn} onPress={reloadStatus} activeOpacity={0.8}>
              <Text style={styles.outlineBtnText}>REFRESH STATUS</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  // Brutalist Logistics Header
  headerContainer: {
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

  container: { paddingHorizontal: 20, paddingBottom: 40 },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: COLORS.black, marginTop: 16, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },

  heroSection: { marginBottom: 24, marginTop: 16 },
  heroTitle: { color: COLORS.black, fontSize: 32, fontFamily: 'IntegralCF-Bold', lineHeight: 36 },
  highlight: { color: COLORS.black }, 
  sub: { color: COLORS.muted, marginTop: 10, fontSize: 12, lineHeight: 18, fontWeight: '500' },

  // Waybill Card Aesthetics
  card: {
    borderWidth: 2,
    borderColor: COLORS.black,
    marginBottom: 20,
    backgroundColor: COLORS.white,
    borderRadius: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.black,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sectionIndex: {
    color: COLORS.white,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '900',
    fontSize: 12,
    marginRight: 10,
    opacity: 0.7,
  },
  sectionTitle: { 
    color: COLORS.white, 
    fontWeight: "900", 
    fontSize: 13,
    letterSpacing: 1.5,
    flex: 1,
  },
  cardBody: {
    padding: 16,
  },
  
  // Status Elements
  statusBadge: { 
    alignSelf: 'flex-start', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderWidth: 2,
    borderColor: COLORS.black,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  statusHint: { color: COLORS.muted, marginTop: 12, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  statusTextMuted: { color: COLORS.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  // Forms
  inputGroup: { marginBottom: 20 },
  label: { 
    color: COLORS.black, 
    fontSize: 10, 
    fontWeight: "800", 
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.black,
    color: COLORS.black,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    fontWeight: '600',
  },
  monoInput: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  warn: { color: COLORS.danger, fontSize: 10, marginTop: 6, fontWeight: '800', letterSpacing: 0.5 },

  // File Upload Buttons
  fileBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  fileBtnText: { color: COLORS.black, fontWeight: "800", fontSize: 11, letterSpacing: 1 },

  previewBox: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.soft,
  },
  photoPreview: { width: 44, height: 44, backgroundColor: COLORS.border, borderWidth: 1, borderColor: COLORS.black },
  fileIcon: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: { color: COLORS.black, fontWeight: "700", fontSize: 12, marginBottom: 4 },
  removeText: { color: COLORS.danger, fontWeight: "800", fontSize: 10, letterSpacing: 1 },

  // Tracking Details
  trackSub: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginBottom: 20, fontWeight: '600' },
  trackGrid: { borderTopWidth: 1, borderTopColor: COLORS.border, marginBottom: 20 },
  trackRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  trackLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  trackValue: { color: COLORS.black, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  
  pulseDot: { width: 10, height: 10, borderRadius: 0, backgroundColor: COLORS.muted },
  pulseDotActive: { backgroundColor: '#00FF00' }, // Terminal green for active tracking

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.black,
    paddingVertical: 18,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: COLORS.white, fontWeight: "900", fontSize: 12, letterSpacing: 1.5 },

  outlineBtn: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 0,
    alignItems: "center",
  },
  outlineBtnText: { color: COLORS.black, fontWeight: "900", fontSize: 12, letterSpacing: 1.5 },

  note: { 
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: COLORS.muted, 
    marginTop: 20, 
    fontSize: 9, 
    lineHeight: 14, 
    textAlign: 'center' 
  },
});














// // frontend/app/ambassador.tsx
// import React, { useEffect, useMemo, useRef, useState } from "react";
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   Alert,
//   Platform,
//   ScrollView,
//   TextInput,
//   ActivityIndicator,
//   KeyboardAvoidingView,
//   Image,
// } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { useRouter } from "expo-router";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { Ionicons } from "@expo/vector-icons";

// // Location (Expo)
// import * as Location from "expo-location";

// // File pickers (Expo)
// import * as ImagePicker from "expo-image-picker";
// import * as DocumentPicker from "expo-document-picker";

// // Your API functions
// import {
//   applyAmbassadorForm,
//   getAmbassadorStatus,
//   updateAmbassadorLocation,
//   registerAmbassadorToken,
// } from "../services/api";

// type Status = {
//   exists?: boolean;
//   is_approved?: boolean;
//   is_rejected?: boolean;
//   message?: string;
//   payoutPerDelivery?: number;
// };

// type PickedFile = {
//   uri: string;
//   name: string;
//   mimeType: string;
// };

// function guessMimeFromName(name: string) {
//   const lower = name.toLowerCase();
//   if (lower.endsWith(".png")) return "image/png";
//   if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
//   if (lower.endsWith(".pdf")) return "application/pdf";
//   if (lower.endsWith(".doc")) return "application/msword";
//   if (lower.endsWith(".docx"))
//     return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
//   return "application/octet-stream";
// }

// function isValidShareCode(v: string) {
//   const s = v.trim().toUpperCase();
//   if (s.length < 6) return false;
//   return /^[A-Z0-9-]+$/.test(s);
// }

// function isValidNINumber(v: string) {
//   const s = v.trim().toUpperCase().replace(/\s/g, "");
//   return /^[A-Z]{2}\d{6}[A-D]$/.test(s);
// }

// function isValidPhone(v: string) {
//   const s = v.trim();
//   const only = s.replace(/[^\d]/g, "");
//   return only.length >= 8 && /^[+\d\s()-]+$/.test(s);
// }

// async function uriToBlob(uri: string) {
//   const r = await fetch(uri);
//   return await r.blob();
// }

// // ✅ UNIQUE AMBASSADOR PALETTE (Inverted Top, Neon Accent)
// const COLORS = {
//   black: '#000000',
//   white: '#FFFFFF',
//   neon: '#CCFF00', // High-fashion technical lime green for 'Active' states
//   mutedDark: '#666666',
//   mutedLight: '#A0A0A0',
//   borderDark: '#333333',
//   borderLight: '#E5E5E5',
//   danger: '#FF0033', // Stark red
// };

// export default function AmbassadorScreen() {
//   const router = useRouter();

//   const [userId, setUserId] = useState<string | null>(null);

//   const [fullName, setFullName] = useState("");
//   const [phone, setPhone] = useState("");
//   const [city, setCity] = useState("");
//   const [vehicleType, setVehicleType] = useState(""); 
//   const [shareCode, setShareCode] = useState("");
//   const [niNumber, setNiNumber] = useState("");

//   const [photo, setPhoto] = useState<PickedFile | null>(null);
//   const [resume, setResume] = useState<PickedFile | null>(null);

//   const [loading, setLoading] = useState(true);
//   const [submitting, setSubmitting] = useState(false);
//   const [status, setStatus] = useState<Status>({});

//   const [locPerm, setLocPerm] = useState<"unknown" | "granted" | "denied">("unknown");
//   const [tracking, setTracking] = useState(false);
//   const [lastCoord, setLastCoord] = useState<{ lat: number; lng: number } | null>(null);
//   const watcherRef = useRef<Location.LocationSubscription | null>(null);
//   const intervalRef = useRef<any>(null);

//   const payoutText = useMemo(() => {
//     const p = status?.payoutPerDelivery;
//     if (typeof p === "number" && !Number.isNaN(p)) return `£${p.toFixed(2)}`;
//     return "£4.99";
//   }, [status?.payoutPerDelivery]);

//   useEffect(() => {
//     (async () => {
//       try {
//         const uid = await AsyncStorage.getItem("userId");
//         setUserId(uid);

//         if (!uid) {
//           setLoading(false);
//           setStatus({ exists: false });
//           return;
//         }

//         const s = await getAmbassadorStatus(uid);
//         if (s?.error) {
//           setStatus({ exists: false, message: s.error });
//         } else {
//           setStatus(s || {});
//         }
//       } catch {
//         setStatus({ exists: false, message: "Failed to load status" });
//       } finally {
//         setLoading(false);
//       }
//     })();

//     return () => {
//       stopTracking();
//     };
//   }, []);

//   useEffect(() => {
//     (async () => {
//       if (!userId) return;
//       if (!status?.is_approved) return;

//       try {
//         const token = await AsyncStorage.getItem("pushToken");
//         if (!token) return;

//         const plat: "ios" | "android" | "web" =
//           Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";

//         await registerAmbassadorToken(userId, plat, token);
//       } catch {}
//     })();
//   }, [userId, status?.is_approved]);

//   const reloadStatus = async () => {
//     if (!userId) return;
//     try {
//       const s = await getAmbassadorStatus(userId);
//       if (!s?.error) setStatus(s || {});
//     } catch {}
//   };

//   const validateForm = () => {
//     if (!fullName.trim()) return "Full name is required";
//     if (!phone.trim()) return "Phone/WhatsApp is required";
//     if (!isValidPhone(phone)) return "Enter a valid phone number";
//     if (!city.trim()) return "City is required";
//     if (!shareCode.trim()) return "Share Code is required";
//     if (!isValidShareCode(shareCode)) return "Share Code looks invalid (use letters/numbers)";
//     if (!niNumber.trim()) return "NI Number is required";
//     if (!isValidNINumber(niNumber)) return "NI Number looks invalid (example: QQ123456C)";
//     if (!photo) return "Photo upload is required";
//     return null;
//   };

//   const pickPhoto = async () => {
//     try {
//       if (Platform.OS !== "web") {
//         const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
//         if (perm.status !== "granted") {
//           Alert.alert("Permission needed", "Allow photo access to upload your photo.");
//           return;
//         }
//       }

//       const res = await ImagePicker.launchImageLibraryAsync({
//         mediaTypes: ImagePicker.MediaTypeOptions.Images,
//         quality: 0.9,
//         allowsEditing: true,
//         aspect: [1, 1],
//       });

//       if (res.canceled) return;
//       const asset = res.assets?.[0];
//       if (!asset?.uri) return;

//       const name = asset.fileName || `photo-${Date.now()}.jpg`;
//       const mimeType = asset.mimeType || guessMimeFromName(name) || "image/jpeg";

//       setPhoto({ uri: asset.uri, name, mimeType });
//     } catch {
//       Alert.alert("Error", "Could not pick photo");
//     }
//   };

//   const pickResume = async () => {
//     try {
//       const res = await DocumentPicker.getDocumentAsync({
//         type: [
//           "application/pdf",
//           "application/msword",
//           "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//         ],
//         copyToCacheDirectory: true,
//         multiple: false,
//       });

//       if (res.canceled) return;
//       const f = res.assets?.[0];
//       if (!f?.uri) return;

//       const name = f.name || `resume-${Date.now()}.pdf`;
//       const mimeType = f.mimeType || guessMimeFromName(name);

//       setResume({ uri: f.uri, name, mimeType });
//     } catch {
//       Alert.alert("Error", "Could not pick resume");
//     }
//   };

//   const submitApplication = async () => {
//     if (!userId) {
//       Alert.alert("Login needed", "Please login first.");
//       router.push("/login");
//       return;
//     }

//     const err = validateForm();
//     if (err) {
//       Alert.alert("Missing / Invalid info", err);
//       return;
//     }

//     try {
//       setSubmitting(true);

//       const form = new FormData();
//       form.append("userId", userId);
//       form.append("fullName", fullName.trim());
//       form.append("phone", phone.trim());
//       form.append("city", city.trim());
//       form.append("vehicleType", vehicleType.trim());
//       form.append("shareCode", shareCode.trim().toUpperCase());
//       form.append("niNumber", niNumber.trim().toUpperCase().replace(/\s/g, ""));

//       if (photo) {
//         if (Platform.OS === "web") {
//           const blob = await uriToBlob(photo.uri);
//           // @ts-ignore
//           form.append("photo", blob, photo.name);
//         } else {
//           // @ts-ignore
//           form.append("photo", { uri: photo.uri, name: photo.name, type: photo.mimeType });
//         }
//       }

//       if (resume) {
//         if (Platform.OS === "web") {
//           const blob = await uriToBlob(resume.uri);
//           // @ts-ignore
//           form.append("resume", blob, resume.name);
//         } else {
//           // @ts-ignore
//           form.append("resume", { uri: resume.uri, name: resume.name, type: resume.mimeType });
//         }
//       }

//       const res = await applyAmbassadorForm(form);

//       if (res?.error) {
//         Alert.alert("Failed", res.error);
//         return;
//       }

//       Alert.alert("Submitted", "Application submitted. You will be notified once approved.");
//       await reloadStatus();
//     } catch (e: any) {
//       Alert.alert("Error", e?.message || "Application failed. Try again.");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const requestLocationPermission = async () => {
//     try {
//       const fg = await Location.requestForegroundPermissionsAsync();
//       if (fg.status !== "granted") {
//         setLocPerm("denied");
//         Alert.alert("Permission needed", "Location permission is required to receive nearby delivery jobs.");
//         return false;
//       }

//       const bg = await Location.requestBackgroundPermissionsAsync();
//       if (bg.status !== "granted") {
//         // still ok while app open
//       }

//       setLocPerm("granted");
//       return true;
//     } catch {
//       setLocPerm("denied");
//       return false;
//     }
//   };

//   const startTracking = async () => {
//     if (!userId) return;

//     if (!status?.is_approved) {
//       Alert.alert("Not approved", "You can start tracking after approval.");
//       return;
//     }

//     const ok = await requestLocationPermission();
//     if (!ok) return;

//     try {
//       setTracking(true);

//       watcherRef.current?.remove?.();
//       watcherRef.current = await Location.watchPositionAsync(
//         {
//           accuracy: Location.Accuracy.Balanced,
//           timeInterval: 5000,
//           distanceInterval: 15,
//         },
//         (pos) => {
//           const lat = pos.coords.latitude;
//           const lng = pos.coords.longitude;
//           setLastCoord({ lat, lng });
//         }
//       );

//       if (intervalRef.current) clearInterval(intervalRef.current);
//       intervalRef.current = setInterval(async () => {
//         try {
//           const current =
//             lastCoord ||
//             (await Location.getCurrentPositionAsync({
//               accuracy: Location.Accuracy.Balanced,
//             }).then((p) => ({ lat: p.coords.latitude, lng: p.coords.longitude })));

//           if (!current) return;

//           await updateAmbassadorLocation(userId, current.lat, current.lng);
//         } catch {}
//       }, 30000);

//       try {
//         const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
//         const lat = p.coords.latitude;
//         const lng = p.coords.longitude;
//         setLastCoord({ lat, lng });
//         await updateAmbassadorLocation(userId, lat, lng);
//       } catch {}

//       Alert.alert("TELEMETRY ONLINE", "You are now visible to the dispatch network.");
//     } catch {
//       setTracking(false);
//       Alert.alert("Error", "Could not start tracking.");
//     }
//   };

//   const stopTracking = () => {
//     try {
//       watcherRef.current?.remove?.();
//       watcherRef.current = null;

//       if (intervalRef.current) clearInterval(intervalRef.current);
//       intervalRef.current = null;

//       setTracking(false);
//     } catch {}
//   };

//   const isApproved = !!status?.is_approved;
//   const isRejected = !!status?.is_rejected;
//   const isApplied = !!status?.exists || isApproved || isRejected;

//   if (loading) {
//     return (
//       <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.black }]}>
//         <View style={styles.headerDark}>
//           <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.backBtn}>
//             <Ionicons name="arrow-back" size={24} color={COLORS.white} />
//           </TouchableOpacity>
//           <Text style={styles.headerTitleDark}>AGENT PORTAL</Text>
//           <View style={{ width: 40 }} />
//         </View>
//         <View style={styles.center}>
//           <ActivityIndicator color={COLORS.neon} size="large" />
//           <Text style={styles.loadingTextDark}>DECRYPTING RECORDS...</Text>
//         </View>
//       </SafeAreaView>
//     );
//   }

//   return (
//     <SafeAreaView style={styles.safe} edges={['top']}>
//       <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
//         <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          
//           {/* 🌑 DARK ZONE: Top Half (Header, Hero, Status) */}
//           <View style={styles.darkZone}>
            
//             <View style={styles.headerDark}>
//               <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.backBtn}>
//                 <Ionicons name="arrow-back" size={24} color={COLORS.white} />
//               </TouchableOpacity>
//               <Text style={styles.headerTitleDark}>AGENT PORTAL</Text>
//               <View style={{ width: 40 }} />
//             </View>

//             <View style={styles.heroSection}>
//               <Text style={styles.heroSubMono}>// SECURE ONBOARDING</Text>
//               <Text style={styles.heroTitle}>
//                 JOIN THE FLEET.{"\n"}EARN <Text style={styles.highlight}>{payoutText}</Text>.
//               </Text>
//             </View>

//             {/* STATUS DASHBOARD */}
//             <View style={styles.statusBox}>
//               <Text style={styles.statusLabel}>CLEARANCE STATUS</Text>
              
//               {!userId ? (
//                 <Text style={styles.statusValueMuted}>AUTH REQUIRED</Text>
//               ) : isApproved ? (
//                 <View>
//                   <View style={styles.statusBadgeNeon}>
//                     <Text style={styles.statusBadgeTextNeon}>APPROVED</Text>
//                   </View>
//                   <Text style={styles.statusHintLight}>You are cleared for dispatch.</Text>
//                 </View>
//               ) : isRejected ? (
//                 <View>
//                   <View style={styles.statusBadgeDanger}>
//                     <Text style={styles.statusBadgeTextWhite}>DENIED</Text>
//                   </View>
//                   <Text style={styles.statusHintLight}>{status?.message || "Contact central dispatch."}</Text>
//                 </View>
//               ) : isApplied ? (
//                 <View>
//                   <View style={styles.statusBadgeWhite}>
//                     <Text style={styles.statusBadgeTextBlack}>PENDING</Text>
//                   </View>
//                   <Text style={styles.statusHintLight}>{status?.message || "Awaiting verification."}</Text>
//                 </View>
//               ) : (
//                 <Text style={styles.statusValueMuted}>NO DOSSIER FOUND</Text>
//               )}
//             </View>

//           </View>

//           {/* 🌕 LIGHT ZONE: Bottom Half (Tracking or Form) */}
//           <View style={styles.lightZone}>
            
//             {/* 📍 APPROVED: LOCATION TRACKING */}
//             {isApproved && (
//               <View style={styles.trackingSection}>
//                 <View style={styles.trackingHeader}>
//                   <Text style={styles.sectionTitleBlack}>TELEMETRY LINK</Text>
//                   {tracking && <View style={styles.pulseDotNeon} />}
//                 </View>

//                 <View style={styles.trackingReadout}>
//                   <Text style={styles.readoutLabel}>SIGNAL STATUS</Text>
//                   <Text style={[styles.readoutValue, tracking ? { color: COLORS.black } : { color: COLORS.mutedLight }]}>
//                     {tracking ? "TRANSMITTING" : "OFFLINE"}
//                   </Text>
                  
//                   {tracking && lastCoord && (
//                     <>
//                       <Text style={[styles.readoutLabel, { marginTop: 16 }]}>LAST COORDINATES</Text>
//                       <Text style={styles.readoutMono}>
//                         {lastCoord.lat.toFixed(6)} // {lastCoord.lng.toFixed(6)}
//                       </Text>
//                     </>
//                   )}
//                 </View>

//                 {!tracking ? (
//                   <TouchableOpacity style={styles.btnBlack} onPress={startTracking} activeOpacity={0.9}>
//                     <Ionicons name="radio-outline" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
//                     <Text style={styles.btnTextWhite}>ENABLE TELEMETRY</Text>
//                   </TouchableOpacity>
//                 ) : (
//                   <TouchableOpacity style={styles.btnOutline} onPress={stopTracking} activeOpacity={0.9}>
//                     <Text style={styles.btnTextBlack}>SEVER CONNECTION</Text>
//                   </TouchableOpacity>
//                 )}
//               </View>
//             )}

//             {/* 📝 NOT APPLIED: FORM */}
//             {!isApproved && !isApplied && (
//               <View style={styles.formSection}>
//                 <Text style={styles.sectionTitleBlack}>CLEARANCE APPLICATION</Text>
//                 <Text style={styles.formDesc}>Provide identity details to initialize background check.</Text>

//                 {/* Editorial "Document Fill-in" Inputs */}
//                 <View style={styles.docInputGroup}>
//                   <Text style={styles.docLabel}>LEGAL NAME</Text>
//                   <TextInput value={fullName} onChangeText={setFullName} placeholder="JOHN DOE" placeholderTextColor={COLORS.mutedLight} style={styles.docInput} autoCapitalize="characters" />
//                 </View>

//                 <View style={styles.docInputGroup}>
//                   <Text style={styles.docLabel}>COMMS NUMBER</Text>
//                   <TextInput value={phone} onChangeText={setPhone} placeholder="+44 7123 456789" placeholderTextColor={COLORS.mutedLight} keyboardType="phone-pad" style={styles.docInput} />
//                 </View>

//                 <View style={styles.docInputGroup}>
//                   <Text style={styles.docLabel}>CITY OF OPERATION</Text>
//                   <TextInput value={city} onChangeText={setCity} placeholder="LONDON" placeholderTextColor={COLORS.mutedLight} style={styles.docInput} autoCapitalize="characters" />
//                 </View>

//                 <View style={styles.docInputGroup}>
//                   <Text style={styles.docLabel}>VEHICLE TYPE</Text>
//                   <TextInput value={vehicleType} onChangeText={setVehicleType} placeholder="BICYCLE, SCOOTER..." placeholderTextColor={COLORS.mutedLight} style={styles.docInput} autoCapitalize="characters" />
//                 </View>

//                 <View style={styles.docInputGroup}>
//                   <Text style={styles.docLabel}>SHARE CODE (RTW)</Text>
//                   <TextInput value={shareCode} onChangeText={setShareCode} placeholder="ABCD-EFGH-IJKL" placeholderTextColor={COLORS.mutedLight} autoCapitalize="characters" style={[styles.docInput, styles.monoText]} />
//                   {!!shareCode.trim() && !isValidShareCode(shareCode) && <Text style={styles.warnText}>INVALID FORMAT</Text>}
//                 </View>

//                 <View style={styles.docInputGroup}>
//                   <Text style={styles.docLabel}>NI NUMBER</Text>
//                   <TextInput value={niNumber} onChangeText={setNiNumber} placeholder="QQ123456C" placeholderTextColor={COLORS.mutedLight} autoCapitalize="characters" style={[styles.docInput, styles.monoText]} />
//                   {!!niNumber.trim() && !isValidNINumber(niNumber) && <Text style={styles.warnText}>INVALID FORMAT</Text>}
//                 </View>

//                 {/* File Uploads */}
//                 <View style={styles.uploadGroup}>
//                   <Text style={styles.docLabel}>ID PHOTO</Text>
//                   <TouchableOpacity style={styles.uploadBtn} onPress={pickPhoto} activeOpacity={0.8}>
//                     <Text style={styles.uploadBtnText}>{photo ? "OVERWRITE PHOTO" : "+ ATTACH PHOTO"}</Text>
//                   </TouchableOpacity>
//                   {photo && (
//                     <View style={styles.fileRow}>
//                       <Image source={{ uri: photo.uri }} style={styles.fileThumb} />
//                       <Text style={styles.fileName} numberOfLines={1}>{photo.name}</Text>
//                     </View>
//                   )}
//                 </View>

//                 <View style={styles.uploadGroup}>
//                   <Text style={styles.docLabel}>DOSSIER (CV)</Text>
//                   <TouchableOpacity style={styles.uploadBtn} onPress={pickResume} activeOpacity={0.8}>
//                     <Text style={styles.uploadBtnText}>{resume ? "OVERWRITE DOCUMENT" : "+ ATTACH DOC"}</Text>
//                   </TouchableOpacity>
//                   {resume && (
//                     <View style={styles.fileRow}>
//                       <View style={styles.fileThumbPlaceholder}><Text style={styles.thumbText}>DOC</Text></View>
//                       <Text style={styles.fileName} numberOfLines={1}>{resume.name}</Text>
//                     </View>
//                   )}
//                 </View>

//                 <TouchableOpacity
//                   style={[styles.btnBlack, submitting && { opacity: 0.7 }, { marginTop: 40 }]}
//                   onPress={submitApplication}
//                   activeOpacity={0.9}
//                   disabled={submitting}
//                 >
//                   {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnTextWhite}>TRANSMIT DOSSIER</Text>}
//                 </TouchableOpacity>
//               </View>
//             )}

//             {/* Pending Applied view */}
//             {!isApproved && isApplied && !isRejected && (
//               <TouchableOpacity style={styles.btnOutline} onPress={reloadStatus} activeOpacity={0.8}>
//                 <Text style={styles.btnTextBlack}>REFRESH STATUS</Text>
//               </TouchableOpacity>
//             )}

//             <SafeAreaView edges={['bottom']} style={{ backgroundColor: COLORS.white }} />
//           </View>
//         </ScrollView>
//       </KeyboardAvoidingView>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   safe: { flex: 1, backgroundColor: COLORS.black }, // Top half is black
  
//   center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.black },
//   loadingTextDark: { color: COLORS.neon, marginTop: 16, fontSize: 11, fontWeight: '800', letterSpacing: 2 },

//   // 🌑 DARK ZONE
//   darkZone: {
//     backgroundColor: COLORS.black,
//     paddingHorizontal: 20,
//     paddingTop: 10,
//     paddingBottom: 40,
//   },
//   headerDark: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 30,
//   },
//   backBtn: { paddingVertical: 8, paddingRight: 10, marginLeft: -8 },
//   headerTitleDark: { color: COLORS.white, fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  
//   heroSection: { marginBottom: 40 },
//   heroSubMono: { color: COLORS.mutedLight, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 10, letterSpacing: 1.5, marginBottom: 12 },
//   heroTitle: { color: COLORS.white, fontSize: 38, fontFamily: 'IntegralCF-Bold', lineHeight: 42, textTransform: 'uppercase' },
//   highlight: { color: COLORS.neon },

//   statusBox: {
//     borderTopWidth: 1,
//     borderTopColor: COLORS.borderDark,
//     paddingTop: 20,
//   },
//   statusLabel: { color: COLORS.mutedLight, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
//   statusValueMuted: { color: COLORS.mutedDark, fontSize: 24, fontFamily: 'IntegralCF-Bold' },
//   statusHintLight: { color: COLORS.mutedLight, fontSize: 12, fontWeight: '500', marginTop: 12, letterSpacing: 0.5 },
  
//   statusBadgeNeon: { backgroundColor: COLORS.neon, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8 },
//   statusBadgeTextNeon: { color: COLORS.black, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  
//   statusBadgeDanger: { backgroundColor: COLORS.danger, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8 },
//   statusBadgeTextWhite: { color: COLORS.white, fontSize: 14, fontWeight: '900', letterSpacing: 1 },

//   statusBadgeWhite: { backgroundColor: COLORS.white, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8 },
//   statusBadgeTextBlack: { color: COLORS.black, fontSize: 14, fontWeight: '900', letterSpacing: 1 },

//   // 🌕 LIGHT ZONE
//   lightZone: {
//     flex: 1,
//     backgroundColor: COLORS.white,
//     paddingHorizontal: 20,
//     paddingTop: 40,
//     paddingBottom: 40,
//   },
//   sectionTitleBlack: { color: COLORS.black, fontSize: 18, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },

//   // Tracking
//   trackingSection: { width: '100%' },
//   trackingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
//   pulseDotNeon: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.neon, borderWidth: 2, borderColor: COLORS.black },
  
//   trackingReadout: {
//     borderWidth: 2,
//     borderColor: COLORS.black,
//     padding: 20,
//     marginBottom: 30,
//   },
//   readoutLabel: { color: COLORS.mutedDark, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
//   readoutValue: { color: COLORS.black, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
//   readoutMono: { color: COLORS.black, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 16, fontWeight: '700', letterSpacing: 1 },

//   // Form (Document Style)
//   formSection: { width: '100%' },
//   formDesc: { color: COLORS.mutedDark, fontSize: 12, fontWeight: '500', marginBottom: 30 },

//   docInputGroup: { marginBottom: 24 },
//   docLabel: { color: COLORS.black, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
//   docInput: {
//     borderBottomWidth: 2,
//     borderBottomColor: COLORS.black,
//     paddingVertical: 10,
//     fontSize: 16,
//     fontWeight: '700',
//     color: COLORS.black,
//   },
//   monoText: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 1 },
//   warnText: { color: COLORS.danger, fontSize: 10, fontWeight: '800', marginTop: 8, letterSpacing: 0.5 },

//   // Uploads
//   uploadGroup: { marginBottom: 30 },
//   uploadBtn: {
//     borderWidth: 1,
//     borderStyle: 'dashed',
//     borderColor: COLORS.black,
//     paddingVertical: 16,
//     alignItems: 'center',
//   },
//   uploadBtnText: { color: COLORS.black, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
//   fileRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
//   fileThumb: { width: 40, height: 40, borderWidth: 1, borderColor: COLORS.black, marginRight: 12 },
//   fileThumbPlaceholder: { width: 40, height: 40, backgroundColor: COLORS.black, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
//   thumbText: { color: COLORS.white, fontSize: 9, fontWeight: '900' },
//   fileName: { color: COLORS.black, fontSize: 12, fontWeight: '600', flex: 1 },

//   // Generic Buttons
//   btnBlack: {
//     backgroundColor: COLORS.black,
//     flexDirection: 'row',
//     paddingVertical: 20,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   btnTextWhite: { color: COLORS.white, fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  
//   btnOutline: {
//     borderWidth: 2,
//     borderColor: COLORS.black,
//     paddingVertical: 20,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   btnTextBlack: { color: COLORS.black, fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
// });