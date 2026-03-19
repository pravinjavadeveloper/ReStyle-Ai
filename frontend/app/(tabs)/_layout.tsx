// frontend/app/(tabs)/_layout.tsx
//  MODIFIED ONLY: added custom tabBar, and updated TAB_BG to your requested #F4F8F9
//  Everything else (fonts, sizes, icons, labels, spacing) is kept the same.

import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons"; //  kept (used by your screen options)

import AnimatedTabBar from "../../components/AnimatedTabBar"; //  NEW

const ACTIVE = "#111111"; // Luxury Black (kept)
const INACTIVE = "#000000"; // kept
const TAB_BG = "#e9e9e9"; //  per your request
const BORDER = "#E6E6E6"; // kept

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,

        //  keep your exact sizing/padding rules
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopColor: BORDER,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 75,
          paddingTop: 22,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
        },

        //  keep your exact label style
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
          fontWeight: "500",
        },
      }}
      //  NEW: custom animated box tab bar
      tabBar={(props) => (
       <AnimatedTabBar
  {...props}
  ACTIVE_BOX="#000000"
  BAR_BG={TAB_BG}
  ACTIVE_TINT={ACTIVE}
  INACTIVE_TINT={INACTIVE}
  BORDER={BORDER}
/>
      )}
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
