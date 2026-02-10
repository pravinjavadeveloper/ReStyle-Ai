// frontend/app/ambassador.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";


export async function openAmbassadorEmail() {
  const to = "teamforsolution@gmail.com";
  const subjectRaw = "RE-STYLE AI — Sustainable Fashion Ambassador Application";

  const bodyRaw =
`Hello Team,

I want to join as a Sustainable Fashion Ambassador for RE-STYLE AI.

My details:
• Full Name:
• Phone / WhatsApp:
• City:
• Instagram/LinkedIn:
• College/Organization (if any):

Why I want to join:
- 

Resume:
(Please attach your resume to this email)

Thank you,
[Your Name]`;

  const subject = encodeURIComponent(subjectRaw);
  const body = encodeURIComponent(bodyRaw);

  // ✅ WEB: open Gmail compose directly (best for browser testing)
  if (Platform.OS === "web") {
    const gmailWeb = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      to
    )}&su=${subject}&body=${body}`;

    return Linking.openURL(gmailWeb);
  }

  // ✅ MOBILE: mailto opens the installed mail app
  const mailto = `mailto:${to}?subject=${subject}&body=${body}`;
  const can = await Linking.canOpenURL(mailto);

  if (can) return Linking.openURL(mailto);

  // fallback: gmail web if mailto not supported
  const gmailWeb = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    to
  )}&su=${subject}&body=${body}`;

  return Linking.openURL(gmailWeb);
}


export default function AmbassadorScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ambassador</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.kicker}>Join the movement</Text>

        <Text style={styles.title}>
          Earn rewards by promoting{"\n"}
          <Text style={styles.highlight}>RE-STYLE AI</Text>
        </Text>

        <Text style={styles.sub}>
          Help people buy/sell pre-loved fashion and earn incentives for every successful signup.
        </Text>

        <View style={styles.bullets}>
          <View style={styles.bulletRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.bold}>Flexible schedule</Text> — promote online or locally in your city.
            </Text>
          </View>

          <View style={styles.bulletRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.bold}>Earn per signup</Text> — referral tracking + simple verification.
            </Text>
          </View>

          <View style={styles.bulletRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.bold}>Build your profile</Text> — get early access + recognition inside the app.
            </Text>
          </View>

          <View style={styles.bulletRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.bold}>No experience required</Text> — students and job seekers are welcome.
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.cta} onPress={openAmbassadorEmail} activeOpacity={0.9}>
          <Text style={styles.ctaText}>Become an Ambassador</Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          {Platform.OS === "web"
            ? "Web note: mailto depends on your browser/OS email handler. If it doesn’t open email, we will copy the template."
            : "Tip: attach your resume in the email before sending."}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },

  header: {
    height: 56,
    backgroundColor: "#000",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { paddingVertical: 8, paddingRight: 10 },
  back: { color: "#888", fontSize: 18 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  container: { padding: 18, paddingBottom: 40 },

  kicker: { color: "#888", marginBottom: 10 },
  title: { color: "#fff", fontSize: 34, fontWeight: "800", lineHeight: 40 },
  highlight: { color: "#D4AF37" }, // gold-like
  sub: { color: "#aaa", marginTop: 12, fontSize: 14, lineHeight: 20 },

  bullets: {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#222",
    backgroundColor: "#111",
  },
  bulletRow: { flexDirection: "row", marginBottom: 12, gap: 10 },
  check: { color: "#4CAF50", fontSize: 16, marginTop: 1 },
  bulletText: { color: "#ddd", flex: 1, lineHeight: 20 },
  bold: { fontWeight: "800", color: "#fff" },

  cta: {
    marginTop: 18,
    backgroundColor: "#D4AF37",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  ctaText: { color: "#111", fontWeight: "900", fontSize: 16 },

  note: { color: "#666", marginTop: 12, fontSize: 12, lineHeight: 18 },
});
