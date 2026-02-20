const admin = require('firebase-admin');
const serviceAccount = require("./serviceAccountKey.json");

// Initialize explicitly with credentials
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

// THE UID from your vendor document
const vendorUID = "seGKaZ6polOb99nuYLw4eaMLKt23"; 

async function grantVendor() {
  console.log("Stamping ID Card for Vendor...");
  try {
    // We get the auth service AFTER initialization
    const auth = admin.auth();
    
    await auth.setCustomUserClaims(vendorUID, {
      role: 'vendor',
      userType: 'vendor'
    });
    
    console.log(`✅ SUCCESS: ${vendorUID} is now a Verified Vendor!`);
    console.log("Liaison, tell the vendor to LOG OUT and LOG BACK IN now.");
    process.exit();
  } catch (error) {
    console.error("❌ Error setting claims:", error);
    process.exit(1);
  }
}

grantVendor();
