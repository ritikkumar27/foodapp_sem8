export interface FoodItem {
  id?: string;
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;  // grams
  sodium?: number; // mg
  serving_size: string | number;
  date?: string;
  createdAt?: string;
}

export interface DailySummary {
  id?: string;
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalSugar?: number;  // grams
  totalSodium?: number; // mg
}