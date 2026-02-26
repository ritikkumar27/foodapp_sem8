// src/screens/ScanScreen.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Button, TouchableOpacity, Alert, 
  TextInput, FlatList, Modal, ScrollView, ActivityIndicator, Image 
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, SPACING } from '../constants/theme';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { 
  getFirestore, collection, query, where, getDocs, addDoc 
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { app } from '../services/firebaseConfig';
import { FoodItem } from '../types';

const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);
const auth = getAuth(app);

interface Product {
  id: string;
  name: string;
  brand?: string;
  image?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  sodium?: number;
  serving_size: string | number;
  verified?: boolean;
}

export default function ScanScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [isOCRProcessing, setIsOCRProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<Partial<FoodItem> | null>(null);
  const [editedOCRResult, setEditedOCRResult] = useState<Partial<FoodItem> | null>(null);

  // Reset scanner when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      setScanned(false);
    }, [])
  );

  const searchProducts = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    // Check if user is authenticated
    if (!auth.currentUser) {
      Alert.alert('Authentication Required', 'Please sign in to search products');
      return;
    }

    setIsSearching(true);
    try {
      const productsRef = collection(db, 'food_items');
      const q = query(
        productsRef,
        where('name_lower', '>=', searchTerm.toLowerCase()),
        where('name_lower', '<=', searchTerm.toLowerCase() + '\uf8ff')
      );
      
      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Omit<Product, 'id'>
      } as Product));
      
      setSearchResults(results);
    } catch (error: any) {
      console.error('Error searching products:', error);
      let errorMessage = 'Failed to search products';
      
      if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please check your account permissions.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      Alert.alert('Search Error', errorMessage);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchProducts(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleProductSelect = (product: Product) => {
    navigation.navigate('ScanResult', { 
      barcode: product.id
    });
  };

  const handleOCRScan = async () => {
    setShowOCRModal(true);
  };

  const capturePhoto = async (cameraRef: any) => {
    if (!cameraRef.current) return null;
    
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false
      });
      return photo;
    } catch (error) {
      console.error('Error taking photo:', error);
      return null;
    }
  };

  const processOCR = async (photoUri: string) => {
    // Check if user is authenticated
    if (!auth.currentUser) {
      Alert.alert('Authentication Required', 'Please sign in to use OCR scanning');
      return;
    }

    setIsOCRProcessing(true);
    try {
      // Upload to Firebase Storage
      const response = await fetch(photoUri);
      const blob = await response.blob();
      const filename = `ocr_${Date.now()}.jpg`;
      const storageRef = ref(storage, `ocr-images/${filename}`);
      await uploadBytes(storageRef, blob);
      const imageUrl = await getDownloadURL(storageRef);

      // Call OCR Cloud Function
      const ocrFunction = httpsCallable(functions, 'processNutritionLabel');
      const result = await ocrFunction({ imageUrl });
      
      const nutritionData = result.data as Partial<FoodItem>;
      setOcrResult(nutritionData);
      setEditedOCRResult(nutritionData);
    } catch (error: any) {
      console.error('Error processing OCR:', error);
      let errorMessage = 'Failed to process nutrition label';
      
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'Storage access denied. Please check your permissions.';
      } else if (error.code === 'storage/unknown') {
        errorMessage = 'Storage error. Please try again later.';
      } else if (error.code === 'functions/not-found') {
        errorMessage = 'OCR service not available. Please contact support.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      Alert.alert('OCR Error', errorMessage);
    } finally {
      setIsOCRProcessing(false);
    }
  };

  const saveOCRProduct = async () => {
    if (!editedOCRResult?.name) {
      Alert.alert('Error', 'Product name is required');
      return;
    }

    // Check if user is authenticated
    if (!auth.currentUser) {
      Alert.alert('Authentication Required', 'Please sign in to save products');
      return;
    }

    try {
      const productData = {
        ...editedOCRResult,
        name_lower: editedOCRResult.name.toLowerCase(),
        verified: false,
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'products'), productData);
      
      Alert.alert('Success', 'Product saved successfully');
      setShowOCRModal(false);
      setOcrResult(null);
      setEditedOCRResult(null);
    } catch (error: any) {
      console.error('Error saving product:', error);
      let errorMessage = 'Failed to save product';
      
      if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please check your account permissions.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      Alert.alert('Save Error', errorMessage);
    }
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  const handleBarCodeScanned = ({ type, data }: any) => {
    if (scanned) return;
    setScanned(true);
    navigation.navigate('ScanResult', { barcode: data });
  };

  const renderSearchResult = ({ item }: { item: Product }) => (
    <TouchableOpacity 
      style={styles.searchResultItem}
      onPress={() => handleProductSelect(item)}
    >
      {!!item.image ? (
        <Image source={{ uri: String(item.image) }} style={styles.productThumb} resizeMode="cover" />
      ) : (
        <View style={styles.productThumb} />
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        {item.brand && <Text style={styles.productBrand}>{item.brand}</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"],
        }}
      />
      
      <View style={styles.overlay}>
        <View style={styles.topContent}>
          <Text style={styles.hintText}>Scan a food barcode</Text>
          <TouchableOpacity 
            style={styles.searchButton}
            onPress={() => setShowSearchModal(true)}
          >
            <MaterialIcons name="search" size={24} color={COLORS.primary} />
            <Text style={styles.searchButtonText}>Search Products</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.scannerFrame} />
        
        <View style={styles.bottomContent}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('RecipeCalculator')}
            style={styles.optionButton}
          >
            <Text style={styles.optionText}>Add Recipe</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSearchModal(false)}>
              <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Search Products</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <View style={styles.searchInputContainer}>
            <MaterialIcons name="search" size={20} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or brand..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>

          {isSearching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.id}
              style={styles.searchResultsList}
              ListEmptyComponent={
                searchQuery.trim() ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No products found</Text>
                    <TouchableOpacity 
                      style={styles.addProductButton}
                      onPress={() => {
                        setShowSearchModal(false);
                        handleOCRScan();
                      }}
                    >
                      <Text style={styles.addProductButtonText}>Add Product</Text>
                    </TouchableOpacity>
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </Modal>

      {/* OCR Modal */}
      <Modal
        visible={showOCRModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowOCRModal(false);
              setOcrResult(null);
              setEditedOCRResult(null);
            }}>
              <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Scan Nutrition Label</Text>
            <View style={{ width: 24 }} />
          </View>

          {!ocrResult ? (
            <OCRScanner onPhotoCaptured={processOCR} isProcessing={isOCRProcessing} />
          ) : (
            <ScrollView style={styles.ocrResultContainer}>
              <Text style={styles.sectionTitle}>Edit Product Details</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editedOCRResult?.name || ''}
                  onChangeText={(text) => setEditedOCRResult(prev => ({ ...prev, name: text }))}
                  placeholder="Enter product name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Brand</Text>
                <TextInput
                  style={styles.textInput}
                  value={editedOCRResult?.brand || ''}
                  onChangeText={(text) => setEditedOCRResult(prev => ({ ...prev, brand: text }))}
                  placeholder="Enter brand name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Serving Size *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editedOCRResult?.serving_size?.toString() || ''}
                  onChangeText={(text) => setEditedOCRResult(prev => ({ ...prev, serving_size: text }))}
                  placeholder="e.g., 1 cup, 100g"
                />
              </View>

              <View style={styles.nutritionInputs}>   
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Calories *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editedOCRResult?.calories?.toString() || ''}
                    onChangeText={(text) => setEditedOCRResult(prev => ({ 
                      ...prev, 
                      calories: parseFloat(text) || 0 
                    }))}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Protein (g)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editedOCRResult?.protein?.toString() || ''}
                    onChangeText={(text) => setEditedOCRResult(prev => ({ 
                      ...prev, 
                      protein: parseFloat(text) || 0 
                    }))}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Carbs (g)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editedOCRResult?.carbs?.toString() || ''}
                    onChangeText={(text) => setEditedOCRResult(prev => ({ 
                      ...prev, 
                      carbs: parseFloat(text) || 0 
                    }))}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Fat (g)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editedOCRResult?.fat?.toString() || ''}
                    onChangeText={(text) => setEditedOCRResult(prev => ({ 
                      ...prev, 
                      fat: parseFloat(text) || 0 
                    }))}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={styles.saveButton}
                onPress={saveOCRProduct}
              >
                <Text style={styles.saveButtonText}>Save Product</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

