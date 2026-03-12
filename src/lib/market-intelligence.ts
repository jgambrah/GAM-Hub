
'use client';

/**
 * @fileOverview Marketplace Commercial Intelligence Service.
 * Tracks student and staff behavior to build a high-fidelity intent profile.
 * Upgraded with Co-Purchase Correlation and Price History.
 */

import { doc, increment, setDoc, Firestore, getDoc, serverTimestamp, collection, query, where, orderBy, limit, getDocs, addDoc } from 'firebase/firestore';
import type { Product, Order } from './types';

/**
 * recordMarketSignal
 * ------------------
 * Logs a behavioral event to the user's market profile and the product's velocity bucket.
 */
export async function recordMarketSignal(
  firestore: Firestore,
  userId: string,
  product: Product,
  signal: 'view' | 'intent' | 'purchase'
) {
  if (!firestore || !userId || !product) return;

  const profileRef = doc(firestore, 'user_market_profiles', userId);
  const statsRef = doc(firestore, 'products', product.id);
  
  // 🕒 MINUTE BUCKET LOGIC: Detects velocity within a 60-second window
  const minuteBucket = new Date().toISOString().slice(0, 16); 
  const velocityRef = doc(firestore, 'product_velocity', product.id, 'minutes', minuteBucket);

  // 1. Update Market Profile
  const profileUpdates: any = {
    updatedAt: serverTimestamp(),
  };

  const velocityUpdates: any = {};

  if (signal === 'view') {
    profileUpdates[`viewedCategories.${product.category}`] = increment(1);
    velocityUpdates.views = increment(1);
  } else if (signal === 'intent') {
    profileUpdates[`intentCategories.${product.category}`] = increment(1);
    profileUpdates[`favoriteVendors.${product.vendorId}`] = increment(1);
    velocityUpdates.intents = increment(1);
  } else if (signal === 'purchase') {
    profileUpdates[`purchasedCategories.${product.category}`] = increment(1);
    profileUpdates[`favoriteVendors.${product.vendorId}`] = increment(1);
    velocityUpdates.purchases = increment(1);
    
    // 🔥 LIAISON UPGRADE: Update Co-Purchase Graph
    updateCoPurchaseCorrelation(firestore, userId, product.id);
  }

  // Non-blocking write to Profile
  setDoc(profileRef, profileUpdates, { merge: true }).catch(() => {});

  // Non-blocking write to Velocity Bucket
  setDoc(velocityRef, velocityUpdates, { merge: true }).catch(() => {});

  // Update Aggregate Stats on the Product itself
  const aggregateUpdates: any = {};
  if (signal === 'view') aggregateUpdates.viewCount = increment(1);
  if (signal === 'purchase') aggregateUpdates.salesCount = increment(1);
  
  if (Object.keys(aggregateUpdates).length > 0) {
    setDoc(statsRef, aggregateUpdates, { merge: true }).catch(() => {});
  }

  // 2. Price Preference Balancing (Async context)
  if (signal === 'view' || signal === 'intent') {
    try {
      const snap = await getDoc(profileRef);
      const data = snap.data() || {};
      const currentPrefs = data.pricePreference || { min: product.price, max: product.price };
      
      const newPrefs = {
        min: Math.min(currentPrefs.min, product.price),
        max: Math.max(currentPrefs.max, product.price)
      };

      setDoc(profileRef, { pricePreference: newPrefs }, { merge: true }).catch(() => {});
    } catch (err) {
      console.warn("Market Intel: Price sync interrupted.");
    }
  }
}

/**
 * recordPricePoint
 * ----------------
 * Tracks historical price points for AI Deal Detection.
 */
export async function recordPricePoint(firestore: Firestore, productId: string, price: number) {
  if (!firestore || !productId) return;
  
  const historyRef = collection(firestore, 'products', productId, 'product_price_history');
  await addDoc(historyRef, {
    price,
    timestamp: serverTimestamp()
  });
}

/**
 * updateCoPurchaseCorrelation
 * ----------------------------
 * Finds the user's last few purchases and increments the correlation weight
 * between the new item and historical items. This powers "People Also Bought".
 */
async function updateCoPurchaseCorrelation(firestore: Firestore, userId: string, newProductId: string) {
    try {
        // 1. Fetch user's last 5 completed orders
        const q = query(
            collection(firestore, 'orders'),
            where('buyerId', '==', userId),
            where('status', 'in', ['picked-up', 'completed', 'archived']),
            orderBy('createdAt', 'desc'),
            limit(6) // Current one + 5 historical
        );
        
        const snap = await getDocs(q);
        const purchasedIds = Array.from(new Set(
            snap.docs
                .map(d => (d.data() as Order).productId)
                .filter(id => id !== newProductId)
        )).slice(0, 5);

        if (purchasedIds.length === 0) return;

        // 2. Update pairs (Correlation Handshake)
        for (const historicalId of purchasedIds) {
            // Standardize key to avoid duplicates (Alphabetical sort)
            const pair = [newProductId, historicalId].sort();
            const correlationId = `${pair[0]}_${pair[1]}`;
            
            const ref = doc(firestore, 'product_co_purchases', correlationId);
            setDoc(ref, {
                productA: pair[0],
                productB: pair[1],
                count: increment(1),
                lastUpdated: serverTimestamp()
            }, { merge: true }).catch(() => {});
        }
    } catch (err) {
        console.warn("Co-Purchase Sync Failed:", err);
    }
}

/**
 * getRelatedProducts
 * -------------------
 * Retrieves the top 10 most correlated products for a given ID.
 */
export async function getRelatedProducts(firestore: Firestore, productId: string) {
    if (!firestore || !productId) return [];

    try {
        // Check both sides of the pair (productA OR productB)
        // Since we standardized the ID, we need two queries or a complex index.
        const qA = query(
            collection(firestore, 'product_co_purchases'),
            where('productA', '==', productId),
            orderBy('count', 'desc'),
            limit(10)
        );
        
        const qB = query(
            collection(firestore, 'product_co_purchases'),
            where('productB', '==', productId),
            orderBy('count', 'desc'),
            limit(10)
        );

        const [snapA, snapB] = await Promise.all([getDocs(qA), getDocs(qB)]);
        
        const results = [...snapA.docs, ...snapB.docs]
            .map(d => {
                const data = d.data();
                return {
                    id: data.productA === productId ? data.productB : data.productA,
                    count: data.count
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return results;
    } catch (err) {
        console.error("Related Retrieval Error:", err);
        return [];
    }
}
