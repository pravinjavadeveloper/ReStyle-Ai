// frontend/app/components/AppFontGate
import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import * as Font from "expo-font";

export default function AppFontGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await Font.loadAsync({
  "IntegralCF-Bold": require("../assets/Fonts/integral-cf-bold.ttf"),
  "Tactics-Bold": require("../assets/Fonts/fonnts.com-tacticsans-bld.otf"),
});
      } catch (e) {
        console.warn("Font load failed, using fallback fonts:", e);
        // ✅ IMPORTANT: do NOT crash
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" }}>
        <Text style={{ color: "#FFF", fontWeight: "bold", letterSpacing: 2 }}>LOADING...</Text>
      </View>
    );
  }

  return <>{children}</>;
}