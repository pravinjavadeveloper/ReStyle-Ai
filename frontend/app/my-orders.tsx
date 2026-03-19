// frontend/app/my-orders.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getMyPurchases,
  getMySoldItems, // fallback (old)
  getSellerOrdersToShip,
  createShippoLabel,
  markDroppedOff,
  getShippingOrder,
} from "../services/api";
import { Ionicons } from "@expo/vector-icons";
import { imgUrl } from "../services/config";

const COLORS = {
  bg: "#FFFFFF",
  text: "#000000",
  border: "#E2E8F0",
  muted: "#666666",
  black: "#000000",
  white: "#FFFFFF",
  soft: "#F9F9F9",
};

type Tab = "bought" | "sold";

function normalizeItems(data: any) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

function safeOpen(url?: string | null) {
  if (!url) return;
  Linking.openURL(url).catch(() => {});
}

function statusLabel(orderStatus?: string, shipmentStatus?: string) {
  const s = shipmentStatus || orderStatus || "UNKNOWN";
  return String(s).replaceAll("_", " ");
}

function statusIcon(s?: string) {
  const v = (s || "").toUpperCase();
  if (v.includes("DELIVERED")) return "checkmark-done";
  if (v.includes("IN_TRANSIT") || v.includes("SHIPPED")) return "car";
  if (v.includes("LABEL")) return "qr-code";
  if (v.includes("AWAITING")) return "time";
  if (v.includes("EXCEPTION") || v.includes("FAILED")) return "alert-circle";
  return "cube-outline";
}

function isDropoffDisabled(shipmentStatus?: string, orderStatus?: string) {
  const s = String(shipmentStatus || orderStatus || "").toUpperCase();
  // once shipped / in transit / delivered, do not allow manual drop-off mark
  return s.includes("SHIPPED") || s.includes("IN_TRANSIT") || s.includes("DELIVERED");
}

