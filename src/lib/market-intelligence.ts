
'use client';

/**
 * @fileOverview Marketplace Commercial Intelligence Service.
 * Now synchronized with the Unified User Intelligence Engine.
 */

import { doc, increment, setDoc, Firestore, getDoc, serverTimestamp, collection, query, where, orderBy, limit, getDocs, addDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { Product, Order, MarketplaceSignal, NotificationSettings, MarketRequest, DemandSignal } from './types';
import { recordUnifiedSignal, updateMarketInterest } from './user-intelligence';

/**
 * recordMarketSignal
 * ------------------
 * Enhanced to relay signals to the Unified Brain.
 */
export async function recordMarketSignal(
  firestore: Firestore,
  userId: string,
  product: Product,
  signal: 'view' | 'favorite' | 'intent' | 'purchase' | 'share'
) {
  if (!firestore || !userId || !product) return;

  // 1. Log to legacy product stats
  const statsRef = doc(firestore, 'products', product.id);
  const productAggregates: any = { updatedAt: serverTimestamp() };

  // 2. Relay to Unified Intelligence Brain 🧠
  // We use the specific updateMarketInterest for deep interest mapping
  updateMarketInterest(firestore, userId, product, signal === 'purchase');

  const unifiedSignalType: MarketplaceSignal = signal === 'share' ? 'click' : signal;
  recordUnifiedSignal(firestore, userId, unifiedSignalType, {
    category: product.category,
    tags: product.tags,
    vendorId: product.vendorId,
    price: product.price
  });

  // Handle legacy specific product aggregation
  switch (signal) {
    case 'view':
      productAggregates.viewCount = increment(1);
      break;
    case 'favorite':
      productAggregates.favoriteCount = increment(1);
      break;
    case 'share':
      productAggregates.shareCount = increment(1);
      break;
    case 'purchase':
      productAggregates.salesCount = increment(1);
      break;
  }

  return setDoc(statsRef, productAggregates, { merge: true }).catch(() => {});
}

/**
 * trackVideoProductClick
 */
export async function trackVideoProductClick(
  firestore: Firestore,
  videoId: string,
  productId: string,
  userId: string
) {
  if (!firestore || !videoId || !productId) return;

  // Audit conversion
  await addDoc(collection(firestore, "video_product_clicks"), {
    videoId,
    productId,
    userId,
    timestamp: new Date().toISOString()
  });

  // Boost video score
  return setDoc(doc(firestore, "campus_pulse", videoId), {
    commerceClicks: increment(1)
  }, { merge: true });
}

export async function searchMarketplaceProducts(firestore: Firestore, campusId: string, searchTerm: string) {
  if (!firestore || !searchTerm) return [];
  const q = query(collection(firestore, "products"), where("campusId", "==", campusId), limit(50));
  const snapshot = await getDocs(q);
  const term = searchTerm.toLowerCase().trim();
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Product))
    .filter(p => p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term))
    .slice(0, 10);
}

export async function createMarketRequest(
  firestore: Firestore,
  userId: string,
  userName: string,
  queryText: string,
  campusId: string,
  aiMetadata: { category: string; tags: string[]; condition: string; location?: string }
) {
  const ref = collection(firestore, "market_requests");
  const requestData = {
    userId, userName, query: queryText,
    category: aiMetadata.category || 'general',
    tags: aiMetadata.tags || [],
    condition: aiMetadata.condition || 'any',
    campusId, location: aiMetadata.location || 'Yard General',
    createdAt: serverTimestamp(),
    status: 'open',
  };
  return addDoc(ref, requestData);
}

export async function toggleFavoriteProduct(firestore: Firestore, userId: string, product: Product, isFavorited: boolean) {
    if (isFavorited) {
        await setDoc(doc(firestore, 'user_intelligence', userId), { favoriteProducts: arrayRemove(product.id) }, { merge: true });
    } else {
        await recordMarketSignal(firestore, userId, product, 'favorite');
    }
}
