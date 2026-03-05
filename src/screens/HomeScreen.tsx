// src/screens/HomeScreen.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { auth, db } from '../services/firebaseConfig';
import { COLORS, SPACING, FONTS } from '../constants/theme';
import FoodList from '../components/FoodList'; 
import { calculateDailyNutritionGoals, calculateBMI } from '../services/nutritionCalculator';

// Fallback Daily Goals (used if user profile doesn't have personalized goals)
const DEFAULT_GOALS = {
  calories: 2000,
  protein: 60,
  carbs: 250,
  fat: 70,
  sugar: 30,
  sodium: 2300
};

export default function HomeScreen({ navigation }: any) {
  const [user, setUser] = useState<any>(null);
  const [goals, setGoals] = useState<any>(DEFAULT_GOALS);
  const [intake, setIntake] = useState<any>({ calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, sodium: 0 });
  const [refreshing, setRefreshing] = useState(false);
  
  // New state to trigger re-renders when food is modified
  const [refreshKey, setRefreshKey] = useState(0); 

  // Helper to get consistent date string
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  // Load User & Data
  const fetchData = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      // 1. Get User Profile and Nutrition Goals
      const userDoc = await getDoc(doc(db, "user_profiles", currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUser(userData);
        
        // Try to get personalized nutrition goals
        let userGoals = userData.dailyNutritionGoals;
        
        // Fallback: if goals don't exist, calculate them
        if (!userGoals) {
          console.log("📊 Calculating personalized goals for user...");
          const hasHypertension = (userData.diseases || []).includes("Hypertension");
          userGoals = calculateDailyNutritionGoals(
            userData.weight,
            userData.height,
            userData.age,
            "male",
            hasHypertension
          );
        }
        
        setGoals({
          calories: userGoals.calories,
          protein: userGoals.protein,
          carbs: userGoals.carbs,
          fat: userGoals.fat,
          sugar: userGoals.sugar,
          sodium: userGoals.sodium
        });
        
        console.log("✅ User goals loaded:", userGoals);
      }

      // 2. Get Today's Intake 
      const today = getTodayDate();
      const intakeRef = doc(db, 'users', currentUser.uid, 'daily_summaries', today);
      const intakeSnap = await getDoc(intakeRef);

      if (intakeSnap.exists()) {
        const data = intakeSnap.data();
        setIntake({
          calories: data.totalCalories || 0,
          protein: data.totalProtein || 0,
          carbs: data.totalCarbs || 0,
          fat: data.totalFat || 0,
          sugar: data.totalSugar || 0,
          sodium: data.totalSodium || 0
        });
      } else {
        setIntake({ calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, sodium: 0 });
      }
    } catch (error) {
      console.error("❌ Error fetching home data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Callback passed to FoodList: runs when you delete/edit food
  const handleDataUpdate = () => {
    setRefreshKey(prev => prev + 1); // Trigger refresh
    fetchData(); // Reload macros
  };

  // [UPDATED] This runs every time the screen comes into focus (e.g., coming back from Scan)
  useFocusEffect(
    useCallback(() => {
      fetchData(); // Reload the Macro Charts
      setRefreshKey(prev => prev + 1); // Force the FoodList component to reload
    }, [])
  );

  // Helper Component for Circular Progress Rings
  const MacroRing = ({ label, value, max, color }: any) => {
    const progress = Math.min(value / max, 1);
    const size = 70; // Reduced size to make rings smaller
    const strokeWidth = 8; // Reduced strokeWidth proportionally
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (progress * circumference);
    const percentage = Math.round(progress * 100);
    
    return (
      <View style={styles.macroRingContainer}>
        <View style={styles.ringWrapper}>
          <Svg width={size} height={size}>
            {/* Background Circle */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#333" // Darker background stroke
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Progress Circle */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              rotation="-90"
              origin={`${size / 2}, ${size / 2}`}
            />
          </Svg>
          <View style={styles.ringTextContainer}>
            <Text style={styles.ringValue}>{percentage}%</Text>
          </View>
        </View>
        <Text style={styles.ringLabel}>{label}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchData()}} tintColor={COLORS.primary}/>}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.username}>{user?.name || "Friend"}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.avatarBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.avatarText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Main Calorie Card with Bar */}
        <LinearGradient
          colors={[`${COLORS.primary}60`, `${COLORS.primary}40`, `${COLORS.primary}20`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.calorieCard, { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }]}
        >
          <View style={styles.calorieContent}>
            <Text style={styles.calorieLabel}>CALORIES</Text>
            <View style={styles.calorieNumbers}>
              <Text style={styles.calorieCurrent}>{Math.round(intake.calories)}</Text>
              <Text style={styles.calorieGoal}>/ {goals.calories}</Text>
            </View>
            <View style={styles.calorieBarContainer}>
              <View style={styles.calorieBarBg}>
                <View style={[styles.calorieBarFill, { width: `${Math.min((intake.calories / goals.calories) * 100, 100)}%` }]} />
              </View>
            </View>
            
          </View>
        </LinearGradient>

        {/* Macros Section */}
        <Text style={styles.sectionTitle}>Daily Macros</Text>
        
        <View style={styles.statsGrid}>
          <MacroRing label="PRO" value={intake.protein || 0} max={goals.protein} color="#4A90E2" />
          <MacroRing label="CARB" value={intake.carbs || 0} max={goals.carbs} color="#FFD166" />
          <MacroRing label="FAT" value={intake.fat || 0} max={goals.fat} color="#FF6B9D" />
          <MacroRing label="SODIUM" value={intake.sodium || 0} max={goals.sodium} color="#4CAF50" />
        </View>

        {/* Food List Component */}
        <FoodList 
            currentDate={getTodayDate()} 
            refreshTrigger={refreshKey} 
            onUpdate={handleDataUpdate}
            navigation={navigation}
        />

        {/* Spacer */}
        <View style={{ height: 20 }} />

        {/* Daily Tip */}
        <View style={styles.tipBox}>
           <Text style={styles.tipTitle}>💡 Daily Tip</Text>
           <Text style={styles.tipText}>Prioritize protein in morning to keep energy stable throughout the day.</Text>
        </View>
        
        {/* Bottom Spacer for scrolling */}
        <View style={{ height: 40 }} />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.m },
  
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: SPACING.l 
  },
  greeting: { color: COLORS.textSecondary, fontSize: 16 },
  username: { color: COLORS.textPrimary, fontSize: 24, fontWeight: 'bold' },
  
  avatarBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary
  },
  avatarText: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: 'bold'
  },
  calorieCard: { 
    backgroundColor: COLORS.surface, 
    borderRadius: 20, 
    padding: SPACING.xl, 
    alignItems: 'center', 
    marginBottom: SPACING.xl, 
    borderWidth: 1, 
    borderColor: '#333' 
  },
  calorieContent: {
    alignItems: 'center',
    width: '100%',
    padding:25
  },
  calorieLabel: { 
    color: COLORS.textPrimary, 
    fontSize: 14, 
    textTransform: 'uppercase', 
    marginBottom: SPACING.m,
    fontWeight: 'bold'
  },
  calorieBarContainer: {
    width: '100%',
    marginBottom: SPACING.s,
  },
  calorieBarBg: {
    height: 8,
    backgroundColor: "#333",
    borderRadius: 5,
  },
  calorieBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 5,
  },
  calorieNumbers: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    alignItems:"baseline",
    paddingBottom: 10,
  },
  calorieCurrent: { 
    color: COLORS.primary, 
    fontSize: 80, 
    fontWeight: 'bold' 
  },
  calorieGoal: { 
    color: COLORS.textPrimary, 
    fontSize: 16 ,
  },
  
  sectionTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold', marginBottom: SPACING.m },
  statsGrid: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl 
  },
  
  // Ring styles for macros
  macroRingContainer: {
    width: 70, // Match the smaller ring size
    alignItems: 'center',
  },
  ringWrapper: {
    position: 'relative',
    marginBottom: SPACING.s,
  },
  ringTextContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  ringUnit: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },
  ringLabel: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  ringMax: {
    color: COLORS.textSecondary,
    fontSize: 10,
    textAlign: 'center',
  },
  
  tipBox: { backgroundColor: '#1A1A1A', padding: SPACING.m, borderRadius: 12 },
  tipTitle: { color: COLORS.primary, fontWeight: 'bold', marginBottom: 4 },
  tipText: { color: COLORS.textSecondary, lineHeight: 20 }
});