export default function MyOrdersScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("bought");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // per-order button loading
  const [labelLoading, setLabelLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const loadData = async () => {
    setLoading(true);

    const userId = await AsyncStorage.getItem("userId");
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      if (tab === "bought") {
        const data = await getMyPurchases(userId);
        setItems(normalizeItems(data));
      } else {
        const shipData = await getSellerOrdersToShip(userId);

        if (shipData?.error) {
          const fallback = await getMySoldItems(userId);
          setItems(normalizeItems(fallback));
        } else {
          setItems(normalizeItems(shipData));
        }
      }
    } catch (error) {
      console.error("Failed to load orders:", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  async function onCreateLabel(orderId: string | number) {
    const key = String(orderId);
    setLabelLoading((p) => ({ ...p, [key]: true }));

    try {
      const r = await createShippoLabel(orderId);

      if (r?.error) {
        if (r.error === "ORDER_NOT_PAID") {
          Alert.alert("Not paid", "This order is not paid yet. You can generate label only after payment.");
          return;
        }
        if (r.error === "ORDER_NOT_READY_FOR_LABEL") {
          Alert.alert("Not ready", `Order status is ${r.status || "unknown"}.`);
          return;
        }
        if (r.error === "SELLER_ADDRESS_MISSING") {
          Alert.alert(
            "Seller address required",
            "Please set your seller address before generating labels.",
            [{ text: "Set address", onPress: () => router.push("/seller-address") }, { text: "OK" }]
          );
          return;
        }
        Alert.alert("Label", r.message || r.error || "Failed to create label");
        return;
      }

      Alert.alert(
        r.reused ? "Label already exists" : "Label created",
        "You can open the label PDF or share the QR at drop-off.",
        [{ text: "Open Label", onPress: () => safeOpen(r.label_url) }, { text: "OK" }]
      );

      loadData();
    } finally {
      setLabelLoading((p) => ({ ...p, [key]: false }));
    }
  }

  async function onMarkDroppedOff(orderId: string | number) {
    const userId = await AsyncStorage.getItem("userId");
    if (!userId) return;

    Alert.alert(
      "Confirm drop-off",
      "Only tap this after you have physically dropped the parcel at the ParcelShop.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, dropped off",
          style: "default",
          onPress: async () => {
            const r = await markDroppedOff(orderId, userId);
            if (r?.error) {
              Alert.alert("Drop-off", r.message || r.error || "Failed");
              return;
            }
            Alert.alert("Updated", "Marked as dropped off.");
            loadData();
          },
        },
      ]
    );
  }

  async function onViewBuyerAddress(orderId: string | number) {
    const userId = await AsyncStorage.getItem("userId");
    if (!userId) return;

    //  backend requires userId query param
    const r = await getShippingOrder(orderId, userId);

    if (r?.error) {
      Alert.alert("Address", r.message || r.error || "Failed to load address");
      return;
    }

    const o = r?.order;

    if (!o?.postcode) {
      Alert.alert("Address", "Buyer shipping address not attached yet.");
      return;
    }

    const lines = [
      o.full_name,
      o.line1,
      o.line2 ? o.line2 : null,
      `${o.city}${o.county ? `, ${o.county}` : ""}`,
      o.postcode,
      o.country || "GB",
      o.phone ? `Phone: ${o.phone}` : null,
    ].filter(Boolean);

    Alert.alert("Buyer Shipping Address", lines.join("\n"));
  }

  const renderBought = (item: any) => {
    return (
      <View style={styles.orderCard}>
        <View style={styles.barcodeStrip} />
        <View style={styles.cardContent}>
          <View style={styles.imageWrap}>
            {item?.image_url ? (
              <Image source={{ uri: imgUrl(item.image_url) }} style={styles.image} resizeMode="cover" />
            ) : (
              <Ionicons name="image-outline" size={24} color={COLORS.muted} />
            )}
          </View>

          <View style={styles.info}>
            <View style={styles.infoTopRow}>
              <Text style={styles.name} numberOfLines={1}>
                {item?.item_name || item?.category || "ITEM"}
              </Text>
              <Text style={styles.price}>£{item?.price}</Text>
            </View>

            <Text style={styles.date}>
              DATE: {item?.date_sold ? new Date(item.date_sold).toLocaleDateString() : "JUST NOW"}
            </Text>

            <View style={[styles.statusBox, { backgroundColor: COLORS.white, borderColor: COLORS.black, borderWidth: 1 }]}>
              <Ionicons name="cube-outline" size={12} color={COLORS.black} />
              <Text style={[styles.statusText, { color: COLORS.black }]}>ORDER CONFIRMED</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderSold = (row: any) => {
    const orderId = row?.order_id || row?.id;
    const shipmentStatus = row?.shipment_status || row?.status;
    const orderStatus = row?.status;

    const labelUrl = row?.label_url;
    const trackingUrl = row?.tracking_url;
    const qrUrl = row?.qr_code_url;
    const trackingNo = row?.tracking_number;
    const carrier = row?.carrier;
    const service = row?.service_level;

    const icon = statusIcon(shipmentStatus || orderStatus);
    const badge = statusLabel(orderStatus, shipmentStatus);

    const dropoffDisabled = isDropoffDisabled(shipmentStatus, orderStatus);

    return (
      <View style={styles.orderCard}>
        <View style={styles.barcodeStrip} />

        <View style={styles.cardContent}>
          <View style={styles.imageWrap}>
            {row?.image_url ? (
              <Image source={{ uri: imgUrl(row.image_url) }} style={styles.image} resizeMode="cover" />
            ) : (
              <Ionicons name="image-outline" size={24} color={COLORS.muted} />
            )}
          </View>

          <View style={styles.info}>
            <View style={styles.infoTopRow}>
              <Text style={styles.name} numberOfLines={1}>
                {(row?.category || row?.item_name || "ITEM").toUpperCase()}
              </Text>
              <Text style={styles.price}>£{row?.price}</Text>
            </View>

            <Text style={styles.date}>
              ORDER #{String(orderId)} {carrier ? `• ${carrier}` : ""} {service ? `• ${service}` : ""}
            </Text>

            <View style={styles.statusBox}>
              <Ionicons name={icon as any} size={12} color={COLORS.black} />
              <Text style={styles.statusText}>{badge}</Text>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.actionBtn, styles.actionPrimary]}
                onPress={() => onCreateLabel(orderId)}
                disabled={!!labelLoading[String(orderId)]}
              >
                {labelLoading[String(orderId)] ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.actionPrimaryText}>{labelUrl ? "RE-OPEN LABEL" : "GENERATE LABEL"}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.8} style={styles.actionBtn} onPress={() => safeOpen(qrUrl)} disabled={!qrUrl}>
                <Text style={[styles.actionText, !qrUrl && { opacity: 0.4 }]}>OPEN QR</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.8} style={styles.actionBtn} onPress={() => safeOpen(labelUrl)} disabled={!labelUrl}>
                <Text style={[styles.actionText, !labelUrl && { opacity: 0.4 }]}>LABEL PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.actionBtn}
                onPress={() => safeOpen(trackingUrl)}
                disabled={!trackingUrl}
              >
                <Text style={[styles.actionText, !trackingUrl && { opacity: 0.4 }]}>
                  TRACK{trackingNo ? ` (${trackingNo})` : ""}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.8} style={styles.actionBtn} onPress={() => onViewBuyerAddress(orderId)}>
                <Text style={styles.actionText}>BUYER ADDRESS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.actionBtn}
                onPress={() => onMarkDroppedOff(orderId)}
                disabled={dropoffDisabled}
              >
                <Text style={[styles.actionText, dropoffDisabled && { opacity: 0.4 }]}>MARK DROPPED OFF</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.tinyHint}>
              Seller flow: Buyer pays → status AWAITING_SHIPMENT → Generate label → Drop off → Shippo webhook updates.
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const emptyText = useMemo(() => {
    if (tab === "bought") return "Your purchase history is empty.";
    return "No paid orders to ship yet.";
  }, [tab]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.backBtn}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>ORDER LEDGER</Text>
        <Text style={styles.subtitle}>YOUR TRANSACTIONS</Text>

        {/*  Put this under header for seller */}
        {tab === "sold" && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push("/seller-address")}
            style={styles.sellerAddressBtn}
          >
            <Text style={styles.sellerAddressBtnText}>SET SELLER ADDRESS</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tab, tab === "bought" && styles.activeTab]} onPress={() => setTab("bought")} activeOpacity={0.8}>
          <Text style={[styles.tabText, tab === "bought" && styles.activeTabText]}>PURCHASES</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tab, tab === "sold" && styles.activeTab]} onPress={() => setTab("sold")} activeOpacity={0.8}>
          <Text style={[styles.tabText, tab === "sold" && styles.activeTabText]}>SALES</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.black} />
          <Text style={styles.loadingText}>RETRIEVING RECORDS...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, index) => String(item?.order_id || item?.id || index)}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (tab === "bought" ? renderBought(item) : renderSold(item))}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={40} color={COLORS.muted} style={{ marginBottom: 16 }} />
              <Text style={styles.emptyText}>NO RECORDS FOUND</Text>
              <Text style={styles.emptySubText}>{emptyText}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 16 },

  headerContainer: { paddingHorizontal: 20, marginBottom: 20 },
  backBtn: { marginBottom: 16, alignSelf: "flex-start" },
  backButtonText: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
  title: {
    color: COLORS.text,
    fontSize: 32,
    fontFamily: "IntegralCF-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  subtitle: { color: COLORS.text, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },

  sellerAddressBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.black,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  sellerAddressBtnText: { color: COLORS.black, fontSize: 10, fontWeight: "900", letterSpacing: 1 },

  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  tab: { marginRight: 32, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: COLORS.black },
  tabText: { color: COLORS.muted, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  activeTabText: { color: COLORS.black },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, color: COLORS.black, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },

  listContainer: { paddingHorizontal: 20, paddingBottom: 40 },

  orderCard: { flexDirection: "row", backgroundColor: COLORS.white, borderRadius: 0, marginBottom: 16, borderWidth: 1, borderColor: COLORS.black },
  barcodeStrip: { width: 6, backgroundColor: COLORS.soft, borderRightWidth: 1, borderColor: COLORS.black, borderStyle: "dashed" },

  cardContent: { flex: 1, flexDirection: "row", padding: 16 },
  imageWrap: { width: 70, height: 90, backgroundColor: COLORS.soft, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", marginRight: 16 },
  image: { width: "100%", height: "100%" },

  info: { flex: 1, justifyContent: "space-between" },
  infoTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  name: { flex: 1, color: COLORS.black, fontSize: 14, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5, marginRight: 10 },
  price: { color: COLORS.black, fontSize: 14, fontWeight: "900" },
  date: { color: COLORS.muted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 10 },

  statusBox: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.soft, paddingVertical: 6, paddingHorizontal: 10, alignSelf: "flex-start" },
  statusText: { color: COLORS.black, fontSize: 9, fontWeight: "800", letterSpacing: 0.5, marginLeft: 6 },

  actionsRow: { marginTop: 10, gap: 8 },

  actionBtn: { borderWidth: 1, borderColor: COLORS.black, paddingVertical: 10, paddingHorizontal: 10, alignSelf: "flex-start" },
  actionPrimary: { backgroundColor: COLORS.black },
  actionPrimaryText: { color: COLORS.white, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  actionText: { color: COLORS.black, fontSize: 10, fontWeight: "900", letterSpacing: 1 },

  tinyHint: { marginTop: 10, color: COLORS.muted, fontSize: 10, lineHeight: 14 },

  emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 60, padding: 40, borderWidth: 1, borderColor: COLORS.border },
  emptyText: { color: COLORS.black, fontSize: 14, fontWeight: "800", letterSpacing: 1, marginBottom: 8 },
  emptySubText: { color: COLORS.muted, fontSize: 12, textAlign: "center" },
});