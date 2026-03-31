// app/login.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { parsePhoneNumberFromString } from "libphonenumber-js";

import { loginUser, signupUser, resendVerification } from "../services/api";
import { NotoSerifDisplay_500Medium } from "@expo-google-fonts/noto-serif-display";
import { useFonts } from "expo-font";

export default function LoginScreen() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [emailVerifiedState, setEmailVerifiedState] = useState<
    "unknown" | "verified" | "not_verified"
  >("unknown");
  const [resendLoading, setResendLoading] = useState(false);

  const [fontsLoaded] = useFonts({ NotoSerifDisplay_500Medium });

  const normalizedEmail = useMemo(
    () => String(email || "").trim().toLowerCase(),
    [email]
  );

  if (!fontsLoaded) return null;

  const isStrongPassword = (value: string) => {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(
      String(value || "")
    );
  };

  const getValidatedPhone = (value: string) => {
    const cleaned = String(value || "").trim();

    if (!cleaned) {
      return { isValid: false, formatted: "" };
    }

    const parsed =
      parsePhoneNumberFromString(cleaned, "GB") ||
      parsePhoneNumberFromString(cleaned);

    if (!parsed || !parsed.isValid()) {
      return { isValid: false, formatted: "" };
    }

    return {
      isValid: true,
      formatted: parsed.number, // E.164 format
    };
  };

  const handleResend = async () => {
    if (!normalizedEmail) {
      Alert.alert("Enter email", "Please enter your email first.");
      return;
    }

    setResendLoading(true);
    try {
      const r = await resendVerification(normalizedEmail);
      Alert.alert(
        "Verification",
        r?.message || "If the email exists, a verification link has been sent."
      );
    } catch {
      Alert.alert("Error", "Failed to resend verification link.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    let validatedPhone = "";

    if (!isLogin) {
      if (!name || String(name).trim().length < 2) {
        Alert.alert("Invalid Name", "Please enter your full name.");
        return;
      }

      const phoneResult = getValidatedPhone(phone);

      if (!phoneResult.isValid) {
        Alert.alert(
          "Invalid Phone Number",
          "Please enter a valid phone number. Use country code if needed, for example +44."
        );
        return;
      }

      validatedPhone = phoneResult.formatted;

      if (!isStrongPassword(password)) {
        Alert.alert(
          "Weak Password",
          "Password must be at least 8 characters and include 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character."
        );
        return;
      }
    }

    setLoading(true);
    setEmailVerifiedState("unknown");

    try {
      let result: any;

      if (isLogin) {
        result = await loginUser(normalizedEmail, password);
      } else {
        result = await signupUser(
          String(name || "").trim(),
          normalizedEmail,
          password,
          validatedPhone
        );
      }

      if (result?.error) {
        if (result?.error === "EMAIL_NOT_VERIFIED") {
          setEmailVerifiedState("not_verified");
          Alert.alert(
            "Verify Email",
            result?.message || "Please verify your email to continue."
          );
          return;
        }

        if (result?.error === "ACCOUNT_DEACTIVATED") {
          Alert.alert(
            "Account Deactivated",
            result?.message || "This account has been deactivated."
          );
          return;
        }

        Alert.alert("Failed", result.error || "Something went wrong");
        return;
      }

      if (!isLogin) {
        Alert.alert(
          "Check your email",
          "We sent you a verification link. Open it to verify your account, then come back and log in."
        );
        setIsLogin(true);
        setEmailVerifiedState("unknown");
        setName("");
        setPhone("");
        setPassword("");
        return;
      }

      setEmailVerifiedState("verified");
      await AsyncStorage.setItem("userId", String(result.user.id));
      await AsyncStorage.setItem(
        "userName",
        String(result.user.name || "Fashionista")
      );

      try {
        const isExpoGo = Constants.appOwnership === "expo";

        if (!isExpoGo) {
          const { setupPushOrWebNotifications } = await import("../services/push");
          await setupPushOrWebNotifications(String(result.user.id));
        }
      } catch {}

      router.replace("/(tabs)");
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.mainWrapper}>
      <ImageBackground
        source={require("../assets/images/l19.png")}
        style={styles.backgroundImage}
        resizeMode="cover"
        imageStyle={{ transform: [{ translateY: -10 }] }}
      >
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.55)", "rgba(0,0,0,1)"]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardView}
          >
            <View style={styles.contentContainer}>
              <View style={styles.header}>
                <Text style={styles.brandTitle}>HOUSE OF REVERA</Text>
                <Text style={styles.brandSubtitle}>
                  {isLogin
                    ? "Log in to access your digital wardrobe."
                    : "Register to digitize, style, and sell."}
                </Text>
              </View>

              <View style={styles.form}>
                {!isLogin && (
                  <>
                    <TextInput
                      placeholder="Full Name"
                      placeholderTextColor="#B5B5B5"
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                    />

                    <TextInput
                      placeholder="Phone number (e.g. +44 7123 456789)"
                      placeholderTextColor="#B5B5B5"
                      style={styles.input}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                    />
                  </>
                )}

                <TextInput
                  placeholder="Email address"
                  placeholderTextColor="#B5B5B5"
                  style={styles.input}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    setEmailVerifiedState("unknown");
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                {emailVerifiedState === "verified" ? (
                  <Text style={styles.verifiedText}>Email verified</Text>
                ) : emailVerifiedState === "not_verified" ? (
                  <View style={styles.notVerifiedRow}>
                    <Text style={styles.notVerifiedText}>
                      Email not verified
                    </Text>
                    <TouchableOpacity
                      onPress={handleResend}
                      activeOpacity={0.85}
                      disabled={resendLoading}
                    >
                      <Text style={styles.resendText}>
                        {resendLoading ? "Sending..." : "Resend link"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <View style={styles.passwordWrap}>
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor="#B5B5B5"
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((s) => !s)}
                    style={styles.eyeBtn}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color="#FFF"
                    />
                  </TouchableOpacity>
                </View>

                {!isLogin && (
                  <>
                    <Text style={styles.phoneHint}>
                      Enter a valid mobile number. Include country code like +44.
                    </Text>
                    <Text style={styles.passwordHint}>
                      Use at least 8 characters with uppercase, lowercase, number,
                      and special character.
                    </Text>
                  </>
                )}

                <TouchableOpacity
                  style={styles.button}
                  onPress={handleAuth}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.buttonText}>
                      {isLogin ? "Continue" : "Register"}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setIsLogin(!isLogin)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.switchText}>
                    {isLogin
                      ? "Don't have an account? Register"
                      : "Already have an account? Log in"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: "#000" },
  backgroundImage: { flex: 1, width: "100%", height: "100%" },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1, justifyContent: "flex-end" },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 40,
  },

  header: { alignItems: "center", marginBottom: 28 },
  brandTitle: {
    fontSize: 35,
    color: "#FFF",
    fontFamily: "NotoSerifDisplay_500Medium",
    fontWeight: "600",
    letterSpacing: 0.7,
    marginBottom: 11,
    textAlign: "center",
    lineHeight: 37,
  },
  brandSubtitle: {
    color: "#E6E6E6",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
  },

  form: { width: "100%" },

  input: {
    backgroundColor: "rgba(0,0,0,0.45)",
    color: "#FFF",
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 0,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    fontSize: 15,
  },

  verifiedText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    marginTop: -6,
    marginBottom: 10,
    letterSpacing: 0.2,
    opacity: 0.9,
  },
  notVerifiedRow: {
    marginTop: -6,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notVerifiedText: {
    color: "#DADADA",
    fontSize: 12,
    fontWeight: "700",
    opacity: 0.9,
  },
  resendText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.3,
    textDecorationLine: "underline",
  },

  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 0,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    height: 52,
  },
  passwordInput: {
    flex: 1,
    color: "#FFF",
    paddingHorizontal: 16,
    height: "100%",
    fontSize: 15,
  },
  eyeBtn: {
    paddingHorizontal: 16,
    height: "100%",
    justifyContent: "center",
  },
  phoneHint: {
    color: "#CFCFCF",
    fontSize: 11,
    lineHeight: 16,
    marginTop: -2,
    marginBottom: 8,
    opacity: 0.95,
  },
  passwordHint: {
    color: "#CFCFCF",
    fontSize: 11,
    lineHeight: 16,
    marginTop: -2,
    marginBottom: 14,
    opacity: 0.95,
  },

  button: {
    backgroundColor: "#FFF",
    height: 52,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  buttonText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  switchText: {
    color: "#FFF",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
    opacity: 0.95,
  },
});