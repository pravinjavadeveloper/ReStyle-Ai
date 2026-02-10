// app/login.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loginUser, signupUser } from "./services/api";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function LoginScreen() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    let result;

    if (isLogin) result = await loginUser(email, password);
    else result = await signupUser(name, email, password);

    setLoading(false);

    if (result?.error) {
      Alert.alert("Failed", result.error);
      return;
    }

    await AsyncStorage.setItem("userId", result.user.id.toString());
    await AsyncStorage.setItem("userName", result.user.name);

    if (isLogin) {
      router.replace("/(tabs)"); // ✅ go into tabs
    } else {
      Alert.alert("Account Created!", "Please log in now.");
      setIsLogin(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>RE-STYLE AI</Text>
        <Text style={styles.subtitle}>Digitize. Style. Sell.</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.headerText}>
          {isLogin ? "Welcome Back" : "Create Account"}
        </Text>

        {!isLogin && (
          <TextInput
            placeholder="Full Name"
            placeholderTextColor="#666"
            style={styles.input}
            value={name}
            onChangeText={setName}
          />
        )}

        <TextInput
          placeholder="Email"
          placeholderTextColor="#666"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <View style={styles.passwordWrap}>
          <TextInput
            placeholder="Password"
            placeholderTextColor="#666"
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((s) => !s)}
            style={styles.eyeBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁️"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
          {loading ? <ActivityIndicator color="#000" /> : (
            <Text style={styles.buttonText}>{isLogin ? "Log In" : "Sign Up"}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
          <Text style={styles.switchText}>
            {isLogin ? "New here? Create an account" : "Already have an account? Log in"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 20, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: 50 },
  title: { fontSize: 32, fontWeight: "bold", color: "#fff", letterSpacing: 2 },
  subtitle: { color: "#888", fontSize: 16, marginTop: 5 },
  form: { width: "100%" },
  headerText: { color: "#fff", fontSize: 24, marginBottom: 20, fontWeight: "600" },
  input: {
    backgroundColor: "#1A1A1A",
    color: "#fff",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#333",
  },
  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#333",
  },
  passwordInput: { flex: 1, color: "#fff", padding: 15 },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  eyeText: { fontSize: 18 },
  button: { backgroundColor: "#fff", padding: 15, borderRadius: 8, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#000", fontWeight: "bold", fontSize: 16 },
  switchText: { color: "#888", textAlign: "center", marginTop: 20, fontSize: 14 },
});
