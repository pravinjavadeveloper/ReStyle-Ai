// app/(tabs)/index.tsx
import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  RefreshControl,
  Animated,
  Pressable,
  ImageBackground,
  FlatList,
  useWindowDimensions,
  Easing,
  InteractionManager, // ✅ ADD: prevents UI jank / delayed tab highlight
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, usePathname } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

// ✅ Google Fonts (Expo)
import { useFonts } from "expo-font";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display";
import { Inter_400Regular, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { Poppins_700Bold } from "@expo-google-fonts/poppins";
import { NotoSerifDisplay_500Medium } from "@expo-google-fonts/noto-serif-display";

import {
  getWardrobeAnalytics,
  getResaleDemand,
  getResaleTiming,
  getNotifications,
  getUserItems,
  getSustainabilityReport,
  registerPushToken,
} from "../../services/api";

import { openTailorsNearMe } from "../../services/externalLinks";
import {
  configureNotificationHandler,
  setupPushOrWebNotifications,
  startNotificationPolling,
} from "../../services/push";

import { Ionicons } from "@expo/vector-icons";

// ✅ PRODUCTION FIX: use ONE centralized imgUrl from app/config.ts
import { imgUrl } from "../../services/config";

const HERO_IMAGE = require("../../assets/img/hb2.png");

// ✅ AI HELP ICON (PNG)
const AI_HELP_ICON = require("../../assets/Icons/rrr.png");

// ==============================
// ✅ PREMIUM CURVED TEXT COMPONENT (Pure RN, no SVGs required)
// ==============================
const CircularText = React.memo(function CircularText() {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    anim.start();

    return () => {
      anim.stop();
    };
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const text = " AI HELP • AI HELP • AI HELP •";
  const chars = text.split("");
  const radius = 25;

  return (
    <Animated.View
      style={{
        position: "absolute",
        width: radius * 2,
        height: radius * 2,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ rotate: spin }],
      }}
    >
      {chars.map((char, i) => {
        const angle = (i / chars.length) * 360;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              height: radius * 2,
              width: 10,
              alignItems: "center",
              transform: [{ rotate: `${angle}deg` }],
            }}
          >
            <Text
              style={{
                fontSize: 7.5,
                fontWeight: "900",
                color: "#111111",
                fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
              }}
            >
              {char}
            </Text>
          </View>
        );
      })}
    </Animated.View>
  );
});

