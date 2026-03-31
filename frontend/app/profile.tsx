// frontend/app/profile.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import {
  getUserProfile,
  updateUserProfile,
  deleteMyAccount,
  buyItem,
  requestPhoneOtp,
  verifyPhoneOtp,
  getStripeConnectStatus,
  stripeConnectOnboard,
  stripeConnectDashboard,
} from "../services/api";

const COLORS = {
  bg: "#FFFFFF",
  text: "#000000",
  border: "#000000",
  muted: "#888888",
  lightGray: "#E5E5E5",
  danger: "#D90429",
  soft: "#FAFAFA",
  ok: "#0B8A3E",
  warn: "#B45309",
};

type UserProfile = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  created_at?: string;
  email_verified?: boolean;
  phone_verified?: boolean;
};

type StripeStatus = {
  connected: boolean;
  stripe_account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements?: any;
};

const PENDING_BUY_KEY = "pendingBuyItemId";

export default function ProfileScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [autoBuyLoading, setAutoBuyLoading] = useState(false);

  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [email, setEmail] = useState("-");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [bannerFromBuyFlow, setBannerFromBuyFlow] = useState(false);

  const normalizePhone = (raw: string) => {
    return String(raw || "").replace(/\s+/g, "").trim();
  };

  const isPhoneValid = (p: string) => {
    const x = normalizePhone(p);
    return /^\+\d{8,15}$/.test(x);
  };

  const loadStripeStatus = useCallback(async (uid: string) => {
    try {
      const st = await getStripeConnectStatus(uid);
      if (st) setStripeStatus(st);
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const uid = await AsyncStorage.getItem("userId");
      setUserId(uid);

      if (!uid) {
        router.replace("/login");
        return;
      }

      const pending = await AsyncStorage.getItem(PENDING_BUY_KEY);
      setBannerFromBuyFlow(!!pending);

      const res = await getUserProfile(uid);

      if (res?.user) {
        const u: UserProfile = res.user;
        setProfile(u);
        setEmail(u.email || "-");
        setName(u.name || "");
        setPhone(u.phone || "");
      } else {
        Alert.alert("Error", res?.error || "Failed to load profile");
      }

      await loadStripeStatus(uid);
    } catch {
      Alert.alert("Error", "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [router, loadStripeStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const saveChanges = async () => {
    if (!userId) return;

    if (name.trim().length < 2) {
      Alert.alert("Error", "Name must be at least 2 characters.");
      return;
    }

    const cleanedPhone = normalizePhone(phone);
    if (cleanedPhone && !isPhoneValid(cleanedPhone)) {
      Alert.alert("Invalid phone", "Enter phone number in international format, e.g. +447911123456");
      return;
    }

    try {
      setSaving(true);
      const res = await updateUserProfile(userId, {
        name: name.trim(),
        phone: cleanedPhone,
      });

      if (res?.error) {
        Alert.alert("Update failed", res.error || "Update failed.");
        return;
      }

      if (res?.user) {
        const u: UserProfile = res.user;
        setProfile(u);
        setEmail(u.email || "-");
        setName(u.name || "");
        setPhone(u.phone || "");
      }

      Alert.alert("SUCCESS", "DOSSIER UPDATED");
    } catch {
      Alert.alert("Error", "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const runDelete = async () => {
    if (!userId) return;

    try {
      setDeleting(true);

      const res = await deleteMyAccount(userId);
      if (res?.error) {
        Alert.alert("Delete failed", res.error || "Unable to delete account.");
        return;
      }

      await AsyncStorage.multiRemove(["userId", "userName", "token", PENDING_BUY_KEY]);

      if (Platform.OS === "web") {
        window.alert("Account deleted successfully");
      } else {
        Alert.alert("Deleted", "Account deleted successfully");
      }

      router.replace("/login");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to delete account.");
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteAccount = () => {
    if (!userId) return;

    if (Platform.OS === "web") {
      const ok = window.confirm(
        "Delete account?\n\nAre you sure you want to delete your account?\nYour account will be deactivated and you will be logged out."
      );
      if (ok) runDelete();
      return;
    }

    Alert.alert(
      "Delete account?",
      "Are you sure you want to delete your account? Your account will be deactivated and you will be logged out.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: deleting ? "Deleting..." : "Yes, delete",
          style: "destructive",
          onPress: runDelete,
        },
      ]
    );
  };

  const getInitials = () => {
    const safeName = (name || "").trim();
    if (!safeName) return "US";
    const parts = safeName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return safeName.substring(0, 2).toUpperCase();
  };

  const startOtp = async () => {
    const cleanedPhone = normalizePhone(phone);

    if (!userId) {
      Alert.alert("Error", "User not found. Please login again.");
      return;
    }

    if (!cleanedPhone) {
      Alert.alert("Phone required", "Please enter your phone number first.");
      return;
    }

    if (!isPhoneValid(cleanedPhone)) {
      Alert.alert("Invalid phone", "Enter phone number in international format, e.g. +447911123456");
      return;
    }

    try {
      setOtpLoading(true);

      const up = await updateUserProfile(userId, { phone: cleanedPhone });
      if (up?.error) {
        Alert.alert("Update failed", up.error || "Could not save phone number.");
        return;
      }

      const res = await requestPhoneOtp(userId, cleanedPhone);
      if (res?.error) {
        Alert.alert("OTP failed", res.error || "Failed to send OTP");
        return;
      }

      setOtpSent(true);
      Alert.alert("OTP Sent", "We sent a verification code to your phone.");
    } catch {
      Alert.alert("OTP failed", "Failed to send OTP");
    } finally {
      setOtpLoading(false);
    }
  };

  const completeVerification = async () => {
    const cleanedPhone = normalizePhone(phone);

    if (!userId) {
      Alert.alert("Error", "User not found. Please login again.");
      return;
    }

    if (!isPhoneValid(cleanedPhone)) {
      Alert.alert("Invalid phone", "Enter phone number in international format, e.g. +447911123456");
      return;
    }

    if (!otpCode.trim() || otpCode.trim().length < 4) {
      Alert.alert("Enter code", "Please enter the OTP code.");
      return;
    }

    try {
      setVerifyLoading(true);

      const res = await verifyPhoneOtp(userId, cleanedPhone, otpCode.trim());

      if (res?.error) {
        Alert.alert("Verification failed", res.error || "Invalid code");
        return;
      }

      setProfile((p) => (p ? { ...p, phone_verified: true, phone: cleanedPhone } : p));
      setOtpSent(false);
      setOtpCode("");

      Alert.alert("Verified", "Phone number verified successfully.");
      await runAutoBuyIfPending();
    } catch {
      Alert.alert("Verification failed", "Invalid code or expired");
    } finally {
      setVerifyLoading(false);
    }
  };

  const runAutoBuyIfPending = async () => {
    try {
      if (!userId) return;

      const pendingBuyItemId = await AsyncStorage.getItem(PENDING_BUY_KEY);
      if (!pendingBuyItemId) return;

      setAutoBuyLoading(true);

      const result = await buyItem(pendingBuyItemId, userId);

      if (result?.error) {
        Alert.alert(
          "Auto-buy failed",
          result?.message || "Could not complete purchase automatically. Please try again."
        );
        return;
      }

      await AsyncStorage.removeItem(PENDING_BUY_KEY);

      Alert.alert("Purchase successful", "Your purchase was completed after verification.");
      router.push("/marketplace");
    } catch {
      Alert.alert("Auto-buy failed", "Please try buying again.");
    } finally {
      setAutoBuyLoading(false);
    }
  };

  const openStripeOnboarding = async () => {
    if (!userId) return;

    try {
      setStripeLoading(true);
      const res = await stripeConnectOnboard(userId);

      if (res?.error || !res?.url) {
        Alert.alert("Stripe", res?.message || res?.error || "Could not start Stripe onboarding.");
        return;
      }

      await Linking.openURL(res.url);

      setTimeout(() => {
        loadStripeStatus(userId);
      }, 1200);
    } catch {
      Alert.alert("Stripe", "Could not open Stripe onboarding.");
    } finally {
      setStripeLoading(false);
    }
  };

  const openStripeDashboard = async () => {
    if (!userId) return;

    try {
      setStripeLoading(true);
      const res = await stripeConnectDashboard(userId);

      if (res?.error || !res?.url) {
        Alert.alert("Stripe", res?.message || res?.error || "Could not open payouts dashboard.");
        return;
      }

      await Linking.openURL(res.url);
    } catch {
      Alert.alert("Stripe", "Could not open payouts dashboard.");
    } finally {
      setStripeLoading(false);
    }
  };

  const phoneVerified = !!profile?.phone_verified;

  const stripeConnected = !!stripeStatus?.connected;
  const stripeReady =
    !!stripeStatus?.connected &&
    !!stripeStatus?.charges_enabled &&
    !!stripeStatus?.payouts_enabled &&
    !!stripeStatus?.details_submitted;

  const stripeBadge = () => {
    if (!stripeConnected) {
      return { label: "NOT CONNECTED", color: COLORS.danger, bg: "#FFF5F5" };
    }
    if (!stripeReady) {
      return { label: "SETUP INCOMPLETE", color: COLORS.warn, bg: "#FFFBEB" };
    }
    return { label: "READY", color: COLORS.ok, bg: "#F2FFF6" };
  };

  const sb = stripeBadge();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <Text style={styles.headerMono}>DOC. REF: PRF-001</Text>
          <Text style={styles.headerTitle}>USER DOSSIER</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.text} />
          <Text style={styles.loadingText}>RETRIEVING RECORDS...</Text>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.idBadge}>
              <View style={styles.idAvatarBox}>
                <Text style={styles.idAvatarText}>{getInitials()}</Text>
              </View>
              <View style={styles.idInfoBox}>
                <Text style={styles.idLabel}>AUTHORIZED USER</Text>
                <Text style={styles.idName} numberOfLines={1}>
                  {name || "UNKNOWN"}
                </Text>
                <View style={styles.barcodeLine} />
                <Text style={styles.idSerial}>UID: {(userId || "0").padStart(6, "0")}</Text>
              </View>
            </View>

            <View style={styles.stripeBox}>
              <View style={styles.stripeTopRow}>
                <Text style={styles.sectionLabelSmall}>PAYOUTS (STRIPE)</Text>
                <View style={[styles.badge, { backgroundColor: sb.bg, borderColor: sb.color }]}>
                  <Text style={[styles.badgeText, { color: sb.color }]}>{sb.label}</Text>
                </View>
              </View>

              <Text style={styles.stripeDesc}>
                Connect Stripe once to receive seller payouts automatically (10% platform fee).
              </Text>

              <View style={styles.stripeBtnRow}>
                <TouchableOpacity
                  style={[styles.stripePrimaryBtn, stripeLoading && { opacity: 0.6 }]}
                  onPress={openStripeOnboarding}
                  disabled={stripeLoading}
                  activeOpacity={0.9}
                >
                  {stripeLoading ? (
                    <ActivityIndicator color={COLORS.bg} />
                  ) : (
                    <Text style={styles.stripePrimaryText}>
                      {stripeConnected ? "FINISH STRIPE SETUP" : "CONNECT STRIPE"}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.stripeSecondaryBtn,
                    (!stripeConnected || stripeLoading) && { opacity: 0.5 },
                  ]}
                  onPress={openStripeDashboard}
                  disabled={!stripeConnected || stripeLoading}
                  activeOpacity={0.9}
                >
                  <Text style={styles.stripeSecondaryText}>MANAGE PAYOUTS</Text>
                </TouchableOpacity>
              </View>

              {!!stripeConnected && !stripeReady && (
                <Text style={styles.stripeHint}>
                  Tip: Open “Finish Stripe setup” and complete bank/KYC. Until then, buyers can’t pay you.
                </Text>
              )}
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.sectionLabel}>IDENTITY PARAMETERS</Text>

              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>EMAIL ADDRESS</Text>
                  <Ionicons name="lock-closed" size={12} color={COLORS.muted} />
                </View>
                <View style={styles.readonlyInput}>
                  <Text style={styles.readonlyText}>{email}</Text>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>LEGAL NAME</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                  placeholder="ENTER NAME"
                  placeholderTextColor={COLORS.lightGray}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>COMMS NUMBER</Text>
                  {!phoneVerified ? (
                    <Text style={styles.notVerifiedTag}>NOT VERIFIED</Text>
                  ) : (
                    <Text style={styles.verifiedTag}>VERIFIED</Text>
                  )}
                </View>

                <TextInput
                  value={phone}
                  onChangeText={(t) => {
                    setPhone(t);
                    setProfile((p) => (p ? { ...p, phone_verified: false } : p));
                    setOtpSent(false);
                    setOtpCode("");
                  }}
                  style={styles.input}
                  keyboardType="phone-pad"
                  placeholder="+44..."
                  placeholderTextColor={COLORS.lightGray}
                />
              </View>

              {phoneVerified && (
                <View style={styles.verifiedBanner}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.ok} />
                  <Text style={styles.verifiedText}>NUMBER VERIFIED</Text>
                </View>
              )}

              {!phoneVerified && (
                <View style={styles.verifyBanner}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.verifyTitle}>
                      {bannerFromBuyFlow ? "VERIFY REQUIRED TO BUY" : "PHONE NOT VERIFIED"}
                    </Text>
                    <Text style={styles.verifyDesc}>
                      {bannerFromBuyFlow
                        ? "To complete your Marketplace purchase, verify your phone number once."
                        : "Verify once to unlock Marketplace purchases."}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.verifyBtn, (otpLoading || verifyLoading) && { opacity: 0.6 }]}
                    onPress={startOtp}
                    disabled={otpLoading || verifyLoading}
                    activeOpacity={0.9}
                  >
                    {otpLoading ? (
                      <ActivityIndicator color={COLORS.bg} />
                    ) : (
                      <Text style={styles.verifyBtnText}>VERIFY NOW</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {!phoneVerified && otpSent && (
                <View style={styles.otpBox}>
                  <Text style={styles.otpTitle}>ENTER VERIFICATION CODE</Text>
                  <Text style={styles.otpDesc}>
                    Code sent to: <Text style={{ fontWeight: "900" }}>{normalizePhone(phone)}</Text>
                  </Text>

                  <TextInput
                    value={otpCode}
                    onChangeText={setOtpCode}
                    style={styles.otpInput}
                    keyboardType="number-pad"
                    placeholder="OTP CODE"
                    placeholderTextColor={COLORS.lightGray}
                    maxLength={8}
                  />

                  <TouchableOpacity
                    style={[styles.otpConfirmBtn, (verifyLoading || autoBuyLoading) && { opacity: 0.6 }]}
                    onPress={completeVerification}
                    disabled={verifyLoading || autoBuyLoading}
                    activeOpacity={0.9}
                  >
                    {verifyLoading ? (
                      <ActivityIndicator color={COLORS.bg} />
                    ) : (
                      <Text style={styles.otpConfirmText}>CONFIRM & VERIFY</Text>
                    )}
                  </TouchableOpacity>

                  {autoBuyLoading && (
                    <View style={styles.autoBuyRow}>
                      <ActivityIndicator color={COLORS.text} />
                      <Text style={styles.autoBuyText}>Completing your purchase...</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={startOtp}
                    disabled={otpLoading || verifyLoading}
                    style={{ marginTop: 10, alignSelf: "flex-start" }}
                  >
                    <Text style={styles.resendText}>{otpLoading ? "SENDING..." : "RESEND CODE"}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={styles.saveBtn} onPress={saveChanges} disabled={saving} activeOpacity={0.9}>
                {saving ? (
                  <ActivityIndicator color={COLORS.bg} />
                ) : (
                  <>
                    <Text style={styles.saveBtnText}>OVERWRITE DATA</Text>
                    <Ionicons name="arrow-forward" size={16} color={COLORS.bg} />
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.dangerSection}>
              <TouchableOpacity
                style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
                activeOpacity={0.85}
                onPress={confirmDeleteAccount}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color={COLORS.bg} />
                ) : (
                  <Text style={styles.deleteBtnText}>DELETE ACCOUNT</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ height: 60 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.text,
  },
  backBtn: { padding: 4, marginLeft: -4 },
  headerRight: { alignItems: "flex-end" },
  headerMono: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 9,
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 1.5, color: COLORS.text },

  container: { padding: 20 },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, fontSize: 11, fontWeight: "800", letterSpacing: 2, color: COLORS.text },

  stripeBox: {
    borderWidth: 2,
    borderColor: COLORS.text,
    padding: 16,
    backgroundColor: COLORS.soft,
    marginBottom: 26,
  },
  stripeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  sectionLabelSmall: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: 2,
  },
  stripeDesc: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.muted,
    lineHeight: 15,
    marginBottom: 12,
  },
  stripeBtnRow: { flexDirection: "row", gap: 10 },
  stripePrimaryBtn: {
    flex: 1,
    backgroundColor: COLORS.text,
    paddingVertical: 12,
    alignItems: "center",
  },
  stripePrimaryText: { color: COLORS.bg, fontWeight: "900", fontSize: 10, letterSpacing: 2 },
  stripeSecondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: COLORS.text,
    alignItems: "center",
  },
  stripeSecondaryText: { color: COLORS.text, fontWeight: "900", fontSize: 10, letterSpacing: 1.5 },
  stripeHint: { marginTop: 10, fontSize: 10, color: COLORS.muted, fontWeight: "700" },

  badge: {
    borderWidth: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  badgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },

  verifiedBanner: {
    borderWidth: 2,
    borderColor: COLORS.ok,
    padding: 12,
    backgroundColor: "#F2FFF6",
    marginBottom: 18,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  verifiedText: { color: COLORS.ok, fontWeight: "900", letterSpacing: 2, fontSize: 11 },

  verifyBanner: {
    borderWidth: 2,
    borderColor: COLORS.text,
    padding: 16,
    backgroundColor: COLORS.soft,
    marginBottom: 18,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  verifyTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5, color: COLORS.text },
  verifyDesc: { marginTop: 6, fontSize: 10, fontWeight: "700", color: COLORS.muted, lineHeight: 15 },
  verifyBtn: { backgroundColor: COLORS.text, paddingVertical: 12, paddingHorizontal: 14 },
  verifyBtnText: { color: COLORS.bg, fontWeight: "900", fontSize: 10, letterSpacing: 2 },

  otpBox: {
    borderWidth: 2,
    borderColor: COLORS.text,
    padding: 16,
    backgroundColor: "#fff",
    marginBottom: 24,
  },
  otpTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5, color: COLORS.text },
  otpDesc: { marginTop: 6, fontSize: 10, fontWeight: "700", color: COLORS.muted, lineHeight: 15 },

  otpInput: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.text,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: 2,
    marginTop: 16,
  },
  otpConfirmBtn: {
    backgroundColor: COLORS.text,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  otpConfirmText: { color: COLORS.bg, fontWeight: "900", fontSize: 11, letterSpacing: 2 },

  resendText: { fontSize: 10, fontWeight: "900", letterSpacing: 2, color: COLORS.text },

  autoBuyRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  autoBuyText: { fontSize: 10, fontWeight: "800", color: COLORS.muted, letterSpacing: 1.2 },

  idBadge: {
    flexDirection: "row",
    borderWidth: 2,
    borderColor: COLORS.text,
    padding: 16,
    marginBottom: 26,
    backgroundColor: COLORS.soft,
  },
  idAvatarBox: {
    width: 80,
    height: 80,
    backgroundColor: COLORS.text,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  idAvatarText: { color: COLORS.bg, fontSize: 32, fontWeight: "900", letterSpacing: -1 },
  idInfoBox: { flex: 1, justifyContent: "center" },
  idLabel: { fontSize: 10, fontWeight: "800", color: COLORS.muted, letterSpacing: 1.5, marginBottom: 4 },
  idName: { fontSize: 22, fontWeight: "900", color: COLORS.text, textTransform: "uppercase", marginBottom: 8 },
  barcodeLine: { height: 4, width: "100%", backgroundColor: COLORS.text, borderStyle: "dashed", marginBottom: 8 },
  idSerial: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 9,
    color: COLORS.text,
    fontWeight: "700",
    letterSpacing: 1,
  },

  formContainer: { marginBottom: 40 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 24,
    letterSpacing: 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.text,
    paddingBottom: 8,
  },

  field: { marginBottom: 28 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  label: { fontSize: 10, fontWeight: "800", color: COLORS.muted, letterSpacing: 1.5 },

  notVerifiedTag: { fontSize: 10, fontWeight: "900", color: COLORS.danger, letterSpacing: 1.5 },
  verifiedTag: { fontSize: 10, fontWeight: "900", color: COLORS.ok, letterSpacing: 1.5 },

  input: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.text,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  readonlyInput: { borderBottomWidth: 2, borderBottomColor: COLORS.lightGray, paddingVertical: 12 },
  readonlyText: { color: COLORS.muted, fontWeight: "700", fontSize: 18 },

  saveBtn: {
    backgroundColor: COLORS.text,
    flexDirection: "row",
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    gap: 10,
  },
  saveBtnText: { color: COLORS.bg, fontWeight: "900", letterSpacing: 2, fontSize: 12 },

  dangerSection: {
    backgroundColor: "#FFF5F5",
  },

  deleteBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    backgroundColor: COLORS.danger,
    alignItems: "center",
  },

  deleteBtnText: {
    color: COLORS.bg,
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 1.1,
  },
});