// frontend/app/(stack)/_layout.tsx
import React from "react";
import { Stack } from "expo-router";

export default function StackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // ✅ stops route name header like "my-orders"
      }}
    />
  );
}