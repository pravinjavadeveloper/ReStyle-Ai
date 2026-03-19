# ReStyle-Ai
Clothing AI

cd backend -->
node server.js

Create new terminal -->
cd frontend -->
npx expo start --clear

Create new terminal -->
cd ai-engine -->
uvicorn main:app --reload --port 8000

UPDATE users SET email_verified=true WHERE email='admin3@test.com';


Gmail is OK for dev/testing only

~500 emails/day limit

Can get blocked if too many resends

For production use:

SendGrid

Mailgun

Amazon SES

We can switch later without changing your auth logic.




market
// frontend/app/(tabs)/marketplace.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  AppState,
  RefreshControl,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { CardField, useStripe } from "@stripe/stripe-react-native";

// ✅ Use ONLY the payments/* route wrappers (new flow)
import {
  getMarketplaceItems,
  paymentsCreateOrder,
  paymentsCreatePaymentIntent,
  paymentsCancelOrder,
  getOrderStatus,
} from "../../services/api";

// ✅ Single source of truth for images
import { imgUrl } from "../../services/config";

const COLORS = {
  bg: "#FFFFFF",
  text: "#000000",
  border: "#E2E8F0",
  muted: "#666666",
  soft: "#F9F9F9",
  black: "#000000",
  white: "#FFFFFF",
};

const PENDING_BUY_KEY = "pendingBuyItemId";
const PENDING_BUY_FROM_KEY = "pendingBuyFrom";

