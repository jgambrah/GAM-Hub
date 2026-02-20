const admin = require('firebase-admin');
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const vendorUID = "seGKaZ6polOb99nuYLw4eaMLKt23"; 

async function forceVerify() {
  try {
    await admin.auth().updateUser(vendorUID, {
      emailVerified: true
    });
    console.log(`✅ SUCCESS: ${vendorUID} is now physically verified in the Fortress.`);
    console.log("Liaison, refresh your browser now.");
    process.exit();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

forceVerify();
