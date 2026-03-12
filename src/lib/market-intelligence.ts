
'use client';

/**
 * @fileOverview Marketplace Commercial Intelligence Service.
 * Tracks student and staff behavior to build a high-fidelity intent profile.
 * Upgraded with Notification FCM tokens and Follower Logic.
 * Now includes User Notifications and Detailed Product View tracking.
 */

import { doc, increment, setDoc, Firestore, getDoc, serverTimestamp, collection, query, where, orderBy, limit, getDocs, addDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { Product, Order, ProductTrend, NotificationSettings } from './types';
import { computeTrendScore } from './compute-trend-score';
import { applyTrendDecay } from './apply-trend-decay';

export type CommercialSignal = 'view' | 'favorite' | 'intent' | 'purchase' | 'share';

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
  const trendRef = doc(firestore, 'product_trends', product.id);
  
  const minuteBucket = new Date().toISOString().slice(0, 16); 
  const velocityRef = doc(firestore, 'product_velocity', product.id, 'minutes', minuteBucket);

  const profileUpdates: any = { updatedAt: serverTimestamp() };
  const velocityUpdates: any = {};
  const productAggregates: any = {};
  const trendUpdates: any = {
    productId: product.id,
    campusId: product.campusId,
    lastUpdated: serverTimestamp()
  };

  switch (signal) {
    case 'view':
      profileUpdates[`viewedCategories.${product.category}`] = increment(1);
      velocityUpdates.views = increment(1);
      productAggregates.viewCount = increment(1);
      trendUpdates.viewCount = increment(1);
      
      // 🕵️ DETAILED VIEW TRACKING (For Price Drop Alerts)
      addDoc(collection(firestore, 'user_product_views'), {
        userId,
        productId: product.id,
        viewedAt: new Date().toISOString()
      }).catch(() => {});
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
      trendUpdates.cartCount = increment(1);
      break;
    case 'purchase':
      profileUpdates[`purchasedCategories.${product.category}`] = increment(1);
      profileUpdates[`favoriteVendors.${product.vendorId}`] = increment(1);
      velocityUpdates.purchases = increment(1);
      productAggregates.salesCount = increment(1);
      trendUpdates.purchaseCount = increment(1);
      updateCoPurchaseCorrelation(firestore, userId, product.id);
      break;
  }

  setDoc(profileRef, profileUpdates, { merge: true }).catch(() => {});
  setDoc(velocityRef, velocityUpdates, { merge: true }).catch(() => {});
  setDoc(trendRef, trendUpdates, { merge: true }).catch(() => {});
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
 * getTrendingProducts (Existing)
 */
export async function getTrendingProducts(firestore: Firestore, campusId: string) {
  const q = query(collection(firestore, "product_trends"), where("campusId", "==", campusId), limit(100));
  const snapshot = await getDocs(q);
  const trends = snapshot.docs.map(d => d.data() as ProductTrend);
  const scored = trends.map(trend => {
    let score = computeTrendScore(trend);
    const lastUpdated = trend.lastUpdated?.toDate ? trend.lastUpdated.toDate() : new Date(trend.lastUpdated);
    score = applyTrendDecay(score, lastUpdated);
    return { productId: trend.productId, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 20);
}

/**
 * toggleFavoriteProduct (Existing)
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
 * updateCoPurchaseCorrelation (Existing)
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
 * getRelatedProducts (Existing)
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
