import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet,  
  KeyboardAvoidingView, Platform, Alert 
} from 'react-native';
import { COLORS, SPACING, FONTS } from '../constants/theme';
import { signInAnonymously, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore'; 
import { auth, db } from '../services/firebaseConfig';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDevBypass = async () => {
    if (!__DEV__) return;

    const devEmail = process.env.EXPO_PUBLIC_DEV_EMAIL || email;
    const devPassword = process.env.EXPO_PUBLIC_DEV_PASSWORD || password;

    setLoading(true);
    try {
      if (devEmail && devPassword) {
        await signInWithEmailAndPassword(auth, devEmail, devPassword);
      } else {
        await signInAnonymously(auth);
      }

      const user = auth.currentUser;
      if (user) {
        // Ensure a profile exists so AppNavigator routes straight to MainTabs.
        await setDoc(
          doc(db, 'user_profiles', user.uid),
          {
            name: 'Dev User',
            email: user.email || '',
            profileVersion: 2,
            age: 25,
            dob: '',
            gender: 'Prefer not to say',
            height: 170,
            weight: 70,
            waist: null,
            activityLevel: 'Moderately active',
            diseases: ['None'],
            medication: {
              onMedication: 'No',
              categories: [],
              timingSensitivity: '',
            },
            diet: {
              pattern: 'Non-vegetarian',
              fastingHabits: 'No',
              fastingType: '',
            },
            allergies: ['None'],
            lifestyle: {
              smoking: 'Never',
              alcohol: 'Never',
              sleepHours: 7,
              stressLevel: 'Low',
            },
            dailyFoodBehavior: {
              packagedFoodFrequency: 'Rare',
            },
            healthGoals: [],
            bmi: 24.2,
            dailyNutritionGoals: {
              calories: 2200,
              protein: 110,
              carbs: 275,
              fat: 70,
              sugar: 25,
              sodium: 2000,
            },
            customLimits: {
              calories: 2200,
              protein: 110,
              carbs: 275,
              fat: 70,
              sugar: 25,
              sodium: 2000,
            },
          },
          { merge: true }
        );
      }
    } catch (error: any) {
      Alert.alert('Dev Bypass Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;


      const profileRef = doc(db, "user_profiles", user.uid);
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        console.log("Profile found, ready for Home.");
      } else {
        console.log("No profile found, user needs Onboarding.");
      }

    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    const resetEmail = email.trim();

    if (!resetEmail) {
      Alert.alert(
        "Reset Password",
        "Please enter your email address in the field above, then tap Forgot Password again."
      );
      return;
    }

    Alert.alert(
      "Reset Password",
      `Send a password reset link to\n${resetEmail}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Link",
          onPress: async () => {
            try {
              await sendPasswordResetEmail(auth, resetEmail);
              Alert.alert("Email Sent ✓", "Check your inbox for a password reset link.");
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Nutriwise</Text>
          <Text style={styles.subtitle}>Smart Food Intelligence</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput 
            style={styles.input} 
            placeholder="hello@example.com" 
            placeholderTextColor={COLORS.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput 
            style={styles.input} 
            placeholder="••••••••" 
            placeholderTextColor={COLORS.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Checking..." : "Enter"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleForgotPassword}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
          {__DEV__ && (
            <TouchableOpacity
              style={styles.devButton}
              onPress={handleDevBypass}
              disabled={loading}
            >
              <Text style={styles.devButtonText}>{loading ? "Please wait..." : "Dev Mode Bypass"}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.footerText}>
              New here? <Text style={{color: COLORS.primary}}>Create Account</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SPACING.l,
    justifyContent: 'center',
  },
  header: {
    marginBottom: SPACING.xl * 1.5,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  form: {
    gap: SPACING.m,
  },
  label: {
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: SPACING.xs,
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.surface,
    padding: SPACING.m,
    borderRadius: 12,
    color: COLORS.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.m,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SPACING.m,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  forgotText: {
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: SPACING.s,
    fontSize: 14,
    fontWeight: '500',
  },
  devButton: {
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: COLORS.surface,
    padding: SPACING.m,
    borderRadius: 12,
    alignItems: 'center',
  },
  devButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  footerText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.m,
  },
});