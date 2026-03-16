
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
        votes: 0
      },
      opponentB: {
        userId: rival.userId,
        videoUrl: rival.videoUrl,
        votes: 0
      },
      participantInfo: {
        [newEntry.userId]: {
          name: newEntry.userName,
          avatarUrl: newEntry.avatarUrl,
          campusAcronym: newEntry.campusAcronym,
          primaryColor: "#3b82f6"
        },
        [rival.userId]: {
          name: rival.userName,
          avatarUrl: rival.avatarUrl,
          campusAcronym: rival.campusAcronym,
          primaryColor: "#ef4444"
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
 * 🔥 ARENA RING: REAL-TIME SPIKE DETECTION
 */
exports.detectHighlightSpike = onDocumentCreated("arena_battles/{battleId}/engagement_events/{eventId}", async (event) => {
    const db = admin.firestore();
    const battleId = event.params.battleId;
    const battleRef = db.collection("arena_battles").doc(battleId);

    const recentEventsSnap = await battleRef.collection("engagement_events")
        .orderBy("timestamp", "desc")
        .limit(20)
        .get();

    if (recentEventsSnap.size < 15) return null;

    const events = recentEventsSnap.docs.map(d => d.data());
    const newest = events[0].timestamp.toMillis();
    const oldest = events[events.length - 1].timestamp.toMillis();

    const timeGapMs = newest - oldest;
    if (timeGapMs < 30000) {
        console.log(`🔥 SPIKE DETECTED in Battle ${battleId}: 15 events in ${Math.round(timeGapMs/1000)}s`);
        return battleRef.update({ 
            isHot: true, 
            lastSpikeAt: admin.firestore.FieldValue.serverTimestamp() 
        });
    }

    return null;
});

/**
 * 🎬 ARENA RING: VIDEO HIGHLIGHT CUTTER (FLUENT-FFMPEG)
 */
exports.processArenaHighlight = onDocumentCreated("arena_highlights/{highlightId}", async (event) => {
    const highlight = event.data.data();
    const highlightId = event.params.highlightId;
    const db = admin.firestore();

    if (highlight.processingStatus === "completed") return null;

    const sourceUrl = highlight.sourceUrl;
    const startTime = highlight.startTime || 0;
    const tempInput = path.join(os.tmpdir(), `input-${highlightId}.mp4`);
    const tempOutput = path.join(os.tmpdir(), `output-${highlightId}.mp4`);

    try {
        console.log(`🎬 Cutting highlight for Battle ${highlight.battleId} starting at ${startTime}s`);
        
        const response = await axios({
            method: "GET",
            url: sourceUrl,
            responseType: "stream",
        });
        
        const writer = fs.createWriteStream(tempInput);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        await new Promise((resolve, reject) => {
            ffmpeg(tempInput)
                .setStartTime(startTime)
                .setDuration(10) 
                .output(tempOutput)
                .on("end", resolve)
                .on("error", reject)
                .run();
        });

        const bucket = admin.storage().bucket();
        const destination = `arena_highlights/${highlightId}.mp4`;
        await bucket.upload(tempOutput, {
            destination,
            metadata: { contentType: "video/mp4", metadata: { battleId: highlight.battleId } },
        });

        const finalUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destination)}?alt=media`;

        const batch = db.batch();
        batch.update(db.collection("arena_highlights").doc(highlightId), {
            clipUrl: finalUrl,
            processingStatus: "completed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        if (highlight.pulsePostId) {
            batch.update(db.collection("campus_pulse").doc(highlight.pulsePostId), {
                mediaUrl: finalUrl,
                thumbnailUrl: finalUrl 
            });
        }

        // 🎖️ ARENA LEGENDS: Increment highlight count for the winner
        if (highlight.winnerId) {
            const legendRef = db.collection("arena_leaderboard").doc(highlight.winnerId);
            batch.set(legendRef, { 
                highlightCount: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        await batch.commit();
        console.log(`✅ Highlight processed successfully: ${finalUrl}`);

    } catch (err) {
        console.error("❌ Highlight processing failed:", err);
        await db.collection("arena_highlights").doc(highlightId).update({ processingStatus: "failed", error: err.message });
    } finally {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    }
    return null;
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
    
    // Sponsorship Context
    const isSponsored = data.isSponsored || false;
    const sponsorName = data.sponsorName || null;
    const sponsorLogo = data.sponsorLogo || null;

    const vA = data.opponentA?.votes || 0;
    const vB = data.opponentB?.votes || 0;
    const winnerId = vA > vB ? data.opponentA.userId : (vB > vA ? data.opponentB.userId : null);
    const isDraw = vA === vB;

    await doc.ref.update({ status: "ended", endedAt: admin.firestore.FieldValue.serverTimestamp() });

    // 🏆 TOURNAMENT PROGRESSION LOGIC (Step 6)
    if (data.tournamentMatch && data.tournamentId && data.matchId) {
        const tourneyRef = db.collection("arena_tournaments").doc(data.tournamentId);
        const matchRef = tourneyRef.collection("matches").doc(data.matchId);
        
        await matchRef.update({ 
            winner: winnerId, 
            status: "completed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        if (winnerId) {
            await tourneyRef.collection("players").doc(winnerId).update({
                round: admin.firestore.FieldValue.increment(1)
            });
        }

        const loserId = data.opponentA.userId === winnerId ? data.opponentB?.userId : data.opponentA.userId;
        if (loserId) {
            await tourneyRef.collection("players").doc(loserId).update({
                eliminated: true
            });
        }
    }

    if (!isDraw && winnerId) {
        const winner = data.opponentA.userId === winnerId ? data.opponentA : data.opponentB;
        const loser = data.opponentA.userId === winnerId ? data.opponentB : data.opponentA;
        const winnerInfo = info[winnerId];
        
        const eventsSnap = await doc.ref.collection("engagement_events").orderBy("timestamp", "asc").get();
        let peakTimeOffset = 0;
        let totalEnergy = 0;

        if (!eventsSnap.empty) {
            const events = eventsSnap.docs.map(d => ({ ...d.data(), time: d.data().timestamp.toMillis() }));
            const startTime = data.createdAt.toMillis();
            const bucketSize = 10000; 
            const buckets = {};
            
            events.forEach(e => {
                const bucketIdx = Math.floor((e.time - startTime) / bucketSize);
                buckets[bucketIdx] = (buckets[bucketIdx] || 0) + (e.weight || 1);
                totalEnergy += (e.weight || 1);
            });

            const sortedBuckets = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
            peakTimeOffset = Math.max(0, parseInt(sortedBuckets[0][0]) * 10 - 2); 
        }

        let highlightCategory = "crowd_favorite";
        const totalVotes = vA + vB;
        const winMargin = Math.abs(vA - vB) / (totalVotes || 1);

        if (winMargin > 0.6) {
            highlightCategory = "knockout_moment";
        } else if (totalEnergy > 50) {
            highlightCategory = "savage_roast";
        }

        const pulseRef = db.collection("campus_pulse").doc();
        const highlightRef = db.collection("arena_highlights").doc();

        await highlightRef.set({
            battleId: doc.id,
            sourceUrl: winner.videoUrl,
            pulsePostId: pulseRef.id,
            creatorId: data.creatorId,
            opponentId: loser.userId,
            winnerId: winnerId,
            startTime: peakTimeOffset,
            category: highlightCategory,
            processingStatus: "pending",
            isSponsored,
            sponsorName,
            sponsorLogo,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await pulseRef.set({
            authorId: winnerId,
            authorName: winnerInfo.name,
            authorAvatarUrl: winnerInfo.avatarUrl,
            campusId: winnerInfo.campusId || "all",
            campusAcronym: winnerInfo.campusAcronym,
            content: `${isSponsored ? sponsorName + " " : ""}Victory Archive: ${winnerInfo.name} dominated the Yard! Check out this highlight.`,
            mediaType: "video",
            mediaUrl: winner.videoUrl, 
            type: "arena_highlight",
            isArenaEntry: true,
            isSponsored,
            sponsorName,
            sponsorLogo,
            battleMetadata: { 
                battleId: doc.id, 
                winnerName: winnerInfo.name, 
                totalEnergy,
                category: highlightCategory,
                isSponsored,
                sponsorName
            },
            likes: 0,
            commentCount: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 🎖️ ARENA CHAMPIONS: Increment individual win count & energy
        const champRef = db.collection("arena_leaderboard").doc(winnerId);
        await champRef.set({ 
            wins: admin.firestore.FieldValue.increment(1),
            votes_received: admin.firestore.FieldValue.increment(vA > vB ? vA : vB),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 🏛️ CAMPUS WARS: Update University Leaderboard
        if (winnerInfo.campusId) {
            const campusRef = db.collection("campus_leaderboard").doc(winnerInfo.campusId);
            await campusRef.set({
                wins: admin.firestore.FieldValue.increment(1),
                totalVotes: admin.firestore.FieldValue.increment(vA > vB ? vA : vB),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
    }
  }
  return null;
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
