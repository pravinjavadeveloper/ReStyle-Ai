// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons"; // ✅ Using standard icons

const ACTIVE = "#111111"; // Luxury Black
const INACTIVE = "#9AA0A6";
const TAB_BG = "#FFFFFF";
const BORDER = "#E6E6E6";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopColor: BORDER,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 60,
          paddingTop: 2,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", // ✅ Serif font for luxury feel
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-closet"
        options={{
          title: "Wardrobe",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "shirt" : "shirt-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="virtual-tryon"
        options={{
          title: "Try-On",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "sparkles" : "sparkles-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: "Resell",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "bag-handle" : "bag-handle-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="circular-score"
        options={{
          title: "Impact",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "leaf" : "leaf-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}