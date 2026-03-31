import { Platform, Alert } from "react-native";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import {
  getNotifications,
  markNotificationRead,
  registerPushToken,
} from "./api";

//  IMPORTANT: do NOT import expo-notifications on web
let Notifications: any = null;
if (Platform.OS !== "web") {
  Notifications = require("expo-notifications");
}

/**
 *  Configure how notifications behave when received
 */
export function configureNotificationHandler() {  
  if (Platform.OS === "web") return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 *  Mobile: register Expo push token
 *  Web: skip token (we use polling instead)
 */
export async function setupPushOrWebNotifications(userId: string) {
  if (!userId) return;

  // =============================
  // 🌐 WEB → skip push token
  // =============================
  if (Platform.OS === "web") {
    console.log("WEB notifications enabled via polling (no expo token).");
    return { web: true };
  }

  // =============================
  // 📱 MUST BE REAL DEVICE
  // =============================
  if (!Device.isDevice) {
    return { error: "Use a real phone for push notifications." };
  }

  try {
    // =============================
    // 🔔 ANDROID CHANNEL (REQUIRED FOR RELIABLE PUSH)
    // =============================
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    // =============================
    // 🔐 PERMISSIONS
    // =============================
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return { error: "Notification permission not granted" };
    }

    // =============================
    // 🧠 GET EAS PROJECT ID (FROM app.json)
    // =============================
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.log("Missing EAS projectId");
      return { error: "Missing EAS projectId" };
    }

    // =============================
    // 📲 GET EXPO PUSH TOKEN
    // =============================
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenData.data;

    // save locally
    await AsyncStorage.setItem("expoPushToken", token);

    // send to backend
    const res = await registerPushToken(userId, token);

    return { success: true, token, backend: res };
  } catch (e: any) {
    console.log("setupPushOrWebNotifications error:", e?.message || e);
    return { error: "Failed to setup notifications" };
  }
}

/**
 *  WEB + MOBILE fallback polling
 * Shows popup for unread notifications
 */
export function startNotificationPolling(userId: string, intervalMs = 5000) {
  if (!userId) return () => {};

  let stopped = false;
  let timer: any = null;

  const showPopup = (title: string, body: string) => {
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      window.alert(`${title}\n\n${body}`);
    } else {
      Alert.alert(title, body);
    }
  };

  const tick = async () => {
    if (stopped) return;

    try {
      const data = await getNotifications(userId);
      const list = Array.isArray(data?.items) ? data.items : [];
      const unread = list.filter((n: any) => !n.is_read);

      const latest = unread[0];
      if (latest) {
        showPopup(
          latest.title || "New Notification",
          latest.body || "You have a new update"
        );
        await markNotificationRead(latest.id);
      }
    } catch {
      // silent fail
    } finally {
      timer = setTimeout(tick, intervalMs);
    }
  };

  tick();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}