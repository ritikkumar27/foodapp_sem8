// src/screens/OnboardingScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Circle } from 'react-native-svg';
import { doc, setDoc, getDoc } from 'firebase/firestore'; // [UPDATED] Added getDoc
import { auth, db } from '../services/firebaseConfig';
import { COLORS, SPACING, FONTS } from '../constants/theme';
import { calculateDailyNutritionGoals, calculateBMI } from '../services/nutritionCalculator';

export default function OnboardingScreen({ navigation }: any) {
  const TOTAL_STEPS = 12;
  const PROFILE_VERSION = 2;
  const [step, setStep] = useState(1); // 1: Age, 2: Height, 3: Weight, 4: Identity, 5: Metrics, 6: Diseases, 7: Meds, 8: Diet, 9: Allergies, 10: Lifestyle, 11: Goals, 12: Consent
  const [loading, setLoading] = useState(true); // Start true to check profile first

  // Data State
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | 'Prefer not to say' | ''>('');
  const [waist, setWaist] = useState('');
  const [activityLevel, setActivityLevel] = useState<'Sedentary' | 'Lightly active' | 'Moderately active' | 'Very active' | ''>('');
  const [diseases, setDiseases] = useState<string[]>([]);
  const [onMedication, setOnMedication] = useState<'Yes' | 'No' | ''>('');
  const [medCategories, setMedCategories] = useState<string[]>([]);
  const [medTiming, setMedTiming] = useState<'Before food' | 'After food' | 'Anytime' | ''>('');
  const [dietPattern, setDietPattern] = useState<'Vegetarian' | 'Eggetarian' | 'Non-vegetarian' | 'Vegan' | ''>('');
  const [fastingHabit, setFastingHabit] = useState<'Yes' | 'No' | ''>('');
  const [fastingType, setFastingType] = useState<'Intermittent fasting' | 'Religious fasting' | ''>('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [smoking, setSmoking] = useState<'Never' | 'Former' | 'Current' | ''>('');
  const [alcohol, setAlcohol] = useState<'Never' | 'Occasionally' | 'Weekly' | 'Daily' | ''>('');
  const [sleepHours, setSleepHours] = useState('');
  const [stressLevel, setStressLevel] = useState<'Low' | 'Medium' | 'High' | ''>('');
  const [packagedFoodFrequency, setPackagedFoodFrequency] = useState<'Rare' | '1–2× weekly' | '3–5× weekly' | 'Daily' | ''>('');
  const [healthGoals, setHealthGoals] = useState<string[]>([]);
  const [consentPersonalization, setConsentPersonalization] = useState(false);
  const [consentNoDiagnosis, setConsentNoDiagnosis] = useState(false);
  const [consentDataUsage, setConsentDataUsage] = useState(false);
  const [consentDeleteAnytime, setConsentDeleteAnytime] = useState(false);

  const genderOptions: Array<'Male' | 'Female' | 'Other' | 'Prefer not to say'> = ['Male', 'Female', 'Other', 'Prefer not to say'];
  const activityOptions: Array<'Sedentary' | 'Lightly active' | 'Moderately active' | 'Very active'> = ['Sedentary', 'Lightly active', 'Moderately active', 'Very active'];
  const diseaseOptions = [
    'Diabetes (Type 1)',
    'Diabetes (Type 2)',
    'Pre-diabetic',
    'Hypertension',
    'Hypotension',
    'Cardiovascular disease',
    'Obesity',
    'Thyroid disorders',
    'PCOS / PCOD',
    'Kidney disease',
    'Liver disease',
    'Gout',
    'Anemia',
    'Asthma',
    'Lactose intolerance',
    'Gluten sensitivity',
    'HIV/AIDS',
    'None',
    'Prefer not to disclose'
  ];
  const medCategoryOptions = ['Insulin', 'Blood pressure meds', 'Thyroid meds', 'Steroids', 'Immunosuppressants'];
  const medTimingOptions: Array<'Before food' | 'After food' | 'Anytime'> = ['Before food', 'After food', 'Anytime'];
  const dietOptions: Array<'Vegetarian' | 'Eggetarian' | 'Non-vegetarian' | 'Vegan'> = ['Vegetarian', 'Eggetarian', 'Non-vegetarian', 'Vegan'];
  const fastingYesNoOptions: Array<'Yes' | 'No'> = ['Yes', 'No'];
  const fastingTypeOptions: Array<'Intermittent fasting' | 'Religious fasting'> = ['Intermittent fasting', 'Religious fasting'];
  const allergyOptions = ['Milk / Dairy', 'Nuts', 'Soy', 'Gluten', 'Eggs', 'Seafood', 'Artificial colors', 'Artificial sweeteners', 'Preservatives', 'None'];
  const smokingOptions: Array<'Never' | 'Former' | 'Current'> = ['Never', 'Former', 'Current'];
  const alcoholOptions: Array<'Never' | 'Occasionally' | 'Weekly' | 'Daily'> = ['Never', 'Occasionally', 'Weekly', 'Daily'];
  const stressOptions: Array<'Low' | 'Medium' | 'High'> = ['Low', 'Medium', 'High'];
  const packagedFoodOptions: Array<'Rare' | '1–2× weekly' | '3–5× weekly' | 'Daily'> = ['Rare', '1–2× weekly', '3–5× weekly', 'Daily'];
  const goalOptions = ['Maintain health', 'Stay fit', 'Fat loss', 'Muscle building', 'Gain weight', 'Reduce sugar intake', 'Reduce salt intake', 'Improve heart health', 'Improve digestion', 'Improve kidney health', 'Improve immunity'];

  // [NEW] Safety Check: If profile exists, skip Onboarding
  useEffect(() => {
    const checkExistingProfile = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const docRef = doc(db, "user_profiles", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data: any = docSnap.data();
            if (data?.profileVersion && data.profileVersion >= PROFILE_VERSION) {
              // Profile is already upgraded.
              navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' }],
              });
              return;
            }

            // Prefill what we can from an older profile.
            if (data?.age) setAge(String(data.age));
            if (data?.height) setHeight(String(data.height));
            if (data?.weight) setWeight(String(data.weight));
            if (Array.isArray(data?.diseases)) setDiseases(data.diseases);
          }
        } catch (e) {
          console.log("Error checking profile:", e);
        }
      }
      // No profile found? Allow them to start onboarding.
      setLoading(false);
    };

    checkExistingProfile();
  }, []);

  const handleNext = async () => {
    // Validation
    if (step === 1 && !age) return Alert.alert("Required", "Please enter your age.");
    if (step === 2 && !height) return Alert.alert("Required", "Please enter your height.");
    if (step === 3 && !weight) return Alert.alert("Required", "Please enter your weight.");
    if (step === 4) {
      if (!dob) return Alert.alert("Required", "Please enter your date of birth.");
      if (!gender) return Alert.alert("Required", "Please select your gender.");
    }
    if (step === 5) {
      if (!activityLevel) return Alert.alert("Required", "Please select your activity level.");
    }
    if (step === 6) {
      // Diseases prompt is mandatory, but allow skip by choosing one of the safe options.
      if (diseases.length === 0) return Alert.alert("Required", "Please select at least one option (e.g., None / Prefer not to disclose).");
    }
    if (step === 7) {
      if (!onMedication) return Alert.alert("Required", "Please choose Yes or No.");
      if (onMedication === 'Yes') {
        if (medCategories.length === 0) return Alert.alert("Required", "Please select at least one medication category.");
        if (!medTiming) return Alert.alert("Required", "Please select timing sensitivity.");
      }
    }
    if (step === 8) {
      if (!dietPattern) return Alert.alert("Required", "Please select your dietary pattern.");
      if (!fastingHabit) return Alert.alert("Required", "Please select Yes or No for fasting habits.");
      if (fastingHabit === 'Yes' && !fastingType) return Alert.alert("Required", "Please select your fasting type.");
    }
    if (step === 9) {
      if (allergies.length === 0) return Alert.alert("Required", "Please select at least one option (e.g., None).");
    }
    if (step === 10) {
      if (!smoking) return Alert.alert("Required", "Please select your smoking status.");
      if (!alcohol) return Alert.alert("Required", "Please select your alcohol consumption.");
      if (!sleepHours) return Alert.alert("Required", "Please enter your average sleep duration.");
      if (!stressLevel) return Alert.alert("Required", "Please select your stress level.");
      if (!packagedFoodFrequency) return Alert.alert("Required", "Please select packaged food consumption frequency.");
    }
    if (step === 11) {
      if (healthGoals.length === 0) return Alert.alert("Required", "Please select at least one health goal.");
    }
    if (step === 12) {
      if (!consentPersonalization || !consentNoDiagnosis || !consentDataUsage || !consentDeleteAnytime) {
        return Alert.alert("Required", "Please accept all consent items to continue.");
      }
    }

    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      // Final Step: Save to Firestore
      finishOnboarding();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const toggleDisease = (d: string) => {
    if (d === "None" || d === "Prefer not to disclose") {
      setDiseases([d]);
    } else {
      let newDiseases = diseases.filter(item => item !== "None" && item !== "Prefer not to disclose");
      if (newDiseases.includes(d)) {
        newDiseases = newDiseases.filter(item => item !== d);
      } else {
        newDiseases.push(d);
      }
      setDiseases(newDiseases.length > 0 ? newDiseases : ["None"]);
    }
  };

  const toggleMulti = (value: string, current: string[], setFn: (v: string[]) => void, exclusiveValue?: string) => {
    if (exclusiveValue && value === exclusiveValue) {
      setFn([exclusiveValue]);
      return;
    }

    let next = exclusiveValue ? current.filter(x => x !== exclusiveValue) : [...current];
    if (next.includes(value)) {
      next = next.filter(x => x !== value);
    } else {
      next = [...next, value];
    }
    setFn(next.length > 0 ? next : (exclusiveValue ? [exclusiveValue] : []));
  };

  function formatDob(input: string) {
    const digits = input.replace(/[^0-9]/g, '').slice(0, 8);
    const dd = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const yyyy = digits.slice(4, 8);
    if (digits.length <= 2) return dd;
    if (digits.length <= 4) return `${dd}/${mm}`;
    return `${dd}/${mm}/${yyyy}`;
  }

  const finishOnboarding = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Parse user inputs
      const weightKg = parseFloat(weight);
      const heightCm = parseFloat(height);
      const ageYears = parseInt(age);

      // Calculate BMI
      const bmi = calculateBMI(weightKg, heightCm);

      // Check if user has hypertension for sodium limit adjustment
      const hasHypertension = diseases.includes("Hypertension");

      // Calculate daily nutrition goals based on maintenance calories
      const nutritionGoals = calculateDailyNutritionGoals(
        weightKg,
        heightCm,
        ageYears,
        gender === 'Female' ? 'female' : 'male',
        hasHypertension
      );

      // Create the User Profile Document
      await setDoc(doc(db, "user_profiles", user.uid), {
        // USE THE AUTH DISPLAY NAME WE SAVED IN SIGNUP
        name: user.displayName || user.email?.split('@')[0] || "User",
        email: user.email,
        profileVersion: PROFILE_VERSION,
        age: ageYears,
        dob,
        gender,
        height: heightCm,
        weight: weightKg,
        waist: waist ? parseFloat(waist) : null,
        activityLevel,
        diseases: diseases.length > 0 ? diseases : ["None"],
        medication: {
          onMedication,
          categories: onMedication === 'Yes' ? medCategories : [],
          timingSensitivity: onMedication === 'Yes' ? medTiming : ''
        },
        diet: {
          pattern: dietPattern,
          fastingHabits: fastingHabit,
          fastingType: fastingHabit === 'Yes' ? fastingType : ''
        },
        allergies: allergies.length > 0 ? allergies : ["None"],
        lifestyle: {
          smoking,
          alcohol,
          sleepHours: sleepHours ? parseFloat(sleepHours) : null,
          stressLevel
        },
        dailyFoodBehavior: {
          packagedFoodFrequency,
        },
        healthGoals,
        consent: {
          personalization: consentPersonalization,
          noDiagnosis: consentNoDiagnosis,
          dataUsage: consentDataUsage,
          deleteAnytime: consentDeleteAnytime
        },
        bmi: bmi,
        // NEW: Save calculated daily goals and macro limits
        dailyNutritionGoals: {
          calories: nutritionGoals.calories,
          protein: nutritionGoals.protein,

          carbs: nutritionGoals.carbs,
          fat: nutritionGoals.fat,
          sugar: nutritionGoals.sugar,
          sodium: nutritionGoals.sodium,
        },
      });

      // Navigate to the Main App
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not save profile.");
    } finally {
      setLoading(false);
    }
  };

  // If we are checking the database, show a loader instead of the form
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // UI Components for each step
  const renderStepContent = () => {
    switch (step) {
      case 1:

        return (
          <>
            <Text style={styles.question}>How old are you?</Text>
            <TextInput
              style={styles.input}
              placeholder="Age (years)"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="number-pad"
              value={age}
              onChangeText={setAge}
              autoFocus
            />
          </>
        );
      case 2:

        return (
          <>
            <Text style={styles.question}>How tall are you?</Text>
            <TextInput
              style={styles.input}
              placeholder="Height (cm)"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="number-pad"
              value={height}
              onChangeText={setHeight}
              autoFocus
            />
          </>
        );
      case 3:

        return (
          <>
            <Text style={styles.question}>What is your weight?</Text>
            <TextInput
              style={styles.input}
              placeholder="Weight (kg)"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="number-pad"
              value={weight}
              onChangeText={setWeight}
              autoFocus
            />
          </>
        );
      case 4:
        return (
          <>
            <Text style={styles.question}>Your identity</Text>
            <Text style={styles.subtext}>We use this for personalizing nutrition thresholds.</Text>
            <TextInput
              style={styles.inputSmall}
              placeholder="Date of Birth (DD/MM/YYYY)"
              placeholderTextColor={COLORS.textSecondary}
              value={dob}
              onChangeText={(t) => setDob(formatDob(t))}
              keyboardType="number-pad"
              maxLength={10}
              autoCapitalize="none"
            />
            <Text style={styles.label}>Gender</Text>
            <View style={styles.chipContainer}>
              {genderOptions.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, gender === g && styles.chipActive]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );
      case 5:
        return (
          <>
            <Text style={styles.question}>Body metrics</Text>
            <Text style={styles.subtext}>Optional waist helps assess cardiometabolic risk.</Text>
            <TextInput
              style={styles.inputSmall}
              placeholder="Waist circumference (cm) (optional)"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="number-pad"
              value={waist}
              onChangeText={setWaist}
              autoFocus
            />
            <Text style={styles.label}>Activity level</Text>
            <View style={styles.chipContainer}>
              {activityOptions.map(a => (
                <TouchableOpacity
                  key={a}
                  style={[styles.chip, activityLevel === a && styles.chipActive]}
                  onPress={() => setActivityLevel(a)}
                >
                  <Text style={[styles.chipText, activityLevel === a && styles.chipTextActive]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );
      case 6:
        return (
          <>
            <Text style={styles.question}>Medical conditions</Text>
            <Text style={styles.subtext}>This is for food suitability guidance, not medical diagnosis.</Text>
            <ScrollView contentContainerStyle={styles.scrollChips}>
              {diseaseOptions.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.chip, diseases.includes(d) && styles.chipActive]}
                  onPress={() => toggleDisease(d)}
                >
                  <Text style={[styles.chipText, diseases.includes(d) && styles.chipTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        );
      case 7:
        return (
          <>
            <Text style={styles.question}>Medication intake</Text>
            <Text style={styles.subtext}>Are you on regular medication?</Text>
            <View style={styles.chipContainer}>
              {['Yes', 'No'].map(v => (
                <TouchableOpacity
                  key={v}
                  style={[styles.chip, onMedication === v && styles.chipActive]}
                  onPress={() => setOnMedication(v as any)}
                >
                  <Text style={[styles.chipText, onMedication === v && styles.chipTextActive]}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {onMedication === 'Yes' && (
              <>
                <Text style={styles.label}>Medicine category (not brand)</Text>
                <View style={styles.chipContainer}>
                  {medCategoryOptions.map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.chip, medCategories.includes(m) && styles.chipActive]}
                      onPress={() => toggleMulti(m, medCategories, setMedCategories)}
                    >
                      <Text style={[styles.chipText, medCategories.includes(m) && styles.chipTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Timing sensitivity</Text>
                <View style={styles.chipContainer}>
                  {medTimingOptions.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.chip, medTiming === t && styles.chipActive]}
                      onPress={() => setMedTiming(t)}
                    >
                      <Text style={[styles.chipText, medTiming === t && styles.chipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        );
      case 8:
        return (
          <>
            <Text style={styles.question}>Diet pattern</Text>
            <Text style={styles.subtext}>This helps us personalize protein, iron, B12 logic.</Text>
            <View style={styles.chipContainer}>
              {dietOptions.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, dietPattern === p && styles.chipActive]}
                  onPress={() => setDietPattern(p)}
                >
                  <Text style={[styles.chipText, dietPattern === p && styles.chipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Fasting habits</Text>
            <View style={styles.chipContainer}>
              {fastingYesNoOptions.map(v => (
                <TouchableOpacity
                  key={v}
                  style={[styles.chip, fastingHabit === v && styles.chipActive]}
                  onPress={() => {
                    setFastingHabit(v);
                    if (v === 'No') setFastingType('');
                  }}
                >
                  <Text style={[styles.chipText, fastingHabit === v && styles.chipTextActive]}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {fastingHabit === 'Yes' && (
              <>
                <Text style={styles.label}>Fasting type</Text>
                <View style={styles.chipContainer}>
                  {fastingTypeOptions.map(ft => (
                    <TouchableOpacity
                      key={ft}
                      style={[styles.chip, fastingType === ft && styles.chipActive]}
                      onPress={() => setFastingType(ft)}
                    >
                      <Text style={[styles.chipText, fastingType === ft && styles.chipTextActive]}>{ft}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        );
      case 9:
        return (
          <>
            <Text style={styles.question}>Allergies</Text>
            <Text style={styles.subtext}>Select all that apply. Choose None if not applicable.</Text>
            <ScrollView contentContainerStyle={styles.scrollChips}>
              {allergyOptions.map(a => (
                <TouchableOpacity
                  key={a}
                  style={[styles.chip, allergies.includes(a) && styles.chipActive]}
                  onPress={() => toggleMulti(a, allergies, setAllergies, 'None')}
                >
                  <Text style={[styles.chipText, allergies.includes(a) && styles.chipTextActive]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        );
      case 10:
        return (
          <>
            <Text style={styles.question}>Lifestyle</Text>
            <Text style={styles.label}>Smoking</Text>
            <View style={styles.chipContainer}>
              {smokingOptions.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, smoking === s && styles.chipActive]}
                  onPress={() => setSmoking(s)}
                >
                  <Text style={[styles.chipText, smoking === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Alcohol</Text>
            <View style={styles.chipContainer}>
              {alcoholOptions.map(a => (
                <TouchableOpacity
                  key={a}
                  style={[styles.chip, alcohol === a && styles.chipActive]}
                  onPress={() => setAlcohol(a)}
                >
                  <Text style={[styles.chipText, alcohol === a && styles.chipTextActive]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ marginBottom: SPACING.m }} />

            <TextInput
              style={styles.inputSmall}
              placeholder="Average sleep duration (hours)"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="decimal-pad"
              value={sleepHours}
              onChangeText={setSleepHours}
            />

            <Text style={styles.label}>Stress level</Text>
            <View style={styles.chipContainer}>
              {stressOptions.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, stressLevel === s && styles.chipActive]}
                  onPress={() => setStressLevel(s)}
                >
                  <Text style={[styles.chipText, stressLevel === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Packaged food frequency</Text>
            <View style={styles.chipContainer}>
              {packagedFoodOptions.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, packagedFoodFrequency === p && styles.chipActive]}
                  onPress={() => setPackagedFoodFrequency(p)}
                >
                  <Text style={[styles.chipText, packagedFoodFrequency === p && styles.chipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );
      case 11:
        return (
          <>
            <Text style={styles.question}>Health goals</Text>
            <Text style={styles.subtext}>Select goals for preventive health guidance.</Text>
            <ScrollView contentContainerStyle={styles.scrollChips}>
              {goalOptions.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, healthGoals.includes(g) && styles.chipActive]}
                  onPress={() => toggleMulti(g, healthGoals, setHealthGoals)}
                >
                  <Text style={[styles.chipText, healthGoals.includes(g) && styles.chipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        );
      case 12:
        return (
          <>
            <Text style={styles.question}>Consent</Text>
            <Text style={styles.subtext}>You can delete your data anytime in Profile.</Text>

            <TouchableOpacity style={styles.checkRow} onPress={() => setConsentPersonalization(!consentPersonalization)}>
              <View style={[styles.checkbox, consentPersonalization && styles.checkboxChecked]} />
              <Text style={styles.checkText}>Use health data for personalized guidance</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.checkRow} onPress={() => setConsentNoDiagnosis(!consentNoDiagnosis)}>
              <View style={[styles.checkbox, consentNoDiagnosis && styles.checkboxChecked]} />
              <Text style={styles.checkText}>No medical diagnosis claim</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.checkRow} onPress={() => setConsentDataUsage(!consentDataUsage)}>
              <View style={[styles.checkbox, consentDataUsage && styles.checkboxChecked]} />
              <Text style={styles.checkText}>Data usage transparency</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.checkRow} onPress={() => setConsentDeleteAnytime(!consentDeleteAnytime)}>
              <View style={[styles.checkbox, consentDeleteAnytime && styles.checkboxChecked]} />
              <Text style={styles.checkText}>Option to delete data anytime</Text>
            </TouchableOpacity>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress Ring */}
      <View style={styles.progressRingContainer}>
        <Svg width={40} height={40}>
          {/* Background Circle */}
          <Circle
            cx={20}
            cy={20}
            r={16}
            stroke="#333"
            strokeWidth={4}
            fill="transparent"
          />
          {/* Progress Circle */}
          <Circle
            cx={20}
            cy={20}
            r={16}
            stroke={COLORS.primary}
            strokeWidth={4}
            strokeDasharray={100.48}
            strokeDashoffset={100.48 - ((step / TOTAL_STEPS) * 100.48)}
            strokeLinecap="round"
            fill="transparent"
            rotation="-90"
            origin="20, 20"
          />
        </Svg>
        <View style={styles.progressTextContainer}>
          <Text style={styles.progressText}>{step}/{TOTAL_STEPS}</Text>
        </View>
      </View>

      <View style={styles.topNav}>
        <TouchableOpacity onPress={handleBack} disabled={step === 1} style={[styles.navBtn, step === 1 && styles.navBtnDisabled]}>
          <Text style={styles.navText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNext} disabled={loading} style={styles.navBtnPrimary}>
          <Text style={styles.navTextPrimary}>{step === TOTAL_STEPS ? 'Finish' : 'Next'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderStepContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  progressRingContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.m,
  },
  progressTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    color: COLORS.textPrimary,
    fontSize: 10,
    fontWeight: 'bold',
  },

  topNav: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.l, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navBtn: { paddingVertical: SPACING.s, paddingHorizontal: SPACING.m },
  navBtnDisabled: { opacity: 0.3 },
  navText: { color: COLORS.textSecondary, fontSize: 16 },
  navBtnPrimary: { backgroundColor: COLORS.primary, paddingVertical: SPACING.s, paddingHorizontal: SPACING.l, borderRadius: 18 },
  navTextPrimary: { color: '#000', fontWeight: 'bold', fontSize: 16 },

  content: { padding: SPACING.xl, paddingTop: SPACING.l, paddingBottom: SPACING.xl, flexGrow: 1 },

  question: { fontSize: 32, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: SPACING.l },
  subtext: { fontSize: 16, color: COLORS.textSecondary, marginBottom: SPACING.xl },
  label: { fontSize: 14, color: COLORS.textSecondary, marginTop: SPACING.l, marginBottom: SPACING.m },

  input: {
    fontSize: 40,
    color: COLORS.primary,
    borderBottomWidth: 2,

    borderBottomColor: COLORS.primary,
    paddingBottom: SPACING.s,
    textAlign: 'center'
  },

  inputSmall: {
    fontSize: 18,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    marginTop: SPACING.m
  },

  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chip: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, borderWidth: 1, borderColor: '#444', backgroundColor: COLORS.surface },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.textSecondary, fontSize: 16 },
  chipTextActive: { color: '#000', fontWeight: 'bold' },

  scrollChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: SPACING.xl },

  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.m },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: '#444', marginRight: SPACING.m, backgroundColor: 'transparent' },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkText: { color: COLORS.textPrimary, fontSize: 16, flex: 1 }
});