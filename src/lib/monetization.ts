
'use client';

/**
 * @fileOverview Liaison Monetization Engine: Wallet Transactions.
 * Implements Step 2, 3, 5, 6 & 7: Spam Prevention, Revenue Split, Paid Boosting, Tournament Entry & Subscriptions.
 */

import { Firestore, doc, increment, runTransaction, updateDoc, collection, addDoc, serverTimestamp, getDoc, setDoc, writeBatch, arrayUnion } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import type { ArenaTournament, CreatorSubscription, CreatorSettings } from './types';

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
 * subscribeToCreator (Step 7)
 * --------------------------
 * Establishes a recurring monthly relationship between a fan and a creator.
 * Implements the requested 70/30 Revenue Split.
 */
export async function subscribeToCreator(
    db: Firestore,
    subscriberId: string,
    creatorId: string,
    amountGHS: number,
    paystackRef: string
) {
    if (!db || !subscriberId || !creatorId) return;

    const subId = `${subscriberId}_${creatorId}`;
    const auditRef = doc(db, 'creator_subscriptions', subId);
    const benefitRef = doc(db, 'creator_subscribers', creatorId, 'subscribers', subscriberId);
    const userRef = doc(db, 'users', subscriberId);
    const settingsRef = doc(db, 'creator_settings', creatorId);
    const analyticsRef = doc(db, 'creator_analytics', creatorId);
    const revenueRef = doc(db, 'platform_stats', 'revenue');

    const now = new Date();
    const renewalDate = new Date();
    renewalDate.setDate(now.getDate() + 30); 

    // THE REVENUE SPLIT: Creator (70%) / Hub (30%)
    const creatorNet = amountGHS * 0.7;
    const platformCut = amountGHS * 0.3;

    const subData = {
        creatorId,
        subscriberId,
        priceMonthly: amountGHS,
        status: 'active',
        paystackReference: paystackRef,
        startDate: serverTimestamp(),
        renewalDate: renewalDate.toISOString(),
        updatedAt: serverTimestamp()
    };

    return runTransaction(db, async (transaction) => {
        // 1. Audit Trail (Billing Node)
        transaction.set(auditRef, subData, { merge: true });

        // 2. Benefit Node (For content gating)
        transaction.set(benefitRef, {
            subscriberSince: serverTimestamp(),
            status: 'active'
        });

        // 3. User Profile Cache (Zero-latency UI check)
        transaction.update(userRef, {
            subscribedCreators: arrayUnion(creatorId)
        });

        // 4. Update Creator Stats & Analytics
        transaction.set(settingsRef, {
            subscriberCount: increment(1),
            updatedAt: serverTimestamp()
        }, { merge: true });

        transaction.set(analyticsRef, {
            activeSubscribers: increment(1),
            newSubscribersLast30: increment(1),
            monthlyIncomeGHS: increment(creatorNet),
            totalNetEarningsGHS: increment(creatorNet),
            updatedAt: serverTimestamp()
        }, { merge: true });

        // 5. Update Platform Hub Revenue
        transaction.set(revenueRef, {
            total_fees_collected: increment(platformCut),
            last_updated: serverTimestamp()
        }, { merge: true });

        // 6. Log notification for creator
        const notifRef = doc(collection(db, 'users', creatorId, 'notifications'));
        transaction.set(notifRef, {
            type: 'subscription',
            title: "New Inner Circle Member! 💎",
            message: `A fan has subscribed to your channel for GHS ${amountGHS}/mo.`,
            link: `/chat`,
            read: false,
            createdAt: serverTimestamp()
        });
    });
}

/**
 * joinTournament (Step 6)
 */
export async function joinTournament(
  db: Firestore,
  userId: string,
  userName: string,
  avatarUrl: string,
  tournamentId: string
) {
  const tournamentRef = doc(db, 'arena_tournaments', tournamentId);
  const playerRef = doc(db, 'arena_tournaments', tournamentId, 'players', userId);

  return runTransaction(db, async (transaction) => {
    const tourneySnap = await transaction.get(tournamentRef);
    if (!tourneySnap.exists()) throw new Error("Tournament not found.");
    
    const tourney = tourneySnap.data() as ArenaTournament;
    if (tourney.status !== 'registration') throw new Error("Registration is closed.");
    if (tourney.currentPlayers >= tourney.maxPlayers) throw new Error("Tournament is full.");

    const playerSnap = await transaction.get(playerRef);
    if (playerSnap.exists()) throw new Error("Already registered.");

    await spendCoins(db, userId, tourney.entryFeeCoins, 'tournament_entry', {
        tournamentId,
        userName
    });

    transaction.set(playerRef, {
        userId,
        userName,
        avatarUrl,
        eliminated: false,
        round: 1,
        joinedAt: serverTimestamp()
    });

    transaction.update(tournamentRef, {
        currentPlayers: increment(1),
        prizePool: increment(tourney.entryFeeCoins),
        updatedAt: serverTimestamp()
    });
  });
}

/**
 * distributeTournamentPrizes (Step 6)
 */
export async function distributeTournamentPrizes(
    db: Firestore, 
    tournamentId: string,
    winners: { first: string, second: string, third: string }
) {
    const tournamentRef = doc(db, 'arena_tournaments', tournamentId);
    const historyRef = collection(db, 'wallet_transactions');

    return runTransaction(db, async (transaction) => {
        const tourneySnap = await transaction.get(tournamentRef);
        if (!tourneySnap.exists()) throw new Error("Tournament node not found.");
        
        const data = tourneySnap.data() as ArenaTournament;
        const totalPool = data.prizePool;
        
        const platformFee = Math.floor(totalPool * 0.20);
        const prizeFund = totalPool - platformFee;

        const firstPrize = Math.floor(prizeFund * 0.60);
        const secondPrize = Math.floor(prizeFund * 0.25);
        const thirdPrize = Math.floor(prizeFund * 0.15);

        const payouts = [
            { userId: winners.first, amount: firstPrize, rank: '1st' },
            { userId: winners.second, amount: secondPrize, rank: '2nd' },
            { userId: winners.third, amount: thirdPrize, rank: '3rd' }
        ];

        for (const p of payouts) {
            const walletRef = doc(db, 'wallets', p.userId);
            transaction.update(walletRef, {
                coins: increment(p.amount),
                updatedAt: serverTimestamp()
            });

            const txRef = doc(historyRef);
            transaction.set(txRef, {
                userId: p.userId,
                type: 'gift_received',
                coins: p.amount,
                metadata: {
                    tournamentId,
                    tournamentName: data.name,
                    rank: p.rank,
                    isTournamentPrize: true
                },
                createdAt: serverTimestamp()
            });
        }

        transaction.update(tournamentRef, {
            status: 'finished',
            platformFeeCollected: platformFee,
            finalWinners: winners,
            updatedAt: serverTimestamp()
        });
    });
}
