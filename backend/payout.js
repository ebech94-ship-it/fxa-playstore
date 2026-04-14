const express = require("express");
const router = express.Router();
const { db } = require("./firebaseAdmin");
const admin = require("firebase-admin");
const fetch = require("node-fetch");


const { XAF_TO_USD, BASE_CURRENCY } = require("../config/currency");
// ----------------------
// TOKEN CACHE (PAYOUT)
// ----------------------
let payoutToken = null;
let tokenExpiry = null;

async function getPayoutToken() {
  if (payoutToken && tokenExpiry && Date.now() < tokenExpiry - 120000) {
    return payoutToken;
  }

  const response = await fetch("https://api.accountpe.com/api/payout/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.SWYCHR_EMAIL,
      password: process.env.SWYCHR_PASSWORD,
    }),
  });

  const data = await response.json();

  if (!data.token) {
    console.error("❌ Payout auth failed:", data);
    throw new Error("Failed to get payout token");
  }

  payoutToken = data.token;
  tokenExpiry = Date.now() + 55 * 60 * 1000;

  return payoutToken;
}

// ----------------------
// CREATE PAYOUT
// ----------------------
router.post("/", async (req, res) => {
  const {
    beneficiary_name,
    mobile_no,
    amount,
    payment_method,
    bank_code,
    account_number,
    remarks,
    country_code
  } = req.body;

  let transactionId;

  try {
    // ----------------------
    // VALIDATION
    // ----------------------
    if (!beneficiary_name || !mobile_no || !amount || !payment_method || !country_code) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const idToken = req.headers.authorization?.split("Bearer ")[1];
    if (!idToken) return res.status(401).json({ error: "Unauthorized" });

    let uid;
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      uid = decodedToken.uid;
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const userRef = db.collection("users").doc(uid);

  
   // ----------------------
// 🔐 CONCURRENCY SAFE CHECK + LOCK (ATOMIC)
// ----------------------
await db.runTransaction(async (t) => {
  const snap = await t.get(userRef);
  const balance = snap.data()?.realBalance || 0;

  // 💰 STEP 1: define amounts (FIRST!)
  const amountUSD = Number(amount);

if (!amountUSD || amountUSD <= 0) {
  throw new Error("INVALID_AMOUNT");
}
  const fee = amountUSD * 0.01; // 1%
  const netUSD = amountUSD - fee;

  // 🔄 convert to XAF for payout API
  const amountXAF = Math.round(netUSD * XAF_TO_USD);

  // 🚫 STEP 2: check balance
  if (balance < amountUSD) {
    throw new Error("INSUFFICIENT_BALANCE");
  }

  // 🆔 STEP 3: create transaction ID
  transactionId =
    "payout_" + Date.now() + "_" + Math.floor(Math.random() * 10000);

  // 🔑 STEP 4: get token
  const token = await getPayoutToken();

  // 🌍 STEP 5: call payout API
  const response = await fetch(
    "https://api.accountpe.com/api/payout/create_transaction",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": transactionId,
      },
      body: JSON.stringify({
        country_code,
        beneficiary_name,
        mobile_no,
        amount: amountXAF, // ✅ converted value
        transaction_id: transactionId,
        payment_method,
        remarks: remarks || "",
        bank_code,
        account_number,
      }),
    }
  );

      if (!response.ok) {
        throw new Error("PAYOUT_FAILED");
      }

      const payoutData = await response.json();

      // 🔒 LOCK BALANCE (immediately)
      t.update(userRef, {
        realBalance: admin.firestore.FieldValue.increment(-amountUSD),
      });

      // 🧾 CREATE PAYOUT RECORD
      const payoutRef = db.collection("payouts").doc(transactionId);

     t.set(payoutRef, {
  userId: uid,
  transactionId,

  // USER SIDE (USD)
  amount: amountUSD,
  fee,
  netAmount: netUSD,
  currency: BASE_CURRENCY,

  // API SIDE (XAF)
  payoutAmount: amountXAF,
  payoutCurrency: "XAF",

  beneficiary_name,
  mobile_no,
  payment_method,
  status: "processing",
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  payoutResponse: payoutData,
    // 🔐 IDEMPOTENCY STORAGE
  processedStatuses: [],
});
const treasuryRef = db.collection("treasury").doc(`${transactionId}_fee`);

t.set(treasuryRef, {
  type: "withdrawal_fee",
  amount: fee,
  currency: BASE_CURRENCY,
  userId: uid,
  transactionId,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});
    });
    
    return res.json({
      success: true,
      transactionId,
    });
  } catch (error) {
    // ----------------------
    // ERROR HANDLING (IMPORTANT)
    // ----------------------
    if (error.message === "INSUFFICIENT_BALANCE") {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    if (error.message === "PAYOUT_FAILED") {
      return res.status(500).json({ error: "Payout provider failed" });
    }

    console.error("Payout error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ----------------------
// PAYOUT WEBHOOK (REAL-TIME UPDATE)
// ----------------------
router.post("/webhook", async (req, res) => {
  try {
    const payload = req.body;

    const transaction_id =
      payload?.data?.transaction_id || payload?.transaction_id;

    const status =
      payload?.data?.status || payload?.status;

    if (!transaction_id || !status) {
      return res.status(200).json({ received: true });
    }

    const snapshot = await db
      .collection("payouts")
      .where("transactionId", "==", transaction_id)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(200).json({ received: true });
    }

    const docRef = snapshot.docs[0].ref;

    const raw = String(status).toLowerCase();

    const newStatus =
      raw === "1" || raw === "success" ? "success" :
      raw === "2" || raw === "failed" ? "failed" :
      raw === "refunded" ? "refunded" :
      raw === "cancelled" ? "cancelled" :
      raw === "processing" ? "processing" :
      raw;

    await db.runTransaction(async (t) => {
      const docSnap = await t.get(docRef);
      const payout = docSnap.data();

      const oldStatus = payout.status;

      // 🔐 IDEMPOTENCY KEY
      const processedKey = `${payout.transactionId}_${newStatus}`;
      const processedList = payout.processedStatuses || [];

      // 🚫 HARD STOP (already processed)
      if (oldStatus === newStatus || processedList.includes(processedKey)) {
        return;
      }

      // ✅ UPDATE PAYOUT DOC
      t.update(docRef, {
        status: newStatus,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        processedStatuses: admin.firestore.FieldValue.arrayUnion(processedKey),
      });

      const userRef = db.collection("users").doc(payout.userId);

      // ----------------------
      // SUCCESS (NO ACTION NEEDED)
      // ----------------------
      if (newStatus === "success") {
        console.log("✅ WEBHOOK: payout success");
        return;
      }

      // ----------------------
      // REFUND CASES
      // ----------------------
      if (
        newStatus === "failed" ||
        newStatus === "cancelled" ||
        newStatus === "refunded"
      ) {
        const userSnap = await t.get(userRef);
        const refundedList = userSnap.data()?.refunds || [];

        const txId = payout.transactionId;

        // 🔒 DOUBLE REFUND PROTECTION
        if (refundedList.includes(txId)) return;

        t.update(userRef, {
          realBalance: admin.firestore.FieldValue.increment(payout.amount),
          refunds: admin.firestore.FieldValue.arrayUnion(txId),
        });

        console.log("💰 WEBHOOK REFUND SAFE");
      }
    });

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(200).json({ received: true });
  }
});

// ----------------------
// STATUS CHECK (READ-ONLY SYNC)
// ----------------------
router.post("/status", async (req, res) => {
  try {
    const { transaction_id } = req.body;

    if (!transaction_id) {
      return res.status(400).json({ error: "transaction_id required" });
    }

    const token = await getPayoutToken();

    const response = await fetch(
      "https://api.accountpe.com/api/payout/transaction_status",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transaction_id }),
      }
    );

    const statusData = await response.json();

    const snapshot = await db
      .collection("payouts")
      .where("transactionId", "==", transaction_id)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.json({
        success: true,
        status: statusData,
        source: "provider"
      });
    }

    const docRef = snapshot.docs[0].ref;

    await db.runTransaction(async (t) => {
      const docSnap = await t.get(docRef);
      const payout = docSnap.data();

      const newStatus = statusData?.data?.status || "unknown";
      const oldStatus = payout.status;

      // 🚫 Avoid duplicate updates
      if (oldStatus === newStatus) return;

      // ✅ ONLY update status (NO MONEY LOGIC HERE)
      t.update(docRef, {
        status: newStatus,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return res.json({
      success: true,
      status: statusData,
      source: "sync"
    });

  } catch (err) {
    console.error("Status error:", err.message);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;