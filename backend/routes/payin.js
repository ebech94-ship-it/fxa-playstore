// payin.js
const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");

const { db } = require("../firebaseAdmin");
const admin = require("firebase-admin");
const crypto = require("crypto");

const { XAF_TO_USD, BASE_CURRENCY } = require("../config/currency");

// ----------------------
// TOKEN CACHE
// ----------------------
let swychrToken = null;
let tokenExpiry = null;

async function getSwychrToken() {
  // Reuse token if still valid (with 2 min buffer)
  if (swychrToken && tokenExpiry && new Date() < tokenExpiry) {
    return swychrToken;
  }

  const response = await fetch("https://api.accountpe.com/api/payin/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.SWYCHR_EMAIL,
      password: process.env.SWYCHR_PASSWORD,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error("Swychr auth failed: " + errText);
  }

  const data = await response.json();

  if (!data.token) {
    throw new Error("Invalid Swychr auth response");
  }

  swychrToken = data.token;

  // ⏱️ Use expiry from API message if possible
  if (data.message) {
    const parsedDate = new Date(data.message);
    if (!isNaN(parsedDate)) {
      // subtract 2 mins safety buffer
      tokenExpiry = new Date(parsedDate.getTime() - 2 * 60 * 1000);
    } else {
      tokenExpiry = new Date(Date.now() + 55 * 60 * 1000);
    }
  } else {
    tokenExpiry = new Date(Date.now() + 55 * 60 * 1000);
  }

  return swychrToken;
}

