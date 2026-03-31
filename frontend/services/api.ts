// frontend/services/api.ts
import axios from "axios";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

// Single source of truth
import { API_URL, AI_URL, AXIOS_TIMEOUT } from "./config";

// Create axios client
const api = axios.create({
  baseURL: API_URL,
  timeout: AXIOS_TIMEOUT,
  withCredentials: true,
});

// Optional: simple logger (helps debug)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg =
      err?.code === "ECONNABORTED"
        ? "Request timeout (backend slow/offline)"
        : err?.message || "Network error";
    return Promise.reject({ ...err, friendlyMessage: msg });
  }
);

if (__DEV__) {
  console.log("API_URL:", API_URL);
  console.log("API URL:", process.env.EXPO_PUBLIC_API_URL);
}

/* =========================
   AUTH
========================= */
export const signupUser = async (name: string, email: string, password: string, phone: string) => {
  try {
    const response = await api.post("/auth/signup", { name, email, password, phone });
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Network error" };
  }
};

// export const loginUser = async (email: string, password: string) => {
//   try {
//     const response = await api.post("/auth/login", { email, password });
//     return response.data;
//   } catch (error: any) {
//     return { error: error.response?.data?.error || error.friendlyMessage || "Network error" };
//   }
// };



// export const loginUser = async (email: string, password: string) => {
//   try {
//     const response = await api.post("/auth/login", { email, password });

//     // ✅ Register token immediately after login
//     const userId = String(response.data?.user?.id || "");
//     if (userId) {
//       tryRegisterPushTokenOnLogin(userId); // intentionally NOT awaited
//     }

//     return response.data;
//   } catch (error: any) {
//     return { error: error.response?.data?.error || error.friendlyMessage || "Network error" };
//   }
// };

export const loginUser = async (email: string, password: string) => {
  try {
    const response = await api.post("/auth/login", { email, password });

    const userId = response.data?.user?.id;
    if (userId != null) {
      tryRegisterPushTokenOnLogin(String(userId)); // not awaited
    }

    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Network error" };
  }
};


/* =========================
   CLOSET
========================= */
export const uploadItem = async (
  userId: string,
  imageUri: string,
  category: string,
  color: string
) => {
  const formData = new FormData();
  formData.append("userId", userId);
  formData.append("category", category);
  formData.append("color", color);

  if (Platform.OS === "web") {
    const res = await fetch(imageUri);
    const blob = await res.blob();
    // @ts-ignore
    formData.append("image", blob, "upload.jpg");
  } else {
    const filename = imageUri.split("/").pop() || "upload.jpg";
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image/jpeg`;
    // @ts-ignore
    formData.append("image", { uri: imageUri, name: filename, type });
  }

  try {
    const response = await api.post("/closet/add", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Upload failed" };
  }
};

export const getUserItems = async (userId: string) => {
  try {
    const response = await api.get(`/closet/${userId}`);
    return response.data;
  } catch {
    return [];
  }
};

/* =========================
   AI
========================= */
export const getAIRecommendation = async (category: string, color: string) => {
  try {
    const response = await fetch(`${AI_URL}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, color }),
    });
    return await response.json();
  } catch {
    return null;
  }
};

