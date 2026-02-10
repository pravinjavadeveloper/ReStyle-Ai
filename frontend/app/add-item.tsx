// frontend/app/add-item.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ AI AUTO ADD API
import { autoAddWithAI } from './services/api';

export default function AddItemScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // 🔐 Get logged in user
  const getUserId = async () => {
    const userId = await AsyncStorage.getItem('userId');
    if (!userId) {
      Alert.alert("Error", "Please login again.");
      router.replace('/');
      return null;
    }
    return userId;
  };

  // 📸 CAMERA FLOW
const openCamera = async () => {
  if (Platform.OS === "web") {
    Alert.alert("Camera not supported on Web", "Please use the mobile app (Android/iOS) to open camera.");
    return;
  }

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permission required", "Camera access is needed");
    return;
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: 1,
    allowsEditing: false,
  });

  if (!result.canceled) {
    handleAIScan([result.assets[0].uri]);
  }
};


  // 🖼️ GALLERY FLOW (single OR multiple)
  const openGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Gallery access is needed");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      handleAIScan(uris);
    }
  };

  // 🤖 AI SCAN + AUTO ADD
  const handleAIScan = async (imageUris: string[]) => {
    const userId = await getUserId();
    if (!userId) return;

    setLoading(true);

    try {
      const result = await autoAddWithAI(userId, imageUris);

      if (result.error) {
        Alert.alert("Scan Failed", result.error);
      } else {
        Alert.alert(
          "Success 🎉",
          `Added ${result.items.length} items to your closet`
        );
        router.push('/my-closet');
      }
    } catch (err) {
      Alert.alert("Error", "AI scan failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Add Items</Text>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>AI is scanning your wardrobe 🤖</Text>
        </View>
      ) : (
        <>
          {/* 📸 CAMERA BUTTON */}
          <TouchableOpacity style={styles.button} onPress={openCamera}>
            <Text style={styles.buttonText}>📸 Open Camera</Text>
          </TouchableOpacity>

          {/* 🖼️ GALLERY BUTTON */}
          <TouchableOpacity style={styles.buttonOutline} onPress={openGallery}>
            <Text style={styles.buttonOutlineText}>🖼️ Upload from Gallery</Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: '#fff',
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonOutlineText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingBox: {
    alignItems: 'center',
  },
  loadingText: {
    color: '#ccc',
    marginTop: 15,
    fontSize: 16,
  },
});
