const admin = require('firebase-admin');
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function runMonthlyReport() {
  console.log("📊 GAM Hub Monthly Performance Report...");
  
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Use ISO string for Firestore query to match the format used in the app
  const firstDayOfMonthISO = firstDayOfMonth.toISOString();
  
  const ordersSnap = await db.collection('orders')
    .where('status', '==', 'completed')
    .where('resolvedAt', '>=', firstDayOfMonthISO)
    .get();

  let totalVolume = 0;
  let totalLiaisonFees = 0;
  const campusStats = {};

  ordersSnap.forEach(doc => {
    const data = doc.data();
    const amount = data.amount || 0;
    const fee = amount * 0.02; // Your 2% cut
    const campus = data.campusId ? data.campusId.toUpperCase() : "UNKNOWN";

    totalVolume += amount;
    totalLiaisonFees += fee;

    // Track Profitability per Campus
    if (!campusStats[campus]) {
        campusStats[campus] = { volume: 0, fees: 0, count: 0 };
    }
    campusStats[campus].volume += amount;
    campusStats[campus].fees += fee;
    campusStats[campus].count += 1;
  });

  console.log("-------------------------------------------");
  console.log(`💰 Total Gross Trade: GHS ${totalVolume.toLocaleString()}`);
  console.log(`🏦 Net Liaison Revenue (2%): GHS ${totalLiaisonFees.toLocaleString()}`);
  console.log(`📦 Total Completed Orders: ${ordersSnap.size}`);
  console.log("-------------------------------------------");
  console.log("📍 Breakdown by Campus (Sorted by Revenue):");
  
  Object.keys(campusStats).sort((a, b) => campusStats[b].fees - campusStats[a].fees).forEach(campus => {
    console.log(`- ${campus}: GHS ${campusStats[campus].fees.toFixed(2)} from ${campusStats[campus].count} sales`);
  });
  
  process.exit();
}

runMonthlyReport();
