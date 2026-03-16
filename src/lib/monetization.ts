
'use client';

/**
 * @fileOverview Liaison Monetization Engine: Wallet Transactions.
 * Implements Step 2, 3, 5 & 6: Spam Prevention, Revenue Split, Paid Boosting & Tournament Entry.
 */

import { Firestore, doc, increment, runTransaction, updateDoc, collection, addDoc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import type { ArenaTournament } from './types';

/**
 * 💎 PROMOTION PACKAGES (Step 5)
 */
export const PROMOTION_PACKAGES = {
  small: { cost: 100, target: 5000, label: 'Small: 5,000 Views' },
  medium: { cost: 300, target: 20000, label: 'Medium: 20,000 Views' },
  large: { cost: 700, target: 50000, label: 'Large: 50,000 Views' }
};

/**
 * addCoins
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
 */
export async function spendCoins(
  db: Firestore, 
  userId: string, 
  amount: number, 
  type: 'gift_sent' | 'powerup_used' | 'tournament_entry' | 'highlight_boost',
  metadata: { 
    battleId?: string; 
    targetCreatorId?: string;
    userName?: string;
    userAvatarUrl?: string;
    boostTier?: string;
    tournamentId?: string;
  } = {}
) {
  if (!db || !userId || amount <= 0) return Promise.reject("Invalid amount");

  const walletRef = doc(db, 'wallets', userId);
  const historyRef = collection(db, 'wallet_transactions');
  const creatorId = metadata.targetCreatorId;
  const battleId = metadata.battleId;

  return runTransaction(db, async (transaction) => {
    const walletDoc = await transaction.get(walletRef);
    if (!walletDoc.exists()) throw new Error("Wallet node not found.");
    
    const currentCoins = walletDoc.data().coins || 0;
    if (currentCoins < amount) throw new Error("Insufficient Hub Coins artillery.");

    transaction.update(walletRef, {
      coins: currentCoins - amount,
      totalSpent: increment(amount),
      updatedAt: serverTimestamp()
    });

    if (creatorId && type !== 'highlight_boost' && type !== 'tournament_entry') {
      const creatorWalletRef = doc(db, 'creator_wallets', creatorId);
      const earnedAmount = Math.floor(amount * 0.5); 
      
      transaction.set(creatorWalletRef, {
        earnedCoins: increment(earnedAmount),
        totalEarned: increment(earnedAmount),
        updatedAt: serverTimestamp()
      }, { merge: true });

      const leaderRef = doc(db, 'arena_leaderboard', creatorId);
      transaction.set(leaderRef, {
        boostsReceived: type === 'powerup_used' ? increment(1) : increment(0),
        giftsReceived: type === 'gift_sent' ? increment(1) : increment(0),
        coinsEarned: increment(earnedAmount),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    if (battleId && metadata.userName) {
        const battleSupporterRef = doc(db, 'arena_battles', battleId, 'gift_leaderboard', userId);
        transaction.set(battleSupporterRef, {
            userName: metadata.userName,
            avatarUrl: metadata.userAvatarUrl || '',
            coinsSent: increment(amount),
            updatedAt: serverTimestamp()
        }, { merge: true });
    }

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

/**
 * boostVibe
 */
export async function boostVibe(
  db: Firestore,
  userId: string,
  postId: string,
  tier: keyof typeof PROMOTION_PACKAGES
) {
  const pack = PROMOTION_PACKAGES[tier];
  
  await spendCoins(db, userId, pack.cost, 'highlight_boost', {
    boostTier: tier,
    targetCreatorId: userId 
  });

  const postRef = doc(db, 'campus_pulse', postId);
  return updateDoc(postRef, {
    isPromoted: true,
    promotionLevel: tier,
    promotionViewsTarget: pack.target,
    promotionViewsDelivered: 0,
    promotedAt: serverTimestamp()
  });
}

/**
 * joinTournament (Step 6)
 * ---------------------
 * Orchestrates structured competition entry.
 */
export async function joinTournament(
  db: Firestore,
  userId: string,
  userName: string,
  avatarUrl: string,
  tournamentId: string
) {
  const tournamentRef = doc(db, 'arena_tournaments', tournamentId);
  const participantRef = doc(db, 'arena_tournaments', tournamentId, 'participants', userId);

  return runTransaction(db, async (transaction) => {
    // 1. Verify Entry Eligibility
    const tourneySnap = await transaction.get(tournamentRef);
    if (!tourneySnap.exists()) throw new Error("Tournament not found.");
    
    const tourney = tourneySnap.data() as ArenaTournament;
    if (tourney.status !== 'registration') throw new Error("Registration is closed.");
    if (tourney.currentPlayers >= tourney.maxPlayers) throw new Error("Tournament is full.");

    const participantSnap = await transaction.get(participantRef);
    if (participantSnap.exists()) throw new Error("Already registered.");

    // 2. Spend entry fee (Wallet Audit)
    await spendCoins(db, userId, tourney.entryFeeCoins, 'tournament_entry', {
        tournamentId,
        userName
    });

    // 3. Register & Update National Hub
    transaction.set(participantRef, {
        userId,
        userName,
        avatarUrl,
        joinedAt: serverTimestamp()
    });

    transaction.update(tournamentRef, {
        currentPlayers: increment(1),
        prizePool: increment(tourney.entryFeeCoins), // Entry fees feed the prize pool
        updatedAt: serverTimestamp()
    });

  });
}