// ==============================
// ✅ LUXURY PREMIUM SPEEDOMETER
// ==============================
const Speedometer = ({ score }: { score: number }) => {
  const clampedScore = Math.min(100, Math.max(0, Number(score) || 0));
  const rotation = (clampedScore / 100) * 180 - 90;

  return (
    <View style={styles.speedometerContainer}>
      <View style={styles.speedometerGauge}>
        <LinearGradient
          colors={["#111111", "#777777", "#DDDDDD"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gaugeBackground}
        />

        <View style={styles.gaugeInnerCutout} />

        <Text style={styles.gaugeLabelBad}>Bad</Text>
        <Text style={styles.gaugeLabelAvg}>Avg</Text>
        <Text style={styles.gaugeLabelExc}>Excellent</Text>

        <View
          style={[
            styles.needleWrapper,
            { transform: [{ rotate: `${rotation}deg` }] },
          ]}
        >
          <View style={styles.needleLine} />
        </View>

        <View style={styles.needleBase} />
      </View>

      <Text style={styles.scoreText}>
        {clampedScore}
        <Text style={styles.scoreTextMax}>/100</Text>
      </Text>
    </View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const pathname = usePathname();

  const { width: SCREEN_W } = useWindowDimensions();

  const DRAWER_W = useMemo(
    () => Math.min(320, Math.floor(SCREEN_W * 0.82)),
    [SCREEN_W]
  );

  const H_PADDING = 16;
  const CARD_GAP = 8;

  const CARD_W = useMemo(() => {
    const w = Math.floor(SCREEN_W * 0.38);
    return w > 0 ? w : 130;
  }, [SCREEN_W]);

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
    Poppins_700Bold,
    NotoSerifDisplay_500Medium,
  });

  const [userName, setUserName] = useState("Fashionista");
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [resale, setResale] = useState<any>(null);
  const [loadingResale, setLoadingResale] = useState(true);

  const [timingLoading, setTimingLoading] = useState(true);
  const [timingTop, setTimingTop] = useState<any>(null);

  const [wardrobeItems, setWardrobeItems] = useState<any[]>([]);
  const [co2Saved, setCo2Saved] = useState(0);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const translateX = useRef(new Animated.Value(-DRAWER_W)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // ✅ keep refs so we can stop them (prevents leaked loops & jank after return)
  const botPulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const staggerAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // ==============================
  // ✅ AI HELP ICON INNER PULSE ANIMATION
  // ==============================
  const botPulse = useRef(new Animated.Value(1)).current;

  // ==============================
  // ✅ PREMIUM CASCADING TRANSITION LOGIC
  // ==============================
  const staggerAnims = useRef(
    [...Array(6)].map(() => new Animated.Value(0))
  ).current;

  const startEntranceAnimations = useCallback(() => {
    // stop any previous run (when navigating back)
    staggerAnimRef.current?.stop?.();
    botPulseAnimRef.current?.stop?.();

    // reset
    staggerAnims.forEach((anim) => anim.setValue(0));

    const animations = staggerAnims.map((anim) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      })
    );

    staggerAnimRef.current = Animated.stagger(100, animations);
    staggerAnimRef.current.start();

    botPulseAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(botPulse, {
          toValue: 1.08,
          duration: 900,
          easing: Easing.out(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(botPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    botPulseAnimRef.current.start();
  }, [staggerAnims, botPulse]);

  const getRevealStyle = (index: number) => {
    return {
      opacity: staggerAnims[index],
      transform: [
        {
          translateY: staggerAnims[index].interpolate({
            inputRange: [0, 1],
            outputRange: [50, 0],
          }),
        },
        {
          scale: staggerAnims[index].interpolate({
            inputRange: [0, 1],
            outputRange: [0.96, 1],
          }),
        },
      ],
    };
  };

  useEffect(() => {
    translateX.setValue(drawerOpen ? 0 : -DRAWER_W);
  }, [DRAWER_W]);

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -DRAWER_W,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setDrawerOpen(false);
    });
  };

  const isActive = (target: string) => {
    if (target === "/(tabs)") return pathname === "/(tabs)" || pathname === "/";
    return pathname === target || pathname.startsWith(target + "/");
  };

  const go = (path: string) => {
    closeDrawer();
    router.push(path as any);
  };

  useEffect(() => {
    (async () => {
      const n = await AsyncStorage.getItem("userName");
      if (n) setUserName(n);
    })();
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const userId = await AsyncStorage.getItem("userId");
      if (!userId) {
        setUnreadCount(0);
        return;
      }
      const data = await getNotifications(userId);
      const list = Array.isArray(data?.items) ? data.items : [];
      const unread = list.filter((n: any) => !n.is_read);
      setUnreadCount(unread.length);
    } catch {}
  }, []);

  // ✅ FIX: Defer heavy notification setup until after nav transition finishes
  useEffect(() => {
    let stopPopupPolling: any = null;
    let countInterval: any = null;
    let cancelled = false;
    let interactionTask: any = null;

    interactionTask = InteractionManager.runAfterInteractions(() => {
      (async () => {
        const userId = await AsyncStorage.getItem("userId");
        if (!userId) return;
        if (cancelled) return;

        configureNotificationHandler();
        await setupPushOrWebNotifications(userId);

        stopPopupPolling = startNotificationPolling(userId, 5000);
        await refreshUnreadCount();
        countInterval = setInterval(() => {
          refreshUnreadCount();
        }, 5000);
      })();
    });

    return () => {
      cancelled = true;
      interactionTask?.cancel?.();
      if (stopPopupPolling) stopPopupPolling();
      if (countInterval) clearInterval(countInterval);
    };
  }, [refreshUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let task: any = null;

      task = InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;

        // ✅ start entrance animations AFTER interactions to avoid tab-bar lag
        startEntranceAnimations();

        (async () => {
          try {
            setTimingLoading(true);
            const userId = await AsyncStorage.getItem("userId");
            if (!userId) return;

            const data = await getResaleTiming(userId);
            const first = Array.isArray(data?.recommendations)
              ? data.recommendations[0]
              : null;
            setTimingTop(first || null);
          } catch {
            setTimingTop(null);
          } finally {
            setTimingLoading(false);
          }
        })();
      });

      return () => {
        cancelled = true;
        task?.cancel?.();
      };
    }, [startEntranceAnimations])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let task: any = null;

      task = InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;
        loadHomeData();
        refreshUnreadCount();
      });

      return () => {
        cancelled = true;
        task?.cancel?.();
      };
    }, [refreshUnreadCount])
  );

  const loadHomeData = async () => {
    setLoadingStats(true);
    setLoadingResale(true);

    const userId = await AsyncStorage.getItem("userId");
    if (!userId) {
      setLoadingStats(false);
      setLoadingResale(false);
      return;
    }

    const analytics = await getWardrobeAnalytics(userId);
    if (analytics && !analytics.error) setStats(analytics);
    setLoadingStats(false);

    const demand = await getResaleDemand(userId);
    if (demand && !demand.error) setResale(demand);
    setLoadingResale(false);

    try {
      const myCloset = await getUserItems(userId);
      const items = Array.isArray(myCloset) ? myCloset : [];
      setWardrobeItems(items);
    } catch {
      setWardrobeItems([]);
    }

    try {
      const report = await getSustainabilityReport(userId);
      if (report && !report.error && report.savings) {
        setCo2Saved(Number(report.savings.co2Kg) || 0);
      }
    } catch {}
  };

  const wardrobeDisplay = useMemo(() => {
    const src = Array.isArray(wardrobeItems) ? wardrobeItems : [];
    return src.slice(0, 5);
  }, [wardrobeItems]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadHomeData(), refreshUnreadCount()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshUnreadCount]);

  const handleLogout = async () => {
    try {
      await AsyncStorage.clear();
      Alert.alert("Logged out", "You have been logged out.");
      closeDrawer();
      router.replace("/login");
    } catch {
      Alert.alert("Error", "Logout failed. Try again.");
    }
  };

  const monthlyGoal = 50;
  const progressPercent = Math.min(
    100,
    Math.max(0, (co2Saved / monthlyGoal) * 100)
  );
  const kmDriven = (co2Saved * 5).toFixed(0);

  const homeScore =
    typeof stats?.healthScore === "number"
      ? stats.healthScore
      : typeof stats?.score === "number"
      ? stats.score
      : parseInt(String(stats?.healthScore || stats?.score)) || 0;

  // ✅ FIX 1: NEVER return null while fonts load (prevents layout/tab-bar jump)
  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={{ flex: 1, backgroundColor: styles.safe.backgroundColor }} />
      </SafeAreaView>
    );
  }

  return (
    // ✅ FIX 2: only use TOP edge; bottom tab bar manages bottom inset
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {drawerOpen && (
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
        </Animated.View>
      )}

      <Animated.View
        pointerEvents={drawerOpen ? "auto" : "none"}
        style={[styles.drawer, { width: DRAWER_W, transform: [{ translateX }] }]}
      >
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>REVERA</Text>
            <Text style={styles.drawerSub}>Hello, {userName} 👋</Text>
          </View>

          <ScrollView contentContainerStyle={styles.drawerList}>
            <DrawerItem
              label="Home"
              icon="home-outline"
              active={isActive("/(tabs)")}
              onPress={() => go("/(tabs)")}
            />
            <DrawerItem
              label="Profile"
              icon="person-circle-outline"
              active={isActive("/profile")}
              onPress={() => go("/profile")}
            />
            <DrawerItem
              label="My Wardrobe"
              icon="shirt-outline"
              active={isActive("/my-closet")}
              onPress={() => go("/my-closet")}
            />
            <DrawerItem
              label="Add Item"
              icon="add-circle-outline"
              active={isActive("/add-item")}
              onPress={() => go("/add-item")}
            />
            <DrawerItem
              label="AI Outfits"
              icon="sparkles-outline"
              active={isActive("/recommend")}
              onPress={() => go("/recommend")}
            />
            <DrawerItem
              label="Virtual Try-on"
              icon="body-outline"
              active={isActive("/virtual-tryon")}
              onPress={() => go("/virtual-tryon")}
            />
            <DrawerItem
              label="Marketplace"
              icon="bag-handle-outline"
              active={isActive("/marketplace")}
              onPress={() => go("/marketplace")}
            />
            <DrawerItem
              label="My Orders"
              icon="cube-outline"
              active={isActive("/my-orders")}
              onPress={() => go("/my-orders")}
            />
            <DrawerItem
              label="Circular Score"
              icon="star-outline"
              active={isActive("/circular-score")}
              onPress={() => go("/circular-score")}
            />
            <DrawerItem
              label="Eco Impact"
              icon="leaf-outline"
              active={isActive("/carbon-impact")}
              onPress={() => go("/carbon-impact")}
            />
            <DrawerItem
              label="Resale Timing"
              icon="hourglass-outline"
              active={isActive("/resale-timing")}
              onPress={() => go("/resale-timing")}
            />
            <DrawerItem
              label="Notifications"
              icon="notifications-outline"
              active={isActive("/notifications")}
              onPress={() => go("/notifications")}
            />
            <DrawerItem
              label="Become an Agent"
              icon="bicycle-outline"
              active={isActive("/drop-collect")}
              onPress={() => go("/drop-collect")}
            />
            <DrawerItem
              label="Agents-jobs"
              icon="briefcase-outline"
              active={isActive("/agent-jobs")}
              onPress={() => go("/agent-jobs")}
            />
            <DrawerItem
              label="Create a delivery"
              icon="navigate-outline"
              active={isActive("/create-delivery")}
              onPress={() => go("/create-delivery")}
            />
            <DrawerItem
              label="Drop delivery"
              icon="navigate-outline"
              active={isActive("/delivery-details")}
              onPress={() => go("/delivery-details")}
            />
            <DrawerItem
              label="Rewards"
              icon="gift-outline"
              active={isActive("/rewards")}
              onPress={() => go("/rewards")}
            />

            <DrawerItem
              label="Care to Wear"
              icon="cut-outline"
              active={false}
              onPress={() => {
                closeDrawer();
                openTailorsNearMe();
              }}
            />

            <DrawerItem
              label="Be an Ambassador"
              icon="megaphone-outline"
              active={isActive("/ambassador")}
              onPress={() => go("/ambassador")}
            />

            <View style={styles.drawerDivider} />
            <DrawerItem
              label="Logout"
              icon="log-out-outline"
              danger
              active={false}
              onPress={handleLogout}
            />
          </ScrollView>
        </SafeAreaView>
      </Animated.View>

      {/* BLOCK 0: HEADER */}
      <Animated.View style={[styles.header, { opacity: staggerAnims[0] }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={openDrawer}
            style={styles.headerIconBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="menu" size={25} color="#000000" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerCenter}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.brand}>
            HOUSE OF REVERA
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => router.push("/notifications")}
            style={styles.headerIconBtn}
            activeOpacity={0.8}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color="#111111"
            />
            {unreadCount > 0 && <View style={styles.unreadDot} />}
          </TouchableOpacity>

          <Pressable
            onPress={() => router.push("/help-bot")}
            style={[styles.headerIconBtn, { width: 50, height: 50 }]}
          >
            <CircularText />
            <Animated.View style={{ transform: [{ scale: botPulse }] }}>
              <Image source={AI_HELP_ICON} style={styles.aiHelpIcon} />
            </Animated.View>
          </Pressable>
        </View>
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#111"
          />
        }
      >
        {/* BLOCK 1: HERO */}
        <Animated.View style={[styles.heroFullWidth, getRevealStyle(1)]}>
          <ImageBackground
            source={HERO_IMAGE}
            style={styles.heroImage}
            resizeMode="cover"
            imageStyle={styles.heroImgStyle}
          >
            <LinearGradient
              colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.65)"]}
              start={{ x: 0.5, y: 0.0 }}
              end={{ x: 0.5, y: 1.0 }}
              style={styles.heroGradient}
            />
            <View style={styles.heroOverlay}>
              <Text style={styles.heroTag}>TODAY'S EDIT</Text>
              <Text style={styles.heroTitle}>
                Sustainable outfit{"\n"}from your wardrobe
              </Text>
              <Text style={styles.heroSubtitle}>
                Picked by AI from what you already own
              </Text>

              <View style={styles.heroButtons}>
                <TouchableOpacity
                  style={styles.heroBtnPrimary}
                  onPress={() => router.push("/virtual-tryon")}
                  activeOpacity={0.9}
                >
                  <Text style={styles.heroBtnTextPrimary}>Wear this</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.heroBtnSecondary}
                  onPress={() => router.push("/my-closet")}
                  activeOpacity={0.9}
                >
                  <Text style={styles.heroBtnTextSecondary}>See more looks</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ImageBackground>
        </Animated.View>

        <View style={styles.padded}>
          {/* BLOCK 2: WARDROBE LIST */}
          <Animated.View style={getRevealStyle(2)}>
            <View style={styles.wardrobeHeader}>
              <Text style={styles.wardrobeTitle}>YOUR WARDROBE</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push("/my-closet")}
              >
                <Text style={styles.viewAll}>VIEW ALL</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              key={`wardrobe-${CARD_W}`}
              data={wardrobeDisplay}
              keyExtractor={(item, idx) => String(item?.id ?? idx)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.wardrobeList}
              decelerationRate="fast"
              snapToInterval={CARD_W + CARD_GAP}
              snapToAlignment="start"
              style={{ minHeight: 180 }}
              ListEmptyComponent={
                <View
                  style={[
                    styles.emptyStateContainer,
                    { width: SCREEN_W - 32 },
                  ]}
                >
                  <Text style={styles.emptyStateText}>Your closet is empty.</Text>
                  <TouchableOpacity
                    style={styles.emptyStateBtn}
                    onPress={() => router.push("/add-item")}
                  >
                    <Text style={styles.emptyStateBtnText}>
                      + ADD FIRST ITEM
                    </Text>
                  </TouchableOpacity>
                </View>
              }
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.wardrobeCard,
                    { width: CARD_W, marginRight: CARD_GAP },
                  ]}
                >
                  <View style={styles.wardrobeImageWrap}>
                    {item?.image_url ? (
                      <Image
                        source={{ uri: imgUrl(item?.image_url) }}
                        style={styles.wardrobeImg}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={{ width: "100%", height: "100%" }} />
                    )}
                  </View>

                  <View style={styles.wardrobeInfo}>
                    <Text style={styles.wardrobeCategory} numberOfLines={1}>
                      {item?.name ||
                        item?.title ||
                        item?.category ||
                        "T-SHIRT"}
                    </Text>

                    <TouchableOpacity
                      style={styles.wardrobeBtn}
                      activeOpacity={0.6}
                      onPress={() => router.push("/my-closet")}
                    >
                      <Text style={styles.wardrobeBtnText}>RESELL</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          </Animated.View>

          {/* BLOCK 3: ACTION CARDS */}
          <Animated.View style={[getRevealStyle(3), { marginTop: 24 }]}>
            <TouchableOpacity
              style={styles.actionResell}
              onPress={() => router.push("/my-closet")}
              activeOpacity={0.9}
            >
              <ImageBackground
  source={require('../../assets/images/c1.png')}
  style={styles.actionResellBg}
  imageStyle={{ resizeMode: "cover" }}
