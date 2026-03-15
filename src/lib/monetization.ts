
'use client';

/**
 * @fileOverview Liaison Monetization Engine: Wallet Transactions.
 * Implements safe, atomic functions for adding and spending Hub Coins.
 * Synchronized with the Hub Error Emitter for security audit context.
 */

import { Firestore, doc, increment, runTransaction, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * addCoins
 * --------
 * Standardized handshake to increase a user's coin balance.
 * Typically called after a successful MoMo payment.
 */
export function addCoins(db: Firestore, userId: string, amount: number) {
  if (!db || !userId || amount <= 0) return;

  const ref = doc(db, 'wallets', userId);
  const updateData = {
    coins: increment(amount),
    totalPurchased: increment(amount),
    updatedAt: new Date().toISOString()
  };

  // 🏎️ NON-BLOCKING HANDSHAKE: Update cache immediately
  updateDoc(ref, updateData).catch(async (serverError) => {
    // Create the rich, contextual error asynchronously.
    const permissionError = new FirestorePermissionError({
      path: ref.path,
      operation: 'update',
      requestResourceData: updateData,
    } satisfies SecurityRuleContext);

    // Emit the error with the global error emitter
    errorEmitter.emit('permission-error', permissionError);
  });
}

/**
 * spendCoins
 * ----------
 * High-integrity transaction to deduct coins for Arena actions.
 * Audits balance before commit to prevent "Negative Artillery" states.
 */
export function spendCoins(db: Firestore, userId: string, amount: number) {
  if (!db || !userId || amount <= 0) return Promise.reject("Invalid amount");

  const walletRef = doc(db, 'wallets', userId);

  // 🛡️ ATOMIC TRANSACTION: Ensuring read-before-write integrity
  return runTransaction(db, async (transaction) => {
    const walletDoc = await transaction.get(walletRef);
    
    if (!walletDoc.exists()) {
      throw new Error("Liaison Alert: Wallet node not found.");
    }

    const currentCoins = walletDoc.data().coins || 0;
    
    if (currentCoins < amount) {
      throw new Error("Insufficient Hub Coins artillery for this action.");
    }

    const updateData = {
      coins: currentCoins - amount, // Explicit subtraction within TX
      totalSpent: increment(amount),
      updatedAt: new Date().toISOString()
    };

    transaction.update(walletRef, updateData);
  }).catch(async (serverError) => {
    // Handle security rule rejections or logical errors
    const permissionError = new FirestorePermissionError({
      path: walletRef.path,
      operation: 'update',
      requestResourceData: { amountSpent: amount }
    } satisfies SecurityRuleContext);

    errorEmitter.emit('permission-error', permissionError);
    throw serverError; // Re-throw for UI error handling
  });
}
