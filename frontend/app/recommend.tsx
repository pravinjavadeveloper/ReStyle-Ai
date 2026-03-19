// frontend/app/recommend.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons'; // ✅ Added for premium icons
import { API_URL } from "../services/config";

import { getUserItems, getAIRecommendation } from '../services/api';

const getImageUri = (imageUrl: string) => {
  const cleanPath = (imageUrl || "").replace(/\\/g, "/").replace(/^\/+/, "");
  // image_url from DB is usually like: uploads/xxx.jpg or /uploads/xxx.jpg
  return `${API_URL}/${cleanPath}`;
};

// ✅ BRUTALIST MONOCHROME PALETTE
const COLORS = {
  bg: '#FFFFFF',
  text: '#000000',
  border: '#E2E8F0',
  muted: '#666666',
  black: '#000000',
  white: '#FFFFFF',
  soft: '#F9F9F9',
};

export default function RecommendScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [myItem, setMyItem] = useState<any>(null);
  const [suggestion, setSuggestion] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const storedUserId = await AsyncStorage.getItem('userId');
    if (!storedUserId) {
      Alert.alert('Not logged in', 'Please login first.');
      router.replace('/login'); 
      return;
    }
    setUserId(storedUserId);
    pickRandomItem(storedUserId);
  };

  const pickRandomItem = async (uid?: string) => {
    try {
      setLoading(true);
      setSuggestion(null);

      const currentUserId = uid || userId;
      if (!currentUserId) {
        setLoading(false);
        return;
      }

      const items = await getUserItems(currentUserId);

      if (!items || items.length === 0) {
        setMyItem(null);
        setLoading(false);
        return;
      }

      const randomItem = items[Math.floor(Math.random() * items.length)];
      setMyItem(randomItem);

      const aiResult = await getAIRecommendation(
        randomItem.category,
        randomItem.color
      );
      setSuggestion(aiResult);

      setLoading(false);
    } catch (err) {
      console.log('RECOMMEND ERROR:', err);
      setLoading(false);
      Alert.alert('Error', 'Failed to load recommendations.');
    }
  };

  const openLink = async (url: string) => {
    try {
      if (!url) return;
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Invalid link', 'Cannot open this link.');
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      console.log('OPEN LINK ERROR:', err);
      Alert.alert('Error', 'Could not open link.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* 🌟 EDITORIAL HEADER */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.backBtn}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>AI STYLIST</Text>
        <Text style={styles.subtitle}>COMPLETE THE LOOK</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        
        {loading && !myItem ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.black} />
            <Text style={styles.loadingText}>ANALYZING YOUR WARDROBE...</Text>
          </View>
        ) : myItem ? (
          <>
            {/* SECTION 1: REFERENCE ITEM (User's piece) */}
            <View style={styles.referenceSection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="bookmark-outline" size={16} color={COLORS.black} />
                <Text style={styles.sectionTitle}>REFERENCE PIECE</Text>
              </View>

              <View style={styles.referenceCard}>
                <View style={styles.referenceImageWrap}>
                  <Image
                    source={{ uri: getImageUri(myItem.image_url) }}
                    style={styles.referenceImage}
                  />
                </View>
                <View style={styles.referenceInfo}>
                  <Text style={styles.referenceLabel}>FROM YOUR CLOSET</Text>
                  <Text style={styles.referenceName}>
                    {myItem.color} {myItem.category}
                  </Text>
                </View>
              </View>
            </View>

            {/* SECTION 2: AI SUGGESTION */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.black} />
                <Text style={styles.loadingText}>CURATING MATCHES...</Text>
              </View>
            ) : suggestion ? (
              <View style={styles.suggestionSection}>
                
                {/* AI Pairing Statement Box */}
                <View style={styles.pairingBox}>
                  <Text style={styles.pairingLabel}>THE PAIRING</Text>
                  <Text style={styles.pairingText}>
                    {suggestion.suggested_pairing}
                  </Text>
                </View>

                {/* MARKETPLACE RESULTS (Editorial List) */}
                <View style={styles.marketList}>
                  <Text style={styles.marketListTitle}>SUGGESTED ADDITIONS</Text>
                  
                  {Array.isArray(suggestion.recommendations) &&
                    suggestion.recommendations.map((item: any, index: number) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.marketRow}
                        onPress={() => openLink(item.link)}
                        activeOpacity={0.7}
                      >
                        <Image
                          source={{ uri: item.image }}
                          style={styles.marketImage}
                        />
                        <View style={styles.marketInfo}>
                          <Text style={styles.marketName} numberOfLines={2}>
                            {item.name}
                          </Text>
                          <Text style={styles.marketPlatform}>
                            VIA {item.platform.toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.marketAction}>
                          <Text style={styles.marketPrice}>{item.price}</Text>
                          <Ionicons name="arrow-forward" size={18} color={COLORS.black} />
                        </View>
                      </TouchableOpacity>
                    ))}
                </View>
              </View>
            ) : (
              <Text style={styles.mutedCenterText}>
                Select an item to view stylist suggestions.
              </Text>
            )}
          </>
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="shirt-outline" size={32} color={COLORS.muted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>YOUR CLOSET IS EMPTY</Text>
            <Text style={styles.emptySubText}>Add items to your wardrobe to get AI styling suggestions.</Text>
          </View>
        )}
      </ScrollView>

      {/* FIXED BOTTOM ACTIONS */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => pickRandomItem()} activeOpacity={0.9}>
          <Ionicons name="shuffle" size={20} color={COLORS.white} />
          <Text style={styles.primaryBtnText}>SHUFFLE ITEM</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 16,
  },
  scroll: { 
    paddingHorizontal: 20, 
    paddingBottom: 100, 
  },
  
  // Brutalist Header
  headerContainer: { 
    paddingHorizontal: 20, 
    marginBottom: 24 
  },
  backBtn: { 
    marginBottom: 16, 
    alignSelf: 'flex-start' 
  },
  backButtonText: { 
    color: COLORS.text, 
    fontSize: 14, 
    fontWeight: '600' 
  },
  title: {
    color: COLORS.text,
    fontSize: 32, 
    fontFamily: 'IntegralCF-Bold', 
    textTransform: 'uppercase',
    letterSpacing: 1.5, 
    marginBottom: 4,  
  },
  subtitle: { 
    color: COLORS.text, 
    fontSize: 11, 
    fontWeight: '600', 
    textTransform: 'uppercase',
    letterSpacing: 0.5 
  },

  // Loading State
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.black,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  // Section 1: Reference Item
  referenceSection: {
    marginBottom: 32,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    marginLeft: 8,
  },
  referenceCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.black,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  referenceImageWrap: {
    width: 120,
    height: 120,
    backgroundColor: COLORS.soft,
    borderRightWidth: 1,
    borderColor: COLORS.black,
    padding: 10,
  },
  referenceImage: { 
    width: '100%', 
    height: '100%', 
    resizeMode: 'contain' 
  },
  referenceInfo: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  referenceLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  referenceName: {
    color: COLORS.black,
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Empty State
  emptyBox: {
    width: '100%',
    padding: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyText: { 
    color: COLORS.black, 
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptySubText: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Section 2: AI Suggestion
  suggestionSection: {
    width: '100%',
  },
  pairingBox: {
    backgroundColor: COLORS.black,
    padding: 20,
    marginBottom: 24,
  },
  pairingLabel: {
    color: COLORS.white,
    opacity: 0.7,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  pairingText: {
    color: COLORS.white,
    fontSize: 18,
    fontFamily: 'IntegralCF-Bold',
    lineHeight: 26,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Marketplace List
  marketList: {
    width: '100%',
  },
  marketListTitle: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.black,
    paddingBottom: 8,
  },
  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  marketImage: {
    width: 60,
    height: 60,
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    resizeMode: 'cover',
  },
  marketInfo: { 
    flex: 1, 
    paddingHorizontal: 16 
  },
  marketName: { 
    color: COLORS.black, 
    fontWeight: '800', 
    fontSize: 13,
    textTransform: 'uppercase',
    marginBottom: 4,
    lineHeight: 18,
  },
  marketPlatform: { 
    color: COLORS.muted, 
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  marketAction: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  marketPrice: {
    color: COLORS.black,
    fontWeight: '900',
    fontSize: 14,
    marginBottom: 4,
  },
  
  mutedCenterText: {
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 20,
  },

  // Footer Button
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  primaryBtn: {
    backgroundColor: COLORS.black,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 0, // Sharp corners
  },
  primaryBtnText: { 
    color: COLORS.white, 
    fontWeight: '800', 
    fontSize: 14,
    letterSpacing: 1.5,
    marginLeft: 10,
  },
});