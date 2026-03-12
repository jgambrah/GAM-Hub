
'use client';

/**
 * @fileOverview Marketplace Commercial Intelligence Service.
 * Tracks student and staff behavior to build a high-fidelity intent profile.
 * Upgraded with Dual-Write Velocity Tracking for real-time trending detection.
 */

import { doc, increment, setDoc, Firestore, getDoc, serverTimestamp } from 'firebase/firestore';
import type { Product } from './types';

/**
 * recordMarketSignal
 * ------------------
 * Logs a behavioral event to the user's market profile and the product's velocity bucket.
 * Handles category counters, vendor affinity, and price range preferences.
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
