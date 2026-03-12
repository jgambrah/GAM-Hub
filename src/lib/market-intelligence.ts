
'use client';

/**
 * @fileOverview Marketplace Commercial Intelligence Service.
 * Tracks student and staff behavior to build a high-fidelity intent profile.
 * Upgraded with Notification FCM tokens and Follower Logic.
 * Now includes Trending Retrieval, Atomic Event Tracking, and Demand Aggregation.
 */

import { doc, increment, setDoc, Firestore, getDoc, serverTimestamp, collection, query, where, orderBy, limit, getDocs, addDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { Product, Order, ProductTrend, NotificationSettings, MarketRequest } from './types';
import { computeTrendScore } from './compute-trend-score';
import { applyTrendDecay } from './apply-trend-decay';

export type CommercialSignal = 'view' | 'favorite' | 'intent' | 'purchase' | 'share';

/**
 * updateDemandSignal
 * -------------------
 * Aggregates student demand into high-level signals for vendors.
 */
export async function updateDemandSignal(
  firestore: Firestore,
  item: string,
  campusId: string
) {
  const normalizedItem = item.toLowerCase().trim();
  const signalId = `${normalizedItem}_${campusId}`;
  const ref = doc(firestore, "demand_signals", signalId);

  return setDoc(ref, {
    item: normalizedItem,
    campusId,
    demandCount: increment(1),
    lastUpdated: serverTimestamp()
  }, { merge: true });
}

/**
 * createMarketRequest
 * -------------------
 * Logic to persist a student's marketplace request (Demand Signal).
 * Now triggers atomic aggregation for the Demand Engine.
 */
export async function createMarketRequest(
  firestore: Firestore,
  userId: string,
  userName: string,
  queryText: string,
  campusId: string,
  aiMetadata: { category: string; tags: string[]; condition: string }
) {
  const ref = collection(firestore, "market_requests");
  const requestData: Omit<MarketRequest, 'id'> = {
    userId,
    userName,
    query: queryText,
    category: aiMetadata.category || 'general',
    tags: aiMetadata.tags || [],
    condition: aiMetadata.condition || 'any',
    campusId,
    createdAt: serverTimestamp(),
    status: 'open',
    matchCount: 0
  };

  const docRef = await addDoc(ref, requestData);
  
  // 🧠 1. AGGREGATE DEMAND: Increment count for the specific item on this campus
  // We use the primary AI-extracted tag as the "Item" for clustering
  const primaryItem = aiMetadata.tags?.[0] || aiMetadata.category || 'item';
  updateDemandSignal(firestore, primaryItem, campusId).catch(e => console.error("Aggregation failed:", e));

  return docRef;
}

/**
 * trackProductEvent
 * -----------------
 * Atomic event tracking for the trending engine.
 */
export async function trackProductEvent(
  firestore: Firestore,
  productId: string,
  eventType: 'view' | 'cart' | 'purchase' | 'share',
  campusId: string
) {
  const ref = doc(firestore, "product_trends", productId);

  const updates: any = {
    productId,
    campusId,
    lastUpdated: serverTimestamp()
  };

  if (eventType === "view") updates.viewCount = increment(1);
  if (eventType === "cart") updates.cartCount = increment(1);
  if (eventType === "purchase") updates.purchaseCount = increment(1);
  if (eventType === "share") updates.shareCount = increment(1);

  return setDoc(ref, updates, { merge: true });
}

/**
 * getTrendingProducts
 * -------------------
 * Retrieves high-velocity products for a specific campus leaderboard.
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
  const trends = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProductTrend));

  const scored = trends.map(trend => {
    let score = computeTrendScore(trend);
    
    // Handle both ISO string and Firestore Timestamp for decay
    const lastUpdated = trend.lastUpdated?.toDate 
      ? trend.lastUpdated.toDate() 
      : new Date(trend.lastUpdated);

    score = applyTrendDecay(score, lastUpdated);

    return {
      productId: trend.productId,
      score
    };
  });

  // Sort by final decayed score
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 20);
}

/**
 * recordMarketSignal
 * ------------------
 * Logs a behavioral event to the user's market profile and the product's velocity bucket.
 * Now logs detailed product views for personalized notifications.
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
  
  // Track specifically for the trending engine aggregate
  const trendingEventType = signal === 'intent' ? 'cart' : (signal as any);
  if (['view', 'cart', 'purchase', 'share'].includes(trendingEventType)) {
    trackProductEvent(firestore, product.id, trendingEventType, product.campusId);
  }

  const profileUpdates: any = { updatedAt: serverTimestamp() };
  const productAggregates: any = {};

  switch (signal) {
    case 'view':
      profileUpdates[`viewedCategories.${product.category}`] = increment(1);
      productAggregates.viewCount = increment(1);
      
      // 🕵️ DETAILED VIEW TRACKING (For Price Drop Alerts)
      addDoc(collection(firestore, 'user_product_views'), {
        userId,
        productId: product.id,
        viewedAt: new Date().toISOString()
      }).catch(() => {});
      break;
    case 'favorite':
      profileUpdates.favoriteProducts = arrayUnion(product.id);
      productAggregates.favoriteCount = increment(1);
      break;
    case 'share':
      productAggregates.shareCount = increment(1);
      break;
    case 'intent':
      profileUpdates[`intentCategories.${product.category}`] = increment(1);
      profileUpdates[`favoriteVendors.${product.vendorId}`] = increment(1);
      break;
    case 'purchase':
      profileUpdates[`purchasedCategories.${product.category}`] = increment(1);
      profileUpdates[`favoriteVendors.${product.vendorId}`] = increment(1);
      productAggregates.salesCount = increment(1);
      updateCoPurchaseCorrelation(firestore, userId, product.id);
      break;
  }

  setDoc(profileRef, profileUpdates, { merge: true }).catch(() => {});
  if (Object.keys(productAggregates).length > 0) {
    setDoc(statsRef, productAggregates, { merge: true }).catch(() => {});
  }
}

/**
 * updateNotificationSettings
 * --------------------------
 * Persists user notification preferences.
 */
export async function updateNotificationSettings(
    firestore: Firestore,
    userId: string,
    settings: Partial<NotificationSettings>
) {
    const ref = doc(firestore, 'user_notifications', userId);
    return setDoc(ref, { userId, ...settings, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * toggleFollowVendor
 * -----------------
 * Subscribes or unsubscribes a user from a specific vendor's updates.
 */
export async function toggleFollowVendor(firestore: Firestore, userId: string, vendorId: string, isFollowing: boolean) {
    const userRef = doc(firestore, 'users', userId);
    try {
        if (isFollowing) {
            await setDoc(userRef, { followedVendors: arrayRemove(vendorId) }, { merge: true });
        } else {
            await setDoc(userRef, { followedVendors: arrayUnion(vendorId) }, { merge: true });
        }
    } catch (e) {
        console.error("Follow toggle failed:", e);
    }
}

/**
 * saveFcmToken
 * ------------
 * Persists the user's notification token to their profile.
 */
export async function saveFcmToken(firestore: Firestore, userId: string, token: string) {
    const userRef = doc(firestore, 'users', userId);
    return setDoc(userRef, { fcmToken: token, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * toggleFavoriteProduct
 */
export async function toggleFavoriteProduct(firestore: Firestore, userId: string, product: Product, isFavorited: boolean) {
    const profileRef = doc(firestore, 'user_market_profiles', userId);
    const productRef = doc(firestore, 'products', product.id);
    try {
        if (isFavorited) {
            await setDoc(profileRef, { favoriteProducts: arrayRemove(product.id) }, { merge: true });
            await setDoc(productRef, { favoriteCount: increment(-1) }, { merge: true });
        } else {
            await recordMarketSignal(firestore, userId, product, 'favorite');
        }
    } catch (e) { console.error("Favorite toggle failed:", e); }
}

/**
 * updateCoPurchaseCorrelation
 */
async function updateCoPurchaseCorrelation(firestore: Firestore, userId: string, newProductId: string) {
    try {
        const q = query(collection(firestore, 'orders'), where('buyerId', '==', userId), where('status', 'in', ['picked-up', 'completed', 'archived']), orderBy('createdAt', 'desc'), limit(6));
        const snap = await getDocs(q);
        const purchasedIds = Array.from(new Set(snap.docs.map(d => (d.data() as Order).productId).filter(id => id !== newProductId))).slice(0, 5);
        if (purchasedIds.length === 0) return;
        for (const historicalId of purchasedIds) {
            const pair = [newProductId, historicalId].sort();
            const correlationId = `${pair[0]}_${pair[1]}`;
            const ref = doc(firestore, 'product_co_purchases', correlationId);
            setDoc(ref, { productA: pair[0], productB: pair[1], count: increment(1), lastUpdated: serverTimestamp() }, { merge: true }).catch(() => {});
        }
    } catch (err) { console.warn("Co-Purchase Sync Failed:", err); }
}

/**
 * getRelatedProducts
 */
export async function getRelatedProducts(firestore: Firestore, productId: string) {
    if (!firestore || !productId) return [];
    try {
        const qA = query(collection(firestore, 'product_co_purchases'), where('productA', '==', productId), orderBy('count', 'desc'), limit(10));
        const qB = query(collection(firestore, 'product_co_purchases'), where('productB', '==', productId), orderBy('count', 'desc'), limit(10));
        const [snapA, snapB] = await Promise.all([getDocs(qA), getDocs(qB)]);
        const results = [...snapA.docs, ...snapB.docs].map(d => {
            const data = d.data();
            return { id: data.productA === productId ? data.productB : data.productA, count: data.count };
        }).sort((a, b) => b.count - a.count).slice(0, 10);
        return results;
    } catch (err) { console.error("Related Retrieval Error:", err); return []; }
}
