// frontend/app/my-closet.tsx

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Animated,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getUserItems,
  listForResale,
  getPriceEstimate,
  deleteItem,
  generateListingAI,
} from "../../services/api";

//  PRODUCTION FIX: single source of truth for images
import { imgUrl } from "../../services/config";

const PLATFORM_FEE_RATE = 0.10;

const COLORS = {
  bg: "#F4F8F9",
  primary: "#000000",
  mid: "#000000",
  accent: "#9f6f6f",
  soft: "#DCEFEA",
  white: "#FFFFFF",
  ink: "#0E1F1B",
  line: "#E2E8F0",
  muted: "rgba(31,58,52,0.62)",
};

type ClosetItem = {
  id: number | string;
  image_url: string;
  category: string;
  for_sale?: boolean;
  price?: number;
  size?: string;
  condition?: string;
  description?: string;
};

const AnimatedItem = ({
  item,
  index,
  onResell,
  onAutoList,
  onDelete,
  openImageUri,
}: {
  item: ClosetItem;
  index: number;
  onResell: (item: ClosetItem) => void;
  onAutoList: (item: ClosetItem) => void;
  onDelete: (item: ClosetItem) => void;
  openImageUri: (path: string) => string;
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  const innerImageAnim = useRef(new Animated.Value(0)).current;

  //  Keep animation exactly (no change)
  useEffect(() => {
    anim.setValue(0);
    innerImageAnim.setValue(0);

    const spring = Animated.spring(anim, {
      toValue: 1,
      friction: 5,
      tension: 45,
      delay: index * 80,
      useNativeDriver: true,
    });

    const zoom = Animated.timing(innerImageAnim, {
      toValue: 1,
      duration: 1200,
      delay: index * 80,
      useNativeDriver: true,
    });

    spring.start();
    zoom.start();

    return () => {
      anim.stopAnimation();
      innerImageAnim.stopAnimation();
    };
  }, [index, anim, innerImageAnim]);

  const isEven = index % 2 === 0;

  const rotateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [isEven ? "-65deg" : "65deg", "0deg"],
  });

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [120, 0],
  });

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.65, 1],
  });

  const imageScale = innerImageAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.4, 1],
  });

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: anim,
          transform: [{ perspective: 800 }, { translateY }, { scale }, { rotateY }],
        },
      ]}
    >
      <View style={styles.imageWrap}>
        <Animated.Image
          source={{ uri: openImageUri(item.image_url) }}
          style={[styles.image, { transform: [{ scale: imageScale }] }]}
          resizeMode="contain"
        />

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(item)}
          activeOpacity={0.85}
        >
          <Text style={{ fontSize: 16 }}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.info}>
        <Text style={styles.category} numberOfLines={1}>
          {item.category} {item.for_sale ? `• $${item.price}` : ""}
        </Text>

        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.btn} onPress={() => onResell(item)} activeOpacity={0.6}>
            <Text style={styles.btnText}>{item.for_sale ? "EDIT" : "RESELL"}</Text>
          </TouchableOpacity>

          {!item.for_sale && (
            <TouchableOpacity style={styles.btn} onPress={() => onAutoList(item)} activeOpacity={0.6}>
              <Text style={styles.btnText}>AI</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

export default function MyClosetScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ClosetItem | null>(null);
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  const [condition, setCondition] = useState("Good");
  const [desc, setDesc] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [autoModalVisible, setAutoModalVisible] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);

  const [aiTitle, setAiTitle] = useState("");
  const [aiDesc, setAiDesc] = useState("");
  const [aiMin, setAiMin] = useState<number>(0);
  const [aiMax, setAiMax] = useState<number>(0);
  const [aiTagsText, setAiTagsText] = useState("");
  const [autoPrice, setAutoPrice] = useState("");

  const headerAnim = useRef(new Animated.Value(0)).current;

  //  NEW: prevent double submit / native "crash feeling"
  const [savingManual, setSavingManual] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);

  //  keep image helper same
  const openImageUri = useCallback((imgPath: string) => imgUrl(imgPath), []);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem("userId");
      if (!userId) {
        if (Platform.OS !== "web") Alert.alert("Error", "Please login again.");
        router.replace("/");
        return;
      }
      const data = await getUserItems(userId);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log("LOAD ITEMS ERROR:", e);
      if (Platform.OS !== "web") Alert.alert("Error", "Failed to load closet items.");
      else alert("Failed to load closet items.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  //  Keep screen focus effect (same)
  useFocusEffect(
    useCallback(() => {
      loadItems();

      headerAnim.setValue(0);
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();

      return () => {
        headerAnim.stopAnimation();
      };
    }, [headerAnim, loadItems])
  );

  const headerTranslateY = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  const handleDelete = async (item: ClosetItem) => {
    const performDelete = async () => {
      setItems((current) => current.filter((i) => String(i.id) !== String(item.id)));
      const result = await deleteItem(item.id as any);
      if (result?.error) {
        if (Platform.OS !== "web") Alert.alert("Error", result.error);
        else alert(result.error);
        loadItems();
      }
    };

    if (Platform.OS === "web") {
      // @ts-ignore
      if (window.confirm("Are you sure you want to delete this item?")) await performDelete();
    } else {
      Alert.alert("Delete Item", "Are you sure you want to remove this item?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ]);
    }
  };

  const handleResellClick = (item: ClosetItem) => {
    setSelectedItem(item);

    if (item.for_sale) {
      setPrice(item.price != null ? String(item.price) : "");
      setSize(item.size || "");
      setCondition(item.condition || "Good");
      setDesc(item.description || "");
    } else {
      setPrice("");
      setSize(item.size || "");
      setDesc("");
      setCondition(item.condition || "Good");
    }

    setModalVisible(true);
  };

  const handleAutoListClick = async (item: ClosetItem) => {
    try {
      const userId = await AsyncStorage.getItem("userId");
      if (!userId) {
        if (Platform.OS !== "web") Alert.alert("Error", "Please login again.");
        router.replace("/");
        return;
      }

      setSelectedItem(item);
      setAiTitle("");
      setAiDesc("");
      setAiMin(0);
      setAiMax(0);
      setAiTagsText("");
      setAutoPrice("");

      setAutoModalVisible(true);
      setAutoLoading(true);

      const res = await generateListingAI(userId, String(item.id));

      if (res?.error) {
        setAutoModalVisible(false);
        if (Platform.OS !== "web") Alert.alert("AI Failed", res.error);
        else alert(res.error);
        return;
      }

      setAiTitle(res.title || "");
      setAiDesc(res.description || "");
      setAiMin(Number(res.priceMin || 0));
      setAiMax(Number(res.priceMax || 0));

      const tags = Array.isArray(res.tags) ? res.tags.map(String) : [];
      setAiTagsText(tags.join(", "));

      const mid = Math.round((Number(res.priceMin || 0) + Number(res.priceMax || 0)) / 2);
      setAutoPrice(String(mid > 0 ? mid : 15));

      setSize(item.size || "");
      setCondition(item.condition || "Good");
    } catch (e) {
      console.log("AUTO LIST ERROR:", e);
      if (Platform.OS !== "web") Alert.alert("Error", "Auto-List failed. Try again.");
      else alert("Auto-List failed. Try again.");
      setAutoModalVisible(false);
    } finally {
      setAutoLoading(false);
    }
  };

  const confirmAutoList = async () => {
    if (!selectedItem) return;
    if (savingAuto) return;

    const p = Number(autoPrice || 0);
    if (!Number.isFinite(p) || p <= 0) {
      if (Platform.OS !== "web") Alert.alert("Error", "Enter a valid price.");
      else alert("Enter a valid price.");
      return;
    }

    const tagsClean = (aiTagsText || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);

    const finalDesc = [
      aiTitle?.trim() ? `${aiTitle.trim()}` : "",
      aiDesc?.trim() ? `${aiDesc.trim()}` : "",
      tagsClean.length ? `Tags: ${tagsClean.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      setSavingAuto(true);

      const result = await listForResale(
        selectedItem.id as any,
        p,
        size || "",
        condition || "Good",
        finalDesc || aiDesc || ""
      );

      if (result?.error) {
        if (Platform.OS !== "web") Alert.alert("Error", result.error);
        else alert(result.error);
      } else {
        if (Platform.OS !== "web") Alert.alert("Listed ", "AI listing posted in your marketplace!");
        else alert("AI listing posted in your marketplace!");

        //  native smooth: close modal first, then refresh
        setAutoModalVisible(false);
        setSelectedItem(null);

        setTimeout(() => {
          loadItems();
        }, 150);
      }
    } catch (e) {
      console.log("CONFIRM AUTO LIST ERROR:", e);
      if (Platform.OS !== "web") Alert.alert("Error", "Failed to list item.");
      else alert("Failed to list item.");
    } finally {
      setSavingAuto(false);
    }
  };

  const fetchEstimate = async () => {
    if (!selectedItem) return;
    setAiLoading(true);

    try {
      const result = await getPriceEstimate(selectedItem.category, condition);
      if (result) {
        setPrice(String(result.suggested ?? ""));
        const msg = `Market Value: $${result.min} - $${result.max}`;
        if (Platform.OS !== "web") Alert.alert("AI Suggestion", msg);
        else alert(`AI Suggestion: ${msg}`);
      }
    } catch (e) {
      console.log("AI ESTIMATE ERROR:", e);
      if (Platform.OS !== "web") Alert.alert("Error", "Failed to get AI estimate.");
      else alert("Failed to get AI estimate.");
    } finally {
      setAiLoading(false);
    }
  };

  const confirmResale = async () => {
    if (!selectedItem) return;
    if (savingManual) return;

    const sellingPrice = Number(price || 0);
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      if (Platform.OS !== "web") Alert.alert("Error", "Please enter a valid price.");
      else alert("Please enter a valid price.");
      return;
    }

    try {
      setSavingManual(true);

      const result = await listForResale(selectedItem.id as any, sellingPrice, size, condition, desc);
      if (result?.error) {
        if (Platform.OS !== "web") Alert.alert("Error", result.error);
        else alert(result.error);
      } else {
        if (Platform.OS !== "web") Alert.alert("Success", "Listing Updated! 🚀");
        else alert("Listing Updated! 🚀");

        //  native smooth: close modal first, then refresh
        setModalVisible(false);
        setSelectedItem(null);

        setTimeout(() => {
          loadItems();
        }, 150);
      }
    } catch (e) {
      console.log("LIST FOR RESALE ERROR:", e);
      if (Platform.OS !== "web") Alert.alert("Error", "Failed to list item.");
      else alert("Failed to list item.");
    } finally {
      setSavingManual(false);
    }
  };

  const { sellingPrice, platformFee, youEarn } = useMemo(() => {
    const priceNum = Number(price || 0);
    const sp = Number.isFinite(priceNum) ? priceNum : 0;
    const fee = Number((sp * PLATFORM_FEE_RATE).toFixed(2));
    const earn = Number((sp - fee).toFixed(2));
    return { sellingPrice: sp, platformFee: fee, youEarn: earn };
  }, [price]);

  const { autoSellingPrice, autoPlatformFee, autoYouEarn } = useMemo(() => {
    const priceNum = Number(autoPrice || 0);
    const sp = Number.isFinite(priceNum) ? priceNum : 0;
    const fee = Number((sp * PLATFORM_FEE_RATE).toFixed(2));
    const earn = Number((sp - fee).toFixed(2));
    return { autoSellingPrice: sp, autoPlatformFee: fee, autoYouEarn: earn };
  }, [autoPrice]);

  const renderItem = ({ item, index }: { item: ClosetItem; index: number }) => (
    <AnimatedItem
      item={item}
      index={index}
      openImageUri={openImageUri}
      onResell={handleResellClick}
      onAutoList={handleAutoListClick}
      onDelete={handleDelete}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.headerContainer,
          { opacity: headerAnim, transform: [{ translateY: headerTranslateY }] },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={{ marginBottom: 16 }}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>MY WARDROBE</Text>
        <Text style={styles.itemCount}>{items.length} ITEMS</Text>
      </Animated.View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading your wardrobe…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={(item) => String(item.id)}
          columnWrapperStyle={styles.row}
          contentContainerStyle={{ paddingBottom: 18 }}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          //  native stability
          removeClippedSubviews={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Your closet is empty</Text>
              <Text style={styles.emptyText}>Add items to start styling & reselling.</Text>
            </View>
          }
        />
      )}

      {/* SELL / EDIT MODAL */}
      <Modal
        transparent
        visible={modalVisible}
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          //  iOS only: prevents Android shake/glitch
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              contentContainerStyle={{ paddingBottom: 28 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>
                {selectedItem?.for_sale ? "Update Listing" : "List for Resale"}
              </Text>

              <Text style={styles.label}>Condition</Text>
              <View style={styles.pillRow}>
                {["New with tags", "Like New", "Good", "Fair"].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.pill, condition === c && styles.pillActive]}
                    onPress={() => setCondition(c)}
                    activeOpacity={0.85}
                  >
                    <Text style={condition === c ? styles.pillTextActive : styles.pillText}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Size</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. M / 32 / UK 8"
                placeholderTextColor={COLORS.muted}
                value={size}
                onChangeText={setSize}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { height: 90 }]}
                multiline
                placeholder="Write a short premium description…"
                placeholderTextColor={COLORS.muted}
                value={desc}
                onChangeText={setDesc}
              />

              <Text style={styles.label}>Price ($)</Text>
              <View style={styles.inlineRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="0.00"
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.muted}
                  value={price}
                  onChangeText={setPrice}
                />

                <TouchableOpacity style={styles.aiButton} onPress={fetchEstimate} activeOpacity={0.9}>
                  {aiLoading ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Text style={styles.aiButtonText}>AI</Text>
                  )}
                </TouchableOpacity>
              </View>

              {sellingPrice > 0 && (
                <View style={styles.feeBox}>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLeft}>Selling price</Text>
                    <Text style={styles.feeRight}>${sellingPrice.toFixed(2)}</Text>
                  </View>

                  <View style={styles.feeRow}>
                    <Text style={styles.feeLeft}>
                      Platform fee ({Math.round(PLATFORM_FEE_RATE * 100)}%)
                    </Text>
                    <Text style={[styles.feeRight, { color: "#C04B4B" }]}>
                      - ${platformFee.toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.feeDivider} />

                  <View style={styles.feeRow}>
                    <Text style={styles.earnLeft}>You earn</Text>
                    <Text style={styles.earnRight}>${youEarn.toFixed(2)}</Text>
                  </View>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.85}
                  style={styles.cancelBtn}
                  disabled={savingManual}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, savingManual && { opacity: 0.7 }]}
                  onPress={confirmResale}
                  activeOpacity={0.9}
                  disabled={savingManual}
                >
                  {savingManual ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.confirmText}>Saving…</Text>
                    </View>
                  ) : (
                    <Text style={styles.confirmText}>{selectedItem?.for_sale ? "Update" : "List item"}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* AUTO-LIST MODAL */}
      <Modal
        transparent
        visible={autoModalVisible}
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setAutoModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              contentContainerStyle={{ paddingBottom: 28 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>Auto-List (AI)</Text>

              {autoLoading ? (
                <View style={{ alignItems: "center", paddingVertical: 26 }}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>Generating your listing…</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.label}>Title (editable)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="AI title…"
                    placeholderTextColor={COLORS.muted}
                    value={aiTitle}
                    onChangeText={setAiTitle}
                  />

                  <Text style={styles.label}>Suggested range</Text>
                  <View style={styles.chipRow}>
                    <View style={styles.rangeChip}>
                      <Text style={styles.rangeChipText}>
                        ${aiMin} – ${aiMax}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.label}>Description (editable)</Text>
                  <TextInput
                    style={[styles.input, { height: 120 }]}
                    multiline
                    placeholder="AI description…"
                    placeholderTextColor={COLORS.muted}
                    value={aiDesc}
                    onChangeText={setAiDesc}
                  />

                  <Text style={styles.label}>Tags (editable, comma separated)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. vintage, streetwear, summer"
                    placeholderTextColor={COLORS.muted}
                    value={aiTagsText}
                    onChangeText={setAiTagsText}
                  />

                  <Text style={styles.label}>Final price ($)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    keyboardType="numeric"
                    placeholderTextColor={COLORS.muted}
                    value={autoPrice}
                    onChangeText={setAutoPrice}
                  />

                  {autoSellingPrice > 0 && (
                    <View style={styles.feeBox}>
                      <View style={styles.feeRow}>
                        <Text style={styles.feeLeft}>
                          Platform fee ({Math.round(PLATFORM_FEE_RATE * 100)}%)
                        </Text>
                        <Text style={[styles.feeRight, { color: "#C04B4B" }]}>
                          - ${autoPlatformFee.toFixed(2)}
                        </Text>
                      </View>

                      <View style={styles.feeDivider} />

                      <View style={styles.feeRow}>
                        <Text style={styles.earnLeft}>You earn</Text>
                        <Text style={styles.earnRight}>${autoYouEarn.toFixed(2)}</Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      onPress={() => setAutoModalVisible(false)}
                      activeOpacity={0.85}
                      style={styles.cancelBtn}
                      disabled={savingAuto}
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.confirmBtn, savingAuto && { opacity: 0.7 }]}
                      onPress={confirmAutoList}
                      activeOpacity={0.9}
                      disabled={savingAuto}
                    >
                      {savingAuto ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <ActivityIndicator size="small" color="#fff" />
                          <Text style={styles.confirmText}>Saving…</Text>
                        </View>
                      ) : (
                        <Text style={styles.confirmText}>Confirm</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 16, paddingHorizontal: 16 },

  headerContainer: { marginBottom: 16 },
  backButton: { color: "#000", fontSize: 14, fontWeight: "600" },
  title: {
    color: "#000",
    fontSize: 22,
    fontFamily: "IntegralCF-Bold",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 4,
  },
  itemCount: { color: "#000", fontSize: 12, marginTop: 16, fontWeight: "500", textTransform: "uppercase" },

  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: COLORS.muted, fontSize: 13, fontWeight: "700" },

  row: { justifyContent: "space-between", marginBottom: 16 },

  card: {
    width: "48%",
    backgroundColor: COLORS.white,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: COLORS.line,
    elevation: 0,
    shadowOpacity: 0,
  },

  imageWrap: {
    width: "100%",
    aspectRatio: 0.85,
    backgroundColor: "#F9F9F9",
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  image: { width: "100%", height: "100%" },

  deleteButton: { position: "absolute", top: 8, right: 12, zIndex: 10 },

  info: { padding: 12, paddingBottom: 16 },

  category: {
    color: "#000",
    fontWeight: "500",
    marginBottom: 12,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  btnRow: { flexDirection: "row" },
  btn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontWeight: "500", fontSize: 9, color: "#000", letterSpacing: 0.5, textTransform: "uppercase" },

  inlineRow: { flexDirection: "row", alignItems: "center" },

  emptyState: { alignItems: "center", marginTop: 50, paddingHorizontal: 20 },
  emptyTitle: { color: COLORS.primary, fontSize: 18, fontWeight: "900", marginBottom: 6 },
  emptyText: { color: COLORS.muted, textAlign: "center", fontSize: 13, fontWeight: "600" },

  //  FIXED: bottom-sheet overlay to stop keyboard glitch (Android/iOS)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.38)",
    justifyContent: "flex-end",
  },

  //  FIXED: full-width bottom sheet (no center jump)
  modalContent: {
    width: "100%",
    maxHeight: "88%",
    backgroundColor: COLORS.white,
    padding: 15,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
  },

  modalTitle: { color: COLORS.primary, fontSize: 20, fontWeight: "900", marginBottom: 12, textAlign: "center" },

  label: { color: COLORS.mid, marginBottom: 6, marginTop: 10, fontSize: 13, fontWeight: "800" },

  input: {
    backgroundColor: COLORS.bg,
    color: COLORS.primary,
    padding: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.line,
    fontWeight: "700",
  },

  pillRow: { flexDirection: "row", flexWrap: "wrap" },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.bg,
    marginRight: 8,
    marginBottom: 8,
  },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.mid, fontWeight: "800", fontSize: 12 },
  pillTextActive: { color: COLORS.white, fontWeight: "900", fontSize: 12 },

  aiButton: {
    width: 48,
    backgroundColor: COLORS.soft,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    marginLeft: 10,
  },
  aiButtonText: { fontWeight: "900", fontSize: 12, color: COLORS.primary },

  chipRow: { flexDirection: "row", alignItems: "center" },
  rangeChip: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  rangeChipText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },

  feeBox: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  feeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  feeLeft: { color: COLORS.muted, fontSize: 13, fontWeight: "700" },
  feeRight: { color: COLORS.primary, fontSize: 13, fontWeight: "900" },
  feeDivider: { height: 1, backgroundColor: COLORS.line, marginVertical: 8 },
  earnLeft: { color: COLORS.mid, fontSize: 14, fontWeight: "900" },
  earnRight: { color: COLORS.mid, fontSize: 14, fontWeight: "900" },

  modalButtons: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 },
  cancelBtn: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.line,
    marginRight: 10,
  },
  cancelText: { color: COLORS.primary, fontWeight: "900" },
  confirmBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  confirmText: { color: COLORS.white, fontWeight: "900" },
});