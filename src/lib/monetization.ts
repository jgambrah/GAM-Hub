
'use client';

/**
 * @fileOverview Liaison Monetization Engine: Wallet Transactions.
 * Implements Step 2: Spam Prevention & 50/50 Creator Revenue Split.
 */

import { Firestore, doc, increment, runTransaction, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * addCoins
 * --------
 * Standardized handshake to increase a user's balance.
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

  updateDoc(walletRef, updateData).catch(async (serverError) => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: walletRef.path,
      operation: 'update',
      requestResourceData: updateData,
    }));
  });

  addDoc(historyRef, historyData).catch(async (serverError) => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: historyRef.path,
      operation: 'create',
      requestResourceData: historyData,
    }));
  });
}

/**
 * spendCoins
 * ----------
 * High-integrity transaction with 50/50 Creator Split logic.
 */
export async function spendCoins(
  db: Firestore, 
  userId: string, 
  amount: number, 
  type: 'gift_sent' | 'powerup_used' | 'tournament_entry',
  metadata: { battleId?: string; targetCreatorId?: string } = {}
) {
  if (!db || !userId || amount <= 0) return Promise.reject("Invalid amount");

  const walletRef = doc(db, 'wallets', userId);
  const historyRef = collection(db, 'wallet_transactions');
  const creatorId = metadata.targetCreatorId;

  return runTransaction(db, async (transaction) => {
    // 1. Audit Viewer Balance
    const walletDoc = await transaction.get(walletRef);
    if (!walletDoc.exists()) throw new Error("Wallet node not found.");
    
    const currentCoins = walletDoc.data().coins || 0;
    if (currentCoins < amount) throw new Error("Insufficient Hub Coins artillery.");

    // 2. Viewer Deduction (100% of cost)
    transaction.update(walletRef, {
      coins: currentCoins - amount,
      totalSpent: increment(amount),
      updatedAt: serverTimestamp()
    });

    // 3. Creator Payout (50% Split)
    if (creatorId) {
      const creatorWalletRef = doc(db, 'creator_wallets', creatorId);
      const earnedAmount = Math.floor(amount * 0.5); // The Arena's 50% cut stays in platform pool
      
      transaction.set(creatorWalletRef, {
        earnedCoins: increment(earnedAmount),
        totalEarned: increment(earnedAmount),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    // 4. Log History
    const historyData = {
      userId,
      type,
      coins: amount,
      metadata,
      createdAt: serverTimestamp()
    };
    
    const newHistoryRef = doc(historyRef);
    transaction.set(newHistoryRef, historyData);

  }).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: walletRef.path,
      operation: 'update',
      requestResourceData: { amountSpent: amount, type }
    });
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  });
}
