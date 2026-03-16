import React, { useEffect, useState, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { auth, db } from '../services/firebaseConfig';
import { reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { COLORS, SPACING, FONTS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { calculateDailyNutritionGoals, calculateBMI } from '../services/nutritionCalculator';

export default function ProfileScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Delete Account Modal State
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // Profile State
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [diseases, setDiseases] = useState<string[]>([]);
  const [bmi, setBmi] = useState(0);

  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | 'Prefer not to say' | ''>('');
  const [waist, setWaist] = useState('');
  const [activityLevel, setActivityLevel] = useState<'Sedentary' | 'Lightly active' | 'Moderately active' | 'Very active' | ''>('');

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

  const diseaseOptions = ["Diabetes", "Hypertension", "Celiac", "None"];

  const genderOptions: Array<'Male' | 'Female' | 'Other' | 'Prefer not to say'> = ['Male', 'Female', 'Other', 'Prefer not to say'];
  const activityOptions: Array<'Sedentary' | 'Lightly active' | 'Moderately active' | 'Very active'> = ['Sedentary', 'Lightly active', 'Moderately active', 'Very active'];
  const yesNoOptions: Array<'Yes' | 'No'> = ['Yes', 'No'];

  const medCategoryOptions = ['Diabetes', 'Blood pressure', 'Thyroid', 'Steroids', 'Painkillers', 'Antibiotics', 'Other'];
  const medTimingOptions: Array<'Before food' | 'After food' | 'Anytime'> = ['Before food', 'After food', 'Anytime'];

  const dietPatternOptions: Array<'Vegetarian' | 'Eggetarian' | 'Non-vegetarian' | 'Vegan'> = ['Vegetarian', 'Eggetarian', 'Non-vegetarian', 'Vegan'];
  const fastingTypeOptions: Array<'Intermittent fasting' | 'Religious fasting'> = ['Intermittent fasting', 'Religious fasting'];

  const allergyOptions = ['Milk', 'Eggs', 'Peanuts', 'Tree nuts', 'Soy', 'Wheat/Gluten', 'Fish', 'Shellfish', 'Sesame', 'None'];
  const smokingOptions: Array<'Never' | 'Former' | 'Current'> = ['Never', 'Former', 'Current'];
  const alcoholOptions: Array<'Never' | 'Occasionally' | 'Weekly' | 'Daily'> = ['Never', 'Occasionally', 'Weekly', 'Daily'];
  const stressOptions: Array<'Low' | 'Medium' | 'High'> = ['Low', 'Medium', 'High'];
  const packagedFoodOptions: Array<'Rare' | '1–2× weekly' | '3–5× weekly' | 'Daily'> = ['Rare', '1–2× weekly', '3–5× weekly', 'Daily'];
  const healthGoalOptions = ['Fat loss', 'Muscle building', 'Stay fit', 'Gain weight', 'Better digestion', 'Better sleep', 'Manage diabetes', 'Lower BP'];

  // 1. ADD PENCIL ICON TO HEADER FOR EDITING
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          onPress={isEditing ? handleSave : () => setIsEditing(true)} 
          disabled={saving}
          style={{ marginRight: 8 }}
        >
          <Ionicons 
            name={isEditing ? "checkmark" : "pencil"} 
            size={20} 
            color={isEditing ? COLORS.primary : (saving ? COLORS.textSecondary : COLORS.primary)} 
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, isEditing, saving]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const docRef = doc(db, "user_profiles", user.uid);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data();
        console.log("✅ Profile data loaded:", data);
        
        setName(data.name);
        setAge(data.age?.toString?.() ?? '');
        setWeight(data.weight?.toString?.() ?? '');
        setHeight(data.height?.toString?.() ?? '');
        setDiseases(Array.isArray(data.diseases) ? data.diseases : ["None"]);
        setBmi(data.bmi || 0);

        setDob(data.dob || '');
        setGender(data.gender || '');
        setWaist(data.waist !== null && data.waist !== undefined ? String(data.waist) : '');
        setActivityLevel(data.activityLevel || '');

        setOnMedication(data?.medication?.onMedication || '');
        setMedCategories(Array.isArray(data?.medication?.categories) ? data.medication.categories : []);
        setMedTiming(data?.medication?.timingSensitivity || '');

        setDietPattern(data?.diet?.pattern || '');
        setFastingHabit(data?.diet?.fastingHabits || '');
        setFastingType(data?.diet?.fastingType || '');

        setAllergies(Array.isArray(data?.allergies) ? data.allergies : []);
        setSmoking(data?.lifestyle?.smoking || '');
        setAlcohol(data?.lifestyle?.alcohol || '');
        setSleepHours(data?.lifestyle?.sleepHours !== null && data?.lifestyle?.sleepHours !== undefined ? String(data.lifestyle.sleepHours) : '');
        setStressLevel(data?.lifestyle?.stressLevel || '');

        setPackagedFoodFrequency(data?.dailyFoodBehavior?.packagedFoodFrequency || '');
        setHealthGoals(Array.isArray(data?.healthGoals) ? data.healthGoals : []);
      }
    } catch (e) {
      console.error("❌ Error fetching profile:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleDisease = (d: string) => {
    if (!isEditing) return; 

    if (d === "None") {
      setDiseases(["None"]);
    } else {
      let newDiseases = diseases.filter(item => item !== "None");
      if (newDiseases.includes(d)) {
        newDiseases = newDiseases.filter(item => item !== d);
      } else {
        newDiseases.push(d);
      }
      setDiseases(newDiseases.length > 0 ? newDiseases : ["None"]);
    }
  };

  const toggleMultiSelect = (
    value: string,
    current: string[],
    setCurrent: React.Dispatch<React.SetStateAction<string[]>>,
    noneValue = 'None'
  ) => {
    if (!isEditing) return;
    if (value === noneValue) {
      setCurrent([noneValue]);
      return;
    }

    const withoutNone = current.filter((x) => x !== noneValue);
    if (withoutNone.includes(value)) {
      const next = withoutNone.filter((x) => x !== value);
      setCurrent(next.length > 0 ? next : [noneValue]);
    } else {
      setCurrent([...withoutNone, value]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const weightKg = parseFloat(weight);
      const heightCm = parseFloat(height);
      const ageYears = parseInt(age);

      // Calculate BMI
      const bmi = calculateBMI(weightKg, heightCm);

      // Check if user has hypertension for sodium limit adjustment
      const hasHypertension = diseases.includes("Hypertension");

      // Recalculate daily nutrition goals based on updated stats
      const nutritionGoals = calculateDailyNutritionGoals(
        weightKg,
        heightCm,
        ageYears,
        gender === 'Female' ? 'female' : 'male',
        hasHypertension
      );

      await updateDoc(doc(db, "user_profiles", user.uid), {
        name,
        age: ageYears,
        dob,
        gender,
        weight: weightKg,
        height: heightCm,
        waist: waist ? parseFloat(waist) : null,
        activityLevel,
        diseases,
        medication: {
          onMedication,
          categories: onMedication === 'Yes' ? medCategories.filter((x) => x !== 'None') : [],
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
        bmi,
        // Update calculated daily goals and macro limits
        dailyNutritionGoals: {
          calories: nutritionGoals.calories,
          protein: nutritionGoals.protein,
          carbs: nutritionGoals.carbs,
          fat: nutritionGoals.fat,
          sugar: nutritionGoals.sugar,
          sodium: nutritionGoals.sodium,
        },
        customLimits: {
          calories: nutritionGoals.calories,
          protein: nutritionGoals.protein,
          carbs: nutritionGoals.carbs,
          fat: nutritionGoals.fat,
          sugar: nutritionGoals.sugar,
          sodium: nutritionGoals.sodium,
        }
      });
      
      setIsEditing(false);
      Alert.alert("Success", `Profile updated!\n\nDaily Goals:\n• Calories: ${nutritionGoals.calories}\n• Protein: ${nutritionGoals.protein}g\n• Carbs: ${nutritionGoals.carbs}g\n• Fat: ${nutritionGoals.fat}g`);
    } catch (e) {
      Alert.alert("Error", "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'Delete') {
      Alert.alert('Error', 'Please type "Delete" exactly to confirm.');
      return;
    }

    if (!passwordInput) {
      Alert.alert('Error', 'Please enter your password to confirm deletion.');
      return;
    }

    setDeleting(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) return;

      // Reauthenticate user
      const credential = EmailAuthProvider.credential(user.email, passwordInput);
      await reauthenticateWithCredential(user, credential);

      const batch = writeBatch(db);
      const uid = user.uid;

      // Delete user profile
      const profileRef = doc(db, 'user_profiles', uid);
      batch.delete(profileRef);

      // Delete all food logs
      const foodLogsQuery = query(collection(db, 'users', uid, 'food_logs'));
      const foodLogsSnap = await getDocs(foodLogsQuery);
      foodLogsSnap.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete all daily summaries
      const summariesQuery = query(collection(db, 'users', uid, 'daily_summaries'));
      const summariesSnap = await getDocs(summariesQuery);
      summariesSnap.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      // Delete user authentication
      await user.delete();

      setDeleteModalVisible(false);
      setDeleteConfirmation('');
      setPasswordInput('');
      
    } catch (error: any) {
      console.error('Delete account error:', error);
      if (error.code === 'auth/wrong-password') {
        Alert.alert('Error', 'Incorrect password. Please try again.');
      } else if (error.code === 'auth/requires-recent-login') {
        Alert.alert('Error', 'Please log out and log back in, then try deleting your account again.');
      } else {
        Alert.alert('Error', 'Could not delete account. Please try again.');
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primary}/></View>;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}> 
      {/* NOTE: We removed 'top' edge so content flows under the header nicely */}
      
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar / Name Placeholder */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
             <Text style={styles.avatarText}>{name ? name.charAt(0).toUpperCase() : "U"}</Text>
          </View>
          {isEditing ? (
            <TextInput
              value={name}
              onChangeText={setName}
              style={[styles.nameInput, styles.inputEditable]}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.textSecondary}
            />
          ) : (
            <Text style={styles.name}>{name}</Text>
          )}
          <Text style={styles.email}>{auth.currentUser?.email}</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.section}>
          <Text style={styles.label}>Physical Stats</Text>
          <View style={styles.row}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Age</Text>
              <TextInput 
                value={age} 
                onChangeText={setAge} 
                editable={isEditing} 
                style={[styles.input, isEditing && styles.inputEditable]} 
                keyboardType="numeric"
              />
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Weight (kg)</Text>
              <TextInput 
                value={weight} 
                onChangeText={setWeight} 
                editable={isEditing} 
                style={[styles.input, isEditing && styles.inputEditable]} 
                keyboardType="numeric"
              />
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Height (cm)</Text>
              <TextInput 
                value={height} 
                onChangeText={setHeight} 
                editable={isEditing} 
                style={[styles.input, isEditing && styles.inputEditable]} 
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Identity</Text>
          <Text style={styles.statLabel}>Date of Birth</Text>
          <TextInput
            value={dob}
            onChangeText={setDob}
            editable={isEditing}
            style={[styles.input, { textAlign: 'left' }, isEditing && styles.inputEditable]}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={[styles.statLabel, { marginTop: SPACING.m }]}>Gender</Text>
          <View style={styles.chipContainer}>
            {genderOptions.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.chip, gender === g && styles.chipActive, !isEditing && { opacity: 0.8 }]}
                onPress={() => isEditing && setGender(g)}
                disabled={!isEditing}
              >
                <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Body Metrics</Text>
          <Text style={styles.statLabel}>Waist (cm)</Text>
          <TextInput
            value={waist}
            onChangeText={setWaist}
            editable={isEditing}
            style={[styles.input, { textAlign: 'left' }, isEditing && styles.inputEditable]}
            keyboardType="numeric"
            placeholder="e.g. 80"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={[styles.statLabel, { marginTop: SPACING.m }]}>Activity level</Text>
          <View style={styles.chipContainer}>
            {activityOptions.map((a) => (
              <TouchableOpacity
                key={a}
                style={[styles.chip, activityLevel === a && styles.chipActive, !isEditing && { opacity: 0.8 }]}
                onPress={() => isEditing && setActivityLevel(a)}
                disabled={!isEditing}
              >
                <Text style={[styles.chipText, activityLevel === a && styles.chipTextActive]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Medication</Text>
          <Text style={styles.statLabel}>On medication?</Text>
          <View style={styles.chipContainer}>
            {yesNoOptions.map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.chip, onMedication === v && styles.chipActive, !isEditing && { opacity: 0.8 }]}
                onPress={() => isEditing && setOnMedication(v)}
                disabled={!isEditing}
              >
                <Text style={[styles.chipText, onMedication === v && styles.chipTextActive]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {onMedication === 'Yes' && (
            <>
              <Text style={[styles.statLabel, { marginTop: SPACING.m }]}>Medication categories</Text>
              <View style={styles.chipContainer}>
                {medCategoryOptions.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, medCategories.includes(m) && styles.chipActive, !isEditing && { opacity: 0.8 }]}
                    onPress={() => toggleMultiSelect(m, medCategories, setMedCategories)}
                    disabled={!isEditing}
                  >
                    <Text style={[styles.chipText, medCategories.includes(m) && styles.chipTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.statLabel, { marginTop: SPACING.m }]}>Timing sensitivity</Text>
              <View style={styles.chipContainer}>
                {medTimingOptions.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, medTiming === t && styles.chipActive, !isEditing && { opacity: 0.8 }]}
                    onPress={() => isEditing && setMedTiming(t)}
                    disabled={!isEditing}
                  >
                    <Text style={[styles.chipText, medTiming === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Diet</Text>
          <Text style={styles.statLabel}>Diet pattern</Text>
          <View style={styles.chipContainer}>
            {dietPatternOptions.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, dietPattern === p && styles.chipActive, !isEditing && { opacity: 0.8 }]}
                onPress={() => isEditing && setDietPattern(p)}
                disabled={!isEditing}
              >
                <Text style={[styles.chipText, dietPattern === p && styles.chipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.statLabel, { marginTop: SPACING.m }]}>Do you do fasting?</Text>
          <View style={styles.chipContainer}>
            {yesNoOptions.map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.chip, fastingHabit === v && styles.chipActive, !isEditing && { opacity: 0.8 }]}
                onPress={() => isEditing && setFastingHabit(v)}
                disabled={!isEditing}
              >
                <Text style={[styles.chipText, fastingHabit === v && styles.chipTextActive]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {fastingHabit === 'Yes' && (
            <>
              <Text style={[styles.statLabel, { marginTop: SPACING.m }]}>Fasting type</Text>
              <View style={styles.chipContainer}>
                {fastingTypeOptions.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, fastingType === t && styles.chipActive, !isEditing && { opacity: 0.8 }]}
                    onPress={() => isEditing && setFastingType(t)}
                    disabled={!isEditing}
                  >
                    <Text style={[styles.chipText, fastingType === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Allergies</Text>
          <View style={styles.chipContainer}>
            {allergyOptions.map((a) => (
              <TouchableOpacity
                key={a}
                style={[styles.chip, allergies.includes(a) && styles.chipActive, !isEditing && { opacity: 0.8 }]}
                onPress={() => toggleMultiSelect(a, allergies, setAllergies)}
                disabled={!isEditing}
              >
                <Text style={[styles.chipText, allergies.includes(a) && styles.chipTextActive]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Lifestyle</Text>
          <Text style={styles.statLabel}>Smoking</Text>
          <View style={styles.chipContainer}>
            {smokingOptions.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, smoking === s && styles.chipActive, !isEditing && { opacity: 0.8 }]}
                onPress={() => isEditing && setSmoking(s)}
                disabled={!isEditing}
              >
                <Text style={[styles.chipText, smoking === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.statLabel, { marginTop: SPACING.m }]}>Alcohol</Text>
          <View style={styles.chipContainer}>
            {alcoholOptions.map((a) => (
              <TouchableOpacity
                key={a}
                style={[styles.chip, alcohol === a && styles.chipActive, !isEditing && { opacity: 0.8 }]}
                onPress={() => isEditing && setAlcohol(a)}
                disabled={!isEditing}
              >
                <Text style={[styles.chipText, alcohol === a && styles.chipTextActive]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.statLabel, { marginTop: SPACING.m }]}>Average sleep duration (hours)</Text>
          <TextInput
            value={sleepHours}
            onChangeText={setSleepHours}
            editable={isEditing}
            style={[styles.input, { textAlign: 'left' }, isEditing && styles.inputEditable]}
            keyboardType="numeric"
            placeholder="e.g. 7"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={[styles.statLabel, { marginTop: SPACING.m }]}>Stress level</Text>
          <View style={styles.chipContainer}>
            {stressOptions.map((st) => (
              <TouchableOpacity
                key={st}
                style={[styles.chip, stressLevel === st && styles.chipActive, !isEditing && { opacity: 0.8 }]}
                onPress={() => isEditing && setStressLevel(st)}
                disabled={!isEditing}
              >
                <Text style={[styles.chipText, stressLevel === st && styles.chipTextActive]}>{st}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Food Behavior</Text>
          <Text style={styles.statLabel}>Packaged food frequency</Text>
          <View style={styles.chipContainer}>
            {packagedFoodOptions.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, packagedFoodFrequency === p && styles.chipActive, !isEditing && { opacity: 0.8 }]}
                onPress={() => isEditing && setPackagedFoodFrequency(p)}
                disabled={!isEditing}
              >
                <Text style={[styles.chipText, packagedFoodFrequency === p && styles.chipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Health Goals</Text>
          <View style={styles.chipContainer}>
            {healthGoalOptions.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.chip, healthGoals.includes(g) && styles.chipActive, !isEditing && { opacity: 0.8 }]}
                onPress={() => toggleMultiSelect(g, healthGoals, setHealthGoals, '__none__')}
                disabled={!isEditing}
              >
                <Text style={[styles.chipText, healthGoals.includes(g) && styles.chipTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Diseases Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Health Conditions</Text>
          <View style={styles.chipContainer}>
            {diseaseOptions.map(d => (
              <TouchableOpacity 
                key={d} 
                style={[
                  styles.chip, 
                  diseases.includes(d) && styles.chipActive,
                  !isEditing && { opacity: 0.8 }
                ]}
                onPress={() => toggleDisease(d)}
                disabled={!isEditing}
              >
                <Text style={[
                  styles.chipText,
                  diseases.includes(d) && styles.chipTextActive
                ]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutBtn}
          onPress={handleLogout}
        >
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>

        {/* Delete Account Button */}
        <TouchableOpacity 
          style={styles.deleteBtn}
          onPress={() => setDeleteModalVisible(true)}
        >
          <Text style={styles.deleteBtnText}>Delete My Account</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Delete Account Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={32} color={COLORS.danger} />
              <Text style={styles.modalTitle}>Delete Account?</Text>
            </View>
            
            <Text style={styles.modalWarning}>
              This action cannot be undone. All your data including:
            </Text>
            
            <View style={styles.warningList}>
              <Text style={styles.warningItem}>• Profile information</Text>
              <Text style={styles.warningItem}>• Food history</Text>
              <Text style={styles.warningItem}>• Daily summaries</Text>
              <Text style={styles.warningItem}>• Account access</Text>
            </View>
            
            <Text style={styles.modalInstruction}>
              Type "Delete" below to confirm:
            </Text>
            
            <TextInput 
              style={styles.confirmInput}
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              placeholder="Type Delete"
              placeholderTextColor={COLORS.textSecondary}
              autoFocus
            />

            <Text style={styles.modalInstruction}>
              Enter your password to confirm:
            </Text>
            
            <TextInput 
              style={styles.confirmInput}
              value={passwordInput}
              onChangeText={setPasswordInput}
              placeholder="Password"
              placeholderTextColor={COLORS.textSecondary}
              secureTextEntry
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity 
                style={styles.cancelModalBtn} 
                onPress={() => {
                  setDeleteModalVisible(false);
                  setDeleteConfirmation('');
                  setPasswordInput('');
                }}
                disabled={deleting}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.confirmModalBtn, 
                  deleteConfirmation === 'Delete' && passwordInput ? styles.confirmModalBtnActive : styles.confirmModalBtnDisabled
                ]}
                onPress={handleDeleteAccount}
                disabled={deleting || deleteConfirmation !== 'Delete' || !passwordInput}
              >
                <Text style={styles.confirmModalBtnText}>
                  {deleting ? "Deleting..." : "Delete Account"}
                </Text>
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
  scroll: { padding: SPACING.l },
  
  avatarSection: { alignItems: 'center', marginBottom: SPACING.xl, marginTop: SPACING.m },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.s, borderWidth: 1, borderColor: COLORS.primary },
  avatarText: { fontSize: 32, color: COLORS.primary, fontWeight: 'bold' },
  name: { fontSize: 20, color: COLORS.textPrimary, fontWeight: 'bold' },
  nameInput: { fontSize: 20, color: COLORS.textPrimary, fontWeight: 'bold', textAlign: 'center', padding: SPACING.s, borderRadius: 12, backgroundColor: COLORS.surface },
  email: { color: COLORS.textSecondary },

  section: { marginBottom: SPACING.xl },
  label: { color: COLORS.textSecondary, marginBottom: SPACING.m, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 },
  
  row: { flexDirection: 'row', gap: SPACING.m },
  statBox: { flex: 1 },
  statLabel: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: COLORS.surface, color: COLORS.textPrimary, padding: SPACING.m, borderRadius: 12, fontSize: 16, textAlign: 'center' },
  inputEditable: { borderWidth: 1, borderColor: COLORS.primary, backgroundColor: '#1A1A1A' },

  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#333', backgroundColor: COLORS.surface },
  chipActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  chipText: { color: COLORS.textSecondary },
  chipTextActive: { color: '#000', fontWeight: 'bold' },

  actionBtn: { padding: SPACING.m, borderRadius: 12, alignItems: 'center', marginTop: SPACING.s },
  btnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },

  // Logout Button
  logoutBtn: { 
    padding: SPACING.m, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: SPACING.l,
    backgroundColor: 'rgba(255, 204, 0, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.primary
  },
  logoutBtnText: { 
    color: COLORS.primary, 
    fontWeight: 'bold', 
    fontSize: 16 
  },

  // Delete Account Button
  deleteBtn: { 
    padding: SPACING.m, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: SPACING.l,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.danger
  },
  deleteBtnText: { 
    color: COLORS.danger, 
    fontWeight: 'bold', 
    fontSize: 16 
  },

  // Delete Modal Styles
  modalBg: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: SPACING.l
  },
  modalCard: { 
    width: '100%', 
    maxWidth: 400,
    backgroundColor: COLORS.surface, 
    borderRadius: 16, 
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: '#333'
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: SPACING.m
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.s
  },
  modalWarning: {
    fontSize: 14,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.m
  },
  warningList: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: SPACING.m,
    borderRadius: 8,
    marginBottom: SPACING.m
  },
  warningItem: {
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 2
  },
  modalInstruction: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.s
  },
  confirmInput: {
    backgroundColor: COLORS.background,
    color: COLORS.textPrimary,
    padding: SPACING.m,
    borderRadius: 8,
    fontSize: 16,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: SPACING.l
  },
  modalBtns: { 
    flexDirection: 'row', 
    gap: SPACING.m 
  },
  cancelModalBtn: {
    flex: 1,
    padding: SPACING.m,
    borderRadius: 8,
    backgroundColor: '#333',
    alignItems: 'center'
  },
  cancelModalBtnText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '600'
  },
  confirmModalBtn: {
    flex: 1,
    padding: SPACING.m,
    borderRadius: 8,
    alignItems: 'center'
  },
  confirmModalBtnActive: {
    backgroundColor: COLORS.danger
  },
  confirmModalBtnDisabled: {
    backgroundColor: '#333',
    opacity: 0.5
  },
  confirmModalBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold'
  }
});