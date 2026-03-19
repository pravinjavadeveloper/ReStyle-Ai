// frontend/app/recycle-hub.tsx

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const PRICE_PER_KG = 9.99; // ✅ change rate here (£/kg)

type ServiceType = "Recycling Pickup" | "Charity Donation" | "Swap Drop";

export default function RecycleHubScreen() {
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);

  const [serviceType, setServiceType] = useState<ServiceType>("Recycling Pickup");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [preferredDate, setPreferredDate] = useState(""); // e.g. 2026-02-15
  const [preferredSlot, setPreferredSlot] = useState(""); // e.g. 10am–12pm
  const [itemsDesc, setItemsDesc] = useState(""); // clothes, shoes, etc
  const [weightKg, setWeightKg] = useState(""); // user input
  const [notes, setNotes] = useState("");

  const numericKg = useMemo(() => {
    const n = Number(weightKg);
    return Number.isFinite(n) ? n : 0;
  }, [weightKg]);

  const estimated = useMemo(() => {
    if (serviceType === "Swap Drop") return 0;
    return Math.max(0, numericKg) * PRICE_PER_KG;
  }, [numericKg, serviceType]);

  const validate = () => {
    if (!name.trim()) return "Please enter your name.";
    if (!phone.trim() || phone.trim().length < 10) return "Please enter a valid phone number.";
    if (!pickupAddress.trim()) return "Please enter pickup address.";
    if (!city.trim()) return "Please enter city.";
    if (!pincode.trim() || pincode.trim().length < 6) return "Please enter a valid pincode.";
    if (!itemsDesc.trim()) return "Please describe what you’re donating/recycling/swapping.";
    if (serviceType !== "Swap Drop") {
      if (!weightKg.trim()) return "Please enter estimated weight (kg).";
      if (numericKg <= 0) return "Weight must be greater than 0.";
    }
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) {
      Alert.alert("Fix this", err);
      return;
    }

    Alert.alert(
      "Request placed ✅",
      `Service: ${serviceType}\nPickup: ${city} - ${pincode}\nEstimated: ${
        serviceType === "Swap Drop" ? "₹0" : `£${estimated.toFixed(0)}`
      }`,
      [
        {
          text: "Go Home",
          onPress: () => router.replace("/(tabs)"),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color="#111" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Recycle Hub</Text>

        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Info / Definition */}
        <View style={styles.heroCard}>
          <Text style={styles.heroTag}>LOCAL RECYCLING • DONATION • SWAP</Text>

          <Text style={styles.heroTitle}>
            We collect from your home and deliver to verified recycle hubs / charity shops.
          </Text>

          <View style={styles.steps}>
            <StepRow idx="1" text="Choose service (Recycle / Donate / Swap)" />
            <StepRow idx="2" text="Enter pickup location + item details" />
            <StepRow idx="3" text="We pick up and deliver responsibly" />
          </View>

          <View style={styles.priceNote}>
            <Ionicons name="pricetag-outline" size={16} color="#111" />
            <Text style={styles.priceText}>
              Pricing: £{PRICE_PER_KG}/kg (Recycle/Donate). Swap drop can be ₹0.
            </Text>
          </View>

          {!showForm ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowForm(true)} activeOpacity={0.9}>
              <Text style={styles.primaryBtnText}>Apply for Pickup</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowForm(false)} activeOpacity={0.9}>
              <Ionicons name="close" size={18} color="#111" />
              <Text style={styles.secondaryBtnText}>Hide Form</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Form */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Pickup Request Form</Text>
            <Text style={styles.formSub}>Fill the details and place your recycling/donation/swap request.</Text>

            <Text style={styles.label}>Service type</Text>
            <View style={styles.chipsRow}>
              <Chip text="Recycling Pickup" active={serviceType === "Recycling Pickup"} onPress={() => setServiceType("Recycling Pickup")} />
              <Chip text="Charity Donation" active={serviceType === "Charity Donation"} onPress={() => setServiceType("Charity Donation")} />
              <Chip text="Swap Drop" active={serviceType === "Swap Drop"} onPress={() => setServiceType("Swap Drop")} />
            </View>

            <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
            <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="11-digit mobile number" keyboardType="phone-pad" />

            <Field label="Pickup address" value={pickupAddress} onChangeText={setPickupAddress} placeholder="House / Street / Landmark" multiline />

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Field label="City" value={city} onChangeText={setCity} placeholder="City" />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Field label="Postcode" value={pincode} onChangeText={setPincode} placeholder="e.g. 400001" keyboardType="number-pad" />
              </View>
            </View>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Field label="Preferred date" value={preferredDate} onChangeText={setPreferredDate} placeholder="YYYY-MM-DD" />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Field label="Preferred time slot" value={preferredSlot} onChangeText={setPreferredSlot} placeholder="10am–12pm" />
              </View>
            </View>

            <Field label="What items?" value={itemsDesc} onChangeText={setItemsDesc} placeholder="Example: 8 shirts, 2 jeans, 1 jacket" multiline />

            {serviceType !== "Swap Drop" && (
              <Field
                label="Estimated weight (kg)"
                value={weightKg}
                onChangeText={setWeightKg}
                placeholder="Example: 5"
                keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
              />
            )}

            <Field label="Extra notes (optional)" value={notes} onChangeText={setNotes} placeholder="Pickup instructions, gate code, etc." multiline />

            <View style={styles.estimateCard}>
              <View style={styles.estimateTop}>
                <Text style={styles.estimateLeft}>Estimated cost</Text>
                <Text style={styles.estimateRight}>{serviceType === "Swap Drop" ? "£0" : `£${estimated.toFixed(0)}`}</Text>
              </View>
              <Text style={styles.estimateSub}>
                {serviceType === "Swap Drop" ? "Swap Drop is free (you can set rules later)." : `Based on £${PRICE_PER_KG}/kg × ${numericKg || 0}kg`}
              </Text>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={submit} activeOpacity={0.9}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.submitText}>Place Request</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 22 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Small components ---------- */

