const express = require("express");
const router = express.Router();
const { db } = require("../firebaseAdmin");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const crypto = require("crypto");

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
    console.error("❌ Payout auth failed");
    throw new Error("Failed to get payout token");
  }

  payoutToken = data.token;
  tokenExpiry = Date.now() + 55 * 60 * 1000;

  return payoutToken;
}

// ----------------------
// FRONTEND COMPATIBILITY ROUTE
// ----------------------
router.post("/create-request", async (req, res, next) => {
  req.url = "/";
  return router.handle(req, res, next);
});

// ----------------------
// CREATE PAYOUT
// ----------------------
router.post("/", async (req, res) => {
  let transactionId;

  try {
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

    if (!beneficiary_name || !mobile_no || !amount || !payment_method || !country_code) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const idToken = req.headers.authorization?.split("Bearer ")[1];
    if (!idToken) return res.status(401).json({ error: "Unauthorized" });

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const userRef = db.collection("users").doc(uid);

    // 💰 AMOUNT LOGIC
    const withdrawalUSD = Number(amount);

    if (!withdrawalUSD || withdrawalUSD <= 0) {
      throw new Error("INVALID_AMOUNT");
    }

    if (withdrawalUSD < 1) {
      throw new Error("MIN_WITHDRAWAL_1_USD");
    }

    // 🔄 CONVERSION
    const grossXAF = Math.round(withdrawalUSD * XAF_TO_USD);

    const feeUSD = Number((withdrawalUSD * 0.01).toFixed(2)); // 1%
    const feeXAF = Math.round(feeUSD * XAF_TO_USD);

    const netXAF = grossXAF - feeXAF;

    // 🆔 TRANSACTION ID
   transactionId = `payout_${Date.now()}_${Math.random()
  .toString(36)
  .substring(2, 8)}`;

    // 🚫 PREVENT DUPLICATE PROCESSING (MOVED UP - SAFE)
    const existing = await db
      .collection("payouts")
      .where("userId", "==", uid)
      .where("status", "in", ["processing"])
      .limit(1)
      .get();

    if (!existing.empty) {
      throw new Error("PAYOUT_ALREADY_PROCESSING");
    }

    // ----------------------
    // FIRESTORE TRANSACTION FIRST (LOCK FUNDS)
    // ----------------------
    let payoutRef;

    await db.runTransaction(async (t) => {
      const userSnap = await t.get(userRef);
      const balance = userSnap.data()?.realBalance || 0;

      if (balance < withdrawalUSD) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      // 🔒 Deduct user balance
      t.update(userRef, {
        realBalance: admin.firestore.FieldValue.increment(-withdrawalUSD),
      });

      // 🧾 Create payout (LOCKED STATE)
      payoutRef = db.collection("payouts").doc(transactionId);

      t.set(payoutRef, {
        userId: uid,
        transactionId,

        amount: withdrawalUSD,
        fee: feeUSD,
        netAmount: withdrawalUSD - feeUSD,
        
         currency: BASE_CURRENCY, 
        payoutAmount: netXAF,
        payoutCurrency: "XAF",

        beneficiary_name,
        mobile_no,
        payment_method,

 // ✅ ADD THESE (IMPORTANT)
  country_code,
  bank_code,
  account_number,
  remarks,

        status: "locked",
        retryCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        processedStatuses: [],
      });

      // 💰 Treasury update
      const treasuryRef = db.collection("treasury").doc("main");

      t.set(
        treasuryRef,
        {
          balance: admin.firestore.FieldValue.increment(feeUSD),
          totalFees: admin.firestore.FieldValue.increment(feeUSD),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // 🧾 Audit log
      const auditRef = db.collection("withdrawalFees").doc(transactionId);

      t.set(auditRef, {
        type: "withdrawal_fee",
        amount: feeUSD,
        currency: "USD",
        userId: uid,
        transactionId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

   /* // 🔑 GET TOKEN (MOVED AFTER LOCK)
    const token = await getPayoutToken();

    // 🌐 CALL API (NOW SAFE)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

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
          amount: netXAF,
          transaction_id: transactionId,
          payment_method,
          remarks: remarks || "",
          bank_code,
          account_number,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error("PAYOUT_FAILED");
    }
    await payoutRef.update({
  status: "failed",
});

    const payoutData = await response.json();

    if (!payoutData || payoutData.status === "error") {
      throw new Error("PAYOUT_FAILED");
    }

    // 🔄 UPDATE STATUS AFTER SUCCESS API CALL
    await payoutRef.update({
      status: "processing",
      payoutResponse: payoutData,
    });

    return res.json({
      success: true,
      message: "Payout initiated successfully",
      transactionId,
    });*/
    // ----------------------
// ✅ WAIT FOR ADMIN APPROVAL
// ----------------------
return res.json({
  success: true,
  message: "Withdrawal request submitted. Awaiting admin approval.",
  transactionId,
});

  } catch (error) {
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
// WEBHOOK (SECURED)
// ----------------------
router.post("/webhook", async (req, res) => {
  let auditRef;

  try {
    const signature = req.headers["x-swychr-signature"];

    // ----------------------
    // 1. VERIFY SIGNATUREa
    // ----------------------
    if (process.env.SWYCHR_WEBHOOK_SECRET) {
      const expectedSignature = crypto
        .createHmac("sha256", process.env.SWYCHR_WEBHOOK_SECRET)
        .update(req.rawBody)
        .digest("hex");

      if (signature !== expectedSignature) {
        auditRef = db.collection("webhookAudit").doc();

        await auditRef.set({
          type: "invalid_signature",
          payload: req.body,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const payload = req.body;

    const transactionId =
      payload?.data?.transaction_id || payload?.transaction_id;

    const rawStatus =
      payload?.data?.status || payload?.status;

    if (!transactionId || !rawStatus) {
      await db.collection("webhookAudit").add({
        type: "invalid_payload",
        payload: req.body,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({ received: true });
    }

    const raw = String(rawStatus).toLowerCase();

    const newStatus =
      raw === "1" || raw === "success" ? "success" :
      raw === "2" || raw === "failed" ? "failed" :
      raw === "refunded" ? "refunded" :
      raw === "cancelled" ? "cancelled" :
      raw === "processing" ? "processing" :
      "unknown";

    // ----------------------
    // 2. FIND PAYOUT
    // ----------------------
    const snapshot = await db
      .collection("payouts")
      .where("transactionId", "==", transactionId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      await db.collection("webhookAudit").add({
        type: "payout_not_found",
        transactionId,
        status: newStatus,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({ received: true });
    }

    const payoutRef = snapshot.docs[0].ref;

    // ----------------------
    // 3. SAFE TRANSACTION
    // ----------------------
    await db.runTransaction(async (t) => {
      const snap = await t.get(payoutRef);
      const payout = snap.data();

      const userRef = db.collection("users").doc(payout.userId);
      const userSnap = await t.get(userRef);

      const beforeBalance = userSnap.data()?.realBalance || 0;

      const processedKey = `${transactionId}_${newStatus}`;
      const refundKey = `${transactionId}_${newStatus}`;

      // ----------------------
      // IDENTITY GUARD (SAFE EXIT)
      // ----------------------
      const alreadyProcessed =
        payout.status === newStatus ||
        (payout.processedStatuses || []).includes(processedKey);

      if (alreadyProcessed) {
        return t.update(payoutRef, {
          lastChecked: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // ----------------------
      // UPDATE PAYOUT STATUS
      // ----------------------
      t.update(payoutRef, {
        status: newStatus,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        processedStatuses: admin.firestore.FieldValue.arrayUnion(processedKey),
      });

      const treasuryRef = db.collection("treasury").doc("main");

      // ----------------------
      // REFUND LOGIC
      // ----------------------
      if (["failed", "cancelled", "refunded"].includes(newStatus)) {
        const refunds = userSnap.data()?.refunds || [];

        if (!refunds.includes(refundKey)) {
          t.update(userRef, {
            realBalance: admin.firestore.FieldValue.increment(payout.amount),
            refunds: admin.firestore.FieldValue.arrayUnion(refundKey),
          });

          t.set(
            treasuryRef,
            {
              balance: admin.firestore.FieldValue.increment(payout.amount),
              lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          t.set(db.collection("ledger").doc(), {
            userId: payout.userId,
            type: "refund",
            amount: payout.amount,
            currency: "USD",
            beforeBalance,
            afterBalance: beforeBalance + payout.amount,
            reference: transactionId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          t.set(db.collection("transactions").doc(), {
            userId: payout.userId,
            type: "refund",
            amount: payout.amount,
            reason: `Payout ${newStatus}`,
            transactionId,
            status: "completed",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      // ----------------------
      // SUCCESS LOGIC
      // ----------------------
      if (newStatus === "success") {
        t.set(
          treasuryRef,
          {
            balance: admin.firestore.FieldValue.increment(-payout.amount),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        t.set(db.collection("ledger").doc(), {
          userId: payout.userId,
          type: "payout",
          amount: payout.amount,
          currency: "USD",
          beforeBalance,
          afterBalance: beforeBalance,
          reference: transactionId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        t.set(db.collection("transactions").doc(), {
          userId: payout.userId,
          type: "payout",
          amount: payout.amount,
          transactionId,
          status: "completed",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    // ----------------------
    // 4. FINAL AUDIT LOG
    // ----------------------
    await db.collection("webhookAudit").add({
      type: "processed",
      transactionId,
      status: newStatus,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error("Webhook error:", err);

    await db.collection("webhookAudit").add({
      type: "error",
      error: err.message,
      stack: err.stack,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});

    return res.status(200).json({ received: true });
  }
});
// ----------------------
// STATUS CHECK
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

    return res.json({
      success: true,
      status: statusData,
    });

  } catch (err) {
    console.error("Status error:", err.message);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


// ----------------------
// ADMIN: APPROVE WITHDRAWAL
// ----------------------
router.post("/admin/approve-withdrawal", async (req, res) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: "transactionId required" });
    }

    // 🔍 Find payout
    const payoutRef = db.collection("payouts").doc(transactionId);
    const payoutSnap = await payoutRef.get();

    if (!payoutSnap.exists) {
      return res.status(404).json({ error: "Payout not found" });
    }

    const payout = payoutSnap.data();

    // 🚫 Only allow locked/pending payouts
    if (payout.status !== "locked") {
      return res.status(400).json({
        error: `Cannot approve payout with status: ${payout.status}`,
      });
    }

    // 🔑 Get payout token
    const token = await getPayoutToken();

    // 🌐 Call payout API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

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
          country_code: payout.country_code,
          beneficiary_name: payout.beneficiary_name,
          mobile_no: payout.mobile_no,
          amount: payout.payoutAmount,
          transaction_id: payout.transactionId,
          payment_method: payout.payment_method,
          remarks: payout.remarks || "",
          bank_code: payout.bank_code || "",
          account_number: payout.account_number || "",
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error("PAYOUT_FAILED");
    }

    const payoutData = await response.json();

    if (!payoutData || payoutData.status === "error") {
      throw new Error("PAYOUT_FAILED");
    }

    // 🔄 Update payout status
    await payoutRef.update({
      status: "processing",
      payoutResponse: payoutData,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      message: "Withdrawal approved and payout initiated",
      transactionId,
    });

  } catch (err) {
    console.error("APPROVE WITHDRAWAL ERROR:", err.message);

    return res.status(500).json({
      error: err.message || "Failed to approve withdrawal",
    });
  }
});
// ----------------------
// ADMIN: REJECT WITHDRAWAL
// ----------------------
router.post("/admin/reject-withdrawal", async (req, res) => {
  try {
    const { transactionId, reason } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: "transactionId required" });
    }

    const payoutRef = db.collection("payouts").doc(transactionId);
    const payoutSnap = await payoutRef.get();

    if (!payoutSnap.exists) {
      return res.status(404).json({ error: "Payout not found" });
    }

    const payout = payoutSnap.data();

    // 🚫 Only locked withdrawals can be rejected
    if (payout.status !== "locked") {
      return res.status(400).json({
        error: `Cannot reject payout with status: ${payout.status}`,
      });
    }

    const userRef = db.collection("users").doc(payout.userId);

    // 🔄 Run refund safely
    await db.runTransaction(async (t) => {
      const userSnap = await t.get(userRef);

      const beforeBalance = userSnap.data()?.realBalance || 0;

      // 💰 Refund user
      t.update(userRef, {
        realBalance: admin.firestore.FieldValue.increment(payout.amount),
      });

      // ❌ Mark payout as rejected
      t.update(payoutRef, {
        status: "rejected",
        rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
        rejectionReason: reason || "Rejected by admin",
      });

      // 🧾 Ledger entry (optional but good for tracking)
      t.set(db.collection("ledger").doc(), {
        userId: payout.userId,
        type: "withdrawal_rejected",
        amount: payout.amount,
        currency: "USD",
        beforeBalance,
        afterBalance: beforeBalance + payout.amount,
        reference: transactionId,
        reason: reason || "Admin rejection",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 📊 Transaction log
      t.set(db.collection("transactions").doc(), {
        userId: payout.userId,
        type: "withdrawal_rejected",
        amount: payout.amount,
        transactionId,
        status: "rejected",
        reason: reason || "Admin rejection",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return res.json({
      success: true,
      message: "Withdrawal rejected and refunded",
      transactionId,
    });

  } catch (err) {
    console.error("REJECT WITHDRAWAL ERROR:", err.message);

    return res.status(500).json({
      error: err.message || "Failed to reject withdrawal",
    });
  }
});
// ----------------------
// ADMIN RETRY PAYOUT
// ----------------------
router.post("/admin/retry-payout", async (req, res) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: "transactionId required" });
    }

    const payoutRef = db.collection("payouts").doc(transactionId);
    const snap = await payoutRef.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Payout not found" });
    }

    const payout = snap.data();

    if (!["failed", "locked"].includes(payout.status)) {
      return res.status(400).json({ error: "Cannot retry this payout" });
    }

    const token = await getPayoutToken();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

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
          country_code: payout.country_code,
          beneficiary_name: payout.beneficiary_name,
          mobile_no: payout.mobile_no,
          amount: payout.payoutAmount,
          transaction_id: transactionId,
          payment_method: payout.payment_method,
          remarks: payout.remarks || "",
          bank_code: payout.bank_code,
          account_number: payout.account_number,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    const data = await response.json();

    if (!response.ok || data?.status === "error") {
      await payoutRef.update({ status: "failed" });
      return res.status(500).json({ error: "Retry failed" });
    }

    await payoutRef.update({
      status: "processing",
      retryCount: admin.firestore.FieldValue.increment(1),
      payoutResponse: data,
    });

    return res.json({
      success: true,
      message: "Retry initiated",
      transactionId,
    });

  } catch (err) {
    console.error("Retry error:", err);
    return res.status(500).json({ error: err.message });
  }
});
// ----------------------
// ADMIN FORCE STATUS
// ----------------------
router.post("/admin/force-payout-status", async (req, res) => {
  try {
    const { transactionId, status } = req.body;

    const allowed = ["processing", "success", "failed", "cancelled", "refunded"];

    if (!transactionId || !status) {
      return res.status(400).json({ error: "Missing fields" });
    }

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const payoutRef = db.collection("payouts").doc(transactionId);

    const snap = await payoutRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Payout not found" });
    }

    await payoutRef.update({
      status,
      forced: true,
      forcedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      message: `Status forced to ${status}`,
      transactionId,
    });

  } catch (err) {
    console.error("Force status error:", err);
    return res.status(500).json({ error: err.message });
  }
});
module.exports = router;