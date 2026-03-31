import { Platform } from "react-native";

const normalizeUrl = (value?: string) => String(value || "").trim().replace(/\/+$/, "");

const ENV_API = normalizeUrl(process.env.EXPO_PUBLIC_API_URL);
const ENV_AI = normalizeUrl(process.env.EXPO_PUBLIC_AI_URL);
const ENV_STRIPE_KEY = String(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "").trim();

if (!ENV_API) {
  throw new Error("Missing EXPO_PUBLIC_API_URL. Set the production backend URL in your Expo env.");
}

if (!ENV_AI) {
  throw new Error("Missing EXPO_PUBLIC_AI_URL. Set the production AI engine URL in your Expo env.");
}

if (!ENV_STRIPE_KEY) {
  throw new Error(
    "Missing EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY. Set the production Stripe publishable key in your Expo env."
  );
}

export const API_URL = ENV_API;
export const AI_URL = ENV_AI;
export const AXIOS_TIMEOUT = 50000;
export const IS_WEB = Platform.OS === "web";

export const imgUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const clean = path.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${API_URL}/${clean}`;
};

export const STRIPE_PUBLISHABLE_KEY = ENV_STRIPE_KEY;
