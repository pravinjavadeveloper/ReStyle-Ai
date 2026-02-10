// frontend/app/my-orders.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Platform} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
// 1. Import Storage to get the real user ID
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMyPurchases, getMySoldItems } from './services/api';

const SERVER_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

export default function MyOrdersScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'bought' | 'sold'>('bought');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [tab]);

  const loadData = async () => {
    setLoading(true);
    
    // 2. Get Real User ID from phone storage
    const userId = await AsyncStorage.getItem('userId');
    
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
        
    }

    // 3. Fetch Data for the REAL user
    try {
        const data = tab === 'bought' 
            ? await getMyPurchases(userId) 
            : await getMySoldItems(userId);
        
        setItems(Array.isArray(data) ? data : []);

    } catch (error) {
        console.error("Failed to load orders:", error);
    } finally {
        setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backButton}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>My Orders 📦</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'bought' && styles.activeTab]} onPress={() => setTab('bought')}>
            <Text style={[styles.tabText, tab === 'bought' && styles.activeTabText]}>My Shopping 🛍️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'sold' && styles.activeTab]} onPress={() => setTab('sold')}>
            <Text style={[styles.tabText, tab === 'sold' && styles.activeTabText]}>Sold Items 💰</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? <ActivityIndicator size="large" color="#fff" style={{marginTop: 50}} /> : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Image source={{ uri: `${SERVER_URL}/${item.image_url.replace(/\\/g, '/')}` }} style={styles.image} />
              <View style={styles.info}>
                <Text style={styles.name}>{item.item_name || item.category}</Text>
                <Text style={styles.price}>${item.price}</Text>
                <Text style={styles.date}>Date: {item.date_sold ? new Date(item.date_sold).toLocaleDateString() : 'Just now'}</Text>
                
                {tab === 'sold' && (
                    <Text style={styles.soldBadge}>✅ SOLD TO USER #{item.buyer_id}</Text>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
                {tab === 'bought' ? "You haven't bought anything yet." : "You haven't sold anything yet."}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 15 },
  header: { flexDirection: 'row', justifyContent:'space-between', alignItems: 'center', marginBottom: 20 },
  backButton: { color: '#888', fontSize: 18 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  
  tabs: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#1A1A1A', borderRadius: 10, padding: 5 },
  tab: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#333' },
  tabText: { color: '#888', fontWeight: 'bold' },
  activeTabText: { color: '#fff' },

  card: { flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 10, marginBottom: 15, padding: 10 },
  image: { width: 80, height: 80, borderRadius: 8, marginRight: 15 },
  info: { justifyContent: 'center' },
  name: { color: '#fff', fontSize: 16, fontWeight: 'bold', textTransform: 'capitalize' },
  price: { color: '#4CAF50', fontSize: 16, fontWeight: 'bold', marginVertical: 4 },
  date: { color: '#666', fontSize: 12 },
  soldBadge: { color: '#4CAF50', fontSize: 10, marginTop: 5, fontWeight:'bold' },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 50 },
});