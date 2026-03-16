
const {onDocumentUpdated, onDocumentCreated, onDocumentDeleted} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onObjectFinalized} = require("firebase-functions/v2/storage");
const {beforeUserCreated} = require("firebase-functions/v2/identity");
const {setGlobalOptions} = require("firebase-functions");
const admin = require("firebase-admin");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const path = require("path");
const os = require("os");
const fs = require("fs");
const axios = require("axios");

ffmpeg.setFfmpegPath(ffmpegPath);

if (!admin.apps.length) {
  admin.initializeApp();
}
setGlobalOptions({maxInstances: 10});

/**
 * 💰 MONETIZATION: AUTO-CREATE WALLET ON SIGNUP
 */
exports.createUserWallet = beforeUserCreated(async (event) => {
  const db = admin.firestore();
  const user = event.data;
  
  // Provision the wallet immediately during the creation flow
  await db.collection("wallets").doc(user.uid).set({
    coins: 0,
    totalPurchased: 0,
    totalSpent: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return {};
});

/**
 * 🛡️ ARENA RING: SMART AUTO-MATCHMAKER
 */
exports.autoMatchBattles = onDocumentCreated("arena_waiting_pool/{entryId}", async (event) => {
  const db = admin.firestore();
  const newEntry = event.data.data();
  const entryId = event.params.entryId;

  return db.runTransaction(async (transaction) => {
    const poolQuery = db.collection("arena_waiting_pool")
      .orderBy("createdAt", "asc")
      .limit(5);

    const poolSnap = await transaction.get(poolQuery);
    const rivalDoc = poolSnap.docs.find(doc => doc.id !== entryId);

    if (!rivalDoc) {
      console.log("⏳ Arena: No rival found in pool yet. Waiting...");
      return;
    }

    const rival = rivalDoc.data();
    
    // Fetch streaks for both participants
    const winnerRef = db.collection("arena_leaderboard").doc(newEntry.userId);
    const rivalRef = db.collection("arena_leaderboard").doc(rival.userId);
    const [winnerSnap, rivalSnap] = await Promise.all([transaction.get(winnerRef), transaction.get(rivalRef)]);
    
    const winnerStreak = winnerSnap.exists ? (winnerSnap.data().winStreak || 0) : 0;
    const rivalStreak = rivalSnap.exists ? (rivalSnap.data().winStreak || 0) : 0;

    const battleRef = db.collection("arena_battles").doc();
    const endsAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const battleData = {
      title: newEntry.title || `Showdown: ${newEntry.campusAcronym} vs ${rival.campusAcronym}`,
      status: "live",
      creatorId: newEntry.userId,
      participants: [newEntry.userId, rival.userId],
      opponentA: {
        userId: newEntry.userId,
        videoUrl: newEntry.videoUrl,
        votes: 0,
        winStreak: winnerStreak
      },
      opponentB: {
        userId: rival.userId,
        videoUrl: rival.videoUrl,
        votes: 0,
        winStreak: rivalStreak
      },
      participantInfo: {
        [newEntry.userId]: {
          name: newEntry.userName,
          avatarUrl: newEntry.avatarUrl,
          campusAcronym: newEntry.campusAcronym,
          primaryColor: "#3b82f6",
          winStreak: winnerStreak
        },
        [rival.userId]: {
          name: rival.userName,
          avatarUrl: rival.avatarUrl,
          campusAcronym: rival.campusAcronym,
          primaryColor: "#ef4444",
          winStreak: rivalStreak
        }
      },
      votes: {
        [newEntry.userId]: 0,
        [rival.userId]: 0
      },
      viewerCount: 2,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      endsAt: endsAt
    };

    transaction.set(battleRef, battleData);
    transaction.delete(db.collection("arena_waiting_pool").doc(entryId));
    transaction.delete(rivalDoc.ref);

    console.log(`⚔️ Arena: Paired ${newEntry.userName} and ${rival.userName} into live battle ${battleRef.id}.`);
  });
});

/**
 * 🛡️ ARENA RING: AUTO-END BATTLES & HIGHLIGHT REGISTRATION
 */
exports.endBattle = onSchedule("every 1 minutes", async (event) => {
  const db = admin.firestore();
  const now = new Date().toISOString();

  const expiredBattles = await db.collection("arena_battles")
    .where("status", "==", "live")
    .where("endsAt", "<=", now)
    .get();

  if (expiredBattles.empty) return null;

  for (const doc of expiredBattles.docs) {
    const data = doc.data();
    const info = data.participantInfo || {};
    
    const vA = data.opponentA?.votes || 0;
    const vB = data.opponentB?.votes || 0;
    const winnerId = vA > vB ? data.opponentA.userId : (vB > vA ? data.opponentB.userId : null);
    const loserId = vA > vB ? data.opponentB?.userId : (vB > vA ? data.opponentA.userId : null);
    const isDraw = vA === vB;

    await doc.ref.update({ status: "ended", endedAt: admin.firestore.FieldValue.serverTimestamp() });

    if (!isDraw && winnerId && loserId) {
        // ⚔️ STEP 10, 11 & 12: Adjudicate Win Streaks, Leaderboards & Stats via Transaction
        await db.runTransaction(async (transaction) => {
            const winnerRef = db.collection("arena_leaderboard").doc(winnerId);
            const loserRef = db.collection("arena_leaderboard").doc(loserId);
            
            const [winnerSnap, loserSnap] = await Promise.all([transaction.get(winnerRef), transaction.get(loserRef)]);
            
            // Winner Update
            const winnerData = winnerSnap.exists ? winnerSnap.data() : { wins: 0, winStreak: 0, bestStreak: 0, weeklyWins: 0 };
            const newStreak = (winnerData.winStreak || 0) + 1;
            const newBest = Math.max(winnerData.bestStreak || 0, newStreak);
            
            transaction.set(winnerRef, {
                wins: admin.firestore.FieldValue.increment(1),
                winStreak: newStreak,
                bestStreak: newBest,
                weeklyWins: admin.firestore.FieldValue.increment(1),
                votes_received: admin.firestore.FieldValue.increment(Math.max(vA, vB)),
                lastBattleAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Loser Update
            transaction.set(loserRef, {
                losses: admin.firestore.FieldValue.increment(1),
                winStreak: 0,
                lastBattleAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // 🔔 RANK NOTIFICATION: If winner is top 3 in weekly, notify them
            if (winnerData.weeklyWins + 1 >= 5) { // Assuming 5+ wins puts you in contention
                const notifRef = db.collection("users").doc(winnerId).collection("notifications").doc();
                transaction.set(notifRef, {
                    type: 'system',
                    title: "Top 3 Contender! 🏆",
                    message: `You've secured another win! You're currently a top contender for the Weekly National Rewards.`,
                    link: "/arena",
                    read: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });
    }
  }
  return null;
});

/**
 * 👑 WEEKLY CHAMPIONS: REWARD & RESET (STEP 9 & 11)
 */
exports.resetWeeklyWins = onSchedule("every monday 00:00", async (event) => {
  const db = admin.firestore();
  const now = new Date();
  const weekId = `${now.getFullYear()}_week${Math.ceil(now.getDate() / 7)}`;

  // 1. IDENTIFY TOP 3 WEEKLY WARRIORS
  const topSnap = await db.collection("arena_leaderboard")
    .orderBy("weeklyWins", "desc")
    .limit(3)
    .get();

  if (topSnap.empty) return null;

  const batch = db.batch();
  const rewards = [5000, 2000, 1000]; // #1, #2, #3 rewards

  topSnap.docs.forEach((docSnap, index) => {
    const data = docSnap.data();
    const userId = docSnap.id;
    const prize = rewards[index];

    // A. DISTRIBUTE COIN REWARDS
    const walletRef = db.collection("wallets").doc(userId);
    batch.update(walletRef, {
        coins: admin.firestore.FieldValue.increment(prize),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // B. LOG TRANSACTION
    const txRef = db.collection("wallet_transactions").doc();
    batch.set(txRef, {
        userId,
        type: 'gift_received',
        coins: prize,
        metadata: {
            type: 'weekly_championship',
            rank: index + 1,
            weekId
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // C. SEND VICTORY NOTIFICATION
    const notifRef = db.collection("users").doc(userId).collection("notifications").doc();
    batch.set(notifRef, {
        type: 'system',
        title: `Weekly Champion #${index + 1}! 👑`,
        message: `Salute the Yard! You finished #${index + 1} this week and earned ${prize} Hub Coins.`,
        link: "/wallet",
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // D. ARCHIVE TO HISTORICAL LEDGER
    const archiveRef = db.collection("weekly_leaderboard").doc(weekId).collection("creators").doc(userId);
    batch.set(archiveRef, {
        creatorId: userId,
        name: data.name,
        wins: data.weeklyWins,
        rank: index + 1,
        prizeEarned: prize,
        campusAcronym: data.campusAcronym,
        archivedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  // 2. RESET EVERYONE'S WEEKLY TALLY
  const allWeeklyWarriors = await db.collection("arena_leaderboard").where("weeklyWins", ">", 0).get();
  allWeeklyWarriors.forEach(docSnap => {
    batch.update(docSnap.ref, { 
        weeklyWins: 0, 
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    });
  });

  return batch.commit();
});

/**
 * 🛡️ ARENA RING: CLEANUP HELPERS
 */
exports.cancelInactiveBattles = onSchedule("every 1 minutes", async (event) => {
  const db = admin.firestore();
  const twoMinutesAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 120000));
  const stale = await db.collection("arena_battles").where("status", "==", "waiting").where("createdAt", "<=", twoMinutesAgo).get();
  if (stale.empty) return null;
  const batch = db.batch();
  stale.forEach(doc => batch.update(doc.ref, { status: "ended", cancelReason: "timeout" }));
  return batch.commit();
});

exports.pruneWaitingPool = onSchedule("every 1 minutes", async (event) => {
  const db = admin.firestore();
  const fiveMinsAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 300000));
  const stale = await db.collection("arena_waiting_pool").where("createdAt", "<=", fiveMinsAgo).get();
  if (stale.empty) return null;
  const batch = db.batch();
  stale.forEach(doc => batch.delete(doc.ref));
  return batch.commit();
});
