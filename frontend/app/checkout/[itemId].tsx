// frontend/app/checkout/[itemId].tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useStripe } from "@stripe/stripe-react-native";

import { API_URL, imgUrl as imgUrlHelper } from "../../services/config";

const COLORS = {
  bg: "#FFFFFF",
  text: "#000000",
  muted: "#666666",
  border: "#E2E8F0",
  soft: "#F7F7F7",
  black: "#000000",
  white: "#FFFFFF",
};

type Item = {
  id: number | string;
  category?: string;
  color?: string;
  size?: string;
  condition?: string;
  price?: string | number;
  image_url?: string;
};

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ itemId?: string | string[] }>();
  const rawItemId = params.itemId;
  const itemId = Array.isArray(rawItemId) ? rawItemId[0] : rawItemId;

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const mountedRef = useRef(true);
  const createOrderStartedRef = useRef(false);
  const backCancelInProgressRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const [item, setItem] = useState<Item | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const [shippingFee, setShippingFee] = useState(8.95);
  const [backendTotal, setBackendTotal] = useState<number | null>(null);

  const [fullName, setFullName] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");

  const itemPrice = useMemo(() => Number(item?.price || 0), [item?.price]);
  const total = useMemo(() => {
    if (backendTotal != null && Number.isFinite(backendTotal)) return backendTotal;
    return itemPrice + shippingFee;
  }, [backendTotal, itemPrice, shippingFee]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function postJson(path: string, body: any) {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, data };
    return data;
  }

  async function getJson(path: string) {
    const res = await fetch(`${API_URL}${path}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, data };
    return data;
  }

  async function saveAddressToDb(userId: string) {
    const payload = {
      userId,
      full_name: fullName.trim(),
      line1: line1.trim(),
      city: city.trim(),
      postcode: postcode.trim(),
      line2: null,
      county: null,
      phone: null,
    };

    const r = await postJson("/shipping/save-address", payload);
    const addressId = r?.address?.id;

    if (!addressId) {
      throw new Error("Address save failed.");
    }

    return String(addressId);
  }

  async function attachAddressToOrder(userId: string, orderIdStr: string, addressId: string) {
    const r = await postJson("/shipping/attach-to-order", {
      orderId: orderIdStr,
      userId,
      addressId,
    });

    if (!r?.success) {
      throw new Error(r?.error || "Failed to attach address to order.");
    }

    return true;
  }

  useEffect(() => {
    if (!itemId) {
      Alert.alert("Checkout", "Invalid item.");
      router.back();
      return;
    }

    if (createOrderStartedRef.current) return;
    createOrderStartedRef.current = true;

    (async () => {
      try {
        if (mountedRef.current) setLoading(true);

        const userId = await AsyncStorage.getItem("userId");
        if (!userId) {
          Alert.alert("Login required", "Please login to continue.");
          router.replace("/login");
          return;
        }

        const saved = await AsyncStorage.getItem("checkoutAddress");
        if (saved) {
          try {
            const a = JSON.parse(saved);
            if (mountedRef.current) {
              setFullName(a.fullName || "");
              setLine1(a.line1 || "");
              setCity(a.city || "");
              setPostcode(a.postcode || "");
            }
          } catch {}
        }

        const order = await postJson("/payments/create-order", { itemId, userId });

        if (!mountedRef.current) return;

        setOrderId(String(order?.orderId || ""));
        setItem(order?.item || null);

        if (Number.isFinite(Number(order?.shippingFeeGbp))) {
          setShippingFee(Number(order.shippingFeeGbp));
        }

        if (Number.isFinite(Number(order?.totalGbp))) {
          setBackendTotal(Number(order.totalGbp));
        }
      } catch (e: any) {
        const code = e?.data?.error;
        const msg =
          code === "PHONE_NOT_VERIFIED"
            ? "Please verify your phone number before buying from Marketplace."
            : code === "ITEM_RESERVED"
            ? "Someone else is checking out this item right now. Try again in a minute."
            : code === "ITEM_NOT_FOR_SALE"
            ? "This item is no longer available."
            : e?.data?.message || e?.data?.error || "Checkout failed. Please try again.";

        Alert.alert("Checkout", msg, [{ text: "OK", onPress: () => router.back() }]);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, [itemId, router]);

  async function initSheet() {
    const userId = await AsyncStorage.getItem("userId");
    if (!userId || !orderId) {
      throw new Error("Missing user or order.");
    }

    const pi = await postJson("/payments/create-payment-intent", {
      orderId,
      userId,
    });

    if (pi?.alreadyPaid) {
      Alert.alert("Already paid", "This order is already paid.");
      return false;
    }

    if (pi?.error === "SELLER_STRIPE_NOT_CONNECTED") {
      throw new Error("Seller has not connected payouts yet. Please choose another item.");
    }

    if (pi?.error === "SELLER_STRIPE_NOT_READY") {
      throw new Error("Seller has not finished Stripe onboarding yet. Please try another item later.");
    }

    if (pi?.error === "RESERVATION_EXPIRED") {
      throw new Error(pi?.message || "Reservation expired. Please try buying again.");
    }

    const cs = pi?.clientSecret;
    if (!cs) {
      throw new Error(pi?.message || "Missing client secret.");
    }

    const { error } = await initPaymentSheet({
      merchantDisplayName: "Restyle AI",
      paymentIntentClientSecret: cs,
      allowsDelayedPaymentMethods: true,
      returnURL: Platform.OS === "ios" ? "restyleai://stripe-redirect" : undefined,
    });

    if (error) {
      throw new Error(error.message);
    }

    return true;
  }

  async function pollPaid(orderIdStr: string) {
    const userId = await AsyncStorage.getItem("userId");
    if (!userId) return false;

    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 1500));

      try {
        const status = await getJson(`/payments/order-status/${orderIdStr}?userId=${userId}`);
        if (status?.payment_status === "paid") return true;
      } catch {}
    }

    return false;
  }

  async function payNow() {
    if (paying) return;

    if (!item) {
      Alert.alert("Checkout", "Item details not loaded.");
      return;
    }

    const userId = await AsyncStorage.getItem("userId");
    if (!userId) {
      Alert.alert("Login required", "Please login again.");
      router.replace("/login");
      return;
    }

    if (!orderId) {
      Alert.alert("Checkout", "Order not ready. Please go back and try again.");
      return;
    }

    const addressOk =
      fullName.trim().length > 0 &&
      line1.trim().length > 0 &&
      city.trim().length > 0 &&
      postcode.trim().length > 0;

    if (!addressOk) {
      Alert.alert("Delivery address", "Please fill your delivery address.");
      return;
    }

    try {
      setPaying(true);

      await AsyncStorage.setItem(
        "checkoutAddress",
        JSON.stringify({
          fullName: fullName.trim(),
          line1: line1.trim(),
          city: city.trim(),
          postcode: postcode.trim(),
        })
      );

      const addressId = await saveAddressToDb(userId);
      await attachAddressToOrder(userId, orderId, addressId);

      const sheetReady = await initSheet();
      if (!sheetReady) {
        setPaying(false);
        return;
      }

      const { error } = await presentPaymentSheet();

      if (error) {
        if (error.code === "Canceled") {
          setPaying(false);
          return;
        }

        Alert.alert("Payment", error.message || "Payment was not completed.");
        setPaying(false);
        return;
      }

      const ok = await pollPaid(orderId);

      Alert.alert(
        "Payment successful",
        ok ? "Order confirmed ✅" : "Payment received ✅ (Confirming order...)",
        [
          {
            text: "OK",
            onPress: () => {
              router.replace("/marketplace?refresh=1");
            },
          },
        ]
      );
    } catch (e: any) {
      const msg =
        e?.data?.message ||
        e?.data?.error ||
        e?.message ||
        "Payment failed. Try again.";

      Alert.alert("Payment", msg);
    } finally {
      if (mountedRef.current) {
        setPaying(false);
      }
    }
  }

  async function cancelCheckout() {
    if (backCancelInProgressRef.current) return;
    backCancelInProgressRef.current = true;

    try {
      const userId = await AsyncStorage.getItem("userId");

      if (orderId && userId) {
        await postJson("/payments/cancel-order", { orderId, userId });
      }
    } catch {
    } finally {
      router.back();
    }
  }

  if (loading || !item) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.black} />
        <Text style={styles.preparingText}>Preparing checkout...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={cancelCheckout} activeOpacity={0.8} disabled={paying}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Item</Text>

          <View style={styles.itemRow}>
            <View style={styles.thumbWrap}>
              <Image
                source={{ uri: imgUrlHelper(item.image_url) }}
                style={styles.thumb}
                resizeMode="contain"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={2}>
                {(item.category || "PRE-LOVED ITEM") + (item.color ? ` • ${item.color}` : "")}
              </Text>

              <Text style={styles.itemMeta}>
                {item.size ? `${item.size} • ` : ""}
                {item.condition || "Used"}
              </Text>

              <Text style={styles.price}>£{Number(item.price || 0).toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.hr} />

          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>Shipping</Text>
            <Text style={styles.lineValue}>£{Number(shippingFee).toFixed(2)}</Text>
          </View>

          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>Estimated delivery</Text>
            <Text style={styles.lineValue}>2–7 days</Text>
          </View>

          <View style={styles.hr} />

          <View style={styles.lineRow}>
            <Text style={[styles.lineLabel, styles.bold]}>Total</Text>
            <Text style={[styles.lineValue, styles.bold]}>£{Number(total).toFixed(2)}</Text>
          </View>

          <Text style={styles.smallNote}>
            Buyer protection: If item not received or not as described, you can raise an issue within the support window.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery address</Text>

          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Full name"
            placeholderTextColor="#999"
            style={styles.input}
            editable={!paying}
          />

          <TextInput
            value={line1}
            onChangeText={setLine1}
            placeholder="Address line"
            placeholderTextColor="#999"
            style={styles.input}
            editable={!paying}
          />

          <View style={styles.rowGap}>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="City"
              placeholderTextColor="#999"
              style={[styles.input, styles.flex1]}
              editable={!paying}
            />

            <TextInput
              value={postcode}
              onChangeText={setPostcode}
              placeholder="Postcode"
              placeholderTextColor="#999"
              style={[styles.input, styles.flex1]}
              autoCapitalize="characters"
              editable={!paying}
            />
          </View>

          <Text style={styles.smallNote}>
            UK only for MVP. We’ll use this for shipping in the next phase.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment</Text>

          <Text style={styles.smallNote}>
            Tap Pay to choose card, Google Pay, or Apple Pay if enabled. 3D Secure is handled automatically.
          </Text>

          <TouchableOpacity
            onPress={payNow}
            disabled={paying}
            activeOpacity={0.8}
            style={[styles.payBtn, paying && styles.disabledBtn]}
          >
            {paying ? (
              <View style={styles.payLoadingRow}>
                <ActivityIndicator size="small" color={COLORS.white} />
                <Text style={styles.payText}>Processing...</Text>
              </View>
            ) : (
              <Text style={styles.payText}>Pay £{Number(total).toFixed(2)}</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footerTiny}>
            By paying you agree to our terms, refunds policy, and marketplace rules.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  preparingText: {
    marginTop: 10,
    color: COLORS.muted,
    fontWeight: "700",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  back: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },

  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 14,
    backgroundColor: "#FFF",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 10,
    color: COLORS.text,
  },

  itemRow: {
    flexDirection: "row",
    gap: 12,
  },
  thumbWrap: {
    width: 78,
    height: 78,
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  thumb: {
    width: "100%",
    height: "100%",
  },

  itemName: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },
  itemMeta: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.muted,
    marginTop: 4,
  },
  price: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.text,
  },

  hr: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  lineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  lineLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
  lineValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },
  bold: {
    fontWeight: "900",
  },

  smallNote: {
    marginTop: 10,
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 16,
  },

  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 13,
    color: COLORS.text,
    backgroundColor: "#FFF",
  },
  rowGap: {
    flexDirection: "row",
    gap: 10,
  },
  flex1: {
    flex: 1,
  },

  payBtn: {
    marginTop: 10,
    backgroundColor: COLORS.black,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledBtn: {
    opacity: 0.6,
  },
  payText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  payLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  footerTiny: {
    marginTop: 10,
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 14,
  },
});