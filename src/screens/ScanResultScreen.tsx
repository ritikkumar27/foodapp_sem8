import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, ScrollView, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebaseConfig';
import { COLORS, SPACING, FONTS } from '../constants/theme';
import { evaluateFood, EvaluationResult } from '../logic/RuleEngine';
import { getFoodAnalysis } from '../services/aiService';

// [NEW] Import the new helper and types
import { logFoodItem } from '../services/firebaseHelper';
import { FoodItem } from '../types';

export default function ScanResultScreen({ route, navigation }: any) {
  const { barcode, fromRecipe, recipeName, recipeNutrition, recipeBreakdown } = route.params || {};
  
  // Check if this is a recipe scan or barcode scan
  const isRecipe = fromRecipe === true;
  
  // Steps: 'loading' -> 'input' (ask grams) -> 'result' (show analysis)
  // For recipes, skip input and go straight to result
  const [step, setStep] = useState<'loading' | 'input' | 'result'>(fromRecipe ? 'result' : 'loading');
  
  // Data State
  const [baseFood, setBaseFood] = useState<any>(null); // The raw 100g data
  const [food, setFood] = useState<any>(null);         // The calculated portion data
  const [portionSize, setPortionSize] = useState('100'); // User input string
  
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string>("Generating health insights...");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Edit name state
  const [editNameModalVisible, setEditNameModalVisible] = useState(false);
  const [editedName, setEditedName] = useState('');

  useEffect(() => {
    if (fromRecipe && recipeNutrition) {
      // For recipes, set up the food data directly from recipe nutrition
      const recipeFood = {
        name: recipeName || 'Homemade Recipe',
        brand: 'Custom Recipe',
        calories: recipeNutrition.calories || 0,
        protein: recipeNutrition.protein || 0,
        carbs: recipeNutrition.carbs || 0,
        fat: recipeNutrition.fat || 0,
        sugar: recipeNutrition.sugar || 0,
        sodium: recipeNutrition.sodium || 0,
        ingredients: recipeBreakdown?.map((ing: any) => ing.name).join(', ') || 'Mixed ingredients',
        servingSize: '1 serving'
      };
      
      setBaseFood(recipeFood);
      setFood(recipeFood);
      setPortionSize('1');
      setEditedName(recipeFood.name);
      
      // Skip to result with default "SAFE" decision for recipes
      setResult({
        decision: 'SAFE',
        reason: 'Custom recipe from your ingredients',
        sugarOK: true,
        sodiumOK: true,
        caloriesOK: true
      });
    } else if (barcode) {
      // For barcode scans, fetch data
      fetchBaseData();
    } else {
      Alert.alert("Error", "Invalid barcode or recipe data");
      navigation.goBack();
    }
  }, []);
  
  // 1. FETCH RAW DATA (3-Layer Lookup: Firebase → OpenFoodFacts → Manual)
  const fetchBaseData = async () => {
    try {
      if (!barcode) {
        Alert.alert("Error", "Invalid barcode");
        navigation.goBack();
        return;
      }

      let foundData = null;

      // LAYER 1: Check Firebase custom_products first (fastest, most reliable)
      try {
        const customDoc = await getDoc(doc(db, "food_items", barcode));
        if (customDoc.exists()) {
          const data = customDoc.data();
          if (data) {
            foundData = data;
            if (!foundData.image) foundData.image = null;
            setBaseFood(foundData);
            setStep('input');
            return;
          }
        }
      } catch (fbError) {
        console.warn("Firebase lookup failed:", fbError);
      }

      // LAYER 2: Try OpenFoodFacts API
      try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`, {
          timeout: 10000
        });
        
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const apiData = await response.json();

        if (apiData && apiData.status === 1 && apiData.product) {
          const product = apiData.product;
          
          // Safely extract nutrition data
          const nutriments = product.nutriments || {};
          
          // Validate that product has minimum nutrition data
          const hasNutritionData = 
            nutriments['energy-kcal_100g'] !== undefined ||
            nutriments.sugars_100g !== undefined ||
            nutriments.salt_100g !== undefined ||
            nutriments.fat_100g !== undefined;

          if (hasNutritionData) {
            foundData = {
              name: product.product_name ? String(product.product_name).trim() : "Unknown Food",
              brand: product.brands ? String(product.brands).trim() : "Generic",
              calories: Number(nutriments['energy-kcal_100g']) || 0,
              sugar: Number(nutriments.sugars_100g) || 0,
              sodium: (Number(nutriments.salt_100g) || 0) * 400,
              fat: Number(nutriments.fat_100g) || 0,
              carbs: Number(nutriments.carbohydrates_100g) || 0,
              protein: Number(nutriments.proteins_100g) || 0,
              ingredients: product.ingredients_text ? String(product.ingredients_text).trim() : "Ingredients not listed",
              image: product.image_url || null,
              servingSize: product.serving_size ? String(product.serving_size).trim() : "100g"
            };

            if (product.serving_quantity) {
              setPortionSize(String(Math.round(Number(product.serving_quantity))));
            }

            setBaseFood(foundData);
            setStep('input');
            return;
          }
        }
      } catch (apiError) {
        console.warn("OpenFoodFacts API error:", apiError);
      }

      // LAYER 3: Product not found - offer options
      showProductNotFoundOptions();

    } catch (error) {
      console.error("❌ Unexpected error in fetchBaseData:", error);
      Alert.alert("Error", "An unexpected error occurred.");
      navigation.goBack();
    }
  };

  // Handle product not found with user options
  const showProductNotFoundOptions = () => {
    Alert.alert(
      "Product Not Found",
      "We couldn't find this barcode in our database. You can:",
      [
        {
          text: "Add Manually",
          onPress: () => {
            Alert.alert("Coming Soon", "Manual product entry will be available soon.");
            navigation.goBack();
          }
        },
        {
          text: "Try Again",
          onPress: () => fetchBaseData()
        },
        {
          text: "Cancel",
          onPress: () => navigation.goBack()
        }
      ]
    );
  };

  // 2. CALCULATE & ANALYZE
  const handleAnalyze = async () => {
    if (!baseFood) {
      Alert.alert("Error", "Food data not loaded");
      return;
    }

    const grams = parseFloat(portionSize);
    if (!grams || isNaN(grams) || grams <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid weight in grams.");
      return;
    }

    setIsAnalyzing(true);

    try {
      const user = auth.currentUser;
      if (!user) return;

      const ratio = grams / 100;
      const calculatedFood = {
        ...baseFood,
        calories: (baseFood.calories || 0) * ratio,
        sugar: (baseFood.sugar || 0) * ratio,
        sodium: (baseFood.sodium || 0) * ratio,
        fat: (baseFood.fat || 0) * ratio,
        carbs: (baseFood.carbs || 0) * ratio,
        protein: (baseFood.protein || 0) * ratio,
        portionLogged: grams 
      };

      setFood(calculatedFood);

      const profileSnap = await getDoc(doc(db, "user_profiles", user.uid));
      const profileData = profileSnap.exists() ? profileSnap.data() : {};
      const today = new Date().toISOString().split('T')[0];
      const intakeSnap = await getDoc(doc(db, "daily_intake", `${user.uid}_${today}`));
      const intakeData = intakeSnap.exists() ? intakeSnap.data() : {};

      const decisionResult = evaluateFood(calculatedFood, profileData, intakeData); 
      setResult(decisionResult);
      setStep('result');

      try {
        const aiResponse = await getFoodAnalysis(
          String(calculatedFood.name || "Unknown"),
          {
             sugar: Number(calculatedFood.sugar) || 0, 
             sodium: Number(calculatedFood.sodium) || 0, 
             fat: Number(calculatedFood.fat) || 0,
             calories: Number(calculatedFood.calories) || 0
          }, 
          calculatedFood.ingredients || [], 
          profileData || {}, 
          decisionResult?.decision || "UNKNOWN" 
        );
        setAiExplanation(aiResponse || "Analysis complete");
      } catch (aiError) {
        console.warn("⚠️ AI Analysis error:", aiError);
        setAiExplanation("Analysis not available");
      }

    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 2.5 EDIT NAME
  const handleSaveName = () => {
    if (editedName.trim()) {
      setFood({ ...food, name: editedName.trim() });
      setBaseFood({ ...baseFood, name: editedName.trim() });
      setEditNameModalVisible(false);
    }
  };

  // 3. LOG FOOD (UPDATED TO USE HELPER)
  const logFood = async () => {
    try {
      if (!food) return;

      // Prepare the item strictly typed
      const itemToLog: FoodItem = {
        name: editedName.trim() || food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        sugar: food.sugar || 0,
        sodium: food.sodium || 0,
        serving_size: portionSize, // Storing what user typed (e.g. "150")
      };
      
      const todayDate = new Date().toISOString().split('T')[0];

      // Call the new helper function
      await logFoodItem(itemToLog, todayDate);

      Alert.alert("Logged!", `${Math.round(food.calories)} kcal added.`);
      
      // Navigate back to Home and it will auto-refresh
      navigation.navigate('Home'); 

    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not log food.");
    }
  };

  if (step === 'loading') {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  // INPUT SCREEN
  if (step === 'input') {
    if (!baseFood) {
      return (
        <View style={styles.center}>
          <Text style={styles.error}>Error loading food data</Text>
        </View>
      );
    }
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.inputContainer}>
          <Text style={styles.title}>How much?</Text>
          <Text style={styles.subtitle}>{baseFood.name || "Unknown"}</Text>
          <Text style={styles.brand}>{baseFood.brand || "Generic"}</Text>

          <View style={styles.inputBox}>
            <TextInput 
              style={styles.gramInput}
              value={portionSize}
              onChangeText={setPortionSize}
              keyboardType="numeric"
              autoFocus
            />
            <Text style={styles.unit}>grams</Text>
          </View>
          
          <Text style={styles.hint}>Standard serving: {baseFood.servingSize || "100g"}</Text>

          <TouchableOpacity style={styles.mainBtn} onPress={handleAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? <ActivityIndicator color="#000"/> : <Text style={styles.btnText}>Analyze Health Impact</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // RESULT SCREEN
  if (!food || !result) {
    return (
      <View style={styles.center}>
        <Text>Error: Food data missing</Text>
      </View>
    );
  }

  const statusColor = result.decision === "SAFE" ? COLORS.success : 
                      result.decision === "WARNING" ? COLORS.warning : COLORS.danger;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* HEADER CARD WITH MACROS GRID */}
        <View style={styles.card}>
          <Text style={styles.brand}>{food?.brand || "Generic"}</Text>
          <View style={styles.foodNameRow}>
            <Text style={styles.foodName}>{food?.name || "Unknown Food"}</Text>
            <TouchableOpacity 
              style={styles.editNameBtn}
              onPress={() => {
                setEditedName(food.name);
                setEditNameModalVisible(true);
              }}
            >
              <Text style={{fontSize: 16, color: COLORS.primary}}>✏️</Text>
            </TouchableOpacity>
          </View>
          <Text style={{color:COLORS.textSecondary, marginBottom:16}}>
             Portion: {portionSize}g
          </Text>

          {/* MACRO GRID */}
          <View style={styles.macroGrid}>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{Math.round(food?.calories || 0)}</Text>
              <Text style={styles.macroLabel}>Calories</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{Math.round(food?.sodium || 0)}mg</Text>
              <Text style={styles.macroLabel}>Sodium</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{Math.round(food?.protein || 0)}g</Text>
              <Text style={styles.macroLabel}>Protein</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{Math.round(food?.carbs || 0)}g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{Math.round(food?.fat || 0)}g</Text>
              <Text style={styles.macroLabel}>Fat</Text>
            </View>
          </View>
        </View>

        {/* DECISION BOX */}
        <View style={[styles.resultBox, { borderColor: statusColor }]}>
          <Text style={[styles.decisionText, { color: statusColor }]}>
            {result.decision || "UNKNOWN"}
          </Text>
          
          <View style={styles.aiBox}>
            <Text style={styles.aiLabel}>✨ Smart Analysis</Text>
            <Text style={styles.aiText}>
              {(aiExplanation && aiExplanation !== "Generating health insights..." 
                ? aiExplanation 
                : (result.reason || "Analyzing...") + "\n\n" + aiExplanation) || "Analysis not available"}
            </Text>
          </View>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FOOTER */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.button, { backgroundColor: statusColor }]} onPress={logFood}>
          <Text style={styles.btnText}>Eat & Track</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={{color: COLORS.textSecondary}}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* EDIT NAME MODAL */}
      <Modal visible={editNameModalVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Recipe Name</Text>
            
            <TextInput 
              style={styles.modalInput} 
              value={editedName} 
              onChangeText={setEditedName}
              placeholder="Enter recipe name"
              placeholderTextColor={COLORS.textSecondary}
              autoFocus
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditNameModalVisible(false)}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveName}>
                <Text style={styles.saveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: SPACING.l, paddingBottom: 20 },

  // Input Styles
  inputContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  title: { fontSize: 32, color: COLORS.textPrimary, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 20, color: COLORS.primary, marginBottom: 4, textAlign: 'center' },
  inputBox: { flexDirection: 'row', alignItems: 'baseline', borderBottomWidth: 2, borderBottomColor: COLORS.primary, marginBottom: SPACING.l, marginTop: SPACING.xl },
  gramInput: { fontSize: 48, color: COLORS.textPrimary, fontWeight: 'bold', minWidth: 80, textAlign: 'center' },
  unit: { fontSize: 24, color: COLORS.textSecondary, marginLeft: 8 },
  hint: { color: COLORS.textSecondary, marginBottom: SPACING.xl },
  mainBtn: { backgroundColor: COLORS.primary, width: '100%', padding: SPACING.l, borderRadius: 16, alignItems: 'center' },

  // Result Styles
  card: { backgroundColor: COLORS.surface, padding: SPACING.l, borderRadius: 16, marginBottom: SPACING.l },
  brand: { color: COLORS.textSecondary, fontSize: 14, textTransform: 'uppercase' },
  foodName: { color: COLORS.textPrimary, fontSize: 28, fontWeight: FONTS.bold as any, marginBottom: SPACING.m },
  
  // New Grid Styles
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  macroItem: { 
    backgroundColor: '#1A1A1A', 
    width: '30%', // Fits 3 items per row roughly
    padding: 10, 
    borderRadius: 8, 
    alignItems: 'center',
    flexGrow: 1 
  },
  macroValue: { color: COLORS.primary, fontSize: 18, fontWeight: 'bold' },
  macroLabel: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },

  resultBox: { borderWidth: 2, borderRadius: 16, padding: SPACING.l, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  decisionText: { fontSize: 32, fontWeight: 'bold', marginBottom: SPACING.m },
  aiBox: { marginTop: SPACING.s, backgroundColor: '#2A2A2A', padding: SPACING.m, borderRadius: 12, width: '100%' },
  aiLabel: { color: COLORS.secondary, fontWeight: 'bold', marginBottom: SPACING.s, fontSize: 14 },
  aiText: { color: '#E0E0E0', fontSize: 14, lineHeight: 22 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.surface, padding: SPACING.l, borderTopWidth: 1, borderTopColor: '#333' },
  button: { padding: SPACING.l, borderRadius: 16, alignItems: 'center' },
  btnText: { color: '#000', fontWeight: 'bold', fontSize: 18 },
  cancelBtn: { alignItems: 'center', padding: SPACING.m },
  
  // Edit Name Modal Styles
  foodNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editNameBtn: { padding: 8, marginLeft: 8 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: SPACING.l, width: '80%', borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold', marginBottom: SPACING.m },
  modalInput: { backgroundColor: '#1A1A1A', borderRadius: 8, padding: SPACING.m, color: COLORS.textPrimary, marginBottom: SPACING.l, borderWidth: 1, borderColor: COLORS.primary },
  modalBtns: { flexDirection: 'row', gap: SPACING.m, justifyContent: 'flex-end' },
  saveBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.l, paddingVertical: SPACING.s, borderRadius: 8 },
  saveTxt: { color: '#000', fontWeight: 'bold' },
  cancelTxt: { color: COLORS.textSecondary },
});