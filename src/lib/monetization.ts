
'use client';

/**
 * @fileOverview Liaison Monetization Engine: Wallet Transactions.
 * Implements safe, atomic functions for adding and spending Hub Coins.
 * Synchronized with the Hub Error Emitter for security audit context.
 * Now logs transaction history.
 */

import { Firestore, doc, increment, runTransaction, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * addCoins
 * --------
 * Standardized handshake to increase a user's coin balance.
 * logs a 'purchase' transaction history record.
 */
export async function addCoins(db: Firestore, userId: string, coins: number, amountPaidGHS?: number) {
  if (!db || !userId || coins <= 0) return;

  const walletRef = doc(db, 'wallets', userId);
  const historyRef = collection(db, 'wallet_transactions');

  const updateData = {
    coins: increment(coins),
    totalPurchased: increment(coins),
    updatedAt: serverTimestamp()
  };

  const historyData = {
    userId,
    type: 'purchase',
    coins,
    amountPaidGHS: amountPaidGHS || 0,
    createdAt: serverTimestamp()
  };

  // Perform as individual writes for responsiveness (Pattern 1)
  updateDoc(walletRef, updateData).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: walletRef.path,
      operation: 'update',
      requestResourceData: updateData,
    } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
  });

  addDoc(historyRef, historyData).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: historyRef.path,
      operation: 'create',
      requestResourceData: historyData,
    } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
  });
}

/**
 * spendCoins
 * ----------
 * High-integrity transaction to deduct coins for Arena actions.
 * Audits balance before commit and logs transaction history.
 */
export async function spendCoins(
  db: Firestore, 
  userId: string, 
  amount: number, 
  type: 'gift_sent' | 'powerup_used' | 'tournament_entry',
  metadata: any = {}
) {
  if (!db || !userId || amount <= 0) return Promise.reject("Invalid amount");

  const walletRef = doc(db, 'wallets', userId);
  const historyRef = collection(db, 'wallet_transactions');

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

    // 1. Update Wallet
    transaction.update(walletRef, {
      coins: currentCoins - amount,
      totalSpent: increment(amount),
      updatedAt: serverTimestamp()
    });

    // 2. Log History
    const historyData = {
      userId,
      type,
      coins: amount,
      metadata,
      createdAt: serverTimestamp()
    };
    
    // addDoc isn't directly usable in transaction, so we use a doc reference
    const newHistoryRef = doc(historyRef);
    transaction.set(newHistoryRef, historyData);

  }).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: walletRef.path,
      operation: 'update',
      requestResourceData: { amountSpent: amount, type }
    } satisfies SecurityRuleContext);

    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  });
}
