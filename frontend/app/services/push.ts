// frontend/app/services/push.ts
import { Platform, Alert } from "react-native";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getNotifications,
  markNotificationRead,
  registerPushToken,
} from "./api";

// ✅ IMPORTANT: do NOT import expo-notifications on web
let Notifications: any = null;
if (Platform.OS !== "web") {
  Notifications = require("expo-notifications");
}

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
 * ✅ Mobile: register Expo push token
 * ✅ Web: skip token but we will still show "alert-like notifications" using polling
 */
export async function setupPushOrWebNotifications(userId: string) {
  if (!userId) return;

  // WEB: no expo token, just return
  if (Platform.OS === "web") {
    console.log("WEB notifications enabled via polling (no expo token).");
    return { web: true };
  }

  if (!Device.isDevice) {
    return { error: "Use a real phone for push notifications." };
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return { error: "Notification permission not granted" };
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await AsyncStorage.setItem("expoPushToken", token);

    const res = await registerPushToken(userId, token);
    return { success: true, token, backend: res };
  } catch (e: any) {
    console.log("setupPushOrWebNotifications error:", e?.message || e);
    return { error: "Failed to setup notifications" };
  }
}

/**
 * ✅ WEB + MOBILE fallback: Poll backend notifications
 * - Shows an Alert popup when new notification arrives
 * - Marks it as read so it won't spam again
 */
export function startNotificationPolling(userId: string, intervalMs = 5000) {
  if (!userId) return () => {};

  let stopped = false;
  let timer: any = null;

  const tick = async () => {
    if (stopped) return;

    try {
      const data = await getNotifications(userId);

      const list = Array.isArray(data?.items) ? data.items : [];
      // unread only
      const unread = list.filter((n: any) => !n.is_read);

      // show only the latest one (prevent spam)
      const latest = unread[0];
      if (latest) {
        // ✅ Web "notification"
        Alert.alert(latest.title || "New Notification", latest.body || "You have a new update");

        // mark as read so it doesn't show again
        await markNotificationRead(latest.id);
      }
    } catch (e) {
      // silent fail (no crash)
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
