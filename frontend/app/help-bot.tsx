// app/help-bot.tsx

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { getFAQReply } from "../services/chatbot/faqBot";

type Message = {
  id: string;
  role: "user" | "bot";
  text: string;
};

// ✅ PREMIUM AI PALETTE
const COLORS = {
  bg: "#FFFFFF",
  text: "#000000",
  muted: "#888888",
  softGray: "#F4F4F5", // Refined premium gray
  white: "#FFFFFF",
  black: "#000000",
};

export default function HelpBot() {
  const router = useRouter();
  const insets = useSafeAreaInsets(); // ✅ Safely handles notches so header is clickable

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "start",
      role: "bot",
      text:
        "Hello.\n\nI can help with:\n" +
        "• reselling items\n" +
        "• buying items\n" +
        "• shipping\n" +
        "• payouts\n" +
        "• carbon impact\n" +
        "• deleting account",
    },
  ]);

  const [input, setInput] = useState("");

  // Small "AI help" toast animation at top
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastY = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(toastY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]),
      Animated.delay(1600),
      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(toastY, { toValue: -10, duration: 220, useNativeDriver: true }),
      ]),
    ]).start();
  }, [toastOpacity, toastY]);

  const goBackSmart = () => {
    try {
      router.back();
    } catch {
      router.replace("/(tabs)");
    }
  };

  const send = () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now() + "_u",
      role: "user",
      text: input.trim(),
    };

    const reply = getFAQReply(input);

    const botMsg: Message = {
      id: Date.now() + "_b",
      role: "bot",
      text: reply.text,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput("");
  };

  return (
    <View style={styles.container}>
      
      {/* 🌟 PREMIUM HEADER - Fixed spacing using insets */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={goBackSmart} style={styles.headerBtn} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}} activeOpacity={0.75}>
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.title}>AI CONCIERGE</Text>
          <Text style={styles.subtitle}>SUPPORT & STYLING</Text>
        </View>

        <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={styles.headerBtn} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}} activeOpacity={0.75}>
           <Ionicons name="home-outline" size={22} color={COLORS.black} />
        </TouchableOpacity>
      </View>

      {/* AI ONLINE TOAST */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          {
            top: insets.top + 70, // Adjusts perfectly below the new header
            opacity: toastOpacity,
            transform: [{ translateY: toastY }],
          },
        ]}
      >
        <Ionicons name="sparkles" size={12} color={COLORS.white} style={{marginRight: 6}} />
        <Text style={styles.toastText}>AI ASSISTANT ONLINE</Text>
      </Animated.View>

      {/* CHAT FEED */}
      <FlatList
        data={messages}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.chatContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isUser = item.role === "user";
          
          if (isUser) {
            return (
              <View style={styles.userMessageWrapper}>
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{item.text}</Text>
                </View>
              </View>
            );
          }

          return (
            <View style={styles.botMessageWrapper}>
              <View style={styles.botAvatar}>
                <Ionicons name="sparkles" size={14} color={COLORS.white} />
              </View>
              <View style={styles.botBubble}>
                <Text style={styles.botText}>{item.text}</Text>
              </View>
            </View>
          );
        }}
      />

      {/* SLEEK INPUT BAR */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom || 20 }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask a question..."
          placeholderTextColor={COLORS.muted}
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={send}
        />

        <TouchableOpacity 
          style={[styles.sendBtn, !input.trim() && { opacity: 0.4 }]} 
          onPress={send} 
          activeOpacity={0.85}
          disabled={!input.trim()}
        >
          <Ionicons name="arrow-up" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.bg 
  },

  // ✅ Header with safe padding
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.softGray,
    backgroundColor: COLORS.bg,
    zIndex: 10,
  },
  headerBtn: {
    width: 44, // Fixed width to keep title centered perfectly
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontFamily: 'IntegralCF-Bold', 
    fontWeight: "900",
    letterSpacing: 1.5,
    color: COLORS.black,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.muted,
    letterSpacing: 1,
    marginTop: 2,
  },

  // System Toast
  toast: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.black,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999, // Pill shape
    zIndex: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  toastText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  // Chat Feed
  chatContainer: { 
    padding: 20, 
    paddingTop: 30, 
    paddingBottom: 100 // Extra padding to scroll above the input bar
  },
  
  // ✅ Bot Message Styling (Premium Rounded)
  botMessageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end', // Aligns avatar to the bottom of the bubble
    marginBottom: 24,
    maxWidth: '85%',
  },
  botAvatar: {
    width: 28,
    height: 28,
    backgroundColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderRadius: 14, // Circular avatar
  },
  botBubble: {
    backgroundColor: COLORS.softGray,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderBottomLeftRadius: 4, // Premium asymmetric tail
  },
  botText: {
    color: COLORS.black,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },

  // ✅ User Message Styling (Premium Rounded & Fixed Height)
  userMessageWrapper: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    maxWidth: '80%',
  },
  userBubble: {
    backgroundColor: COLORS.black,
    paddingVertical: 14, // Fixed height issue (was 16 overall)
    paddingHorizontal: 18,
    borderRadius: 20,
    borderBottomRightRadius: 4, // Premium asymmetric tail
  },
  userText: {
    color: COLORS.white,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },

  // ✅ Minimal Input Bar
  inputContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.softGray,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.softGray,
    color: COLORS.black,
    paddingHorizontal: 20,
    paddingVertical: 12, // More balanced height
    fontSize: 14,
    fontWeight: "500",
    borderRadius: 24, // Sleek Pill Shape
  },
  sendBtn: {
    width: 44,
    height: 44, // Match input height
    backgroundColor: COLORS.black,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    borderRadius: 22, // Perfect Circle
  },
});