export const getPriceEstimate = async (category: string, condition: string) => {
  try {
    const response = await fetch(`${AI_URL}/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, condition }),
    });
    return await response.json();
  } catch {
    return null;
  }
};

/* =========================
   RESELL
========================= */
export const listForResale = async (
  id: string,
  price: any,
  size: string,
  condition: string,
  desc: string
) => {
  try {
    const response = await api.put(`/closet/sell/${id}`, {
      price,
      size,
      condition,
      description: desc,
    });
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to list item" };
  }
};

export const getMarketplaceItems = async (userId: string) => {
  try {
    const response = await api.get(`/closet/marketplace/${userId}`);
    return response.data;
  } catch {
    return [];
  }
};

export const getMyPurchases = async (userId: string) => {
  try {
    const response = await api.get(`/closet/purchases/${userId}`);
    return response.data;
  } catch {
    return [];
  }
};

export const getMySoldItems = async (userId: string) => {
  try {
    const response = await api.get(`/closet/sold/${userId}`);
    return response.data;
  } catch {
    return [];
  }
};

export const buyItem = async (itemId: string, buyerId: string) => {
  try {
    const response = await api.put(`/closet/buy/${itemId}`, { buyerId });
    return response.data;
  } catch (error: any) {
    const backend = error.response?.data;
    return {
      error: backend?.error || error.friendlyMessage || "Purchase failed",
      message: backend?.message,
    };
  }
};

export const deleteItem = async (itemId: string) => {
  try {
    const response = await api.delete(`/closet/delete/${itemId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Delete failed" };
  }
};

export async function autoAddWithAI(userId: string, imageUris: string[]) {
  const formData = new FormData();
  formData.append("userId", String(userId));

  imageUris.forEach((uri, i) => {
    if (!uri) return;

    if (Platform.OS === "web") {
      return;
    }

    let filename = uri.split("/").pop() || `image_${i}.jpg`;
    if (!/\.(jpg|jpeg|png|webp)$/i.test(filename)) filename += ".jpg";

    const ext = filename.split(".").pop()?.toLowerCase();
    const type =
      ext === "png" ? "image/png" :
      ext === "webp" ? "image/webp" :
      "image/jpeg";

    // @ts-ignore
    formData.append("images", {
      uri,
      name: filename,
      type,
    });
  });

  try {
    const res = await api.post("/closet/auto-add", formData, {
      timeout: 180000,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      transformRequest: (data) => data,
    });

    return res.data;
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;

    if (status === 429) {
      return {
        status,
        error: "AI_RATE_LIMIT",
        message: data?.message || "AI quota limit reached. Retry after 60 seconds.",
      };
    }

    return {
      status,
      error: data?.error || "AUTO_ADD_FAILED",
      message: data?.message || err?.message || "Auto add failed. Please try again.",
    };
  }
}

export const getWardrobeAnalytics = async (userId: string) => {
  try {
    const response = await api.get(`/analytics/${userId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Analytics failed" };
  }
};

export const getResaleDemand = async (userId: string) => {
  try {
    const response = await api.get(`/resale/demand/${userId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Resale demand failed" };
  }
};

export const getSustainabilityReport = async (userId: string) => {
  try {
    const response = await api.get(`/sustainability/${userId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Sustainability failed" };
  }
};

export const generateListingAI = async (userId: string, itemId: string) => {
  try {
    const response = await api.post("/listing-ai/generate", { userId, itemId });
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "AI listing failed" };
  }
};

export const getResaleTiming = async (userId: string) => {
  try {
    const response = await api.get(`/resale-timing/${userId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Resale timing failed" };
  }
};

export const autoListItemAI = async (
  userId: string,
  itemId: string,
  finalPrice: number,
  size: string,
  condition: string
) => {
  try {
    const ai = await generateListingAI(userId, itemId);
    if (ai?.error) return { error: ai.error };

    const result = await listForResale(
      itemId,
      finalPrice,
      size || "",
      condition || "Good",
      ai.description || ""
    );

    if (result?.error) return { error: result.error };
    return { success: true, ai, result };
  } catch {
    return { error: "Auto-list failed" };
  }
};

/* =========================
   REWARDS
========================= */
export const getRewardsProfile = async (userId: string) => {
  try {
    const response = await api.get(`/rewards/${userId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to load rewards" };
  }
};

export const getRewardsHistory = async (userId: string, limit = 50) => {
  try {
    const response = await api.get(`/rewards/${userId}/history?limit=${limit}`);
    return response.data;
  } catch (error: any) {
    return {
      error: error.response?.data?.error || error.friendlyMessage || "Failed to load rewards history",
    };
  }
};

/* =========================
   NOTIFICATIONS
========================= */


async function tryRegisterPushTokenOnLogin(userId: string) {
  try {
    // Ask permission
    const perm = await Notifications.getPermissionsAsync();
    let status = perm.status;

    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }

    if (status !== "granted") return;

    // Get Expo push token (works on real device build)

    
const projectId =
  Constants?.expoConfig?.extra?.eas?.projectId ??
  Constants?.easConfig?.projectId;

const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenRes.data;

    if (token) {
      await registerPushToken(userId, token);
    }
  } catch (e) {
    // Don't block login if notifications fail
    console.log("Push token register skipped:", e);
  }
}




export async function registerPushToken(userId: string, token: string) {
  try {
    const response = await api.post("/notifications/register-token", { userId, token });
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to register token" };
  }
}

export async function getNotifications(userId: string) {
  try {
    const response = await api.get(`/notifications/${userId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to load notifications" };
  }
}

export async function markNotificationRead(id: number | string) {
  try {
    const response = await api.put(`/notifications/read/${id}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to mark read" };
  }
}

export async function markAllNotificationsRead(userId: string) {
  try {
    const response = await api.put(`/notifications/read-all/${userId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to mark all read" };
  }
}

/* =========================
   AMBASSADOR / DELIVERY AGENT
========================= */
export async function applyAmbassadorForm(formData: FormData) {
  try {
    const response = await api.post("/ambassador/apply", formData);
    return response.data;
  } catch (error: any) {
    return {
      error: error.response?.data?.error || error.friendlyMessage || "Failed to submit application",
    };
  }
}

export async function getAmbassadorStatus(userId: string) {
  try {
    const response = await api.get(`/ambassador/status/${userId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to load status" };
  }
}

export async function updateAmbassadorLocation(userId: string, lat: number, lng: number) {
  try {
    const response = await api.post("/ambassador/location", { userId, lat, lng });
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to update location" };
  }
}

export async function registerAmbassadorToken(
  userId: string,
  platform: "ios" | "android" | "web",
  token: string
) {
  try {
    const response = await api.post("/ambassador/register-token", { userId, platform, token });
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to register token" };
  }
}

/* =========================
   DELIVERIES
========================= */
export async function createDelivery(payload: {
  customerId: string | number;
  pickup_address?: string;
  drop_address?: string;
  pickup_lat: number;
  pickup_lng: number;
  drop_lat?: number | null;
  drop_lng?: number | null;
  radiusKm?: number;
  payout_gbp?: number;
}) {
  try {
    const response = await api.post("/deliveries/create", payload);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to create delivery" };
  }
}

export async function getAvailableDeliveries(agentId: string, radiusKm = 8) {
  try {
    const response = await api.get(`/deliveries/available/${agentId}?radiusKm=${radiusKm}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to load available deliveries" };
  }
}

export async function acceptDelivery(deliveryId: string, agentId: string) {
  try {
    const response = await api.put(`/deliveries/accept/${deliveryId}`, { agentId });
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to accept delivery" };
  }
}

export async function getCustomerDeliveries(customerId: string) {
  try {
    const response = await api.get(`/deliveries/customer/${customerId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to load customer deliveries" };
  }
}

export async function getAgentDeliveries(agentId: string) {
  try {
    const response = await api.get(`/deliveries/agent/${agentId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to load agent deliveries" };
  }
}

/* =========================
   USER PROFILE
========================= */
export async function getUserProfile(userId: string) {
  try {
    const response = await api.get(`/users/me/${userId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to load profile" };
  }
}

export async function updateUserProfile(userId: string, payload: { name?: string; phone?: string }) {
  try {
    const response = await api.put(`/users/me/${userId}`, payload);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to update profile" };
  }
}

export async function deleteMyAccount(userId: string) {
  try {
    const response = await api.delete(`/users/me/${userId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to delete account" };
  }
}

export async function resendVerification(email: string) {
  try {
    const response = await api.post("/auth/resend-verification", { email });
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Network error" };
  }
}

/* =========================
   PHONE VERIFICATION (OTP)
========================= */
export async function requestPhoneOtp(userId: string, phone: string) {
  try {
    const response = await api.post("/phone-verification/request-otp", { userId, phone });
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to send OTP" };
  }
}

export async function verifyPhoneOtp(userId: string, phone: string, firebaseIdToken: string) {
  try {
    const response = await api.post("/phone-verification/verify-otp", {
      userId,
      phone,
      firebaseIdToken,
    });
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to verify OTP" };
  }
}

/* =========================
   PAYMENTS (STRIPE)
========================= */

// 1) Reserve item + create order (backend: /closet/reserve-and-create-order)
export const reserveAndCreateOrder = async (itemId: string | number, buyerId: string) => {
  try {
    const response = await api.post(`/closet/reserve-and-create-order`, { itemId, buyerId });
    return response.data;
  } catch (error: any) {
    const backend = error.response?.data;
    return {
      error: backend?.error || error.friendlyMessage || "Reserve failed",
      message: backend?.message,
      status: error.response?.status,
    };
  }
};

export const createPaymentIntent = async (orderId: string | number, userId: string) => {
  try {
    const response = await api.post(`/payments/create-payment-intent`, { orderId, userId });
    return response.data;
  } catch (error: any) {
    const backend = error.response?.data;
    return {
      error: backend?.error || error.friendlyMessage || "Payment intent failed",
      message: backend?.message,
      status: error.response?.status,
    };
  }
};

export const getOrderStatus = async (orderId: string | number, userId: string) => {
  try {
    const response = await api.get(`/payments/order-status/${orderId}?userId=${userId}`);
    return response.data;
  } catch (error: any) {
    const backend = error.response?.data;
    return {
      error: backend?.error || error.friendlyMessage || "Status check failed",
      message: backend?.message,
      status: error.response?.status,
    };
  }
};

export async function cancelOrder(orderId: string, userId: string) {
  const r = await fetch(`${API_URL}/payments/cancel-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, userId }),
  });
  return r.json();
}

export async function paymentsCreateOrder(payload: {
  itemId: string | number;
  userId: string | number;
  shippingAddressId?: number | string;
}) {
  try {
    const response = await api.post("/payments/create-order", payload);
    return response.data;
  } catch (error: any) {
    return {
      error: error.response?.data?.error || error.friendlyMessage || "Create order failed",
      message: error.response?.data?.message,
      status: error.response?.status,
    };
  }
}

export async function paymentsCreatePaymentIntent(payload: { orderId: string | number; userId: string | number }) {
  try {
    const response = await api.post("/payments/create-payment-intent", payload);
    return response.data;
  } catch (error: any) {
    return {
      error: error.response?.data?.error || error.friendlyMessage || "Payment intent failed",
      message: error.response?.data?.message,
      status: error.response?.status,
    };
  }
}

export async function paymentsCancelOrder(payload: { orderId: string | number; userId: string | number }) {
  try {
    const response = await api.post("/payments/cancel-order", payload);
    return response.data;
  } catch (error: any) {
    return {
      error: error.response?.data?.error || error.friendlyMessage || "Cancel failed",
      message: error.response?.data?.message,
      status: error.response?.status,
    };
  }
}

/* =========================
   SHIPPING (SELLER QR FLOW)
========================= */
export async function getSellerOrdersToShip(sellerId: string | number) {
  try {
    const res = await api.get(`/shipping/seller-orders/${sellerId}`);
    return res.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to load seller orders" };
  }
}

export async function createShippoLabel(orderId: string | number) {
  try {
    const res = await api.post(`/shipping/create-label`, { orderId });
    return res.data;
  } catch (error: any) {
    const backend = error.response?.data;
    return {
      error: backend?.error || error.friendlyMessage || "Create label failed",
      status: error.response?.status,
      message: backend?.message,
    };
  }
}

export async function getShippingLabel(orderId: string | number) {
  try {
    const res = await api.get(`/shipping/label/${orderId}`);
    return res.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to load label" };
  }
}

// Seller confirms drop-off
export async function markDroppedOff(orderId: string | number, sellerId: string | number) {
  try {
    const res = await api.post(`/shipping/mark-dropped-off`, { orderId, sellerId });
    return res.data;
  } catch (error: any) {
    const backend = error.response?.data;
    return {
      error: backend?.error || error.friendlyMessage || "Failed to mark dropped off",
      status: error.response?.status,
      message: backend?.message,
    };
  }
}

// Fetch order + buyer shipping address (backend requires ?userId=)
export async function getShippingOrder(orderId: string | number, userId: string | number) {
  try {
    const res = await api.get(`/shipping/order/${orderId}?userId=${userId}`);
    return res.data;
  } catch (error: any) {
    const backend = error.response?.data;
    return {
      error: backend?.error || error.friendlyMessage || "Failed to load order address",
      status: error.response?.status,
      message: backend?.message,
    };
  }
}

// Optional: label/qr shortcut
export async function getLabelOrQr(orderId: string | number) {
  return getShippingLabel(orderId);
}

export async function saveSellerAddress(payload: {
  userId: string | number;
  full_name: string;
  line1: string;
  line2?: string;
  city: string;
  county?: string;
  postcode: string;
  phone?: string;
  is_default?: boolean;
}) {
  try {
    const res = await api.post("/shipping/save-seller-address", payload);
    return res.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to save seller address" };
  }
}

export async function getMySellerAddress(userId: string | number) {
  try {
    const res = await api.get(`/shipping/my-seller-address/${userId}`);
    return res.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || error.friendlyMessage || "Failed to load seller address" };
  }
}



// ✅ Stripe Connect APIs

export async function getStripeConnectStatus(userId: string) {
  const res = await fetch(`${API_URL}/stripe/connect/status/${userId}`);
  return res.json();
}

export async function stripeConnectOnboard(userId: string) {
  const res = await fetch(`${API_URL}/stripe/connect/onboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

export async function stripeConnectDashboard(userId: string) {
  const res = await fetch(`${API_URL}/stripe/connect/dashboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

export default api;