function StepRow({ idx, text }: { idx: string; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{idx}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

function Chip({ text, active, onPress }: { text: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.chip, active ? styles.chipActive : null]}>
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{text}</Text>
    </TouchableOpacity>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: any;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA0A6"
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline ? styles.inputMulti : null]}
      />
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },

  header: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#E6E6E6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 6 },
  backText: { color: "#111", fontSize: 14, fontWeight: "600" },
  title: { color: "#111", fontSize: 16, fontWeight: "800" },

  container: { padding: 16, paddingBottom: 28 },

  heroCard: {
    backgroundColor: "#FFFCF0",
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 16,
    padding: 16,
  },
  heroTag: { fontSize: 11, color: "#777", fontWeight: "800", letterSpacing: 1 },
  heroTitle: { marginTop: 10, fontSize: 15, color: "#111", fontWeight: "700", lineHeight: 21 },

  steps: { marginTop: 12, gap: 10 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  stepText: { flex: 1, color: "#333", fontSize: 13, fontWeight: "600" },

  priceNote: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EFEFEF",
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  priceText: { flex: 1, color: "#111", fontSize: 12, fontWeight: "600" },

  primaryBtn: {
    marginTop: 14,
    backgroundColor: "#111",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  secondaryBtn: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: { color: "#111", fontWeight: "800", fontSize: 13 },

  formCard: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 16,
    padding: 16,
  },
  formTitle: { color: "#111", fontSize: 16, fontWeight: "900" },
  formSub: { marginTop: 6, color: "#666", fontSize: 12, fontWeight: "600" },

  label: { marginTop: 12, color: "#111", fontSize: 12, fontWeight: "800" },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E6E6E6",
    backgroundColor: "#F7F7F7",
  },
  chipActive: { backgroundColor: "#111", borderColor: "#111" },
  chipText: { color: "#111", fontSize: 12, fontWeight: "800" },
  chipTextActive: { color: "#fff" },

  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#EAEAEA",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#111",
    backgroundColor: "#fff",
  },
  inputMulti: { minHeight: 90, textAlignVertical: "top" },

  row2: { flexDirection: "row", alignItems: "flex-start" },

  estimateCard: {
    marginTop: 14,
    backgroundColor: "#FFFCF0",
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 14,
    padding: 12,
  },
  estimateTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  estimateLeft: { color: "#111", fontWeight: "900", fontSize: 13 },
  estimateRight: { color: "#111", fontWeight: "900", fontSize: 16 },
  estimateSub: { marginTop: 6, color: "#666", fontSize: 12, fontWeight: "600" },

  submitBtn: {
    marginTop: 14,
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  submitText: { color: "#fff", fontWeight: "900", fontSize: 13 },
});
