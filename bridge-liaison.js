const admin = require('firebase-admin'); const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) { admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }); } const db = admin.firestore();

const adminUID = "xYAuFJclD2UiUwPAUb4vqEaaKct2"; const staffUID = "NpyQxEhleSZvTN8iPJFlOX3ZoR73"; // The UID of your jgrah@knust.edu.gh account

async function createBridge() { const chatId = [adminUID, staffUID].sort().join("_"); await db.collection("chats").doc(chatId).set({ users: [adminUID, staffUID], lastMessage: "Liaison-to-Staff Bridge Active. 🏛️", updatedAt: admin.firestore.FieldValue.serverTimestamp(), type: "support" }, { merge: true }); console.log("✅ Bridge created! Refresh your browser."); process.exit(); } createBridge();