>
                <View style={styles.actionResellOverlay} />
                <View style={styles.actionResellContent}>
                  <Text style={styles.actionResellTitle}>RESELL IN 1 TAP</Text>
                  <Text style={styles.actionResellSub}>
                    AI handles pricing & description. You just approve.
                  </Text>
                </View>
              </ImageBackground>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionDonate}
              onPress={() => router.push("/recycle-hub")}
              activeOpacity={0.9}
            >
              <View style={styles.actionDonateTextWrap}>
                <Text style={styles.actionDonateTitle}>DONATE OR SWAP</Text>
                <Text style={styles.actionDonateSub}>
                  Doorstep pickup for local charity & textile recycling.
                </Text>
              </View>
            <Image
  source={require('../../assets/images/c2.png')}
  style={styles.actionDonateImg}
/>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                marginTop: 12,
                backgroundColor: "#fff",
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 0,
                borderWidth: 1,
                borderColor: "#000",
                alignSelf: "flex-start",
              }}
              onPress={async () => {
const userId = await AsyncStorage.getItem("userId");
const res = await registerPushToken(
  String(userId),
  "ExponentPushToken[TEST123]"
);
                console.log("TEST PUSH RESULT:", res);
                Alert.alert("Test Result", JSON.stringify(res));
              }}
              activeOpacity={0.85}
            >
              <Text style={{ color: "#000", fontWeight: "900", letterSpacing: 0.6 }}>
                TEST PUSH SAVE
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionAgent}
              onPress={() => router.push("/drop-collect")}
              activeOpacity={0.9}
            >
              <View style={styles.actionAgentContent}>
                <Text style={styles.actionAgentTitle}>BECOME AN AGENT</Text>
                <Text style={styles.actionAgentSub}>
                  Earn £8–£15 per job with flexible local deliveries.
                </Text>
              </View>
              <View style={styles.actionAgentArrow}>
                <Ionicons name="arrow-forward" size={18} color="#000" />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* BLOCK 4: ECO IMPACT */}
          <Animated.View style={[getRevealStyle(4), styles.impactFooter]}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 8,
              }}
            >
              <Text style={styles.impactTitle}>
                This month{" "}
                <Text style={{ fontWeight: "700" }}>
                  {co2Saved.toFixed(1)} kg CO₂
                </Text>{" "}
                saved
              </Text>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${progressPercent}%` }]}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 8,
              }}
            >
              <Text style={styles.impactSub}>
                Equivalent to {kmDriven} km not driven
              </Text>
              <TouchableOpacity onPress={() => router.push("/carbon-impact")}>
                <Text style={styles.impactLink}>View full impact &gt;</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* BLOCK 5: DASHBOARD WIDGET */}
          <Animated.View style={getRevealStyle(5)}>
            <TouchableOpacity
              style={styles.dashboardWidget}
              onPress={() => router.push("/wardrobe-analytics")}
              activeOpacity={0.9}
            >
              <View style={styles.dashHeader}>
                <Text style={styles.dashTitle}>Wardrobe Overview</Text>
                <Text style={styles.dashLink}>See Full Report →</Text>
              </View>

              {loadingStats ? (
                <ActivityIndicator color="#111" style={{ marginTop: 10 }} />
              ) : (
                <>
                  <Speedometer score={homeScore} />

                  <View style={styles.dashRow}>
                    <View style={styles.statsCol}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 6,
                        }}
                      >
                        <Ionicons
                          name="shirt-outline"
                          size={16}
                          color="#111111"
                          style={{ marginRight: 8 }}
                        />
                        <Text style={[styles.statLine, { marginBottom: 0 }]}>
                          {stats?.totalItems || 0} Total Items
                        </Text>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Ionicons
                          name={
                            stats?.topCategory?.key
                              ? "trophy-outline"
                              : "analytics-outline"
                          }
                          size={16}
                          color="#111111"
                          style={{ marginRight: 8 }}
                        />
                        <Text style={[styles.statLine, { marginBottom: 0 }]}>
                          {stats?.topCategory?.key
                            ? `Top: ${stats.topCategory.key}`
                            : "No Data"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              )}

              <View style={styles.divider} />

              <Text style={styles.miniNote}>
                {stats?.totalItems > 0
                  ? "Your closet is active. Keep styling!"
                  : "Add items to unlock insights."}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DrawerItem({ label, icon, onPress, danger, active }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.drawerItem,
        active && styles.drawerItemActive,
        pressed && styles.drawerItemPressed,
      ]}
    >
      <View style={styles.drawerItemLeft}>
        <Ionicons
          name={icon}
          size={20}
          color={danger ? "#D90429" : "#111111"}
        />
        <Text
          style={[
            styles.drawerLabel,
            active && styles.drawerLabelActive,
            danger && { color: "#D90429" },
          ]}
        >
          {label}
        </Text>
      </View>
      {active && <View style={styles.activePill} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F5F5" },

  header: {
    height: 56,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E6E6E6",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  headerLeft: {
    width: 52,
    alignItems: "flex-start",
    justifyContent: "center",
  },

  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },

  headerRight: {
    width: 112,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },

  headerIconBtn: {
    width: 40,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  headerIcon: { fontSize: 20, color: "#ffffff" },

  brand: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 1,
    color: "#000000",
    fontFamily: "Tactics-Bold",
  },

  unreadDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#111111",
  },

  aiHelpIcon: {
    width: 38,
    height: 38,
    resizeMode: "contain",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    zIndex: 10,
  },

  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    zIndex: 11,
    borderRightWidth: 1,
    borderRightColor: "#E6E6E6",
  },
  drawerHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  drawerTitle: {
    fontSize: 22,
    fontFamily: "IntegralCF-Bold",
    fontWeight: "900",
    color: "#111111",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  drawerSub: {
    marginTop: 6,
    color: "#777777",
    fontSize: 13,
    fontWeight: "500",
  },
  drawerList: {
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  drawerItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  drawerItemPressed: { opacity: 0.7 },
  drawerItemActive: { backgroundColor: "#F3F4F6" },
  drawerLabel: { fontSize: 15, color: "#111111", fontWeight: "500" },
  drawerLabelActive: { fontWeight: "800" },
  activePill: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#111111",
  },
  drawerDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginVertical: 10,
    marginHorizontal: 16,
  },

  container: { paddingBottom: 120 },

  heroFullWidth: { width: "100%", height: 250 },
  heroImage: { width: "100%", height: "100%", justifyContent: "flex-end" },
  heroImgStyle: { resizeMode: "cover" },
  heroGradient: { ...StyleSheet.absoluteFillObject },
  heroOverlay: { padding: 18, paddingBottom: 16 },
  heroTag: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    letterSpacing: 1.4,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 22,
    fontFamily: "PlayfairDisplay_700Bold",
    marginBottom: 10,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    lineHeight: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: 10,
  },
  heroButtons: { flexDirection: "row", gap: 14 },

  heroBtnPrimary: {
    backgroundColor: "rgba(17,17,17,0.95)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBtnTextPrimary: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },

  heroBtnSecondary: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  heroBtnTextSecondary: { color: "#FFFFFF", fontWeight: "600" },

  padded: { paddingHorizontal: 16, paddingTop: 10 },

  wardrobeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 3,
    marginBottom: 12,
  },
  wardrobeTitle: {
    fontSize: 20,
    color: "#000",
    fontFamily: "IntegralCF-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  viewAll: {
    color: "#000",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  wardrobeList: { paddingRight: 16, paddingBottom: 8 },

  wardrobeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 0,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 0,
    shadowOpacity: 0,
  },
  wardrobeImageWrap: {
    width: "100%",
    aspectRatio: 0.85,
    backgroundColor: "#F9F9F9",
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  wardrobeImg: {
    width: "100%",
    height: "100%",
  },
  wardrobeInfo: {
    padding: 10,
    paddingBottom: 12,
  },
  wardrobeCategory: {
    color: "#000",
    fontWeight: "500",
    marginBottom: 12,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  wardrobeBtn: {
    width: "100%",
    paddingVertical: 9,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  wardrobeBtnText: {
    fontWeight: "500",
    fontSize: 9,
    color: "#000",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  emptyStateContainer: {
    paddingVertical: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 0,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyStateText: {
    color: "#777",
    fontSize: 13,
    marginBottom: 10,
    fontWeight: "600",
  },
  emptyStateBtn: {
    backgroundColor: "#000",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 0,
  },
  emptyStateBtnText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  actionResell: {
    width: "100%",
    height: 140,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#000",
  },
  actionResellBg: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  actionResellOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  actionResellContent: {
    position: "absolute",
    alignItems: "center",
    padding: 16,
  },
  actionResellTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  actionResellSub: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },

  actionDonate: {
    flexDirection: "row",
    width: "100%",
    height: 110,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFF",
  },
  actionDonateTextWrap: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
  },
  actionDonateTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#000",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  actionDonateSub: {
    fontSize: 11,
    color: "#666",
    lineHeight: 16,
    fontWeight: "500",
  },
  actionDonateImg: {
    width: 110,
    height: "100%",
    borderLeftWidth: 1,
    borderLeftColor: "#E2E8F0",
  },

  actionAgent: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: "#000",
    padding: 20,
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#000",
  },
  actionAgentContent: {
    flex: 1,
    paddingRight: 16,
  },
  actionAgentTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFF",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  actionAgentSub: {
    fontSize: 11,
    color: "#CCC",
    lineHeight: 18,
    fontWeight: "500",
  },
  actionAgentArrow: {
    width: 40,
    height: 40,
    borderRadius: 0,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },

  impactFooter: {
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 0,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    elevation: 0,
    shadowOpacity: 0,
  },
  impactTitle: {
    fontSize: 14,
    color: "#111111",
    fontFamily: "Inter_400Regular",
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#EFEFEF",
    borderRadius: 0,
    overflow: "hidden",
    marginTop: 4,
  },
  progressFill: { height: "100%", backgroundColor: "#111", borderRadius: 0 },
  impactSub: {
    fontSize: 12,
    color: "#777777",
    fontFamily: "Inter_400Regular",
  },
  impactLink: { fontSize: 12, color: "#111111", fontWeight: "700" },

  dashboardWidget: {
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 0,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dashHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  dashTitle: { color: "#111111", fontSize: 16, fontWeight: "800" },
  dashLink: { color: "#777777", fontSize: 12, fontWeight: "700" },

  dashRow: { flexDirection: "row", alignItems: "center" },
  statsCol: { flex: 1 },
  statLine: { color: "#111111", fontSize: 13, marginBottom: 6 },

  divider: {
    height: 1,
    backgroundColor: "#EFEFEF",
    marginTop: 14,
    marginBottom: 10,
  },
  miniNote: { color: "#777777", fontStyle: "italic", fontSize: 12 },

  speedometerContainer: { alignItems: "center", marginBottom: 10 },

  speedometerGauge: {
    width: 260,
    height: 130,
    overflow: "hidden",
    position: "relative",
    alignItems: "center",
  },
  gaugeBackground: {
    width: 260,
    height: 260,
    borderRadius: 130,
    position: "absolute",
    top: 0,
  },
  gaugeInnerCutout: {
    position: "absolute",
    top: 15,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#FFFFFF",
  },
  gaugeLabelBad: {
    position: "absolute",
    bottom: 15,
    left: 35,
    color: "#999999",
    fontWeight: "800",
    fontSize: 13,
  },
  gaugeLabelAvg: {
    position: "absolute",
    top: 20,
    alignSelf: "center",
    color: "#111111",
    fontWeight: "800",
    fontSize: 13,
  },
  gaugeLabelExc: {
    position: "absolute",
    bottom: 15,
    right: 35,
    color: "#999999",
    fontWeight: "800",
    fontSize: 13,
  },

  needleWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 260,
    height: 260,
    alignItems: "center",
  },
  needleLine: {
    width: 4,
    height: 115,
    backgroundColor: "#111111",
    alignSelf: "center",
    marginTop: 15,
    borderRadius: 2,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },
  needleBase: {
    position: "absolute",
    bottom: -12,
    alignSelf: "center",
    width: 24,
    height: 24,
    backgroundColor: "#111111",
    borderRadius: 12,
  },

  scoreText: {
    color: "#111111",
    fontSize: 40,
    fontWeight: "900",
    marginTop: 10,
  },
  scoreTextMax: { fontSize: 22, color: "#777777" },
});