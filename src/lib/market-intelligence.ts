
'use client';

/**
 * @fileOverview Marketplace Commercial Intelligence Service.
 * Tracks student and staff behavior to build a high-fidelity intent profile.
 * Shared signals allow video discovery to influence product recommendations.
 */

import { doc, increment, setDoc, Firestore, getDoc } from 'firebase/firestore';
import type { Product } from './types';

/**
 * recordMarketSignal
 * ------------------
 * Logs a behavioral event to the user's market profile.
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
  
  // 1. Prepare incremental updates based on signal intensity
  const updates: any = {
    updatedAt: new Date().toISOString(),
  };

  if (signal === 'view') {
    // Light Signal: User is browsing
    updates[`viewedCategories.${product.category}`] = increment(1);
  } else if (signal === 'intent') {
    // Medium Signal: User clicked 'Buy Now' or 'Apply'
    updates[`intentCategories.${product.category}`] = increment(1);
    updates[`favoriteVendors.${product.vendorId}`] = increment(1);
  } else if (signal === 'purchase') {
    // Strong Signal: Order completed/Handshake successful
    updates[`purchasedCategories.${product.category}`] = increment(1);
    updates[`favoriteVendors.${product.vendorId}`] = increment(1);
  }

  // 2. Price Preference Balancing
  // We perform a light read-then-write to update the min/max range.
  try {
    const snap = await getDoc(profileRef);
    const data = snap.data() || {};
    const currentPrefs = data.pricePreference || { min: product.price, max: product.price };
    
    // We only update if the new product is outside the current interest range
    updates.pricePreference = {
      min: Math.min(currentPrefs.min, product.price),
      max: Math.max(currentPrefs.max, product.price)
    };

    // Use non-blocking pattern for the final write
    setDoc(profileRef, updates, { merge: true }).catch(err => {
        console.warn("Market Intel: Final write failed", err);
    });
  } catch (err) {
    console.warn("Liaison Market Intel: Profile sync interrupted.", err);
  }
}
