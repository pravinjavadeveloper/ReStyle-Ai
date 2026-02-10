// frontend/app/my-closet.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getUserItems,
  listForResale,
  getPriceEstimate,
  deleteItem,
  generateListingAI, // ✅ NEW
} from '../services/api';

const SERVER_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

// ✅ One place to control platform fee
const PLATFORM_FEE_RATE = 0.10;

export default function MyClosetScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // MODAL STATE (existing sell modal)
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('');
  const [condition, setCondition] = useState('Good');
  const [desc, setDesc] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // ✅ NEW: AUTO-LIST MODAL STATE
  const [autoModalVisible, setAutoModalVisible] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [aiTitle, setAiTitle] = useState('');
  const [aiDesc, setAiDesc] = useState('');
  const [aiMin, setAiMin] = useState<number>(0);
  const [aiMax, setAiMax] = useState<number>(0);
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [autoPrice, setAutoPrice] = useState(''); // editable final price (prefilled)

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        if (Platform.OS !== 'web') Alert.alert('Error', 'Please login again.');
        router.replace('/');
        return;
      }
      const data = await getUserItems(userId);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log('LOAD ITEMS ERROR:', e);
      if (Platform.OS !== 'web') Alert.alert('Error', 'Failed to load closet items.');
      else alert('Failed to load closet items.');
    } finally {
      setLoading(false);
    }
  };

  // 👇 DELETE FUNCTION (WEB COMPATIBLE)
  const handleDelete = async (item: any) => {
    console.log('Attempting to delete:', item.id);

    const performDelete = async () => {
      console.log('🚀 Sending delete request for', item.id);

      // Optimistic UI Update
      setItems((current) => current.filter((i) => String(i.id) !== String(item.id)));

      const result = await deleteItem(item.id);
      console.log('✅ Delete Result:', result);

      if (result?.error) {
        if (Platform.OS !== 'web') Alert.alert('Error', result.error);
        else alert(result.error);
        loadItems(); // rollback by reloading
      }
    };

    if (Platform.OS === 'web') {
      // @ts-ignore
      if (window.confirm('Are you sure you want to delete this item?')) {
        await performDelete();
      }
    } else {
      Alert.alert('Delete Item', 'Are you sure you want to remove this item?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]);
    }
  };

  // ✅ Existing sell/edit flow
  const handleResellClick = (item: any) => {
    setSelectedItem(item);

    if (item.for_sale) {
      setPrice(item.price ? item.price.toString() : '');
      setSize(item.size || '');
      setCondition(item.condition || 'Good');
      setDesc(item.description || '');
    } else {
      setPrice('');
      setSize('');
      setDesc('');
      setCondition('Good');
    }

    setModalVisible(true);
  };

  // ✅ NEW: Auto-List flow
  const handleAutoListClick = async (item: any) => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        if (Platform.OS !== 'web') Alert.alert('Error', 'Please login again.');
        router.replace('/');
        return;
      }

      setSelectedItem(item);
      setAiTitle('');
      setAiDesc('');
      setAiMin(0);
      setAiMax(0);
      setAiTags([]);
      setAutoPrice('');
      setAutoModalVisible(true);
      setAutoLoading(true);

      const res = await generateListingAI(userId, String(item.id));

      if (res?.error) {
        setAutoModalVisible(false);
        if (Platform.OS !== 'web') Alert.alert('AI Failed', res.error);
        else alert(res.error);
        return;
      }

      setAiTitle(res.title || '');
      setAiDesc(res.description || '');
      setAiMin(Number(res.priceMin || 0));
      setAiMax(Number(res.priceMax || 0));
      setAiTags(Array.isArray(res.tags) ? res.tags.map(String) : []);

      // prefill final price to middle of range
      const mid = Math.round((Number(res.priceMin || 0) + Number(res.priceMax || 0)) / 2);
      setAutoPrice(String(mid > 0 ? mid : 15));

      // also prefill optional fields (does not change your old modal)
      setSize(item.size || '');
      setCondition(item.condition || 'Good');

    } catch (e) {
      console.log("AUTO LIST ERROR:", e);
      if (Platform.OS !== 'web') Alert.alert('Error', 'Auto-List failed. Try again.');
      else alert('Auto-List failed. Try again.');
      setAutoModalVisible(false);
    } finally {
      setAutoLoading(false);
    }
  };

  // ✅ Confirm Auto-List → uses your existing listForResale (no new listing table needed)
  const confirmAutoList = async () => {
    if (!selectedItem) return;

    const p = Number(autoPrice || 0);
    if (!Number.isFinite(p) || p <= 0) {
      if (Platform.OS !== 'web') Alert.alert('Error', 'Enter a valid price.');
      else alert('Enter a valid price.');
      return;
    }

    try {
      const result = await listForResale(
        selectedItem.id,
        p,
        size || '',
        condition || 'Good',
        aiDesc || ''
      );

      if (result?.error) {
        if (Platform.OS !== 'web') Alert.alert('Error', result.error);
        else alert(result.error);
      } else {
        if (Platform.OS !== 'web') Alert.alert('Listed ✅', 'AI listing posted in your marketplace!');
        else alert('AI listing posted in your marketplace!');

        setAutoModalVisible(false);
        loadItems();
      }
    } catch (e) {
      console.log('CONFIRM AUTO LIST ERROR:', e);
      if (Platform.OS !== 'web') Alert.alert('Error', 'Failed to list item.');
      else alert('Failed to list item.');
    }
  };

  const fetchEstimate = async () => {
    if (!selectedItem) return;
    setAiLoading(true);

    try {
      const result = await getPriceEstimate(selectedItem.category, condition);
      if (result) {
        setPrice(String(result.suggested ?? ''));
        const msg = `Market Value: $${result.min} - $${result.max}`;
        if (Platform.OS !== 'web') Alert.alert('AI Suggestion', msg);
        else alert(`AI Suggestion: ${msg}`);
      }
    } catch (e) {
      console.log('AI ESTIMATE ERROR:', e);
      if (Platform.OS !== 'web') Alert.alert('Error', 'Failed to get AI estimate.');
      else alert('Failed to get AI estimate.');
    } finally {
      setAiLoading(false);
    }
  };

  const confirmResale = async () => {
    if (!selectedItem) return;

    const sellingPrice = Number(price || 0);

    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      if (Platform.OS !== 'web') Alert.alert('Error', 'Please enter a valid price.');
      else alert('Please enter a valid price.');
      return;
    }

    try {
      const result = await listForResale(selectedItem.id, sellingPrice, size, condition, desc);

      if (result?.error) {
        if (Platform.OS !== 'web') Alert.alert('Error', result.error);
        else alert(result.error);
      } else {
        if (Platform.OS !== 'web') Alert.alert('Success', 'Listing Updated! 🚀');
        else alert('Listing Updated! 🚀');

        setModalVisible(false);
        loadItems();
      }
    } catch (e) {
      console.log('LIST FOR RESALE ERROR:', e);
      if (Platform.OS !== 'web') Alert.alert('Error', 'Failed to list item.');
      else alert('Failed to list item.');
    }
  };

  // ✅ Fee calculation in ONE place (SELL MODAL)
  const { sellingPrice, platformFee, youEarn } = useMemo(() => {
    const priceNum = Number(price || 0);
    const sp = Number.isFinite(priceNum) ? priceNum : 0;

    const fee = Number((sp * PLATFORM_FEE_RATE).toFixed(2));
    const earn = Number((sp - fee).toFixed(2));

    return { sellingPrice: sp, platformFee: fee, youEarn: earn };
  }, [price]);

  // ✅ NEW: Fee calculation for AUTO-LIST MODAL (ONLY ADDED)
  const { autoSellingPrice, autoPlatformFee, autoYouEarn } = useMemo(() => {
    const priceNum = Number(autoPrice || 0);
    const sp = Number.isFinite(priceNum) ? priceNum : 0;

    const fee = Number((sp * PLATFORM_FEE_RATE).toFixed(2));
    const earn = Number((sp - fee).toFixed(2));

    return { autoSellingPrice: sp, autoPlatformFee: fee, autoYouEarn: earn };
  }, [autoPrice]);

  const openImageUri = (imgPath: string) => {
    const clean = (imgPath || '').replace(/\\/g, '/');
    return `${SERVER_URL}/${clean}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Closet</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#fff" />
      ) : (
        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={(item) => item.id.toString()}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {/* 🗑️ DELETE OVERLAY (Top Left) */}
              <TouchableOpacity
                style={styles.deleteOverlay}
                onPress={() => handleDelete(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteText}>🗑️</Text>
              </TouchableOpacity>

              {item.for_sale && (
                <View style={styles.saleBadge}>
                  <Text style={styles.saleText}>${item.price}</Text>
                </View>
              )}

              <Image source={{ uri: openImageUri(item.image_url) }} style={styles.image} resizeMode="cover" />

              <View style={styles.info}>
                <Text style={styles.category}>{item.category}</Text>

                {/* ✅ Keep your existing Sell/Edit button */}
                <TouchableOpacity
                  style={[styles.actionBtn, item.for_sale ? styles.editBtn : styles.sellBtn]}
                  onPress={() => handleResellClick(item)}
                >
                  <Text style={[styles.btnText, item.for_sale ? styles.btnTextLight : styles.btnTextDark]}>
                    {item.for_sale ? '✏️ Edit Listing' : '💰 Resell'}
                  </Text>
                </TouchableOpacity>

                {/* ✅ NEW: Auto-List button (only if not already for sale) */}
                {!item.for_sale && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.autoBtn]}
                    onPress={() => handleAutoListClick(item)}
                  >
                    <Text style={[styles.btnText, styles.autoBtnText]}>✨ Auto-List</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={{ color: '#666', textAlign: 'center', marginTop: 50 }}>Your closet is empty.</Text>}
        />
      )}

      {/* 🟢 SELL / UPDATE LISTING MODAL (unchanged) */}
      <Modal transparent={true} visible={modalVisible} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.modalTitle}>{selectedItem?.for_sale ? 'Update Listing' : 'Sell Item'}</Text>

              <Text style={styles.label}>Condition:</Text>
              <View style={styles.pillRow}>
                {['New with tags', 'Like New', 'Good', 'Fair'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.pill, condition === c && styles.pillActive]}
                    onPress={() => setCondition(c)}
                  >
                    <Text style={condition === c ? styles.pillTextActive : styles.pillText}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Size:</Text>
              <TextInput
                style={styles.input}
                placeholder="Size"
                placeholderTextColor="#666"
                value={size}
                onChangeText={setSize}
              />

              <Text style={styles.label}>Description:</Text>
              <TextInput
                style={[styles.input, { height: 60 }]}
                multiline
                placeholder="Description"
                placeholderTextColor="#666"
                value={desc}
                onChangeText={setDesc}
              />

              <Text style={styles.label}>Price ($):</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="0.00"
                  keyboardType="numeric"
                  placeholderTextColor="#666"
                  value={price}
                  onChangeText={setPrice}
                />
                <TouchableOpacity style={styles.aiButton} onPress={fetchEstimate}>
                  {aiLoading ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={{ fontWeight: 'bold', fontSize: 11 }}>✨ AI Estimate</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* 💰 Fee Breakdown */}
              {sellingPrice > 0 && (
                <View
                  style={{
                    backgroundColor: '#222',
                    padding: 12,
                    borderRadius: 8,
                    marginTop: 15,
                    borderWidth: 1,
                    borderColor: '#333',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: '#888', fontSize: 13 }}>Selling Price:</Text>
                    <Text style={{ color: '#fff', fontSize: 13 }}>${sellingPrice.toFixed(2)}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ color: '#888', fontSize: 13 }}>
                      Platform Fee ({Math.round(PLATFORM_FEE_RATE * 100)}%):
                    </Text>
                    <Text style={{ color: '#ff6b6b', fontSize: 13 }}>- ${platformFee.toFixed(2)}</Text>
                  </View>

                  <View style={{ height: 1, backgroundColor: '#444', marginVertical: 6 }} />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: 15 }}>You Earn:</Text>
                    <Text style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: 15 }}>${youEarn.toFixed(2)}</Text>
                  </View>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={{ color: '#ccc', padding: 10 }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.confirmBtn} onPress={confirmResale}>
                  <Text style={{ fontWeight: 'bold' }}>{selectedItem?.for_sale ? 'Update' : 'List Item'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ✅ NEW: AUTO-LIST MODAL */}
      <Modal transparent={true} visible={autoModalVisible} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.modalTitle}>✨ Auto-List (AI)</Text>

              {autoLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={{ color: '#aaa', marginTop: 10 }}>Generating listing…</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.label}>Title</Text>
                  <View style={styles.aiBox}>
                    <Text style={{ color: '#fff' }}>{aiTitle || '—'}</Text>
                  </View>

                  <Text style={styles.label}>Suggested Price Range</Text>
                  <View style={styles.aiBox}>
                    <Text style={{ color: '#fff' }}>${aiMin} - ${aiMax}</Text>
                  </View>

                  <Text style={styles.label}>Description</Text>
                  <View style={styles.aiBox}>
                    <Text style={{ color: '#fff' }}>{aiDesc || '—'}</Text>
                  </View>

                  {!!aiTags?.length && (
                    <>
                      <Text style={styles.label}>Tags</Text>
                      <View style={styles.aiBox}>
                        <Text style={{ color: '#fff' }}>{aiTags.join(', ')}</Text>
                      </View>
                    </>
                  )}

                  <Text style={styles.label}>Final Price ($)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    keyboardType="numeric"
                    placeholderTextColor="#666"
                    value={autoPrice}
                    onChangeText={setAutoPrice}
                  />

                  {/* ✅ ADDED: Platform fee breakdown under Final Price (AUTO-LIST) */}
                  {autoSellingPrice > 0 && (
                    <View style={styles.feeBox}>
                      <View style={styles.feeRow}>
                        <Text style={styles.feeLeft}>
                          Platform Fee ({Math.round(PLATFORM_FEE_RATE * 100)}%)
                        </Text>
                        <Text style={styles.feeRight}>- ${autoPlatformFee.toFixed(2)}</Text>
                      </View>

                      <View style={styles.feeDivider} />

                      <View style={styles.feeRow}>
                        <Text style={styles.earnLeft}>You Earn</Text>
                        <Text style={styles.earnRight}>${autoYouEarn.toFixed(2)}</Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.modalButtons}>
                    <TouchableOpacity onPress={() => setAutoModalVisible(false)}>
                      <Text style={{ color: '#ccc', padding: 10 }}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.confirmBtn} onPress={confirmAutoList}>
                      <Text style={{ fontWeight: 'bold' }}>Confirm Listing</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 15 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backButton: { color: '#888', fontSize: 18 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },

  row: { justifyContent: 'space-between' },
  card: {
    width: '48%',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    marginBottom: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  image: { width: '100%', height: 160 },
  info: { padding: 10 },
  category: { color: '#fff', fontWeight: 'bold', marginBottom: 8 },

  deleteOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
  },
  deleteText: { fontSize: 14 },

  actionBtn: {
    width: '100%',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  sellBtn: { backgroundColor: '#fff' },
  editBtn: { backgroundColor: '#333', borderWidth: 1, borderColor: '#555' },

  btnText: { fontWeight: 'bold', fontSize: 12 },
  btnTextDark: { color: '#000' },
  btnTextLight: { color: '#fff' },

  // ✅ NEW button style
  autoBtn: { borderWidth: 1, borderColor: '#E0B0FF', backgroundColor: 'transparent' },
  autoBtnText: { color: '#E0B0FF' },

  saleBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#4CAF50',
    padding: 5,
    borderRadius: 5,
    zIndex: 10,
  },
  saleText: { color: '#fff', fontWeight: 'bold', fontSize: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    width: '95%',
    maxHeight: '90%',
    backgroundColor: '#222',
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#444',
  },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { color: '#ccc', marginBottom: 5, marginTop: 10, fontSize: 14 },
  input: { backgroundColor: '#111', color: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#444' },
  pillActive: { backgroundColor: '#fff', borderColor: '#fff' },
  pillText: { color: '#888' },
  pillTextActive: { color: '#000', fontWeight: 'bold' },
  aiButton: { backgroundColor: '#E0B0FF', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 12, borderRadius: 8 },

  // ✅ AI preview box
  aiBox: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
  },

  // ✅ ADDED: Auto-list fee styles
  feeBox: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLeft: {
    color: '#aaa',
    fontSize: 13,
  },
  feeRight: {
    color: '#ff6b6b',
    fontSize: 13,
    fontWeight: 'bold',
  },
  feeDivider: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginVertical: 8,
  },
  earnLeft: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
  },
  earnRight: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
  },

  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25 },
  confirmBtn: { backgroundColor: '#4CAF50', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 },
});
