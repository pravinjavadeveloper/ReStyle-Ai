//frontend/app/seller-sddress.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { getMySellerAddress, saveSellerAddress } from "../services/api";

const COLORS = {
  bg: "#FFFFFF",
  text: "#000000",
  border: "#E2E8F0",
  muted: "#666666",
  black: "#000000",
  white: "#FFFFFF",
  soft: "#F9F9F9",
};

export default function SellerAddressScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [isDefault, setIsDefault] = useState(true);

  const [full_name, setFullName] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postcode, setPostcode] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const userId = await AsyncStorage.getItem("userId");
      if (!userId) {
        setLoading(false);
        return;
      }

      const r = await getMySellerAddress(userId);
      const a = r?.address;

      if (a) {
        setFullName(a.full_name || "");
        setLine1(a.line1 || "");
        setLine2(a.line2 || "");
        setCity(a.city || "");
        setCounty(a.county || "");
        setPostcode(a.postcode || "");
        setPhone(a.phone || "");
        setIsDefault(a.is_default !== false);
      }

      setLoading(false);
    })();
  }, []);

  function validate() {
    if (!full_name.trim()) return "Full name is required";
    if (!line1.trim()) return "Address line 1 is required";
    if (!city.trim()) return "City is required";
    if (!postcode.trim()) return "Postcode is required";
    return null;
  }

  async function onSave() {
    const userId = await AsyncStorage.getItem("userId");
    if (!userId) return;

    const err = validate();
    if (err) {
      Alert.alert("Missing info", err);
      return;
    }

    setSaving(true);
    const r = await saveSellerAddress({
      userId,
      full_name,
      line1,
      line2,
      city,
      county,
      postcode,
      phone,
      is_default: isDefault,
    });

    setSaving(false);

    if (r?.error) {
      Alert.alert("Save failed", r.error);
      return;
    }

    Alert.alert("Saved ✅", "Seller address saved successfully.", [
      { text: "OK", onPress: () => router.back() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>SELLER ADDRESS</Text>
        <Text style={styles.subtitle}>USED FOR SHIPPING LABELS</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.black} />
          <Text style={styles.loadingText}>LOADING...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} value={full_name} onChangeText={setFullName} placeholder="Your name" />

          <Text style={styles.label}>Address Line 1</Text>
          <TextInput style={styles.input} value={line1} onChangeText={setLine1} placeholder="House no, street" />

          <Text style={styles.label}>Address Line 2 (optional)</Text>
          <TextInput style={styles.input} value={line2} onChangeText={setLine2} placeholder="Apartment, landmark" />

          <Text style={styles.label}>City</Text>
          <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" />

          <Text style={styles.label}>County (optional)</Text>
          <TextInput style={styles.input} value={county} onChangeText={setCounty} placeholder="County" />

          <Text style={styles.label}>Postcode</Text>
          <TextInput style={styles.input} value={postcode} onChangeText={setPostcode} placeholder="e.g. SW1A 1AA" />

          <Text style={styles.label}>Phone (optional)</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+44..." />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Save as default</Text>
            <Switch value={isDefault} onValueChange={setIsDefault} />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={onSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.saveText}>SAVE ADDRESS</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>
            This address will be used as the “From” address on your Shippo shipping labels.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 16 },
  header: { paddingHorizontal: 20, marginBottom: 12 },
  back: { color: COLORS.text, fontSize: 14, fontWeight: "600", marginBottom: 14 },
  title: { color: COLORS.text, fontSize: 28, fontFamily: "IntegralCF-Bold", letterSpacing: 1.2 },
  subtitle: { color: COLORS.text, fontSize: 11, fontWeight: "600", letterSpacing: 0.5, marginTop: 4 },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: COLORS.black, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },

  form: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },
  label: { color: COLORS.black, fontSize: 12, fontWeight: "800", letterSpacing: 0.6, marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.black,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: COLORS.white,
  },

  switchRow: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  switchText: { color: COLORS.black, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },

  saveBtn: {
    marginTop: 18,
    backgroundColor: COLORS.black,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveText: { color: COLORS.white, fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },

  hint: { marginTop: 14, color: COLORS.muted, fontSize: 12, lineHeight: 16 },
});