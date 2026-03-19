import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerPushToken } from "../services/api";

// Required config
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});


Notifications.addNotificationResponseReceivedListener((response) => {
  const data = response.notification.request.content.data;
  console.log("Notification tapped:", data);
});


export async function registerForPushNotifications() {
  try {
    if (!Device.isDevice) {
      console.log("Must use physical device for push notifications");
      return;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push permission not granted");
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    const userId = await AsyncStorage.getItem("userId");
    if (!userId) return;

    await registerPushToken(userId, token);

    console.log("✅ Push token registered:", token);

    // Android channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#E0B0FF",
      });
    }
  } catch (e) {
    console.log("PUSH REG ERROR:", e);
  }
}