// OCR Scanner Component
const OCRScanner = ({ onPhotoCaptured, isProcessing }: any) => {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = React.useRef<any>(null);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false
      });
      onPhotoCaptured(photo.uri);
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  return (
    <View style={styles.ocrScannerContainer}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing="back"
      />
      
      <View style={styles.ocrOverlay}>
        <Text style={styles.ocrHintText}>Position nutrition label in frame</Text>
        <View style={styles.ocrFrame} />
        
        <TouchableOpacity 
          style={styles.captureButton}
          onPress={handleCapture}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="large" color={COLORS.primary} />
          ) : (
            <View style={styles.captureButtonInner} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  message: { textAlign: 'center', paddingBottom: 10, color: 'white' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'space-between', alignItems: 'center' },
  topContent: { paddingTop: 60, alignItems: 'center' },
  hintText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  
  // Create a transparent hole in the middle
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    borderRadius: 20,
  },
  
  bottomContent: { paddingBottom: 50, gap: 15 },
  optionButton: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary
  },
  optionText: { color: COLORS.primary, fontSize: 16, fontWeight: '600' },
  manualButton: { padding: 10 },
  manualText: { color: COLORS.primary, fontSize: 16, textDecorationLine: 'underline' },
  
  // Search Button
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary
  },
  searchButtonText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  
  // Modal Styles
  modalContainer: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface
  },
  modalTitle: { 
    color: COLORS.textPrimary, 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  
  // Search Input
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: SPACING.l,
    paddingHorizontal: SPACING.m,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    gap: SPACING.s
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    paddingVertical: SPACING.m
  },
  
  // Search Results
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  searchResultsList: {
    flex: 1,
    paddingHorizontal: SPACING.l
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)'
  },
  productThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  productInfo: { flex: 1 },
  productName: { 
    color: COLORS.textPrimary, 
    fontSize: 16, 
    fontWeight: '600' 
  },
  productBrand: { 
    color: COLORS.textSecondary, 
    fontSize: 14,
    marginTop: 2
  },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginBottom: SPACING.l
  },
  addProductButton: {
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    backgroundColor: COLORS.primary,
    borderRadius: 12
  },
  addProductButtonText: {
    color: 'black',
    fontSize: 16,
    fontWeight: '600'
  },
  
  // OCR Scanner
  ocrScannerContainer: { flex: 1 },
  ocrOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  ocrHintText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 60
  },
  ocrFrame: {
    width: 300,
    height: 200,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    borderRadius: 12
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 60
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary
  },
  
  // OCR Result Form
  ocrResultContainer: {
    flex: 1,
    padding: SPACING.l
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: SPACING.l
  },
  inputGroup: {
    marginBottom: SPACING.l
  },
  inputLabel: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.s
  },
  textInput: {
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    fontSize: 16,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  nutritionInputs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.s
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.l,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SPACING.l
  },
  saveButtonText: {
    color: 'black',
    fontSize: 16,
    fontWeight: '600'
  }
});