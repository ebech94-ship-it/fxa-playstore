const express = require("express");
const router = express.Router();

const { db } = require("../firebaseAdmin");
const treasuryService = require("../services/treasuryService");
const admin = require("firebase-admin");

// ---------------------------------------------------------------------
// AUTH (ADMIN ONLY)
// ---------------------------------------------------------------------
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(token);

    req.user = decoded;

    if (!req.user.admin) {
      return res.status(403).json({ error: "Admin access denied" });
    }

    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// =====================================================
// 1️⃣ APPROVE PAYOUT
// =====================================================
router.post("/approve-payout", authenticate, async (req, res) => {
  try {
    const { transactionId } = req.body;

    const payoutQuery = await db.collection("payouts")
      .where("transactionId", "==", transactionId)
      .limit(1)
      .get();

    if (payoutQuery.empty) throw new Error("Payout not found");

    const payoutRef = payoutQuery.docs[0].ref;

    await db.runTransaction(async (t) => {
      const snap = await t.get(payoutRef);
      const treasuryRef = db.collection("treasury").doc("main");

      const amount = snap.data().amount;

      t.update(treasuryRef, {
        balance: admin.firestore.FieldValue.increment(-amount),
      });

      t.update(payoutRef, {
        status: "paid",
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      t.update(db.collection("transactions").doc(transactionId), {
        status: "PAID",
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    res.json({ success: true });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =====================================================
// 2️⃣ REJECT PAYOUT
// =====================================================
router.post("/reject-payout", authenticate, async (req, res) => {
  try {
    const { transactionId, reason } = req.body;

    const payoutQuery = await db.collection("payouts")
      .where("transactionId", "==", transactionId)
      .limit(1)
      .get();

    if (payoutQuery.empty) throw new Error("Payout not found");

    const payoutRef = payoutQuery.docs[0].ref;

    await db.runTransaction(async (t) => {
      const snap = await t.get(payoutRef);

      const userRef = db.collection("users").doc(snap.data().userId);

      t.update(userRef, {
        realBalance: admin.firestore.FieldValue.increment(snap.data().amount),
      });

      t.update(payoutRef, {
        status: "rejected",
        reason: reason || "No reason provided",
        rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      t.update(db.collection("transactions").doc(transactionId), {
        status: "REJECTED",
      });
    });

    res.json({ success: true });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =====================================================
// 3️⃣ PAY TOURNAMENT WINNER
// =====================================================
router.post("/pay-tournament-winner", authenticate, async (req, res) => {
  try {
    const { tournamentId, userId, amount, rank } = req.body;

    await treasuryService.payTournamentWinner(
      tournamentId,
      userId,
      amount,
      rank,
      req.user.uid
    );

    res.json({ success: true });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =====================================================
// 4️⃣ FREEZE USER
// =====================================================
router.post("/toggle-freeze", authenticate, async (req, res) => {
  try {
    const { userId, freeze } = req.body;

    await db.collection("users").doc(userId).update({
      frozen: !!freeze,
    });

    res.json({ success: true });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =====================================================
// 5️⃣ DELETE USER (SOFT)
// =====================================================
router.post("/delete-user", authenticate, async (req, res) => {
  try {
    const { userId } = req.body;

    await db.collection("users").doc(userId).update({
      deleted: true,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =====================================================
// 6️⃣ MOVE TO TREASURY
// =====================================================
router.post("/moveTournamentFundsToTreasury", authenticate, async (req, res) => {
  try {
    const { tournamentId, amount } = req.body;

    await treasuryService.moveTournamentFundsToTreasury(
      tournamentId,
      amount
    );

    res.json({ success: true });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =====================================================
// 7️⃣ SYSTEM LOGS
// =====================================================
router.get("/system-logs", authenticate, async (req, res) => {
  try {
    const snapshot = await db.collection("adminLogs")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const logs = snapshot.docs.map(doc => doc.data());

    res.json(logs);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// 8️⃣ ACTIVITY HISTORY
// =====================================================
router.get("/activity-history", authenticate, async (req, res) => {
  try {
    const snapshot = await db.collection("adminLogs")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const activities = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(activities);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/reply-support", authenticate, async (req, res) => {
  try {
    const { threadId, message } = req.body;

    if (!threadId || !message || !message.trim()) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const threadRef = db.collection("supportThreads").doc(threadId);
    const threadSnap = await threadRef.get();

    if (!threadSnap.exists) {
      return res.status(404).json({ error: "Support thread not found" });
    }

    // ✅ Add admin message to thread
    await threadRef.collection("messages").add({
      sender: "admin",
      text: message.trim(),
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      adminId: req.user.uid,
    });

    // ✅ Update thread metadata
    await threadRef.update({
      lastMessage: message.trim(),
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "answered",
      answeredBy: req.user.uid,
    });

    // (optional but good) log admin action
    await db.collection("adminLogs").add({
      adminId: req.user.uid,
      action: "reply-support",
      threadId,
      message: message.trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: "Reply sent successfully",
    });

  } catch (err) {
    console.error("REPLY SUPPORT ERROR:", err.message);
    res.status(500).json({ error: "Failed to send reply" });
  }
});

module.exports = router;