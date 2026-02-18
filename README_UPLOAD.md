# Bulk Upload Food Items to Firebase

## Setup Instructions

### 1. Get Firebase Service Account Key
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download JSON file and rename it to `service-account-key.json`
4. Place it in the root of your project

### 2. Prepare Your Data
Create `amazon_products.json` with this structure:
```json
[
  {
    "barcode": "1234567890123",
    "name": "Product Name",
    "brand": "Brand Name",
    "calories": 100,
    "protein": 10,
    "carbs": 20,
    "fat": 5,
    "sugar": 8,
    "sodium": 200,
    "serving_size": "100g",
    "category": {
      "primary": "Food Category",
      "secondary": "Sub Category"
    }
  }
]
```

### 3. Install Dependencies
```bash
npm install firebase-admin @types/node
```

### 4. Run the Upload Script
```bash
npx ts-node uploadFoodItems.ts
```

## Script Features

✅ **Duplicate Prevention**: Skips items with existing barcodes
✅ **Barcode Validation**: Only processes items with barcodes
✅ **Data Normalization**: Converts nutrition to nested object
✅ **Category Support**: Handles primary/secondary categories
✅ **Error Handling**: Logs all errors and continues processing
✅ **Progress Tracking**: Shows insert/skip/error counts

## Output Example
```
📦 Starting bulk upload to food_items collection...
📚 Loaded 150 products from amazon_products.json
✅ Inserted (1234567890123): Product Name
⏭️  Skipping existing product (9876543210987): Another Product
⏭️  Skipping product without barcode: Product Without Barcode

📊 Upload Summary:
✅ Successfully inserted: 145 items
⏭️  Skipped (existing/no barcode): 5 items
❌ Errors: 0 items
📦 Total processed: 150 items
```

## Firestore Schema
The script creates documents in `food_items` collection with:
- `barcode` as document ID
- `name_lower` for case-insensitive search
- `nutrition` object with all nutritional values
- `category` object with primary/secondary
- `verified: false` for uploaded items
- `createdAt` timestamp
