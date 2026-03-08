
// set-admin.js
const admin = require('firebase-admin');

// 1. Download your Service Account Key from Firebase Console 
// (Project Settings > Service Accounts > Generate New Private Key)
// and place it in the root of your project as 'serviceAccountKey.json'.
let serviceAccount;
try {
  serviceAccount = require("./serviceAccountKey.json");
} catch (e) {
    console.error("Error: 'serviceAccountKey.json' not found in the project root.");
    console.error("Please download it from your Firebase project settings and place it in the root directory.");
    process.exit(1);
}


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 2. Replace this with the UID of your admin user from the Firebase Auth Console
const superAdminUID = "xYAuFJclD2UiUwPAUb4vqEaaKct2"; 

async function grantSuperAdmin() {
  if (!superAdminUID) {
      console.error("Error: 'superAdminUID' is not set.");
      console.error("Please replace the placeholder UID in 'set-admin.js' with your actual user ID.");
      process.exit(1);
  }
  try {
    console.log("Stamping Official Liaison Credentials...");

    // A. Update Auth Custom Claims (The "Passport")
    await admin.auth().setCustomUserClaims(superAdminUID, {
      role: 'admin',
      isAdmin: true,
      superAdmin: true,
      campusId: 'all' // Allows you to bypass campus filters
    });

    // B. Update Firestore Document (The "Identity Card")
    // This ensures the UI doesn't restrict you to a specific campus
    const db = admin.firestore();
    await db.collection('users').doc(superAdminUID).set({
      campusId: 'all',
      campusAcronym: 'GH',
      role: 'admin',
      userType: 'Admin'
    }, { merge: true });

    console.log(`Successfully promoted UID: ${superAdminUID} to National Liaison`);
    console.log("Liaison, LOG OUT and LOG BACK IN to activate your Global Powers.");
    process.exit();
  } catch (error) {
    console.error("Error setting claims:", error);
    process.exit(1);
  }
}

grantSuperAdmin();
