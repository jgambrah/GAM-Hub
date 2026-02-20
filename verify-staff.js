
const admin = require('firebase-admin');
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

// 1. Paste your staff UID here (found in Firebase Auth Console)
const staffUID = "XPnC2EQxG9ctGQbnwwJLQ97umDP2"; 

async function forceVerifyStaff() {
  try {
    await admin.auth().updateUser(staffUID, {
      emailVerified: true
    });
    console.log(`✅ SUCCESS: Staff account ${staffUID} is now verified!`);
    console.log("Liaison, refresh your browser now.");
    process.exit();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

forceVerifyStaff();
