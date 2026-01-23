const admin = require("firebase-admin");
const { db } = require("./firebaseAdmin");
const treasury = require("./treasury"); // make sure path is correct

// Initialize Firebase if not already done
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(), // or your service account
  });
}

// Replace with your actual userId and transaction reference
const userId = "Kts84GS92lfV8s6J2tESjBeecQL2";
const txRef = "fx-1768925142543"; // the transaction you want to credit

async function testWalletUpdate() {
  try {
    // 1️⃣ Get transaction to know amount
    const txSnap = await db.collection("transactions").doc(txRef).get();
    if (!txSnap.exists) {
      console.log("❌ Transaction not found:", txRef);
      return;
    }

    const { amount } = txSnap.data();

    // 2️⃣ Call treasury to credit wallet
    await treasury.processCampayDeposit(userId, Number(amount), txRef);

    console.log(`✅ Treasury processed deposit of ${amount} XAF for user ${userId}`);

    // 3️⃣ Check updated wallet balance
    const userSnap = await db.collection("users").doc(userId).get();
    console.log("💰 Updated wallet balance:", userSnap.data()?.walletBalance);

  } catch (err) {
    console.error("Error updating wallet:", err);
  }
}

testWalletUpdate();
