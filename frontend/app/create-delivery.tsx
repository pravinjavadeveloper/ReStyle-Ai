// frontend/app/create-delivery.tsx
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
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons"; //  Premium Icons

import { createDelivery } from "../services/api";

//  BRUTALIST MONOCHROME PALETTE
const COLORS = {
  bg: "#FFFFFF",
  black: "#000000",
  border: "#E2E8F0",
  muted: "#666666",
  soft: "#F9F9F9",
  white: "#FFFFFF",
};

export default function CreateDeliveryScreen() {
  const router = useRouter();

  const [loadingLoc, setLoadingLoc] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [customerId, setCustomerId] = useState<string | null>(null);

  const [pickupAddress, setPickupAddress] = useState("");
  const [dropAddress, setDropAddress] = useState("");

  const [pickupLat, setPickupLat] = useState<string>("");
  const [pickupLng, setPickupLng] = useState<string>("");

  const [dropLat, setDropLat] = useState<string>("");
  const [dropLng, setDropLng] = useState<string>("");

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

  const validate = () => {
    if (!pickupAddress.trim()) return "Pickup address is required";
    if (!dropAddress.trim()) return "Drop address is required";

    const pLat = Number(pickupLat);
    const pLng = Number(pickupLng);
    const dLat = Number(dropLat);
    const dLng = Number(dropLng);

    if (!Number.isFinite(pLat) || !Number.isFinite(pLng))
      return "Pickup lat/lng must be valid numbers";

    if (!Number.isFinite(dLat) || !Number.isFinite(dLng))
      return "Drop lat/lng must be valid numbers";

    const pay = Number(payoutGbp);
    if (!Number.isFinite(pay) || pay <= 0)
      return "Payout must be a valid amount (e.g. 4.99)";

    return null;
  };

  const useMyCurrentLocationAsPickup = async () => {
    try {
      setLoadingLoc(true);

      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow location permission to use current pickup location."
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      setPickupLat(String(lat));
      setPickupLng(String(lng));

      try {
        const geo = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });
        if (geo && geo.length > 0) {
          const g = geo[0];
          const addr = [g.name, g.street, g.city, g.region, g.postalCode, g.country]
            .filter(Boolean)
            .join(", ");
          if (addr) setPickupAddress(addr);
        }
      } catch {}

      Alert.alert("COORDINATES LOCKED", "Pickup location set to your current GPS coordinates.");
    } catch {
      Alert.alert("Error", "Could not fetch location.");
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

      const res = await createDelivery({
        customerId, // string is ok, backend will parse
        pickup_address: pickupAddress.trim(),
        drop_address: dropAddress.trim(),
        pickup_lat: Number(pickupLat),
        pickup_lng: Number(pickupLng),
        drop_lat: Number(dropLat),
        drop_lng: Number(dropLng),
        payout_gbp: Number(payoutGbp),
        radiusKm: 8,
      });

      if (res?.error) {
        Alert.alert("Failed", res.error);
        return;
      }

      Alert.alert("DISPATCH CREATED", "Delivery manifested. Nearby agents are being notified.");
      router.back();
    } catch {
      Alert.alert("Error", "Create delivery failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const payoutText = useMemo(() => {
    const v = Number(payoutGbp);
    if (Number.isFinite(v)) return `£${v.toFixed(2)}`;
    return "£4.99";
  }, [payoutGbp]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* 🌟 LOGISTICS HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            {/* <Text style={styles.headerMono}>// DEPT: LOGISTICS</Text> */}
            <Text style={styles.headerTitle}>DISPATCH HUB</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          
          <View style={styles.heroSection}>
            <Text style={styles.title}>NEW DELIVERY{"\n"}MANIFEST</Text>
            <Text style={styles.sub}>
              Initialize a delivery request. The network will ping approved agents within an 8km radius of your origin point.
            </Text>
          </View>

          {/* 📍 SECTION 01: ORIGIN (PICKUP) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionIndex}>01</Text>
              <Text style={styles.sectionTitle}>ORIGIN POINT</Text>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.label}>STREET ADDRESS</Text>
              <TextInput
                value={pickupAddress}
                onChangeText={setPickupAddress}
                placeholder="ENTER PICKUP LOCATION"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>LATITUDE</Text>
                  <TextInput
                    value={pickupLat}
                    onChangeText={setPickupLat}
                    placeholder="51.5074"
                    placeholderTextColor={COLORS.muted}
                    keyboardType="numeric"
                    style={[styles.input, styles.monoInput]}
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>LONGITUDE</Text>
                  <TextInput
                    value={pickupLng}
                    onChangeText={setPickupLng}
                    placeholder="-0.1278"
                    placeholderTextColor={COLORS.muted}
                    keyboardType="numeric"
                    style={[styles.input, styles.monoInput]}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.secondaryBtn, loadingLoc && { opacity: 0.5 }]}
                onPress={useMyCurrentLocationAsPickup}
                disabled={loadingLoc}
                activeOpacity={0.8}
              >
                {loadingLoc ? (
                  <ActivityIndicator color={COLORS.black} size="small" />
                ) : (
                  <>
                    <Ionicons name="locate-outline" size={16} color={COLORS.black} />
                    <Text style={styles.secondaryText}>ACQUIRE GPS COORDINATES</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* 🏁 SECTION 02: DESTINATION (DROP) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionIndex}>02</Text>
              <Text style={styles.sectionTitle}>DESTINATION</Text>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.label}>STREET ADDRESS</Text>
              <TextInput
                value={dropAddress}
                onChangeText={setDropAddress}
                placeholder="ENTER DROP-OFF LOCATION"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>LATITUDE</Text>
                  <TextInput
                    value={dropLat}
                    onChangeText={setDropLat}
                    placeholder="51.5150"
                    placeholderTextColor={COLORS.muted}
                    keyboardType="numeric"
                    style={[styles.input, styles.monoInput]}
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>LONGITUDE</Text>
                  <TextInput
                    value={dropLng}
                    onChangeText={setDropLng}
                    placeholder="-0.1410"
                    placeholderTextColor={COLORS.muted}
                    keyboardType="numeric"
                    style={[styles.input, styles.monoInput]}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* 💰 SECTION 03: COMPENSATION */}
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
                
                {/* Live Preview Box */}
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
                <Text style={styles.ctaText}>TRANSMIT DISPATCH</Text>
                <Ionicons name="radio-outline" size={20} color={COLORS.white} />
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.footerNote}>
            // SYS_NOTE: Ensure agents are cleared and transmitting live telemetry for optimal matching.
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  
  // Header
  header: {
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

  container: { padding: 20 },
  
  heroSection: {
    marginBottom: 24,
  },
  title: { 
    color: COLORS.black, 
    fontSize: 32, 
    fontFamily: 'IntegralCF-Bold', 
    lineHeight: 36, 
    marginBottom: 8 
  },
  sub: { 
    color: COLORS.muted, 
    fontSize: 12, 
    lineHeight: 18, 
    fontWeight: '500' 
  },

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
  },
  cardBody: {
    padding: 16,
  },

  // Forms
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
    fontWeight: '600',
    marginBottom: 16,
  },
  monoInput: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
  },
  row: { 
    flexDirection: "row", 
    alignItems: "center" 
  },

  secondaryBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.black,
    paddingVertical: 14,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: { 
    color: COLORS.black, 
    fontWeight: "800", 
    fontSize: 11, 
    letterSpacing: 0.5 
  },

  // Payout Special Formatting
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  payoutPreviewBox: {
    marginLeft: 16,
    backgroundColor: COLORS.black,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50, // Matches input height roughly
    marginTop: 22, // aligns with input below label
  },
  payoutPreviewLabel: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    opacity: 0.7,
  },
  payoutPreviewText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'IntegralCF-Bold',
  },

  // Primary CTA
  ctaBtn: {
    flexDirection: 'row',
    marginTop: 10,
    backgroundColor: COLORS.black,
    paddingVertical: 18,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: 'center',
    gap: 10,
  },
  ctaText: { 
    color: COLORS.white, 
    fontWeight: "900", 
    fontSize: 14, 
    letterSpacing: 1.5 
  },

  footerNote: { 
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: COLORS.muted, 
    marginTop: 20, 
    fontSize: 10, 
    lineHeight: 16,
    textAlign: 'center'
  },
});