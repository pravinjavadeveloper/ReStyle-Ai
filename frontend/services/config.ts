// frontend/services/config.ts
import { Platform } from "react-native";

/**
 * 🔧 CHANGE ONLY HERE WHEN YOU DEPLOY
 *
 * WEB  → http://localhost:xxxx works
 * Android emulator → http://10.0.2.2:xxxx
 * Real phone → use your backend public URL (AWS)
 */

// Expo injects EXPO_PUBLIC_* only via process.env (no optional chaining)
const ENV_API = process.env.EXPO_PUBLIC_API_URL as string | undefined;
const ENV_AI = process.env.EXPO_PUBLIC_AI_URL as string | undefined;

const LOCAL_API =
  Platform.OS === "android"
    ? "http://10.0.2.2:5000"
    : "http://localhost:5000";

const LOCAL_AI =
  Platform.OS === "android"
    ? "http://10.0.2.2:8000"
    : "http://localhost:8000";

export const API_URL = (ENV_API || LOCAL_API).replace(/\/+$/, "");
export const AI_URL = (ENV_AI || LOCAL_AI).replace(/\/+$/, "");

// ⏱️ Global axios timeout (used in api.ts)
export const AXIOS_TIMEOUT = 50000;

/**
 * 🖼️ Helper to convert backend image path → full URL
 */
export const imgUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const clean = path.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${API_URL}/${clean}`;
};

export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "pk_test_51T4p4nLA8lZgHO0AUyw1QQCiSrIqVcOKdmlKpCKcBjGWtmnuIMntxsozEjTo7rDEwVfKmdkZ1XZ07dmFKnPp8V3d00Hl4lO2L8";
  