export default function MarketplaceScreen() {
  const router = useRouter();
  const { confirmPayment } = useStripe();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Prevent double purchases
  const [buyingId, setBuyingId] = useState<string | number | null>(null);

  // Stripe modal states
  const [payOpen, setPayOpen] = useState(false);
  const [payItem, setPayItem] = useState<any | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [payLoading, setPayLoading] = useState(false);

  // ✅ show correct total (item + shipping) after create-order
  const [payTotal, setPayTotal] = useState<number | null>(null);

  // store orderId to cancel reservation if user closes
  const orderIdRef = useRef<string | null>(null);

  // avoid calling setState after unmount
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const normalizeItems = (data: any) => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  };

  const loadMarketplace = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);

      const myId = await AsyncStorage.getItem("userId");
      if (!myId) {
        if (!alive.current) return;
        setItems([]);
        return;
      }

      const data = await getMarketplaceItems(myId);
      const list = normalizeItems(data);

      if (!alive.current) return;
      setItems(list);
    } catch {
      if (!alive.current) return;
      setItems([]);
    } finally {
      if (!alive.current) return;
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  // 1) initial load
  useEffect(() => {
    loadMarketplace();
  }, [loadMarketplace]);

  // 2) refresh on focus
  useFocusEffect(
    useCallback(() => {
      loadMarketplace({ silent: true });
    }, [loadMarketplace])
  );

  // 3) refresh on app active
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        loadMarketplace({ silent: true });
      }
    });
    return () => sub.remove();
  }, [loadMarketplace]);

  // 4) pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadMarketplace({ silent: true });
    } finally {
      if (alive.current) setRefreshing(false);
    }
  }, [loadMarketplace]);

  const redirectToProfileForVerification = async (itemId: string | number) => {
    await AsyncStorage.setItem(PENDING_BUY_KEY, String(itemId));
    await AsyncStorage.setItem(PENDING_BUY_FROM_KEY, "marketplace");

    Alert.alert(
      "Verify phone number",
      "Please verify your phone number before buying from Marketplace.",
      [
        { text: "Verify Now", onPress: () => router.push("/profile") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  // Open payment modal
  const openPaymentModal = async (item: any) => {
    if (!item?.id) return;
    if (buyingId) return;

    setBuyingId(item.id);
    setPayItem(item);
    setPayTotal(null);
    setCardComplete(false);
    orderIdRef.current = null;
    setPayOpen(true);
    setBuyingId(null);
  };

  // close modal + release reservation if any
  const closePaymentModal = async () => {
    try {
      const myId = await AsyncStorage.getItem("userId");
      const orderId = orderIdRef.current;

      // if user closes without paying, release reservation
      if (myId && orderId) {
        await paymentsCancelOrder({ orderId, userId: myId });
      }
    } catch {
      // ignore
    } finally {
      orderIdRef.current = null;
      setPayOpen(false);
      setPayItem(null);
      setPayTotal(null);
      setCardComplete(false);
      setPayLoading(false);
    }
  };

  // Force release reservation (used for seller stripe errors too)
  const releaseReservationSafely = async () => {
    try {
      const myId = await AsyncStorage.getItem("userId");
      const orderId = orderIdRef.current;
      if (myId && orderId) {
        await paymentsCancelOrder({ orderId, userId: myId });
      }
    } catch {
      // ignore
    } finally {
      orderIdRef.current = null;
    }
  };

  // Poll webhook-confirmed paid status
  const pollPaid = async (orderId: string, userId: string) => {
    for (let i = 0; i < 20; i++) {
      const st = await getOrderStatus(orderId, userId);
      if (st?.payment_status === "paid") return true;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  };

  // ✅ Production Stripe flow (NEW: /payments/create-order + /payments/create-payment-intent)
  const confirmAndPay = async () => {
    const myId = await AsyncStorage.getItem("userId");
    if (!myId || !payItem?.id) {
      Alert.alert("Error", "Please login again.");
      return;
    }

    if (!cardComplete) {
      Alert.alert("Card details incomplete", "Please enter full card details.");
      return;
    }

    try {
      setPayLoading(true);

      // 1) Reserve + create order (NEW route)
      const reserveRes = await paymentsCreateOrder({
        itemId: payItem.id,
        userId: myId,
      });

      if (reserveRes?.error === "PHONE_NOT_VERIFIED") {
        await closePaymentModal();
        await redirectToProfileForVerification(payItem.id);
        return;
      }

      if (reserveRes?.error) {
        Alert.alert(
          "Error",
          reserveRes?.message || reserveRes?.error || "Could not reserve item."
        );
        return;
      }

      const orderId = String(reserveRes?.orderId || "");
      if (!orderId) {
        Alert.alert("Error", "Order creation failed.");
        return;
      }
      orderIdRef.current = orderId;

      // ✅ show correct total (item + shipping)
      if (reserveRes?.totalGbp != null) {
        const t = Number(reserveRes.totalGbp);
        if (Number.isFinite(t)) setPayTotal(t);
      }

      // 2) Create payment intent (NEW wrapper)
      const piRes = await paymentsCreatePaymentIntent({
        orderId,
        userId: myId,
      });

      if (piRes?.alreadyPaid) {
        await closePaymentModal();
        setItems((curr) => curr.filter((i) => i.id !== payItem.id));
        loadMarketplace({ silent: true });
        Alert.alert("Already paid", "This order was already paid.");
        return;
      }

      // ✅ seller connect errors from backend
      if (piRes?.error === "SELLER_STRIPE_NOT_CONNECTED") {
        await releaseReservationSafely();
        await closePaymentModal();

        Alert.alert(
          "Seller not ready",
          "This seller has not connected payouts yet. Please choose another item.",
          [{ text: "OK" }]
        );
        return;
      }

      if (piRes?.error === "SELLER_STRIPE_NOT_READY") {
        await releaseReservationSafely();
        await closePaymentModal();

        Alert.alert(
          "Seller onboarding incomplete",
          "The seller hasn’t finished Stripe onboarding yet. Please try later or choose another item.",
          [{ text: "OK" }]
        );
        return;
      }

      if (piRes?.error || !piRes?.clientSecret) {
        Alert.alert(
          "Payment error",
          piRes?.message || piRes?.error || "Could not create payment."
        );
        return;
      }

      // 3) Confirm payment (3DS handled by Stripe)
      const { error } = await confirmPayment(piRes.clientSecret, {
        paymentMethodType: "Card",
      });

      if (error) {
        if ((error as any)?.code === "Canceled") return;
        Alert.alert("Payment failed", error.message || "Payment was not completed.");
        return;
      }

      // 4) Poll order status (webhook is source of truth)
      const paid = await pollPaid(orderId, myId);

      if (paid) {
        Alert.alert("PURCHASE SUCCESSFUL", `You just bought the ${payItem.category || "item"}!`);

        setItems((currentItems) => currentItems.filter((i) => i.id !== payItem.id));
        loadMarketplace({ silent: true });

        orderIdRef.current = null;
        setPayOpen(false);
        setPayItem(null);
        setPayTotal(null);
      } else {
        Alert.alert(
          "Processing",
          "Payment received. Updating order… Pull down to refresh in a few seconds."
        );
        loadMarketplace({ silent: true });

        orderIdRef.current = null;
        setPayOpen(false);
        setPayItem(null);
        setPayTotal(null);
      }
    } catch {
      Alert.alert("Error", "Could not complete purchase.");
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.backBtn}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <Text style={styles.title}>MARKETPLACE</Text>
        </View>

        <Text style={styles.itemCount}>DISCOVER SUSTAINABLE FINDS • {items.length} ITEMS</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.black} />
          <Text style={styles.loadingText}>CURATING COLLECTION...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContainer}
          data={items}
          numColumns={2}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.row}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const isBuying = buyingId === item?.id;

            return (
              <View style={styles.card}>
                <View style={styles.imageContainer}>
                  <Image source={{ uri: imgUrl(item.image_url) }} style={styles.image} resizeMode="contain" />

                  <View style={styles.priceTag}>
                    <Text style={styles.priceText}>£{item.price}</Text>
                  </View>
                </View>

                <View style={styles.info}>
                  <Text style={styles.category} numberOfLines={1}>
                    {item.category || "PRE-LOVED ITEM"}
                  </Text>

                  <Text style={styles.details} numberOfLines={1}>
                    {item.size ? `${item.size} • ` : ""}
                    {item.condition || "USED"}
                  </Text>

                  <TouchableOpacity
                    style={[styles.buyButton, isBuying && { opacity: 0.55 }]}
                    onPress={() => openPaymentModal(item)}
                    activeOpacity={0.6}
                    disabled={isBuying}
                  >
                    {isBuying ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <ActivityIndicator size="small" color={COLORS.black} />
                        <Text style={styles.buyButtonText}>LOADING...</Text>
                      </View>
                    ) : (
                      <Text style={styles.buyButtonText}>QUICK BUY</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>THE MARKETPLACE IS EMPTY.</Text>
              <Text style={styles.emptySubText}>Pull down to refresh or check back soon.</Text>
            </View>
          }
        />
      )}

      {/* Stripe Payment Modal */}
      <Modal
        visible={payOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!payLoading) closePaymentModal();
        }}
      >
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.sheet}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>SECURE PAYMENT</Text>

              <Pressable disabled={payLoading} onPress={closePaymentModal}>
                <Text style={modalStyles.close}>✕</Text>
              </Pressable>
            </View>

            <Text style={modalStyles.sub}>
              Paying for: <Text style={{ fontWeight: "800" }}>{payItem?.category || "Item"}</Text>
            </Text>

            <CardField
              postalCodeEnabled={true}
              style={{ width: "100%", height: 50, marginTop: 14 }}
              cardStyle={{
                backgroundColor: "#FFFFFF",
                textColor: "#000000",
                borderWidth: 1,
                borderColor: "#000000",
              }}
              onCardChange={(card) => setCardComplete(!!card?.complete)}
            />

            <TouchableOpacity
              style={[modalStyles.payBtn, (!cardComplete || payLoading) && { opacity: 0.55 }]}
              disabled={!cardComplete || payLoading}
              onPress={confirmAndPay}
              activeOpacity={0.7}
            >
              {payLoading ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ActivityIndicator size="small" color="#000" />
                  <Text style={modalStyles.payText}>PROCESSING...</Text>
                </View>
              ) : (
                <Text style={modalStyles.payText}>
                  PAY £{payTotal != null ? payTotal : payItem?.price ?? ""}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={modalStyles.foot}>Stripe handles 3D Secure automatically.</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 16,
  },
  headerContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  backBtn: {
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    color: COLORS.text,
    fontSize: 32,
    fontFamily: "IntegralCF-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  itemCount: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  card: {
    width: "48%",
    backgroundColor: COLORS.white,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 0,
    shadowOpacity: 0,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 0.85,
    backgroundColor: COLORS.soft,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  priceTag: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: COLORS.white,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.black,
  },
  priceText: {
    color: COLORS.black,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  info: { padding: 12, paddingBottom: 16 },
  category: {
    color: COLORS.black,
    fontWeight: "500",
    marginBottom: 4,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  details: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  buyButton: {
    width: "100%",
    paddingVertical: 10,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: COLORS.black,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  buyButtonText: {
    fontWeight: "600",
    fontSize: 10,
    color: COLORS.black,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 40,
  },
  emptyText: {
    color: COLORS.black,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptySubText: {
    color: COLORS.muted,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "500",
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 1,
    borderColor: "#000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
  },
  close: {
    fontSize: 18,
    fontWeight: "800",
  },
  sub: {
    marginTop: 10,
    fontSize: 12,
    color: "#111",
  },
  payBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 12,
    alignItems: "center",
  },
  payText: {
    fontWeight: "900",
    letterSpacing: 1,
  },
  foot: {
    marginTop: 10,
    fontSize: 11,
    color: "#555",
  },
});



fcn /routes
// backend/services/fcm.js
"use strict";

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

let initialized = false;

function parseServiceAccount() {
  const jsonStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (jsonStr && jsonStr.trim().startsWith("{")) {
    return JSON.parse(jsonStr);
  }

  if (jsonPath) {
    const abs = path.isAbsolute(jsonPath)
      ? jsonPath
      : path.join(process.cwd(), jsonPath);
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  }

  return null;
}

function initFirebase() {
  if (initialized || admin.apps.length > 0) {
    initialized = true;
    return;
  }

  let serviceAccount;
  try {
    serviceAccount = parseServiceAccount();
  } catch (err) {
    throw new Error("Invalid Firebase service account JSON/PATH");
  }

  if (!serviceAccount) {
    throw new Error(
      "FCM not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH."
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  initialized = true;
}

function isLikelyFcmToken(token) {
  // FCM tokens are long strings; this is a safe broad check.
  return typeof token === "string" && token.length >= 80 && !token.includes("[");
}

async function sendFCM(token, payload = {}) {
  if (!isLikelyFcmToken(token)) {
    return {
      success: false,
      skipped: true,
      reason: "NOT_FCM_TOKEN",
    };
  }

  initFirebase();

  // FCM data values MUST be strings
  const data = {};
  const rawData = payload.data || {};
  for (const k of Object.keys(rawData)) {
    const v = rawData[k];
    data[k] = v === undefined || v === null ? "" : String(v);
  }

  const message = {
    token,
    notification: {
      title: payload.title || "RE-STYLE AI",
      body: payload.body || "",
    },
    data,
    android: payload.android || {
      priority: "high",
      notification: {
        channelId: payload.channelId || "deliveries",
        sound: "default",
      },
    },
    apns: payload.apns || undefined, // optional (not needed for android)
  };

  try {
    const id = await admin.messaging().send(message);
    return { success: true, messageId: id };
  } catch (e) {
    // Do not crash server
    return {
      success: false,
      error: "FCM_SEND_FAILED",
      detail: e?.message || String(e),
      code: e?.code,
    };
  }
}

module.exports = { sendFCM, isLikelyFcmToken };


apns/routes
// backend/services/apns.js
"use strict";

const apn = require("apn");
const fs = require("fs");
const path = require("path");

let provider = null;

function isLikelyApnsToken(token) {
  // APNs device token = 64 hex chars
  return typeof token === "string" && /^[a-f0-9]{64}$/i.test(token.trim());
}

function getProvider() {
  if (provider) return provider;

  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;
  const p8Path = process.env.APNS_P8_PATH;

  const production =
    String(process.env.APNS_PRODUCTION || "false").toLowerCase() === "true";

  if (!keyId || !teamId || !bundleId || !p8Path) {
    throw new Error(
      "APNs not configured. Set APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_P8_PATH."
    );
  }

  const abs = path.isAbsolute(p8Path) ? p8Path : path.join(process.cwd(), p8Path);

  let key;
  try {
    key = fs.readFileSync(abs);
  } catch (e) {
    throw new Error(`APNs key file not found/readable at: ${abs}`);
  }

  provider = new apn.Provider({
    token: { key, keyId, teamId },
    production,
  });

  return provider;
}

async function sendAPNS(deviceToken, payload = {}) {
  if (!isLikelyApnsToken(deviceToken)) {
    return {
      success: false,
      skipped: true,
      reason: "NOT_APNS_TOKEN",
    };
  }

  let p;
  try {
    p = getProvider();
  } catch (e) {
    return { success: false, error: "APNS_NOT_CONFIGURED", detail: e.message };
  }

  const bundleId = process.env.APNS_BUNDLE_ID;

  const note = new apn.Notification();
  note.topic = bundleId;

  // For iOS 13+ pushType is required
  note.pushType = "alert";
  note.priority = 10;
  note.expiry = Math.floor(Date.now() / 1000) + 3600;

  note.alert = {
    title: payload.title || "RE-STYLE AI",
    body: payload.body || "",
  };

  note.sound = payload.sound || "default";

  // APNs payload must be JSON-safe
  note.payload = payload.data || {};

  try {
    const result = await p.send(note, deviceToken);

    const failed = (result.failed || [])[0];
    if (failed) {
      return {
        success: false,
        error: "APNS_SEND_FAILED",
        status: failed?.status,
        response: failed?.response,
        device: failed?.device,
      };
    }

    return { success: true, sent: (result.sent || []).length };
  } catch (e) {
    return { success: false, error: "APNS_SEND_FAILED", detail: e?.message || String(e) };
  }
}

module.exports = { sendAPNS, isLikelyApnsToken };
