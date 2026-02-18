import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf8')); // You'll need to provide this file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

interface AmazonProduct {
  barcode?: string;
  name: string;
  brand?: string;
  nutrition?: {
    energy_kcal?: number;
    fat_g?: number;
    carbohydrates_g?: number;
    sugars_g?: number;
    protein_g?: number;
    fiber_g?: number;
    sodium_mg?: number;
  };
  serving_size?: string;
  category?: string;
  ingredients?: string[];
}

interface FoodItem {
  name: string;
  name_lower: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  sodium?: number;
  serving_size: string | number;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    sugar?: number;
    sodium?: number;
  };
  category?: {
    primary?: string;
    secondary?: string;
  };
  ingredients?: string[];
  verified: boolean;
  createdAt: string;
}

async function uploadFoodItems() {
  try {
    console.log('📦 Starting bulk upload to food_items collection...');
    
    // Read the source file
    const filePath = join(__dirname, 'amazon_products.json');
    const fileContent = readFileSync(filePath, 'utf8');
    const products: AmazonProduct[] = JSON.parse(fileContent);
    
    console.log(`📚 Loaded ${products.length} products from amazon_products.json`);
    
    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process each product
    for (const product of products) {
      try {
        // Skip products without a barcode
        if (!product.barcode) {
          console.log(`⏭️  Skipping product without barcode: ${product.name}`);
          skippedCount++;
          continue;
        }
        
        // Check if document with this barcode already exists
        const docRef = db.collection('food_items').doc(product.barcode);
        const docSnapshot = await docRef.get();
        
        if (docSnapshot.exists) {
          console.log(`⏭️  Skipping existing product (${product.barcode}): ${product.name}`);
          skippedCount++;
          continue;
        }
        
        // Transform product data to match Firestore schema
        const foodItem: FoodItem = {
          name: product.name,
          name_lower: product.name.toLowerCase(),
          brand: product.brand,
          calories: product.nutrition?.energy_kcal || 0,
          protein: product.nutrition?.protein_g || 0,
          carbs: product.nutrition?.carbohydrates_g || 0,
          fat: product.nutrition?.fat_g || 0,
          sugar: product.nutrition?.sugars_g || 0,
          sodium: product.nutrition?.sodium_mg || 0,
          serving_size: product.serving_size || '1 serving',
          nutrition: {
            calories: product.nutrition?.energy_kcal || 0,
            protein: product.nutrition?.protein_g || 0,
            carbs: product.nutrition?.carbohydrates_g || 0,
            fat: product.nutrition?.fat_g || 0,
            sugar: product.nutrition?.sugars_g || 0,
            sodium: product.nutrition?.sodium_mg || 0
          },
          category: product.category ? {
            primary: product.category,
            secondary: ''
          } : undefined,
          ingredients: product.ingredients,
          verified: false,
          createdAt: new Date().toISOString()
        };
        
        // Insert the document with barcode as ID
        await docRef.set(foodItem);
        console.log(`✅ Inserted (${product.barcode}): ${product.name}`);
        insertedCount++;
        
      } catch (error) {
        console.error(`❌ Error processing product ${product.name}:`, error);
        errorCount++;
      }
    }
    
    // Summary
    console.log('\n📊 Upload Summary:');
    console.log(`✅ Successfully inserted: ${insertedCount} items`);
    console.log(`⏭️  Skipped (existing/no barcode): ${skippedCount} items`);
    console.log(`❌ Errors: ${errorCount} items`);
    console.log(`📦 Total processed: ${products.length} items`);
    
  } catch (error) {
    console.error('💥 Fatal error during upload:', error);
  } finally {
    // Cleanup
    await admin.app().delete();
  }
}

// Run the upload function
uploadFoodItems().catch(console.error);
