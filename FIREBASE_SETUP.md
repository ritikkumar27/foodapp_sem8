# Firebase Setup Instructions

## 1. Deploy Security Rules

Deploy the Firestore and Storage rules I created:

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules  
firebase deploy --only storage
```

## 2. Update Firestore Rules Index

Create a composite index for the products collection search:

1. Go to Firebase Console → Firestore Database → Indexes
2. Click "Add Index"
3. Collection: `products`
4. Fields:
   - `name_lower` (Ascending)
   - `name_lower` (Descending) 
5. Click "Create"

## 3. Deploy OCR Cloud Function

Make sure you have the `processNutritionLabel` function deployed:

```bash
# Deploy all functions
firebase deploy --only functions
```

If you don't have this function yet, create it in `functions/index.js`:

```javascript
const functions = require("firebase-functions");
const vision = require('@google-cloud/vision');

exports.processNutritionLabel = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const { imageUrl } = data;
  
  try {
    const client = new vision.ImageAnnotatorClient();
    const [result] = await client.textDetection(imageUrl);
    const detections = result.textAnnotations;
    
    if (detections.length === 0) {
      throw new functions.https.HttpsError('not-found', 'No text detected');
    }

    const fullText = detections[0].description;
    
    // Parse nutrition information from text
    const nutritionData = parseNutritionLabel(fullText);
    
    return nutritionData;
  } catch (error) {
    console.error('OCR Error:', error);
    throw new functions.https.HttpsError('internal', 'OCR processing failed');
  }
});

function parseNutritionLabel(text) {
  // Basic parsing logic - you may need to enhance this
  const lines = text.split('\n');
  const nutrition = {};
  
  lines.forEach(line => {
    if (line.includes('Calories')) {
      nutrition.calories = parseInt(line.match(/\d+/)?.[0] || 0);
    }
    if (line.includes('Protein')) {
      nutrition.protein = parseFloat(line.match(/[\d.]+/)?.[0] || 0);
    }
    if (line.includes('Carbohydrates') || line.includes('Carbs')) {
      nutrition.carbs = parseFloat(line.match(/[\d.]+/)?.[0] || 0);
    }
    if (line.includes('Fat')) {
      nutrition.fat = parseFloat(line.match(/[\d.]+/)?.[0] || 0);
    }
    if (line.includes('Sugar')) {
      nutrition.sugar = parseFloat(line.match(/[\d.]+/)?.[0] || 0);
    }
    if (line.includes('Sodium')) {
      nutrition.sodium = parseInt(line.match(/\d+/)?.[0] || 0);
    }
  });
  
  return nutrition;
}
```

## 4. Install Required Dependencies

In your functions directory:

```bash
cd functions
npm install @google-cloud/vision
```

## 5. Test the Setup

After deploying:

1. Sign in to your app
2. Try searching for products
3. Try scanning a nutrition label
4. Check Firebase Console logs for any errors

## Common Issues & Solutions

- **Permission Denied**: Make sure security rules are deployed
- **Storage Unknown Error**: Check Storage rules are deployed and bucket exists
- **Function Not Found**: Ensure OCR function is deployed
- **Index Error**: Create the Firestore composite index mentioned above
