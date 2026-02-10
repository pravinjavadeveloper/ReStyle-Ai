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

import { getUserItems, getAIRecommendation } from './services/api';

const SERVER_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

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
    // ✅ Get real logged-in userId (saved at login)
    const storedUserId = await AsyncStorage.getItem('userId');
    if (!storedUserId) {
      Alert.alert('Not logged in', 'Please login first.');
      router.replace('/login'); // change route if your login path differs
      return;
    }
    setUserId(storedUserId);

    // ✅ Auto-load first recommendation
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

      // ✅ fetch ONLY current user's items
      const items = await getUserItems(currentUserId);

      if (!items || items.length === 0) {
        setMyItem(null);
        setLoading(false);
        return;
      }

      const randomItem = items[Math.floor(Math.random() * items.length)];
      setMyItem(randomItem);

      // 🧠 Ask AI for pairing + marketplace links
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

  const getImageUri = (imageUrl: string) => {
    // imageUrl may look like: uploads/123-file.jpg OR uploads\123-file.jpg
    const cleanPath = imageUrl?.replace(/\\/g, '/');
    return `${SERVER_URL}/${cleanPath}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Complete The Look ✨</Text>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* SECTION 1: YOUR ITEM */}
        <Text style={styles.sectionTitle}>1. You Own</Text>

        {loading && !myItem ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : myItem ? (
          <View style={styles.card}>
            <Image
              source={{ uri: getImageUri(myItem.image_url) }}
              style={styles.image}
            />
            <Text style={styles.cardText}>
              {myItem.color} {myItem.category}
            </Text>
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              No closet items found. Add items first.
            </Text>
          </View>
        )}

        {/* SECTION 2: AI SUGGESTION */}
        <Text style={styles.sectionTitle}>2. You Need (AI Suggestion)</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : suggestion ? (
          <View style={{ width: '100%' }}>
            <Text style={styles.matchText}>
              💡 Best Match:{' '}
              <Text style={styles.matchHighlight}>
                {suggestion.suggested_pairing}
              </Text>
            </Text>

            {/* MARKETPLACE RESULTS */}
            {Array.isArray(suggestion.recommendations) &&
              suggestion.recommendations.map((item: any, index: number) => (
                <TouchableOpacity
                  key={index}
                  style={styles.marketCard}
                  onPress={() => openLink(item.link)}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: item.image }}
                    style={styles.marketImage}
                  />
                  <View style={styles.marketInfo}>
                    <Text style={styles.marketName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.platform}>
                      Found on {item.platform}
                    </Text>
                    <Text style={styles.price}>{item.price}</Text>
                  </View>
                  <Text style={styles.arrow}>→</Text>
                </TouchableOpacity>
              ))}
          </View>
        ) : (
          <Text style={{ color: '#666' }}>
            Pick an item to get outfit suggestions.
          </Text>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.refreshBtn} onPress={() => pickRandomItem()}>
        <Text style={styles.btnText}>🔄 Try Another Item</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 15 }}>
        <Text style={{ color: '#666' }}>Back Home</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
    alignItems: 'center',
  },
  scroll: { width: '100%', alignItems: 'center' },
  header: {
    fontSize: 26,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#888',
    alignSelf: 'flex-start',
    marginBottom: 10,
    marginTop: 10,
    fontSize: 16,
  },

  card: {
    backgroundColor: '#1A1A1A',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#333',
  },
  image: { width: 120, height: 120, borderRadius: 10, resizeMode: 'contain' },
  cardText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },

  emptyBox: {
    width: '100%',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
  },
  emptyText: { color: '#888', textAlign: 'center' },

  matchText: { color: '#ccc', fontSize: 18, marginBottom: 15 },
  matchHighlight: { fontWeight: 'bold', color: '#4CAF50' },

  marketCard: {
    flexDirection: 'row',
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#444',
  },
  marketImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  marketInfo: { flex: 1, marginLeft: 15 },
  marketName: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  platform: { color: '#888', fontSize: 12 },
  price: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 16,
    marginTop: 2,
  },
  arrow: { color: '#666', fontSize: 24, paddingRight: 10 },

  refreshBtn: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 30,
    marginTop: 20,
  },
  btnText: { fontWeight: 'bold', fontSize: 16 },
});
