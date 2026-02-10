// frontend/app/services/api.ts
import axios from "axios";
import { Platform } from 'react-native';

// 1. SELECT CORRECT URL
const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
const AI_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
});


// AUTH
export const signupUser = async (name: string, email: string, password: string) => {
    try {
        const response = await api.post('/auth/signup', { name, email, password });
        return response.data;
    } catch (error: any) { return { error: error.response?.data?.error || "Network error" }; }
};

export const loginUser = async (email: string, password: string) => {
    try {
        const response = await api.post('/auth/login', { email, password });
        return response.data;
    } catch (error: any) { return { error: error.response?.data?.error || "Network error" }; }
};

// CLOSET
export const uploadItem = async (userId: string, imageUri: string, category: string, color: string) => {
    const formData = new FormData();
    formData.append('userId', userId);
    formData.append('category', category);
    formData.append('color', color);

    if (Platform.OS === 'web') {
        const res = await fetch(imageUri);
        const blob = await res.blob();
        formData.append('image', blob, 'upload.jpg');
    } else {
        const filename = imageUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        // @ts-ignore
        formData.append('image', { uri: imageUri, name: filename, type });
    }

    try {
        const response = await api.post('/closet/add', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        return response.data;
    } catch (error: any) { return { error: "Upload failed" }; }
};

export const getUserItems = async (userId: string) => {
    try {
        const response = await api.get(`/closet/${userId}`);
        return response.data;
    } catch (error: any) { return []; }
};

// AI & RESELL
export const getAIRecommendation = async (category: string, color: string) => {
    try {
        const response = await fetch(`${AI_URL}/recommend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, color }),
        });
        return await response.json();
    } catch (error) { return null; }
};

export const getPriceEstimate = async (category: string, condition: string) => {
    try {
        const response = await fetch(`${AI_URL}/estimate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, condition }),
        });
        return await response.json();
    } catch (error) { return null; }
};

// THIS IS THE ONLY DEFINITION OF listForResale
export const listForResale = async (id: string, price: string, size: string, condition: string, desc: string) => {
    try {
        const response = await api.put(`/closet/sell/${id}`, { price, size, condition, description: desc });
        return response.data;
    } catch (error: any) { return { error: "Failed to list item" }; }
};



// 🆕 GET MARKETPLACE FEED
export const getMarketplaceItems = async (userId: string) => {
    try {
        const response = await api.get(`/closet/marketplace/${userId}`);
        return response.data;
    } catch (error: any) {
        return [];
    }
};



// Get items I bought
export const getMyPurchases = async (userId: string) => {
    try {
        const response = await api.get(`/closet/purchases/${userId}`);
        return response.data;
    } catch (error: any) {
        return [];
    }
};

// Get items I sold
export const getMySoldItems = async (userId: string) => {
    try {
        const response = await api.get(`/closet/sold/${userId}`);
        return response.data;
    } catch (error: any) {
        return [];
    }
};

// Update buyItem to support buyerId (if you haven't already)
export const buyItem = async (itemId: string, buyerId: string) => {
    try {
        const response = await api.put(`/closet/buy/${itemId}`, { buyerId });
        return response.data;
    } catch (error: any) {
        return { error: "Purchase failed" };
    }
};


export const deleteItem = async (itemId: string) => {
  try {
    const response = await api.delete(`/closet/delete/${itemId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || "Delete failed" };
  }
};


export const autoAddWithAI = async (userId: string, imageUris: string[]) => {
  const formData = new FormData();
  formData.append("userId", userId);

  for (let i = 0; i < imageUris.length; i++) {
    const uri = imageUris[i];

    if (Platform.OS === "web") {
      // ✅ WEB: convert to Blob
      const res = await fetch(uri);
      const blob = await res.blob();
      formData.append("images", blob, `upload-${i}.jpg`);
    } else {
      // ✅ MOBILE: use file object
      const filename = uri.split("/").pop() || `upload-${i}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";

      // @ts-ignore
      formData.append("images", { uri, name: filename, type });
    }
  }

  try {
    const response = await api.post("/closet/auto-add", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || "AI Scan failed" };
  }
};

export const getWardrobeAnalytics = async (userId: string) => {
  try {
    const response = await api.get(`/analytics/${userId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || "Analytics failed" };
  }
};

export const getResaleDemand = async (userId: string) => {
  try {
    const response = await api.get(`/resale/demand/${userId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || "Resale demand failed" };
  }
};


export const getSustainabilityReport = async (userId: string) => {
  try {
    const response = await api.get(`/sustainability/${userId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || "Sustainability failed" };
  }
};

// ✅ Generate resale listing using AI (inside app)
export const generateListingAI = async (userId: string, itemId: string) => {
  try {
    const response = await api.post("/listing-ai/generate", { userId, itemId });
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || "AI listing failed" };
  }
};

// ✅ Smart Resale Timing Engine
export const getResaleTiming = async (userId: string) => {
  try {
    const response = await api.get(`/resale-timing/${userId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || "Resale timing failed" };
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
    // 1) Generate listing with AI
    const ai = await generateListingAI(userId, itemId);
    if (ai?.error) return { error: ai.error };

    // 2) Immediately list item using AI description
    const result = await listForResale(
      itemId,
      finalPrice,
      size || "",
      condition || "Good",
      ai.description || ""
    );

    if (result?.error) return { error: result.error };

    return { success: true, ai, result };
  } catch (e: any) {
    return { error: "Auto-list failed" };
  }
};

export const getRewardsProfile = async (userId: string) => {
  try {
    const response = await api.get(`/rewards/${userId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || "Failed to load rewards" };
  }
};

export const getRewardsHistory = async (userId: string, limit = 50) => {
  try {
    const response = await api.get(`/rewards/${userId}/history?limit=${limit}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || "Failed to load rewards history" };
  }
};

// ✅ Notifications (uses same API_URL as the rest of app)

export async function registerPushToken(userId: string, token: string) {
  try {
    const response = await api.post("/notifications/register-token", { userId, token });
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || "Failed to register token" };
  }
}

export async function getNotifications(userId: string) {
  try {
    const response = await api.get(`/notifications/${userId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || "Failed to load notifications" };
  }
}

export async function markNotificationRead(id: number | string) {
  try {
    const response = await api.put(`/notifications/read/${id}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || "Failed to mark read" };
  }
}

export async function markAllNotificationsRead(userId: string) {
  try {
    const response = await api.put(`/notifications/read-all/${userId}`);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data?.error || "Failed to mark all read" };
  }
}



export default api;

