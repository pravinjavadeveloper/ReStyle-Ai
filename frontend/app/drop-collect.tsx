// app/drop-collect.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

//  HIGH-FASHION LOGISTICS PALETTE
const COLORS = {
  bg: "#FFFFFF",
  black: "#000000",
  orange: "#FF4500", // Safety/Courier Orange for action
  border: "#E2E8F0",
  muted: "#666666",
  soft: "#F4F4F4",
};

export default function DropCollectScreen() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [transport, setTransport] = useState("Bicycle");

  const handleSubmit = () => {
    if (!name || !phone || !city) {
      Alert.alert("Missing Info", "Please fill out all required fields.");
      return;
    }

    Alert.alert(
      "DISPATCH RECEIVED 🚀", 
      `Thanks ${name}, we have received your application for the Agent role in ${city}.\n\nOur team will review your manifest and transmit verification instructions shortly.`,
      [
        { text: "ACKNOWLEDGE", onPress: () => router.back() }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* 🌟 LOGISTICS HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            {/* <Text style={styles.headerMono}>// DEPT: LOGISTICS</Text> */}
            <Text style={styles.headerTitle}>AGENT NETWORK</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          
          {!showForm ? (
            /* --- DISPATCH BRIEF (EXPLANATION VIEW) --- */
            <View style={styles.explanationView}>
              
              {/* Hero Label */}
              <View style={styles.heroLabel}>
                <View style={styles.heroLabelTop}>
                  <Text style={styles.heroMono}>REQ: FIELD_AGENT</Text>
                  <Ionicons name="barcode-outline" size={24} color={COLORS.black} />
                </View>
                <Text style={styles.title}>DROP & COLLECT{"\n"}DISPATCHER</Text>
                <Text style={styles.highlightText}>
                  BECOME THE PHYSICAL BACKBONE OF CIRCULAR FASHION.
                </Text>
                <View style={styles.badgeRow}>
                  <View style={styles.badge}><Text style={styles.badgeText}>FREELANCE</Text></View>
                  <View style={styles.badge}><Text style={styles.badgeText}>FLEXIBLE</Text></View>
                  <View style={styles.badge}><Text style={styles.badgeText}>LOCAL</Text></View>
                </View>
              </View>

              <Text style={styles.description}>
                Earn money by picking up and delivering clothing for resale, repairs, and sustainable fashion services directly through the RE-STYLE app.
              </Text>

              {/* Protocol Table (What you'll do) */}
              <View style={styles.tableCard}>
                <View style={styles.tableHeader}>
                  <Text style={styles.tableTitle}>STANDARD PROTOCOL</Text>
                </View>
                <TableRow num="01" text="Pick up clothing from local users" />
                <TableRow num="02" text="Deliver items to tailors, repair shops, or hubs" />
                <TableRow num="03" text="Return completed garments to users" />
                <TableRow num="04" text="Use the app for GPS check-in and photo proof" isLast />
              </View>

              {/* Compensation Block (Safety Orange Accent) */}
              <View style={styles.compCard}>
                <Text style={styles.compTitle}>COMPENSATION & PERKS</Text>
                <View style={styles.compRateBox}>
                  <Text style={styles.compRateText}>£12.50 – £15.00</Text>
                  <Text style={styles.compRateSub}>PER COMPLETED ROUTE</Text>
                </View>
                <View style={styles.compGrid}>
                  <Text style={styles.compBullet}>• FLEXIBLE HOURS</Text>
                  <Text style={styles.compBullet}>• LOCAL ASSIGNMENTS</Text>
                  <Text style={styles.compBullet}>• 100% APP-BASED</Text>
                  <Text style={styles.compBullet}>• NO INTERVIEWS</Text>
                </View>
              </View>

              {/* Target Profile */}
              <View style={styles.profileBox}>
                <Text style={styles.profileLabel}>TARGET PROFILE:</Text>
                <Text style={styles.profileText}>Students, Gig Workers, Freelancers, or anyone seeking high-flexibility physical tasks.</Text>
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowForm(true)} activeOpacity={0.9}>
                <Text style={styles.primaryBtnText}>INITIALIZE APPLICATION</Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
              </TouchableOpacity>

            </View>
          ) : (
            /* --- MANIFEST (FORM VIEW) --- */
            <View style={styles.formView}>
              
              <View style={styles.formHeaderBox}>
                <Text style={styles.formMono}>FORM: AGENT_ONBOARDING</Text>
                <Text style={styles.formTitle}>APPLICATION MANIFEST</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>OPERATIVE NAME <Text style={{color: COLORS.orange}}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. ALEX JOHNSON"
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>COMMS NUMBER <Text style={{color: COLORS.orange}}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 07700 900000"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>OPERATIONAL ZONE (CITY) <Text style={{color: COLORS.orange}}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. LONDON / CAMDEN"
                  placeholderTextColor="#999"
                  value={city}
                  onChangeText={setCity}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>PRIMARY TRANSPORT <Text style={{color: COLORS.orange}}>*</Text></Text>
                <View style={styles.transportGrid}>
                  {['Bicycle', 'Scooter', 'Car', 'Walking'].map(t => (
                    <TouchableOpacity 
                      key={t}
                      style={[styles.transportBtn, transport === t && styles.transportBtnActive]}
                      onPress={() => setTransport(t)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.transportText, transport === t && styles.transportTextActive]}>
                        {t.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} activeOpacity={0.9}>
                <Text style={styles.submitBtnText}>TRANSMIT DATA</Text>
                <Ionicons name="radio-outline" size={18} color={COLORS.white} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelBtnText}>ABORT & RETURN</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Custom Table Row component for the Protocol list
function TableRow({ num, text, isLast = false }: { num: string, text: string, isLast?: boolean }) {
  return (
    <View style={[styles.tableRow, isLast && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowNum}>{num}</Text>
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  
  // Brutalist Logistics Header
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.black,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerMono: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 9,
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.black,
    letterSpacing: 1.5,
  },
  backBtn: { padding: 4 },

  container: {
    padding: 20,
    paddingBottom: 40,
  },

  /* --- EXPLANATION VIEW --- */
  explanationView: {
    paddingTop: 10,
  },
  
  // Shipping Label Hero
  heroLabel: {
    borderWidth: 2,
    borderColor: COLORS.black,
    padding: 16,
    marginBottom: 24,
  },
  heroLabelTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.black,
    paddingBottom: 8,
  },
  heroMono: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: 'IntegralCF-Bold',
    color: COLORS.black,
    lineHeight: 34,
    marginBottom: 12,
  },
  highlightText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.black,
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { 
    backgroundColor: COLORS.black, 
    paddingHorizontal: 10, 
    paddingVertical: 6,
  },
  badgeText: { 
    fontSize: 10, 
    fontWeight: '900', 
    color: COLORS.white,
    letterSpacing: 1,
  },

  description: {
    fontSize: 14,
    color: COLORS.black,
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 24,
  },

  // Protocol Table
  tableCard: {
    borderWidth: 2,
    borderColor: COLORS.black,
    marginBottom: 24,
  },
  tableHeader: {
    backgroundColor: COLORS.black,
    padding: 10,
  },
  tableTitle: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.black,
    padding: 12,
    alignItems: 'center',
  },
  rowNum: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '900',
    fontSize: 14,
    color: COLORS.muted,
    width: 30,
  },
  rowText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.black,
    textTransform: 'uppercase',
  },

  // Compensation Card (Orange Accent)
  compCard: {
    borderWidth: 2,
    borderColor: COLORS.orange,
    padding: 16,
    marginBottom: 24,
    backgroundColor: '#FFF5F0', // Very light orange tint
  },
  compTitle: {
    color: COLORS.orange,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  compRateBox: {
    marginBottom: 16,
  },
  compRateText: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.black,
    fontFamily: 'IntegralCF-Bold',
  },
  compRateSub: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 1,
  },
  compGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  compBullet: {
    width: '48%',
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: 4,
  },

  profileBox: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.black,
    paddingLeft: 12,
    marginBottom: 32,
  },
  profileLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  profileText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.black,
    lineHeight: 18,
  },

  primaryBtn: {
    backgroundColor: COLORS.orange,
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  /* --- FORM VIEW (TERMINAL AESTHETIC) --- */
  formView: {
    paddingTop: 10,
  },
  formHeaderBox: {
    borderBottomWidth: 4,
    borderBottomColor: COLORS.black,
    paddingBottom: 16,
    marginBottom: 24,
  },
  formMono: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: 'IntegralCF-Bold',
    color: COLORS.black,
  },
  
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: COLORS.black,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.soft,
    borderWidth: 2,
    borderColor: COLORS.black,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },
  
  transportGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10 
  },
  transportBtn: { 
    width: '48%',
    borderWidth: 2, 
    borderColor: COLORS.border, 
    paddingVertical: 16, 
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  transportBtnActive: { 
    backgroundColor: COLORS.black, 
    borderColor: COLORS.black,
  },
  transportText: { 
    fontSize: 12, 
    color: COLORS.muted, 
    fontWeight: '800',
    letterSpacing: 1,
  },
  transportTextActive: { 
    color: COLORS.white ,
  },

  submitBtn: {
    backgroundColor: COLORS.black,
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 10,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  cancelBtn: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelBtnText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
});