const admin = require("firebase-admin");
const { db } = require("./firebaseAdmin"); // adjust path if your file is named differently

// Initialize Firebase admin if not already done
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(), // or your service account
  });
}

async function main() {
  try {
    const userSnap = await db.collection("users").doc("Kts84GS92lfV8s6J2tESjBeecQL2").get();
    console.log("Wallet balance:", userSnap.data()?.walletBalance);
  } catch (err) {
    console.error("Error reading wallet:", err);
  }
}

main();
