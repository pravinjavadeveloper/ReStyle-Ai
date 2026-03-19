// frontend/app/delivery-details.tsx
import React, { useEffect, useMemo, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

// ✅ keep your API call
import { createDelivery } from "../services/api";

const COLORS = {
  bg: "#FFFFFF",
  black: "#000000",
  border: "#E2E8F0",
  muted: "#666666",
  soft: "#F9F9F9",
  white: "#FFFFFF",
};

type UkAddress = {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  county: string;
  postcode: string;
};

export default function DeliveryDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // ✅ passed from marketplace later
  const itemId = String(params.itemId || "");
  const itemPrice = String(params.price || "");
  const itemCategory = String(params.category || "Item");

  const [customerId, setCustomerId] = useState<string | null>(null);

  // UI states
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // UK-style pickup + drop
  const [pickup, setPickup] = useState<UkAddress>({
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    county: "",
    postcode: "",
  });

  const [drop, setDrop] = useState<UkAddress>({
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    county: "",
    postcode: "",
  });

  // We still send lat/lng to backend (optional but useful)
  const [pickupLat, setPickupLat] = useState<string>("");
  const [pickupLng, setPickupLng] = useState<string>("");
  const [dropLat, setDropLat] = useState<string>("");
  const [dropLng, setDropLng] = useState<string>("");

  // payout (optional)
  const [payoutGbp, setPayoutGbp] = useState<string>("4.99");

  useEffect(() => {
    (async () => {
      const uid = await AsyncStorage.getItem("userId");
      setCustomerId(uid);

      if (!uid) {
        Alert.alert("Login needed", "Please login first.");
        router.push("/login");
      }
    })();
  }, [router]);

  const payoutText = useMemo(() => {
    const v = Number(payoutGbp);
    if (Number.isFinite(v)) return `£${v.toFixed(2)}`;
    return "£4.99";
  }, [payoutGbp]);

  const buildAddressString = (a: UkAddress) => {
    return [
      a.fullName,
      a.phone,
      a.line1,
      a.line2,
      a.city,
      a.county,
      a.postcode,
    ]
      .filter((x) => String(x || "").trim())
      .join(", ");
  };

  const validate = () => {
    // Minimal but real
    const must = (v: string) => String(v || "").trim().length > 0;

    // pickup
    if (!must(pickup.fullName)) return "Pickup: Full name is required";
    if (!must(pickup.phone)) return "Pickup: Phone is required";
    if (!must(pickup.line1)) return "Pickup: Address line 1 is required";
    if (!must(pickup.city)) return "Pickup: City is required";
    if (!must(pickup.postcode)) return "Pickup: Postcode is required";

    // drop
    if (!must(drop.fullName)) return "Drop: Full name is required";
    if (!must(drop.phone)) return "Drop: Phone is required";
    if (!must(drop.line1)) return "Drop: Address line 1 is required";
    if (!must(drop.city)) return "Drop: City is required";
    if (!must(drop.postcode)) return "Drop: Postcode is required";

    const pay = Number(payoutGbp);
    if (!Number.isFinite(pay) || pay <= 0) return "Payout must be a valid amount (e.g. 4.99)";

    return null;
  };

  const askLocationPermission = async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") {
      Alert.alert("Permission needed", "Please allow location permission to use GPS.");
      return false;
    }
    return true;
  };

  // ✅ small button: use current location for PICKUP (UK)
  const useCurrentLocationForPickup = async () => {
    try {
      setLoadingLoc(true);

      if (!(await askLocationPermission())) return;

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // ✅ balanced for UK city use
      });

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      setPickupLat(String(lat));
      setPickupLng(String(lng));

      // Try reverse geocode into UK format
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (geo?.length) {
          const g = geo[0];
          // NOTE: reverse geocode fields differ per device; we handle safely
          const line1 = [g.name, g.street].filter(Boolean).join(" ");
          const city = (g.city || g.subregion || g.region || "") as string;
          const postcode = (g.postalCode || "") as string;

          setPickup((p) => ({
            ...p,
            line1: line1 || p.line1,
            city: city || p.city,
            postcode: postcode || p.postcode,
          }));
        }
      } catch {}

      Alert.alert("GPS Locked", "Pickup location filled from your current position.");
    } catch {
      Alert.alert("Error", "Could not fetch GPS location.");
    } finally {
      setLoadingLoc(false);
    }
  };

  // ✅ optional: use current location for DROP too (small button)
  const useCurrentLocationForDrop = async () => {
    try {
      setLoadingLoc(true);

      if (!(await askLocationPermission())) return;

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      setDropLat(String(lat));
      setDropLng(String(lng));

      try {
        const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (geo?.length) {
          const g = geo[0];
          const line1 = [g.name, g.street].filter(Boolean).join(" ");
          const city = (g.city || g.subregion || g.region || "") as string;
          const postcode = (g.postalCode || "") as string;

          setDrop((d) => ({
            ...d,
            line1: line1 || d.line1,
            city: city || d.city,
            postcode: postcode || d.postcode,
          }));
        }
      } catch {}

      Alert.alert("GPS Locked", "Drop location filled from your current position.");
    } catch {
      Alert.alert("Error", "Could not fetch GPS location.");
    } finally {
      setLoadingLoc(false);
    }
  };

  const submit = async () => {
    if (!customerId) return;

    const err = validate();
    if (err) {
      Alert.alert("INVALID DATA", err);
      return;
    }

    try {
      setSubmitting(true);

      // ✅ we keep your backend payload format (lat/lng required in your API)
      // If lat/lng not provided, we fallback to 0 (still valid number). (You can change later.)
      const res = await createDelivery({
        customerId,
        pickup_address: buildAddressString(pickup),
        drop_address: buildAddressString(drop),
        pickup_lat: Number(pickupLat) || 0,
        pickup_lng: Number(pickupLng) || 0,
        drop_lat: Number(dropLat) || 0,
        drop_lng: Number(dropLng) || 0,
        payout_gbp: Number(payoutGbp),
        radiusKm: 8,
      });

      if (res?.error) {
        Alert.alert("Failed", res.error);
        return;
      }

      // ✅ next step will be: open payment flow here
      Alert.alert(
        "Delivery Saved",
        `Delivery details saved for ${itemCategory}. Next: payment.`,
        [
          {
            text: "Continue to Payment",
            onPress: () => {
              // next step: we will implement payment screen/modal
              router.back();
            },
          },
        ]
      );
    } catch {
      Alert.alert("Error", "Create delivery failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={24} color={COLORS.black} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>DELIVERY DETAILS</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* HERO */}
          <View style={styles.heroSection}>
            <Text style={styles.title}>UK DELIVERY{"\n"}CHECKOUT</Text>
            <Text style={styles.sub}>
              Enter pickup & drop-off details. You can use GPS to auto-fill key fields.
            </Text>

            {/* Item mini summary */}
            <View style={styles.itemStrip}>
              <Text style={styles.itemStripText}>
                ITEM: <Text style={{ fontWeight: "900" }}>{itemCategory}</Text>
                {itemPrice ? ` • £${itemPrice}` : ""}
              </Text>
              <Text style={styles.itemStripSub}>ID: {itemId || "N/A"}</Text>
            </View>
          </View>

          {/* PICKUP */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionIndex}>01</Text>
              <Text style={styles.sectionTitle}>PICKUP (COLLECTION)</Text>

              <TouchableOpacity
                style={[styles.gpsSmallBtn, loadingLoc && { opacity: 0.6 }]}
                onPress={useCurrentLocationForPickup}
                disabled={loadingLoc}
                activeOpacity={0.85}
              >
                {loadingLoc ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Ionicons name="locate-outline" size={14} color={COLORS.white} />
                )}
                <Text style={styles.gpsSmallText}>Use GPS</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.label}>FULL NAME</Text>
              <TextInput
                value={pickup.fullName}
                onChangeText={(v) => setPickup((p) => ({ ...p, fullName: v }))}
                placeholder="e.g. John Smith"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
              />

              <Text style={styles.label}>PHONE</Text>
              <TextInput
                value={pickup.phone}
                onChangeText={(v) => setPickup((p) => ({ ...p, phone: v }))}
                placeholder="e.g. +44 7xxx xxxxxx"
                placeholderTextColor={COLORS.muted}
                keyboardType="phone-pad"
                style={styles.input}
              />

              <Text style={styles.label}>ADDRESS LINE 1</Text>
              <TextInput
                value={pickup.line1}
                onChangeText={(v) => setPickup((p) => ({ ...p, line1: v }))}
                placeholder="House no. & street"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
              />

              <Text style={styles.label}>ADDRESS LINE 2 (OPTIONAL)</Text>
              <TextInput
                value={pickup.line2}
                onChangeText={(v) => setPickup((p) => ({ ...p, line2: v }))}
                placeholder="Flat / building / area"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>CITY</Text>
                  <TextInput
                    value={pickup.city}
                    onChangeText={(v) => setPickup((p) => ({ ...p, city: v }))}
                    placeholder="London"
                    placeholderTextColor={COLORS.muted}
                    style={[styles.input, { marginBottom: 0 }]}
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>COUNTY (OPTIONAL)</Text>
                  <TextInput
                    value={pickup.county}
                    onChangeText={(v) => setPickup((p) => ({ ...p, county: v }))}
                    placeholder="Greater London"
                    placeholderTextColor={COLORS.muted}
                    style={[styles.input, { marginBottom: 0 }]}
                  />
                </View>
              </View>

              <Text style={[styles.label, { marginTop: 16 }]}>POSTCODE</Text>
              <TextInput
                value={pickup.postcode}
                onChangeText={(v) => setPickup((p) => ({ ...p, postcode: v }))}
                placeholder="SW1A 1AA"
                placeholderTextColor={COLORS.muted}
                autoCapitalize="characters"
                style={styles.input}
              />
            </View>
          </View>

          {/* DROP */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionIndex}>02</Text>
              <Text style={styles.sectionTitle}>DROP-OFF (DELIVERY)</Text>

              <TouchableOpacity
                style={[styles.gpsSmallBtn, loadingLoc && { opacity: 0.6 }]}
                onPress={useCurrentLocationForDrop}
                disabled={loadingLoc}
                activeOpacity={0.85}
              >
                {loadingLoc ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Ionicons name="locate-outline" size={14} color={COLORS.white} />
                )}
                <Text style={styles.gpsSmallText}>Use GPS</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.label}>FULL NAME</Text>
              <TextInput
                value={drop.fullName}
                onChangeText={(v) => setDrop((d) => ({ ...d, fullName: v }))}
                placeholder="e.g. Jane Doe"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
              />

              <Text style={styles.label}>PHONE</Text>
              <TextInput
                value={drop.phone}
                onChangeText={(v) => setDrop((d) => ({ ...d, phone: v }))}
                placeholder="e.g. +44 7xxx xxxxxx"
                placeholderTextColor={COLORS.muted}
                keyboardType="phone-pad"
                style={styles.input}
              />

              <Text style={styles.label}>ADDRESS LINE 1</Text>
              <TextInput
                value={drop.line1}
                onChangeText={(v) => setDrop((d) => ({ ...d, line1: v }))}
                placeholder="House no. & street"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
              />

              <Text style={styles.label}>ADDRESS LINE 2 (OPTIONAL)</Text>
              <TextInput
                value={drop.line2}
                onChangeText={(v) => setDrop((d) => ({ ...d, line2: v }))}
                placeholder="Flat / building / area"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>CITY</Text>
                  <TextInput
                    value={drop.city}
                    onChangeText={(v) => setDrop((d) => ({ ...d, city: v }))}
                    placeholder="London"
                    placeholderTextColor={COLORS.muted}
                    style={[styles.input, { marginBottom: 0 }]}
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>COUNTY (OPTIONAL)</Text>
                  <TextInput
                    value={drop.county}
                    onChangeText={(v) => setDrop((d) => ({ ...d, county: v }))}
                    placeholder="Greater London"
                    placeholderTextColor={COLORS.muted}
                    style={[styles.input, { marginBottom: 0 }]}
                  />
                </View>
              </View>

              <Text style={[styles.label, { marginTop: 16 }]}>POSTCODE</Text>
              <TextInput
                value={drop.postcode}
                onChangeText={(v) => setDrop((d) => ({ ...d, postcode: v }))}
                placeholder="SW1A 1AA"
                placeholderTextColor={COLORS.muted}
                autoCapitalize="characters"
                style={styles.input}
              />
            </View>
          </View>

          {/* PAYOUT */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionIndex}>03</Text>
              <Text style={styles.sectionTitle}>AGENT COMPENSATION</Text>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.payoutRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>BOUNTY (GBP)</Text>
                  <TextInput
                    value={payoutGbp}
                    onChangeText={setPayoutGbp}
                    placeholder="4.99"
                    placeholderTextColor={COLORS.muted}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>

                <View style={styles.payoutPreviewBox}>
                  <Text style={styles.payoutPreviewLabel}>TOTAL</Text>
                  <Text style={styles.payoutPreviewText}>{payoutText}</Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.ctaBtn, submitting && { opacity: 0.7 }]}
            onPress={submit}
            activeOpacity={0.9}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Text style={styles.ctaText}>SAVE & CONTINUE</Text>
                <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.footerNote}>
            // UK FORMAT: Name, Phone, Address, City, Postcode. GPS uses balanced accuracy.
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.black,
  },
  headerTitleWrap: { alignItems: "center" },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.black,
    letterSpacing: 1.5,
  },
  backBtn: { padding: 4 },

  container: { padding: 20 },

  heroSection: { marginBottom: 24 },
  title: {
    color: COLORS.black,
    fontSize: 32,
    fontFamily: "IntegralCF-Bold",
    lineHeight: 36,
    marginBottom: 8,
  },
  sub: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },

  itemStrip: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.black,
    padding: 12,
    backgroundColor: COLORS.white,
  },
  itemStripText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: COLORS.black,
    textTransform: "uppercase",
  },
  itemStripSub: {
    marginTop: 6,
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: "600",
  },

  card: {
    borderWidth: 2,
    borderColor: COLORS.black,
    marginBottom: 20,
    backgroundColor: COLORS.white,
    borderRadius: 0,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.black,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sectionIndex: {
    color: COLORS.white,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontWeight: "900",
    fontSize: 12,
    marginRight: 10,
    opacity: 0.7,
  },
  sectionTitle: {
    flex: 1,
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 1.5,
  },
  gpsSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.white,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  gpsSmallText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  cardBody: { padding: 16 },

  label: {
    color: COLORS.black,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.black,
    backgroundColor: COLORS.soft,
    color: COLORS.black,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
  },
  row: { flexDirection: "row", alignItems: "center" },

  payoutRow: { flexDirection: "row", alignItems: "flex-start" },
  payoutPreviewBox: {
    marginLeft: 16,
    backgroundColor: COLORS.black,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    marginTop: 22,
  },
  payoutPreviewLabel: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
    opacity: 0.7,
  },
  payoutPreviewText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "900",
    fontFamily: "IntegralCF-Bold",
  },

  ctaBtn: {
    flexDirection: "row",
    marginTop: 10,
    backgroundColor: COLORS.black,
    paddingVertical: 18,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 1.5,
  },

  footerNote: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: COLORS.muted,
    marginTop: 20,
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
  },
});