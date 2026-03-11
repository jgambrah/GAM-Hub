
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onDocumentUpdated, onDocumentCreated} =
    require("firebase-functions/v2/firestore");
const {onRequest, onCall, HttpsError} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions");
const admin = require("firebase-admin");
const {getStorage} = require("firebase-admin/storage");
const {beforeUserCreated, beforeUserSignedIn} = require("firebase-functions/v2/identity");
const crypto = require("crypto");

admin.initializeApp();
setGlobalOptions({maxInstances: 10});

/**
 * 🏎️ REAL-TIME TRENDING ENGINE (REACTIVE)
 * Triggers on any engagement update to recalculate the trendScore immediately.
 */
exports.calculateTrendingScore = onDocumentUpdated("trending_stats/{postId}", async (event) => {
  const data = event.data.after.data();
  const oldData = event.data.before.data();

  if (data.trendScore && !Object.keys(data).some(k => k !== 'trendScore' && data[k] !== oldData[k])) {
    return null;
  }

  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
  const now = new Date();
  const ageHours = (now - createdAt) / 3600000;

  const views = data.views || 0;
  const likes = data.likes || 0;
  const comments = data.comments || 0;
  const shares = data.shares || 0;
  const completions = data.completions || 0;

  const velocity = (views * 1) + (likes * 3) + (comments * 5) + (shares * 8) + (completions * 20);
  let score = velocity / Math.pow((ageHours + 2), 1.3);

  if (views > 500 && ageHours < 2) {
    score *= 1.5;
  }

  // 🎓 VIRAL GRADUATION THRESHOLD
  if (views > 300 && (completions / Math.max(views, 1)) > 0.6) {
    score = Math.max(score, 50); 
  }

  if (data.trendScore && Math.abs(data.trendScore - score) < 0.001) {
    return null;
  }

  return event.data.after.ref.update({ 
    trendScore: score,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
});

/**
 * 🛰️ SCHEDULED TRENDING UPDATE (CRON)
 */
exports.updateScheduledTrendingScores = onSchedule("every 5 minutes", async (event) => {
  const db = admin.firestore();
  const snapshot = await db.collection("trending_stats").get();
  const batch = db.batch();
  const now = new Date();

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
    const ageHours = (now - createdAt) / 3600000;

    const views = data.views || 0;
    const likes = data.likes || 0;
    const comments = data.comments || 0;
    const shares = data.shares || 0;
    const completions = data.completions || 0;

    const velocity = (views * 1) + (likes * 3) + (comments * 5) + (shares * 8) + (completions * 20);
    let trendScore = velocity / Math.pow((ageHours + 2), 1.3);

    if (views > 500 && ageHours < 2) trendScore *= 1.5;
    if (views > 300 && (completions / Math.max(views, 1)) > 0.6) trendScore = Math.max(trendScore, 50);

    batch.update(docSnap.ref, {
      trendScore,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  await batch.commit();
});

/**
 * #️⃣ HASHTAG INDEXER & VELOCITY TRACKER
 * Updates global registry and per-minute statistics when a new vibration is created.
 */
exports.onVibeCreatedUpdateHashtags = onDocumentCreated("campus_pulse/{postId}", async (event) => {
  const data = event.data.data();
  const tags = data.tags || [];
  if (tags.length === 0) return;

  const db = admin.firestore();
  const batch = db.batch();
  const minuteBucket = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm

  tags.forEach(tag => {
    const normalizedTag = tag.toLowerCase();
    
    // 1. Update Global Registry
    const tagRef = db.collection('hashtags').doc(normalizedTag);
    batch.set(tagRef, {
      tag: normalizedTag,
      postCount: admin.firestore.FieldValue.increment(1),
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 2. Update Velocity Bucket (Time-Series) for Virality Detection
    const statsRef = db.collection("hashtagStats")
      .doc(normalizedTag)
      .collection("minutes")
      .doc(minuteBucket);
      
    batch.set(statsRef, {
      count: admin.firestore.FieldValue.increment(1)
    }, { merge: true });
  });

  await batch.commit();
});

/**
 * 📈 TRENDING HASHTAG UPDATER (PROFESSIONAL VELOCITY ENGINE)
 * Calculates hashtag velocity and trending scores every 5 minutes.
 * Incorporates Viral Thresholds and Exponential Decay.
 */
exports.updateTrendingHashtags = onSchedule("every 5 minutes", async (event) => {
  const db = admin.firestore();
  const hashtagsSnapshot = await db.collection("hashtags").get();
  const now = new Date();
  const batch = db.batch();

  const lookbackMins = 30;
  const startTime = new Date(now.getTime() - lookbackMins * 60000);
  const startTimeString = startTime.toISOString().slice(0, 16);

  const processPromises = hashtagsSnapshot.docs.map(async (docSnap) => {
    const tag = docSnap.id;
    const data = docSnap.data();
    
    const statsSnapshot = await db.collection("hashtagStats")
      .doc(tag)
      .collection("minutes")
      .where("__name__", ">=", startTimeString)
      .get();

    const counts = statsSnapshot.docs.map(d => d.data().count || 0);
    const totalNewPosts = counts.reduce((a, b) => a + b, 0);
    const velocity = totalNewPosts / lookbackMins;

    const lastUsedAt = data.lastUsedAt?.toDate ? data.lastUsedAt.toDate() : now;
    const ageMinutes = Math.max(0, (now.getTime() - lastUsedAt.getTime()) / 60000);
    const ageHours = ageMinutes / 60;
    const freshness = 1 / (ageMinutes + 1);
    const engagement = velocity > 0 ? 0.5 : 0; 

    // LIAISON VIRAL LIFECYCLE: Apply exponential decay (12h half-life)
    const halfLife = 12;
    const decay = Math.exp(-ageHours / halfLife);

    const baseScore = (velocity * 0.6) + (engagement * 0.3) + (freshness * 0.1);
    const trendScore = baseScore * decay;

    batch.update(docSnap.ref, {
      trendScore,
      velocity,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 🛡️ VIRAL THRESHOLD PROMOTION
    if (trendScore > 30) {
      const viralRef = db.collection("viral_hashtags").doc(tag);
      batch.set(viralRef, {
        tag,
        trendScore,
        detectedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });

  await Promise.all(processPromises);
  await batch.commit();
});

/**
 * 1. MEDIA CLEANUP
 */
exports.cleanupOldChatMedia = onSchedule("0 0 * * 0", async (event) => {
  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles({prefix: "chat_media/"});
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() - 30);

  const deletePromises = files.map(async (file) => {
    const [metadata] = await file.getMetadata();
    const createdDate = new Date(metadata.timeCreated);
    if (createdDate < expirationDate) {
      return file.delete();
    }
    return null;
  });
  await Promise.all(deletePromises);
});

/**
 * 2. THE UNIVERSAL LEAD PROCESSOR
 */
exports.processLeadFee = onDocumentCreated("orders/{orderId}",
    async (event) => {
      const db = admin.firestore();
      const order = event.data.data();

      if (order.productType === "service") {
        const vendorRef = db.collection("users").doc(order.vendorId);
        const vSnap = await vendorRef.get();
        const vData = vSnap.data();

        const pDoc = await db.collection("lead_prices").doc(order.category).get();
        const leadCost = pDoc.exists ? pDoc.data().price : 5.00;
        const batch = db.batch();

        if (vData.trial_leads_count > 0) {
          batch.update(vendorRef, {
            trial_leads_count: admin.firestore.FieldValue.increment(-1),
          });
        } else {
          batch.update(vendorRef, {
            lead_credits: admin.firestore.FieldValue.increment(-leadCost),
          });
          const revRef = db.collection("platform_stats").doc("revenue");
          batch.set(revRef, {
            total_lead_revenue: admin.firestore.FieldValue.increment(leadCost),
          }, {merge: true});
        }
        await batch.commit();
      }
    });

/**
 * 3. THE WEEKLY ARENA RESET
 */
exports.weeklyVibeReset = onSchedule("59 23 * * 0", async (event) => {
  const db = admin.firestore();
  const rankRef = db.collection("platform_stats").doc("arena_rankings");
  const snap = await rankRef.get();

  if (snap.exists) {
    const scores = snap.data().scores || {};
    const entries = Object.entries(scores);
    if (entries.length === 0) return null;

    const winner = entries.sort(([, a], [, b]) => b - a)[0];

    await db.collection("hall_of_fame").add({
      campusId: winner[0],
      totalBurns: winner[1],
      weekEnding: admin.firestore.FieldValue.serverTimestamp(),
      type: "arena_vibe_king",
    });

    const resetScores = {};
    Object.keys(scores).forEach((key) => {
      resetScores[key] = 0;
    });

    return rankRef.update({
      scores: resetScores,
      lastReset: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  return null;
});

/**
 * 4. THE MONTHLY YARD STRENGTH RESET
 */
exports.monthlyYardStrengthReset = onSchedule("0 0 1 * *", async (event) => {
  const db = admin.firestore();
  const strengthRef = db.collection("platform_stats").doc("yard_strength");
  const snap = await strengthRef.get();

  if (snap.exists) {
    const scores = snap.data().scores || {};
    const entries = Object.entries(scores);
    if (entries.length === 0) return null;

    const winner = entries.sort(([, a], [, b]) => b - a)[0];

    await db.collection("hall_of_fame").add({
      campusId: winner[0],
      totalPoints: winner[1],
      monthEnding: admin.firestore.FieldValue.serverTimestamp(),
      type: "yard_strength_champion",
    });

    const resetScores = {};
    Object.keys(scores).forEach((key) => {
      resetScores[key] = 0;
    });

    return strengthRef.update({
      scores: resetScores,
      lastReset: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  return null;
});

/**
 * 5. YARD STRENGTH ENGINE: Trade Trigger
 */
exports.calculateYardStrength = onDocumentUpdated("orders/{orderId}",
    async (event) => {
      const db = admin.firestore();
      const newData = event.data.after.data();
      const oldData = event.data.before.data();

      if (oldData.status !== "completed" && newData.status === "completed") {
        const campusKey = newData.campusId.toLowerCase();
        const points = Math.floor(newData.amount || 0);
        const strengthRef = db.collection("platform_stats").doc("yard_strength");

        return strengthRef.set({
          [`scores.${campusKey}`]: admin.firestore.FieldValue.increment(points),
          lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});
      }
      return null;
    });

/**
 * 6. YARD STRENGTH ENGINE: Unity Tracker
 */
exports.trackUnityStrength = onDocumentUpdated("connections/{id}",
    async (event) => {
      const newData = event.data.after.data();
      const oldData = event.data.before.data();

      if (oldData.status !== "accepted" && newData.status === "accepted") {
        const db = admin.firestore();
        const strengthRef = db.collection("platform_stats").doc("yard_strength");

        const fromKey = newData.fromCampusId.toLowerCase();
        const toKey = newData.toCampusId.toLowerCase();

        return strengthRef.set({
          [`scores.${fromKey}`]: admin.firestore.FieldValue.increment(5),
          [`scores.${toKey}`]: admin.firestore.FieldValue.increment(5),
          lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});
      }
      return null;
    });

/**
 * 7. YARD STRENGTH: ORGANIZATION TRIGGER
 */
exports.onGroupStrength = onDocumentCreated("groups/{groupId}", async (event) => {
  const data = event.data.data();
  const db = admin.firestore();
  const strengthRef = db.collection("platform_stats").doc("yard_strength");
  const campusKey = data.campusId.toLowerCase();
  return strengthRef.set({
    [`scores.${campusKey}`]: admin.firestore.FieldValue.increment(15),
    lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
});

/**
 * 8. THE DYNAMIC AUTH GATEKEEPER
 */
exports.gamHubAuthGate = beforeUserCreated(async (event) => {
  const user = event.data;
  const email = user.email ? user.email.toLowerCase() : "";
  const db = admin.firestore();

  if (email === "admin@gamhub.com") {
    return {
      customClaims: {
        role: "admin",
        superAdmin: true,
        isAdmin: true,
        campusId: "all",
      },
    };
  }

  const domain = email.split("@")[1];
  if (!domain) throw new Error("Invalid email format.");

  const studentSnap = await db.collection("campuses")
      .where("studentDomain", "==", domain).get();

  const staffSnap = await db.collection("campuses")
      .where("staffDomain", "==", domain).get();

  if (!studentSnap.empty) {
    return {
      customClaims: {
        role: "student",
        userType: "student",
        campusId: studentSnap.docs[0].id,
      },
    };
  }

  if (!staffSnap.empty) {
    return {
      customClaims: {
        role: "staff",
        userType: "staff",
        campusId: staffSnap.docs[0].id,
      },
    };
  }

  return {customClaims: {role: "vendor", userType: "vendor"}};
});

/**
 * 9. PAYSTACK WEBHOOK
 */
exports.paystackWebhook = onRequest({
  secrets: ["PAYSTACK_SECRET_KEY"],
}, async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const sig = req.headers["x-paystack-signature"];
  const hash = crypto.createHmac("sha512", secret)
      .update(JSON.stringify(req.body)).digest("hex");

  if (hash !== sig) return res.status(401).send("Unauthorized");

  const event = req.body;
  if (event.event === "charge.success") {
    const refParts = event.data.reference.split("_");
    const orderId = refParts[1];

    if (event.data.reference.startsWith("FUEL_")) {
      const vId = refParts[1];
      const ghs = event.data.amount / 100;
      await admin.firestore().collection("users").doc(vId).update({
        lead_credits: admin.firestore.FieldValue.increment(ghs),
        accountType: "premium",
      });
    } else {
      const oRef = admin.firestore().collection("orders").doc(orderId);
      await oRef.update({
        status: "paid",
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
  return res.status(200).send("OK");
});

/**
 * 10. HANDOVER TRIGGER
 */
exports.onAuthorityGranted = onDocumentUpdated("users/{userId}",
    async (event) => {
      const newData = event.data.after.data();
      const oldData = event.data.before.data();

      const isNowAuth = oldData.isAuthority !== true && newData.isAuthority === true;
      if (isNowAuth) {
        try {
          await admin.auth().setCustomUserClaims(event.params.userId, {
            role: newData.role,
            isAuthority: true,
            campusId: newData.campusId,
          });
        } catch (error) {
          console.error("Handover Error:", error);
        }
      }
    });

/**
 * 11. THE AD-CLICK TRACKER
 */
exports.trackAdClick = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Please log in to the Yard.");
  }

  const {productId, vendorId} = request.data;
  const db = admin.firestore();
  const clickCost = 0.20;

  const vendorRef = db.collection("users").doc(vendorId);
  const productRef = db.collection("products").doc(productId);
  const revRef = db.collection("platform_stats").doc("revenue");

  return db.runTransaction(async (transaction) => {
    const vSnap = await transaction.get(vendorRef);
    const vData = vSnap.data();
    const pSnap = await transaction.get(productRef);
    const pData = pSnap.data();

    if (!vData || (vData.lead_credits || 0) < clickCost) {
      transaction.update(productRef, {
        isSponsored: false,
        adStatus: "depleted",
      });
      return {status: "out_of_fuel"};
    }

    transaction.update(vendorRef, {
      lead_credits: admin.firestore.FieldValue.increment(-clickCost),
    });

    transaction.update(productRef, {
      clicks: admin.firestore.FieldValue.increment(1),
      lastClickAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.set(revRef, {
      total_ad_revenue: admin.firestore.FieldValue.increment(clickCost),
    }, {merge: true});

    const today = new Date().toISOString().split("T")[0];
    const analyticsId = `${productId}_${today}`;
    const analyticsRef = db.collection("ad_analytics").doc(analyticsId);

    transaction.set(analyticsRef, {
      productId,
      vendorId,
      date: today,
      campusId: pData?.campusId || "all",
      clicks: admin.firestore.FieldValue.increment(1),
      spend: admin.firestore.FieldValue.increment(clickCost),
      conversions: admin.firestore.FieldValue.increment(0),
    }, {merge: true});

    return {status: "success"};
  });
});

/**
 * 12. LIAISON PROFILE SYNC
 */
exports.syncUserClaims = onDocumentUpdated("users/{userId}", async (event) => {
  const newData = event.data.after.data();
  try {
    await admin.auth().setCustomUserClaims(event.params.userId, {
      role: newData.role || "student",
      userType: newData.role || "student",
      campusId: newData.campusId || null,
      campusAcronym: newData.campusAcronym || null,
      superAdmin: newData.role === "admin" || newData.email === "admin@gamhub.com",
      isAdmin: newData.role === "admin" || newData.email === "admin@gamhub.com",
      isCandidate: newData.candidacyStatus === "approved",
      isAuthority: !!newData.isAuthority,
      major: newData.major || null,
      department: newData.department || null,
    });
  } catch (error) {
    console.error("❌ Claims Sync Error:", error);
  }
});

/**
 * 13. SIGN-IN CLAIMS INJECTOR
 */
exports.injectClaimsOnSignIn = beforeUserSignedIn(async (event) => {
  const user = event.data;
  const email = user.email?.toLowerCase() || "";
  const db = admin.firestore();

  if (email === "admin@gamhub.com" || user.uid === "xYAuFJclD2UiUwPAUb4vqEaaKct2") {
    return {
      customClaims: {role: "admin", isAdmin: true, superAdmin: true, campusId: "all"},
    };
  }

  try {
    const docSnap = await db.collection("users").doc(user.uid).get();
    if (!docSnap.exists) return;
    const data = docSnap.data();
    return {
      customClaims: {
        role: data.role || "student",
        userType: data.role || "student",
        campusId: data.campusId || null,
        campusAcronym: data.campusAcronym || null,
        isAdmin: data.role === "admin",
        superAdmin: data.role === "admin",
        isCandidate: data.candidacyStatus === "approved",
        isAuthority: !!data.isAuthority,
        major: data.major || null,
        department: data.department || null,
      },
    };
  } catch (error) {
    return;
  }
});

/**
 * 14. THE AI LIAISON MODERATOR
 */
exports.onArenaVibration = onDocumentCreated("arena_posts/{postId}", async (event) => {
  const post = event.data.data();
  const content = post.content || "";
  const keywords = ["vote", "tribal", "violence", "politics", "tribe", "kill", "fight"];
  const isSensitive = keywords.some((k) => content.toLowerCase().includes(k));

  if (isSensitive) {
    if (content.toLowerCase().includes("violence") ||
        content.toLowerCase().includes("tribal") ||
        content.toLowerCase().includes("fight")) {
      return event.data.ref.update({
        status: "blocked",
        content: "[LIAISON ALERT: This post violated the Yard Safety Protocol]",
        moderationNote: "Inciting tribalism or violence is strictly prohibited.",
      });
    }
    const comebacksRef = event.data.ref.collection("comebacks");
    await comebacksRef.add({
      text: "Liaison Bot is watching. Keep it healthy, Citizens. 🤖🛡️🇬🇭",
      authorId: "liaison-bot",
      authorName: "Liaison Bot",
      authorCampus: "GH",
      authorColor: "#0f172a",
      isBot: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return event.data.ref.update({
      comebackCount: admin.firestore.FieldValue.increment(1),
    });
  }
  return null;
});

/**
 * 15. NOTIFICATION ENGINE
 */
exports.sendOrderNotifications = onDocumentUpdated("orders/{orderId}",
    async (event) => {
      const newData = event.data.after.data();
      const oldData = event.data.before.data();
      let targetId = "";
      let msg = "";

      if (oldData.status === "inquiry_sent" && newData.status === "awaiting_confirmation") {
        targetId = newData.vendorId;
        msg = `New request for ${newData.productName}!`;
      } else if (oldData.status === "awaiting_confirmation" && newData.status === "confirmed") {
        targetId = newData.buyerId;
        msg = `Stock confirmed for ${newData.productName}!`;
      }

      if (targetId && msg) {
        const userDoc = await admin.firestore().collection("users").doc(targetId).get();
        const fcmToken = userDoc.data() ? userDoc.data().fcmToken : null;
        if (fcmToken) {
          await admin.messaging().send({
            token: fcmToken,
            notification: {title: "GAM Hub Yard Alert", body: msg},
            data: {orderId: event.params.orderId},
          });
        }
      }
    });

/**
 * 16. THE LIAISON VECTOR PRECOMPUTATION
 */
exports.onVibeCreated = onDocumentCreated("campus_pulse/{postId}", async (event) => {
  const data = event.data.data();
  if (data.embedding) return;
  console.log(`Liaison Intelligence: Precomputing vector for Vibe ${event.params.postId}`);
});
