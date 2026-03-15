# NutriWise 🥗

Smart Food Intelligence — a React Native mobile app that helps you scan food products, analyze their nutritional impact with AI, and track your daily intake with personalized health goals.

## Features

- **Barcode Scanning** — Scan packaged food barcodes using your phone camera to instantly fetch nutrition data
- **AI-Powered Analysis** — Get personalized health verdicts powered by Google Gemini AI, tailored to your medical conditions, allergies, and fitness goals
- **Rule-Based Safety Engine** — Deterministic checks for Diabetes (sugar), Hypertension (sodium), and daily nutrient budgets before AI analysis
- **Daily Intake Tracking** — Log food items and track calories, protein, carbs, fat, sugar, and sodium against your personalized goals
- **Personalized Nutrition Goals** — BMR/TDEE calculated using the Mifflin-St Jeor equation based on your age, weight, height, and gender
- **Recipe Calculator** — Build homemade recipes from ingredients, calculate total and per-serving nutrition
- **Health Profile Onboarding** — Collects diseases, allergies, medications, diet patterns, and health goals for personalized recommendations
- **Intake History** — View past daily summaries to track your progress over time
- **Password Recovery** — Forgot password flow with Firebase email reset

## Tech Stack

| Layer      | Technology                                      |
| ---------- | ----------------------------------------------- |
| Framework  | React Native 0.81 + Expo 54                     |
| Language   | TypeScript                                      |
| Navigation | React Navigation 7 (native-stack + bottom-tabs) |
| Auth       | Firebase Auth (email/password)                  |
| Database   | Cloud Firestore                                 |
| AI         | Google Gemini 2.5 Flash                         |
| Camera     | expo-camera                                     |
| Animations | react-native-reanimated                         |
| Build      | EAS Build                                       |

## Prerequisites

- Node.js (v18+)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (for development)
- Firebase project with Firestore & Auth enabled
- Google Gemini API key

## Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/ritikkumar27/foodapp_sem8.git
   cd foodapp_sem8
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory:

   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
   EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
   EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Firebase setup**
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable **Authentication** (Email/Password provider)
   - Enable **Cloud Firestore** (region: `asia-south1`)
   - Deploy Firestore security rules:
     ```bash
     firebase deploy --only firestore:rules
     ```

5. **Run the app**
   ```bash
   npx expo start --tunnel
   ```
   Scan the QR code with Expo Go on your phone.

## Project Structure

```
foodapp_sem8/
├── index.ts                     # App entrypoint
├── App.tsx                      # Root component
├── app.json                     # Expo configuration
├── .env                         # Environment variables
│
├── src/
│   ├── navigation/
│   │   └── AppNavigator.tsx     # Auth flow + tab navigation + stack navigation
│   │
│   ├── screens/
│   │   ├── LoginScreen.tsx      # Login with forgot password
│   │   ├── SignupScreen.tsx     # Registration
│   │   ├── OnboardingScreen.tsx # Health profile collection
│   │   ├── HomeScreen.tsx       # Dashboard with calorie/macro progress rings
│   │   ├── ScanScreen.tsx       # Camera barcode scanner
│   │   ├── ScanResultScreen.tsx # Nutrition display + AI analysis
│   │   ├── RecipeCalculatorScreen.tsx  # Recipe builder
│   │   ├── HistoryScreen.tsx    # Past daily summaries
│   │   └── ProfileScreen.tsx   # View/edit health profile
│   │
│   ├── services/
│   │   ├── firebaseConfig.ts    # Firebase initialization
│   │   ├── firebaseHelper.ts    # Firestore CRUD (food logs, daily summaries)
│   │   ├── aiService.ts         # Gemini AI food analysis
│   │   ├── nutritionCalculator.ts       # BMR/TDEE/macro calculations
│   │   ├── recipeNutritionCalculator.ts # Recipe nutrition from ingredients
│   │   └── recipeService.ts     # Recipe CRUD operations
│   │
│   ├── logic/
│   │   └── RuleEngine.ts        # Health-based food safety rules
│   │
│   ├── components/
│   │   └── FoodList.tsx         # Reusable food list component
│   │
│   ├── constants/
│   │   └── theme.ts             # Colors, spacing, fonts
│   │
│   └── types/
│       └── index.ts             # TypeScript interfaces
│
├── functions/                   # Firebase Cloud Functions (scaffold)
├── firestore.rules              # Firestore security rules
├── storage.rules                # Firebase Storage rules
└── uploadFoodItems.ts           # Bulk food data upload script
```

## Architecture

```
User Flow:
Login/Signup → Onboarding (health profile) → Home Dashboard
                                                  ├── Scan → ScanResult → Log Food
                                                  ├── History (past summaries)
                                                  └── Profile (edit health data)

Data Flow (Scan → Analysis):
Camera Scan → Fetch Nutrition → Rule Engine (SAFE/WARNING/AVOID)
                                     → Gemini AI (personalized analysis)
                                         → Log to Firestore (batched write)
                                             → Update daily summary
```

## Firestore Data Model

| Collection                           | Document Key   | Description                                              |
| ------------------------------------ | -------------- | -------------------------------------------------------- |
| `user_profiles/{uid}`                | User ID        | Health profile (age, weight, diseases, allergies, goals) |
| `users/{uid}/food_logs`              | Auto-generated | Individual food items logged                             |
| `users/{uid}/daily_summaries/{date}` | Date string    | Aggregated daily totals                                  |
| `users/{uid}/recipes`                | Auto-generated | Saved recipe configurations                              |
| `food_items/{barcode}`               | Barcode        | Product database (public read)                           |

## Scripts

| Command           | Description           |
| ----------------- | --------------------- |
| `npm start`       | Start Expo dev server |
| `npm run android` | Start with Android    |
| `npm run ios`     | Start with iOS        |
| `npm run web`     | Start web version     |
