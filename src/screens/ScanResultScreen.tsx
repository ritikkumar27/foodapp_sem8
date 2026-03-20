import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, ScrollView, TextInput, Modal, Image } from 'react-native';
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

  const [detailsVisible, setDetailsVisible] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'ingredients' | 'nutrients'>('ingredients');

  const [additiveInfoVisible, setAdditiveInfoVisible] = useState(false);
  const [selectedAdditive, setSelectedAdditive] = useState<string | null>(null);

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
      setResult(({
        decision: 'SAFE',
        reason: 'Custom recipe from your ingredients',
        sugarOK: true,
        sodiumOK: true,
        caloriesOK: true
      } as any) as EvaluationResult);
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
        const response = await fetch(
          `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
          ({ timeout: 10000 } as any)
        );
        
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

  const renderSmartAnalysis = (text: string) => {
    const lines = String(text || '')
      .replace(/\r\n/g, '\n')
      .split('\n');

    return (
      <View style={styles.aiFormatted}>
        {lines.map((rawLine, idx) => {
          const line = rawLine.trim();

          if (!line) return <View key={`sp-${idx}`} style={styles.aiSpacer} />;

          const isHeading = /^#{2,3}\s+/.test(line);
          const headingText = isHeading ? line.replace(/^#{2,3}\s+/, '') : '';
          if (isHeading) {
            return (
              <Text key={`h-${idx}`} style={styles.aiHeading}>
                {headingText}
              </Text>
            );
          }

          const isBullet = /^[-*•]\s+/.test(line);
          const bulletText = isBullet ? line.replace(/^[-*•]\s+/, '') : '';
          if (isBullet) {
            return (
              <View key={`b-${idx}`} style={styles.aiBulletRow}>
                <Text style={styles.aiBulletDot}>•</Text>
                <Text style={styles.aiBulletText}>{bulletText}</Text>
              </View>
            );
          }

          return (
            <Text key={`p-${idx}`} style={styles.aiParagraph}>
              {line}
            </Text>
          );
        })}
      </View>
    );
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

  const grade = result.decision === 'SAFE' ? 'A' : result.decision === 'WARNING' ? 'C' : 'E';
  const gradeColor = grade === 'A' ? COLORS.success : grade === 'C' ? COLORS.warning : COLORS.danger;

  const ingredientsText = Array.isArray(food?.ingredients)
    ? food.ingredients.filter(Boolean).join(', ')
    : (food?.ingredients ? String(food.ingredients) : 'Ingredients not listed');

  const allergensList: string[] = Array.isArray(food?.allergens)
    ? food.allergens
    : [];

  const additivesList: string[] = Array.isArray(food?.additives)
    ? food.additives
    : [];

  const getAllergenIcon = (name: string) => {
    const n = String(name).toLowerCase();
    if (n.includes('wheat') || n.includes('gluten')) return '🌾';
    if (n.includes('soy') || n.includes('soya')) return '🫘';
    if (n.includes('milk') || n.includes('dairy')) return '🥛';
    if (n.includes('egg')) return '🥚';
    if (n.includes('peanut') || n.includes('groundnut')) return '🥜';
    if (n.includes('tree nut') || n.includes('almond') || n.includes('cashew')) return '🌰';
    if (n.includes('oat')) return '🌾';
    return '⚠️';
  };

  const getAdditiveRisk = (additive: string) => {
    const a = String(additive).toUpperCase();
    if (a.includes('INS635')) return 'High';
    if (a.includes('INS')) return 'Medium';
    return 'Low';
  };

  const getAdditiveInfo = (additive: string) => {
    const raw = String(additive || '').trim();
    const code = raw.toUpperCase().replace(/\s+/g, '');

    const lookup: Record<string, { title: string; what: string; concerns: string } | undefined> = {
      'INS635': {
        title: 'INS 635 (Disodium 5-ribonucleotides)',
        what: 'A flavour enhancer used to boost umami/savoury taste. Often used with MSG (INS 621).',
        concerns: 'Generally considered safe at typical food levels. Some people may be sensitive to flavour enhancers and report headaches or flushing. People with gout or high uric acid sometimes prefer to limit nucleotide-based enhancers.',
      },
      'INS451(I)': {
        title: 'INS 451(i) (Triphosphates)',
        what: 'Used as a stabilizer/emulsifier and to improve texture and water retention in processed foods.',
        concerns: 'High intake of phosphate additives may be a concern for people with kidney disease. In general, limiting ultra-processed foods helps reduce additive/phosphate intake.',
      },
      'INS451': {
        title: 'INS 451 (Triphosphates)',
        what: 'Used as a stabilizer/emulsifier and to improve texture and water retention in processed foods.',
        concerns: 'High intake of phosphate additives may be a concern for people with kidney disease. In general, limiting ultra-processed foods helps reduce additive/phosphate intake.',
      },
      'INS508': {
        title: 'INS 508 (Potassium chloride)',
        what: 'A mineral salt used as a thickener/stabilizer or as a salt substitute in some foods.',
        concerns: 'Usually safe in normal amounts. People with kidney disease or on potassium-restricted diets should be cautious with extra potassium sources.',
      },
      'INS330': {
        title: 'INS 330 (Citric acid)',
        what: 'An acidity regulator commonly used to add tartness and preserve freshness.',
        concerns: 'Generally safe. In some people it can contribute to mouth irritation or worsen acid sensitivity. Rinsing after acidic foods can help protect teeth.',
      },
      'INS621': {
        title: 'INS 621 (MSG)',
        what: 'A flavour enhancer that boosts savoury taste.',
        concerns: 'Considered safe for most people. A small group may be sensitive and report symptoms like headache or flushing after large amounts.',
      },
    };

    const info = lookup[code] || lookup[code.replace(/^INS/, 'INS')] || undefined;
    if (info) return info;

    return {
      title: raw,
      what: 'Food additive used to improve taste, texture, stability, or shelf life.',
      concerns: 'Safety depends on dose and individual sensitivity. If you have allergies, migraines, kidney issues, or specific medical conditions, consider limiting highly processed foods and check with a clinician for personalized guidance.',
    };
  };

  const base = baseFood || food;
  const nutrientsRows = [
    { label: 'Energy (kcal)', value: base?.calories },
    { label: 'Protein (g)', value: base?.protein },
    { label: 'Carbohydrate (g)', value: base?.carbs },
    { label: 'Total Sugar (g)', value: base?.sugar },
    { label: 'Added Sugar (g)', value: base?.addedSugar },
    { label: 'Total Fat (g)', value: base?.fat },
    { label: 'Saturated Fat (g)', value: base?.saturatedFat },
    { label: 'Trans Fat (g)', value: base?.transFat },
    { label: 'Sodium (mg)', value: base?.sodium },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        removeClippedSubviews
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        
        {/* HEADER CARD WITH MACROS GRID */}
        <View style={styles.card}>
          <View style={styles.productTopRow}>
            {!!food?.image ? (
              <Image
                source={{ uri: String(food.image) }}
                style={styles.productImageSquare}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.productImageSquare} />
            )}

            <View style={styles.productTopInfo}>
              <View style={styles.productTopHeader}>
                <Text style={styles.productName} numberOfLines={2}>{food?.name || "Unknown Food"}</Text>
                <View style={[styles.gradeBadge, { backgroundColor: gradeColor }]}>
                  <Text style={styles.gradeText}>{grade}</Text>
                </View>
              </View>

              <Text style={styles.brandInline}>{food?.brand || "Generic"}</Text>
              <Text style={styles.quantityText}>{String(food?.servingSize || food?.serving_size || portionSize)}{String(food?.servingSize || food?.serving_size || '').toLowerCase().includes('g') ? '' : ' g'}</Text>
            </View>

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
        </View>

        <TouchableOpacity
          style={styles.detailsCard}
          onPress={() => {
            setDetailsTab('ingredients');
            setDetailsVisible(true);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.detailsTitle}>Ingredients & Nutrients</Text>
          <Text style={styles.detailsSubtitle}>Tap to view ingredients, allergens, additives and nutrients per 100g</Text>
        </TouchableOpacity>

        {/* DECISION BOX & AI ANALYSIS */}
        {aiExplanation === "Generating health insights..." ? (
          <View style={styles.aiLoadingContainer}>
            <ActivityIndicator color={COLORS.primary} size="large" />
            <Text style={styles.aiLoadingText}>Generating Response</Text>
          </View>
        ) : (
          <View style={[styles.resultBox, { borderColor: statusColor }]}>
            <View style={styles.aiBox}>
              <Text style={styles.aiLabel}>✨ Smart Analysis</Text>
              {renderSmartAnalysis(
                (aiExplanation && aiExplanation !== "Generating health insights..." 
                  ? aiExplanation 
                  : (result.reason || "Analyzing...") + "\n\n" + aiExplanation) || "Analysis not available"
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={detailsVisible} transparent animationType="slide" onRequestClose={() => setDetailsVisible(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetOverlayTouchable} activeOpacity={1} onPress={() => setDetailsVisible(false)} />
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetTabs}>
              <TouchableOpacity
                style={[styles.sheetTabBtn, detailsTab === 'ingredients' && styles.sheetTabBtnActive]}
                onPress={() => setDetailsTab('ingredients')}
              >
                <Text style={[styles.sheetTabText, detailsTab === 'ingredients' && styles.sheetTabTextActive]}>Ingredients</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetTabBtn, detailsTab === 'nutrients' && styles.sheetTabBtnActive]}
                onPress={() => setDetailsTab('nutrients')}
              >
                <Text style={[styles.sheetTabText, detailsTab === 'nutrients' && styles.sheetTabTextActive]}>Nutrients</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
              {detailsTab === 'ingredients' ? (
                <View>
                  <Text style={styles.sectionTitle}>Ingredients</Text>
                  <Text style={styles.paragraphText}>{ingredientsText}</Text>

                  <Text style={styles.sectionTitle}>Allergens</Text>
                  {allergensList.length === 0 ? (
                    <Text style={styles.paragraphText}>None listed</Text>
                  ) : (
                    <View style={styles.pillsRow}>
                      {allergensList.map((a, idx) => (
                        <View key={`${a}-${idx}`} style={styles.pill}>
                          <Text style={styles.pillText}>{getAllergenIcon(a)} {a}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={styles.sectionTitle}>Additives</Text>
                  {additivesList.length === 0 ? (
                    <Text style={styles.paragraphText}>None listed</Text>
                  ) : (
                    <View style={styles.additivesList}>
                      {additivesList.map((ad, idx) => (
                        <TouchableOpacity
                          key={`${ad}-${idx}`}
                          style={styles.additiveRow}
                          activeOpacity={0.85}
                          onPress={() => {
                            setSelectedAdditive(ad);
                            setAdditiveInfoVisible(true);
                          }}
                        >
                          <Text style={styles.additiveName}>{ad}</Text>
                          <View style={[styles.riskBadge, getAdditiveRisk(ad) === 'Low' ? styles.riskLow : getAdditiveRisk(ad) === 'Medium' ? styles.riskMedium : styles.riskHigh]}>
                            <Text style={styles.riskText}>{getAdditiveRisk(ad)}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                <View>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Nutrient</Text>
                    <Text style={[styles.tableHeaderCell, { width: 110, textAlign: 'right' }]}>Per 100g</Text>
                  </View>

                  {nutrientsRows.map((row) => {
                    const v = row.value;
                    const display = v === undefined || v === null || Number.isNaN(Number(v)) ? '-' : (row.label.includes('(kcal)') || row.label.includes('(mg)') ? String(Math.round(Number(v))) : String(Number(v).toFixed(1)));
                    return (
                      <View key={row.label} style={styles.tableRow}>
                        <Text style={[styles.tableCell, { flex: 1 }]}>{row.label}</Text>
                        <Text style={[styles.tableCell, { width: 110, textAlign: 'right' }]}>{display}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={additiveInfoVisible} transparent animationType="fade" onRequestClose={() => setAdditiveInfoVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.additiveModalCard}>
            <Text style={styles.modalTitle}>{selectedAdditive ? getAdditiveInfo(selectedAdditive).title : 'Additive'}</Text>
            <Text style={styles.additiveModalLabel}>What is it?</Text>
            <Text style={styles.additiveModalText}>{selectedAdditive ? getAdditiveInfo(selectedAdditive).what : ''}</Text>

            <Text style={styles.additiveModalLabel}>Possible concerns</Text>
            <Text style={styles.additiveModalText}>{selectedAdditive ? getAdditiveInfo(selectedAdditive).concerns : ''}</Text>

            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setAdditiveInfoVisible(false)}>
                <Text style={styles.cancelTxt}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* FOOTER */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.button, { backgroundColor: statusColor }]} onPress={logFood}>
          <Text style={styles.btnText}>Eat & Track</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={{ color: COLORS.textSecondary }}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* EDIT NAME MODAL */}
      <Modal visible={editNameModalVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Food Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editedName}
              onChangeText={setEditedName}
              placeholder="Enter food name"
              placeholderTextColor={COLORS.textSecondary}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setEditNameModalVisible(false)}>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  scrollContent: { padding: SPACING.l, paddingBottom: 120 },

  card: { backgroundColor: COLORS.surface, borderRadius: 20, padding: SPACING.l, marginBottom: SPACING.l },
  productTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  productTopInfo: { flex: 1 },
  productTopHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  productImageSquare: { width: 74, height: 74, borderRadius: 14, backgroundColor: '#1A1A1A' },
  productName: { color: COLORS.textPrimary, fontSize: 18, fontWeight: FONTS.bold as any, flex: 1 },
  brandInline: { color: COLORS.textSecondary, fontSize: 13, marginTop: 6 },
  quantityText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
  gradeBadge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  gradeText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  brand: { color: COLORS.textSecondary, fontSize: 14, textTransform: 'uppercase' },
  foodName: { color: COLORS.textPrimary, fontSize: 28, fontWeight: FONTS.bold as any, marginBottom: SPACING.m, flex: 1 },

  // Input screen
  inputContainer: { flex: 1, justifyContent: 'center', padding: SPACING.l },
  title: { color: COLORS.textPrimary, fontSize: 28, fontWeight: 'bold', marginBottom: SPACING.s },
  subtitle: { color: COLORS.textPrimary, fontSize: 18, marginBottom: SPACING.s },
  inputBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: SPACING.l, marginBottom: SPACING.m },
  gramInput: { backgroundColor: COLORS.surface, color: COLORS.textPrimary, padding: SPACING.m, borderRadius: 12, minWidth: 120, textAlign: 'center', fontSize: 20 },
  unit: { color: COLORS.textSecondary, marginLeft: SPACING.m, fontSize: 16 },
  hint: { color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.s },
  mainBtn: { backgroundColor: COLORS.primary, padding: SPACING.l, borderRadius: 16, alignItems: 'center', marginTop: SPACING.l },
  error: { color: COLORS.danger },

  // Result screen
  foodNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editNameBtn: { padding: 8, marginLeft: 8 },

  detailsCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: SPACING.l, marginBottom: SPACING.l, borderWidth: 1, borderColor: '#333' },
  detailsTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold' },
  detailsSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 6, lineHeight: 18 },

  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  macroItem: {
    backgroundColor: '#1A1A1A',
    width: '30%',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    flexGrow: 1,
  },
  macroValue: { color: COLORS.primary, fontSize: 18, fontWeight: 'bold' },
  macroLabel: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },

  resultBox: { borderWidth: 2, borderRadius: 16, padding: SPACING.l, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  aiBox: { marginTop: SPACING.s, backgroundColor: '#1F1F1F', padding: SPACING.l, borderRadius: 16, width: '100%', borderWidth: 1, borderColor: '#333' },
  aiLabel: { color: COLORS.secondary, fontWeight: 'bold', marginBottom: SPACING.m, fontSize: 14, letterSpacing: 0.3 },
  aiLoadingContainer: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.m,
  },
  aiLoadingText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  aiFormatted: { gap: 8 },
  aiSpacer: { height: 8 },
  aiHeading: { color: COLORS.textPrimary, fontSize: 14, fontWeight: 'bold', marginTop: 4 },
  aiParagraph: { color: '#E8E8E8', fontSize: 13.5, lineHeight: 21 },
  aiBulletRow: { flexDirection: 'row', alignItems: 'flex-start' },
  aiBulletDot: { color: COLORS.primary, width: 16, lineHeight: 21, fontSize: 14, marginTop: 0.5 },
  aiBulletText: { color: '#E8E8E8', fontSize: 13.5, lineHeight: 21, flex: 1 },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheetOverlayTouchable: { flex: 1 },
  sheetContainer: { backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: SPACING.l, paddingTop: 10, paddingBottom: SPACING.l, maxHeight: '80%' },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#444', alignSelf: 'center', marginBottom: 10 },
  sheetTabs: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  sheetTabBtn: { flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  sheetTabBtnActive: { backgroundColor: '#1A1A1A', borderColor: COLORS.primary },
  sheetTabText: { color: COLORS.textSecondary, fontWeight: 'bold' },
  sheetTabTextActive: { color: COLORS.textPrimary },
  sheetContent: { paddingBottom: 24 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: 'bold', marginTop: 8, marginBottom: 8 },
  paragraphText: { color: '#E0E0E0', fontSize: 13, lineHeight: 20 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  pillText: { color: COLORS.textPrimary, fontSize: 12 },
  additivesList: { gap: 10 },
  additiveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  additiveName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: 'bold' },
  riskBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  riskText: { color: '#000', fontSize: 12, fontWeight: 'bold' },
  riskLow: { backgroundColor: COLORS.success },
  riskMedium: { backgroundColor: COLORS.warning },
  riskHigh: { backgroundColor: COLORS.danger },
  tableHeaderRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#333' },
  tableHeaderCell: { color: COLORS.textSecondary, fontSize: 12, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  tableCell: { color: COLORS.textPrimary, fontSize: 13 },

  // Footer (smaller)
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.surface, padding: SPACING.m, borderTopWidth: 1, borderTopColor: '#333' },
  button: { paddingVertical: SPACING.m, paddingHorizontal: SPACING.l, borderRadius: 16, alignItems: 'center' },
  btnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { alignItems: 'center', paddingVertical: SPACING.s, paddingHorizontal: SPACING.m, marginTop: SPACING.s },

  // Edit Name Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: SPACING.l, width: '80%', borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold', marginBottom: SPACING.m },
  modalInput: { backgroundColor: '#1A1A1A', borderRadius: 8, padding: SPACING.m, color: COLORS.textPrimary, marginBottom: SPACING.l, borderWidth: 1, borderColor: COLORS.primary },
  modalBtns: { flexDirection: 'row', gap: SPACING.m, justifyContent: 'flex-end' },
  saveBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.l, paddingVertical: SPACING.s, borderRadius: 8 },
  saveTxt: { color: '#000', fontWeight: 'bold' },
  cancelTxt: { color: COLORS.textSecondary },

  additiveModalCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: SPACING.l, width: '88%', borderWidth: 1, borderColor: '#333' },
  additiveModalLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: 'bold', marginTop: 6, marginBottom: 6 },
  additiveModalText: { color: '#E0E0E0', fontSize: 13, lineHeight: 20 },
});