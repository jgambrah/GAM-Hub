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
 * 1. MEDIA CLEANUP: Deletes chat media older than 30 days.
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
 * Queries the database in real-time to determine campus and role.
 */
exports.gamHubAuthGate = beforeUserCreated(async (event) => {
  const user = event.data;
  const email = user.email ? user.email.toLowerCase() : "";
  const db = admin.firestore();

  if (email === "admin@gamhub.com") {
    return {customClaims: {role: "admin", superAdmin: true, isAdmin: true, campusId: "all"}};
  }

  const domain = email.split("@")[1];
  if (!domain) throw new Error("Invalid email format.");

  const studentSnap = await db.collection("campuses")
      .where("studentDomain", "==", domain).get();

  const staffSnap = await db.collection("campuses")
      .where("staffDomain", "==", domain).get();

  if (!studentSnap.empty) {
    const campusData = studentSnap.docs[0].data();
    console.log(`New Student joining from: ${campusData.name}`);
    return {
      customClaims: {
        role: "student",
        userType: "student",
        campusId: studentSnap.docs[0].id,
      },
    };
  }

  if (!staffSnap.empty) {
    const campusData = staffSnap.docs[0].data();
    console.log(`New Staff member joining from: ${campusData.name}`);
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
 * Automatically updates Auth Token Claims whenever a user document is updated.
 */
exports.syncUserClaims = onDocumentUpdated("users/{userId}", async (event) => {
  const newData = event.data.after.data();

  console.log(`Syncing claims for UID: ${event.params.userId}`);

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
    });

    console.log("✅ Claims successfully synced to Auth Token.");
  } catch (error) {
    console.error("❌ Claims Sync Error:", error);
  }
});

/**
 * 13. SIGN-IN CLAIMS INJECTOR
 * Catches existing users who predate syncUserClaims.
 * Fires on every sign-in and stamps fresh claims from Firestore.
 */
exports.injectClaimsOnSignIn = beforeUserSignedIn(async (event) => {
  const user = event.data;
  const email = user.email?.toLowerCase() || "";
  const db = admin.firestore();

  console.log(`Injecting claims on sign-in for UID: ${user.uid}`);

  // Admin shortcut — no Firestore read needed
  if (email === "admin@gamhub.com" || user.uid === "xYAuFJclD2UiUwPAUb4vqEaaKct2") {
    return {
      customClaims: {
        role: "admin",
        isAdmin: true,
        superAdmin: true,
        campusId: "all",
      },
    };
  }

  // Everyone else — read from Firestore
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
      },
    };
  } catch (error) {
    console.error("❌ Claims Injection Error:", error);
    return;
  }
});