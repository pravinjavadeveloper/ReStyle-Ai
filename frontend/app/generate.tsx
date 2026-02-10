// frontend/app/generate.tsx
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getUserItems } from './services/api'; 

// Fix Image URL for Web/Android
const SERVER_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

export default function GenerateScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [outfit, setOutfit] = useState<{top: any, bottom: any} | null>(null);

  const generateOutfit = async () => {
    setLoading(true);
    setOutfit(null); // Clear previous outfit

    // 1. Get all items
    const allItems = await getUserItems("1"); // Hardcoded user "1"

    // 2. Filter Tops and Bottoms
    const tops = allItems.filter((item: any) => 
        item.category.toLowerCase().includes('shirt') || 
        item.category.toLowerCase().includes('top') ||
        item.category.toLowerCase().includes('hoodie')
    );

    const bottoms = allItems.filter((item: any) => 
        item.category.toLowerCase().includes('pant') || 
        item.category.toLowerCase().includes('jean') ||
        item.category.toLowerCase().includes('short')
    );

    // 3. Pick Random Items
    if (tops.length > 0 && bottoms.length > 0) {
        const randomTop = tops[Math.floor(Math.random() * tops.length)];
        const randomBottom = bottoms[Math.floor(Math.random() * bottoms.length)];
        
        // Fake delay for "AI Thinking" effect 🧠
        setTimeout(() => {
            setOutfit({ top: randomTop, bottom: randomBottom });
            setLoading(false);
        }, 1500);
        
    } else {
        setLoading(false);
        Alert.alert("Not enough clothes!", "You need at least 1 Shirt and 1 Pant to generate an outfit.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>AI Stylist 🤖</Text>
      
      <View style={styles.stage}>
        {loading ? (
            <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Analyzing colors...</Text>
            </View>
        ) : outfit ? (
            <View style={styles.resultBox}>
                {/* TOP */}
                <Image 
                    source={{ uri: `${SERVER_URL}/${outfit.top.image_url.replace(/\\/g, '/')}` }} 
                    style={styles.image} 
                    resizeMode="contain" // 👈 Fixed: Added as Prop
                />
                <Text style={styles.plus}>+</Text>
                {/* BOTTOM */}
                <Image 
                    source={{ uri: `${SERVER_URL}/${outfit.bottom.image_url.replace(/\\/g, '/')}` }} 
                    style={styles.image} 
                    resizeMode="contain" // 👈 Fixed: Added as Prop
                />
            </View>
        ) : (
            <Text style={styles.placeholder}>Tap the button to create a look!</Text>
        )}
      </View>

      <TouchableOpacity style={styles.button} onPress={generateOutfit}>
        <Text style={styles.buttonText}>✨ Generate New Look</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} style={{marginTop: 20}}>
        <Text style={{color: '#666'}}>Go Back</Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20, alignItems: 'center' },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 30 },
  stage: { 
    width: '100%', height: 400, backgroundColor: '#1A1A1A', borderRadius: 20, 
    justifyContent: 'center', alignItems: 'center', marginBottom: 30, borderWidth: 1, borderColor: '#333' 
  },
  loadingBox: { alignItems: 'center' },
  loadingText: { color: '#888', marginTop: 10 },
  placeholder: { color: '#666', fontSize: 16 },
  resultBox: { alignItems: 'center', width: '100%', height: '100%', padding: 20, justifyContent: 'space-evenly' },
  
  // 👇 REMOVED resizeMode from here
  image: { width: 150, height: 150, borderRadius: 10, backgroundColor: '#000' },
  
  plus: { color: '#fff', fontSize: 30, fontWeight: 'bold' },
  button: { backgroundColor: '#fff', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30 },
  buttonText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
});