// ----------------------
// LOGIN ROUTE (optional)
// ----------------------
router.get("/login", async (req, res) => {
  try {
    const token = await getSwychrToken();
    res.json({ success: true, token });
  } catch (error) {
    console.error("Swychr login error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------
// CREATE PAYMENT LINK
// ----------------------
router.post("/create-link", async (req, res) => {
  try {
    const { name, email, momoNumber, amount } = req.body;

    if (!name || !email || !momoNumber || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const idToken = req.headers.authorization?.split("Bearer ")[1];
    if (!idToken) return res.status(401).json({ error: "Unauthorized" });

    let uid;
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      uid = decodedToken.uid;
    } catch (_err) {
      return res.status(401).json({ error: "Invalid token" });
    }
const amountNum = Number(amount);

if (!amountNum || amountNum <= 0) {
  return res.status(400).json({ error: "Invalid amount" });
}
const cleanPhone = String(momoNumber).replace(/\s/g, "");

if (!/^(237)?6\d{8}$/.test(cleanPhone)) {
  return res.status(400).json({ error: "Invalid MoMo number" });
}
    const token = await getSwychrToken();

    const transactionId =
      "txn_" + Date.now() + "_" + Math.floor(Math.random() * 10000);

    const paymentResponse = await fetch(
      "https://api.accountpe.com/api/payin/create_payment_links",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": transactionId,
        },
        body: JSON.stringify({
          country_code: "CM",
          name,
          email,
          amount:amountNum,
          currency: "XAF",
          transaction_id: transactionId,
          description: "Forex Tournament Deposit",
          pass_digital_charge: true,
          mobile: cleanPhone,
         callback_url: process.env.PAYIN_WEBHOOK_URL,
        }),
      }
    );

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text();
      throw new Error("Payment link failed: " + errorText);
    }

    const paymentData = await paymentResponse.json();
    if (!paymentData?.data?.payment_link) {
  throw new Error("Payment link missing from provider response");
}

const amountUSD = amountNum / XAF_TO_USD;

await db.collection("transactions").add({
  userId: uid,
  transactionId,
 name,
  email,
  amount: amountUSD,
currency: BASE_CURRENCY,
originalCurrency: "XAF",
originalAmount: amountNum,
  momoNumber: cleanPhone,
  status: "pending",
  type: "deposit",
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});

 res.json({
  success: true,
  paymentUrl: paymentData?.data?.payment_link
});

  } catch (error) {
    console.error("Create link error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
// ----------------------
// WEBHOOK (PRODUCTION SAFE + AUDIT READY)
// ----------------------
router.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-swychr-signature"];

    if (!process.env.SWYCHR_WEBHOOK_SECRET) {
      throw new Error("SWYCHR_WEBHOOK_SECRET is required");
    }

    if (!signature) {
      console.log("❌ Missing signature");
      return res.status(401).send("Unauthorized");
    }

    // VERIFY SIGNATURE
    const expected = crypto
      .createHmac("sha256", process.env.SWYCHR_WEBHOOK_SECRET)
      .update(req.rawBody)
      .digest("hex");

    if (signature !== expected) {
      console.log("❌ Invalid signature");

      await db.collection("webhook_logs").add({
        transactionId: null,
        status: "invalid_signature",
        rawPayload: req.body,
        signatureValid: false,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(401).send("Unauthorized");
    }

    const payload = req.body;

    if (!payload?.data?.data?.attributes) {
      console.log("❌ Invalid payload");

      await db.collection("webhook_logs").add({
        transactionId: null,
        status: "invalid_payload",
        rawPayload: payload,
        signatureValid: true,
        receivedAt:admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({ received: true });
    }

    const { status, transaction_id, amount } =
      payload.data.data.attributes;
      console.log("========== WEBHOOK ATTRIBUTES ==========");
console.log(JSON.stringify(payload.data.data.attributes, null, 2));
console.log("=======================================");

    console.log("🔥 WEBHOOK:", { transaction_id, status });

    const snapshot = await db
      .collection("transactions")
      .where("transactionId", "==", transaction_id)
      .limit(1)
      .get();
console.log("Firestore docs found:", snapshot.size);
    if (snapshot.empty) {
      console.log("❌ Transaction not found");

      await db.collection("webhook_logs").add({
        transactionId: transaction_id,
        status: "not_found",
        rawPayload: payload,
        signatureValid: true,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({ received: true });
    }

    const doc = snapshot.docs[0];

    // ----------------------
    // SUCCESS PAYMENT
    // ----------------------
    if (Number(status) === 1) {
      let ledgerData = null;
      let treasuryData = null;

      await db.runTransaction(async (t) => {
        const snap = await t.get(doc.ref);
        const tx = snap.data();

        if (!tx.userId) throw new Error("Invalid transaction");

        if (tx.status === "completed") return;
        if (tx.processedWebhook) return;

        const txAmountUSD = Number(tx.amount);
        const webhookAmountUSD = Number(amount) / XAF_TO_USD;

        // VALIDATION
        if (
          tx.originalAmount &&
          Math.abs(Number(amount) - Number(tx.originalAmount)) > 1
        ) {
          throw new Error("XAF amount mismatch");
        }

        if (
          tx.amount &&
          Math.abs(webhookAmountUSD - txAmountUSD) > 0.01
        ) {
          throw new Error("USD amount mismatch");
        }

        const userRef = db.collection("users").doc(tx.userId);

        const userSnap = await t.get(userRef);
        const beforeBalance = userSnap.data()?.accounts?.real?.balance || 0;
        const afterBalance = beforeBalance + txAmountUSD;

        // UPDATE USER
       t.update(userRef, {
  "accounts.real.balance": admin.firestore.FieldValue.increment(txAmountUSD),
});

        // UPDATE TREASURY
        const treasuryRef = db.collection("treasury").doc("main");

        t.set(
          treasuryRef,
          {
            balance: admin.firestore.FieldValue.increment(txAmountUSD),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // UPDATE TRANSACTION
        t.update(doc.ref, {
          status: "completed",
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          processedWebhook: true,
        });

        // PREPARE LEDGER DATA
        ledgerData = {
          userId: tx.userId,
          type: "deposit",
          amount: txAmountUSD,
          currency: "USD",
          beforeBalance,
          afterBalance,
          reference: transaction_id,
        };

        treasuryData = {
          type: "deposit",
          amount: txAmountUSD,
          reference: transaction_id,
        };
      });

      // OUTSIDE TRANSACTION → SAFE LOGGING

      await db.collection("webhook_logs").add({
        transactionId: transaction_id,
        status: "success",
        rawPayload: payload,
        signatureValid: true,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (ledgerData) {
        await db.collection("ledger").add({
          ...ledgerData,
         createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      if (treasuryData) {
        await db.collection("treasury_ledger").add({
          ...treasuryData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      console.log("✅ USER CREDITED");
    }

    // ----------------------
    // FAILED PAYMENT
    // ----------------------
    if (Number(status) === 2) {

  const txSnap = await doc.ref.get();

  if (txSnap.data()?.status === "completed") {
    return res.status(200).json({ received: true });
  }

  await doc.ref.update({
    status: "failed",
    failedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

      await db.collection("webhook_logs").add({
        transactionId: transaction_id,
        status: "failed",
        rawPayload: payload,
        signatureValid: true,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log("❌ PAYMENT FAILED");
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error("Webhook error:", error.message);

    return res.status(500).json({ error: error.message });
  }
});
module.exports = router;