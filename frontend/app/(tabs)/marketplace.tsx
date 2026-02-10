// frontend/app/marketplace.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
// 1. IMPORT STORAGE 👇
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Import buyItem
import { getMarketplaceItems, buyItem } from '../services/api';

const SERVER_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

export default function MarketplaceScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarketplace();
  }, []);

  const loadMarketplace = async () => {
    // 1. Get My ID from Storage
    const myId = await AsyncStorage.getItem('userId');
    if (!myId) return;

    // 2. Fetch Marketplace (Backend automatically hides my own items)
    const data = await getMarketplaceItems(myId); 
    setItems(data);
    setLoading(false);
  };

  const handleBuy = async (item: any) => {
      // 1. Get Buyer ID
      const myId = await AsyncStorage.getItem('userId');
      if (!myId) {
          Alert.alert("Error", "Please login to buy items.");
          return;
      }

      // 2. Call Backend
      const result = await buyItem(item.id, myId);

      if (result.error) {
          Alert.alert("Error", "Could not complete purchase.");
      } else {
          Alert.alert("🎉 Purchase Successful!", `You just bought the ${item.category}!`);
          
          // 3. Remove item from list immediately
          setItems(currentItems => currentItems.filter(i => i.id !== item.id));
      }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backButton}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Marketplace 🛒</Text>
        <View style={{ width: 40 }} /> 
      </View>

      {loading ? <ActivityIndicator size="large" color="#fff" /> : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
              <View style={styles.card}>
                <Image 
                    source={{ uri: `${SERVER_URL}/${item.image_url.replace(/\\/g, '/')}` }} 
                    style={styles.image} 
                    resizeMode="cover"
                />
                
                <View style={styles.info}>
                    <View style={styles.row}>
                        <Text style={styles.category}>{item.category}</Text>
                        <Text style={styles.price}>${item.price}</Text>
                    </View>
                    <Text style={styles.details}>📏 Size: {item.size || 'N/A'} • ✨ {item.condition || 'Used'}</Text>
                    
                    <TouchableOpacity style={styles.buyButton} onPress={() => handleBuy(item)}>
                        <Text style={styles.buyButtonText}>Buy Now</Text>
                    </TouchableOpacity>
                </View>
              </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No items for sale right now.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 15 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent:'space-between', marginBottom: 20 },
  backButton: { color: '#888', fontSize: 18 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  card: { backgroundColor: '#1A1A1A', borderRadius: 15, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#333' },
  image: { width: '100%', height: 250 },
  info: { padding: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  category: { color: '#fff', fontSize: 18, fontWeight: 'bold', textTransform: 'capitalize' },
  price: { color: '#4CAF50', fontSize: 18, fontWeight: 'bold' },
  details: { color: '#ccc', fontSize: 14, marginBottom: 15 },
  buyButton: { backgroundColor: '#fff', padding: 12, borderRadius: 8, alignItems: 'center' },
  buyButtonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 50, fontSize: 16 },
});