
'use client';

/**
 * @fileOverview Marketplace Commercial Intelligence Service.
 * Tracks student and staff behavior to build a high-fidelity intent profile.
 * Upgraded with Weighted Trending Signals, Correlation Graph, and Product Trend Document.
 */

import { doc, increment, setDoc, Firestore, getDoc, serverTimestamp, collection, query, where, orderBy, limit, getDocs, addDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { Product, Order, ProductTrend } from './types';
import { computeTrendScore } from './compute-trend-score';
import { applyTrendDecay } from './apply-trend-decay';

export type CommercialSignal = 'view' | 'favorite' | 'intent' | 'purchase' | 'share';

/**
 * recordMarketSignal
 * ------------------
 * Logs a behavioral event to the user's market profile and the product's velocity bucket.
 * Implements the professional weight system:
 * view=1, favorite=2, share=3, intent=4, purchase=8
 */
export async function recordMarketSignal(
  firestore: Firestore,
  userId: string,
  product: Product,
  signal: CommercialSignal
) {
  if (!firestore || !userId || !product) return;

  const profileRef = doc(firestore, 'user_market_profiles', userId);
  const statsRef = doc(firestore, 'products', product.id);
  const trendRef = doc(firestore, 'product_trends', product.id);
  
  // 🕒 MINUTE BUCKET LOGIC: Detects velocity within a 60-second window
  const minuteBucket = new Date().toISOString().slice(0, 16); 
  const velocityRef = doc(firestore, 'product_velocity', product.id, 'minutes', minuteBucket);

  // 1. Update Market Profile (For personalization)
  const profileUpdates: any = {
    updatedAt: serverTimestamp(),
  };

  const velocityUpdates: any = {};
  const productAggregates: any = {};
  const trendUpdates: any = {
    productId: product.id,
    campusId: product.campusId,
    lastUpdated: serverTimestamp()
  };

  // WEIGHT ASSIGNMENT
  switch (signal) {
    case 'view':
      profileUpdates[`viewedCategories.${product.category}`] = increment(1);
      velocityUpdates.views = increment(1);
      productAggregates.viewCount = increment(1);
      trendUpdates.viewCount = increment(1);
      break;
    case 'favorite':
      profileUpdates.favoriteProducts = arrayUnion(product.id);
      velocityUpdates.favorites = increment(1);
      productAggregates.favoriteCount = increment(1);
      break;
    case 'share':
      velocityUpdates.shares = increment(1);
      productAggregates.shareCount = increment(1);
      trendUpdates.shareCount = increment(1);
      break;
    case 'intent':
      profileUpdates[`intentCategories.${product.category}`] = increment(1);
      profileUpdates[`favoriteVendors.${product.vendorId}`] = increment(1);
      velocityUpdates.intents = increment(1);
      trendUpdates.cartCount = increment(1); // Maps 'intent' to 'cart' for trends
      break;
    case 'purchase':
      profileUpdates[`purchasedCategories.${product.category}`] = increment(1);
      profileUpdates[`favoriteVendors.${product.vendorId}`] = increment(1);
      velocityUpdates.purchases = increment(1);
      productAggregates.salesCount = increment(1);
      trendUpdates.purchaseCount = increment(1);
      
      // 🔥 LIAISON UPGRADE: Update Co-Purchase Graph
      updateCoPurchaseCorrelation(firestore, userId, product.id);
      break;
  }

  // 🛰️ BATCHED NON-BLOCKING HANDSHAKE
  setDoc(profileRef, profileUpdates, { merge: true }).catch(() => {});
  setDoc(velocityRef, velocityUpdates, { merge: true }).catch(() => {});
  setDoc(trendRef, trendUpdates, { merge: true }).catch(() => {});
  
  if (Object.keys(productAggregates).length > 0) {
    setDoc(statsRef, productAggregates, { merge: true }).catch(() => {});
  }

  // 💰 Price Preference Balancing (Async context)
  if (signal === 'view' || signal === 'intent') {
    try {
      const snap = await getDoc(profileRef);
      const data = snap.data() || {};
      const currentPrefs = data.pricePreference || { min: product.price, max: product.price };
      
      const newPrefs = {
        min: Math.min(currentPrefs.min || product.price, product.price),
        max: Math.max(currentPrefs.max || product.price, product.price)
      };

      setDoc(profileRef, { pricePreference: newPrefs }, { merge: true }).catch(() => {});
    } catch (err) {
      console.warn("Market Intel: Price sync interrupted.");
    }
  }
}

/**
 * trackProductEvent
 * -----------------
 * Specific event tracker for product trends as requested.
 * Acts as a wrapper for recordMarketSignal where applicable.
 */
export async function trackProductEvent(
  firestore: Firestore,
  productId: string,
  eventType: 'view' | 'cart' | 'purchase' | 'share',
  campusId: string
) {
  const ref = doc(firestore, 'product_trends', productId);
  const updates: any = {
    productId,
    campusId,
    lastUpdated: serverTimestamp()
  };

  if (eventType === "view") updates.viewCount = increment(1);
  if (eventType === "cart") updates.cartCount = increment(1);
  if (eventType === "purchase") updates.purchaseCount = increment(1);
  if (eventType === "share") updates.shareCount = increment(1);

  await setDoc(ref, updates, { merge: true }).catch(err => {
    console.error("Trend Tracking Failed:", err);
  });
}

/**
 * getTrendingProducts
 * --------------------
 * Retrieves the hottest products for a specific campus using the decayed score formula.
 */
export async function getTrendingProducts(
  firestore: Firestore,
  campusId: string
) {
  const q = query(
    collection(firestore, "product_trends"),
    where("campusId", "==", campusId),
    limit(100)
  );

  const snapshot = await getDocs(q);
  const trends = snapshot.docs.map(d => d.data() as ProductTrend);

  const scored = trends.map(trend => {
    let score = computeTrendScore(trend);
    
    // Apply time decay
    const lastUpdated = trend.lastUpdated?.toDate ? trend.lastUpdated.toDate() : new Date(trend.lastUpdated);
    score = applyTrendDecay(score, lastUpdated);

    return {
      productId: trend.productId,
      score
    };
  });

  // Sort by decayed score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 20);
}

/**
 * toggleFavoriteProduct
 * --------------------
 * High-performance favorite toggler.
 */
export async function toggleFavoriteProduct(firestore: Firestore, userId: string, product: Product, isFavorited: boolean) {
    const profileRef = doc(firestore, 'user_market_profiles', userId);
    const productRef = doc(firestore, 'products', product.id);

    try {
        if (isFavorited) {
            // Unfavorite
            await setDoc(profileRef, { favoriteProducts: arrayRemove(product.id) }, { merge: true });
            await setDoc(productRef, { favoriteCount: increment(-1) }, { merge: true });
        } else {
            // Favorite
            await recordMarketSignal(firestore, userId, product, 'favorite');
        }
    } catch (e) {
        console.error("Favorite toggle failed:", e);
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
