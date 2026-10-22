
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { admin, db } = require("./firebaseAdmin");
const treasury = require("./treasury");

if (process.env.FB_PROJECT_ID !== "fxa-playstore") {
  throw new Error("Refusing to start: Firebase must be fxa-playstore");
}

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(req.method, req.url);
  }
  next();
});

// --------------------------------------------------
// AUTHENTICATION
// --------------------------------------------------
async function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No Firebase token provided" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(header.split(" ")[1]);
    const userSnap = await db.collection("users").doc(decoded.uid).get();

    if (!userSnap.exists) {
      return res.status(403).json({ error: "User record not found" });
    }

    const user = userSnap.data();

    if (user.frozen || user.deleted) {
      return res.status(403).json({
        error: user.frozen ? "Account frozen" : "Account deleted",
      });
    }

    req.user = decoded;
    req.userDoc = user;
    next();
  } catch (err) {
    console.error("Authentication error:", err.message);
    return res.status(401).json({ error: "Invalid Firebase token" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.admin !== true) {
    return res.status(403).json({ error: "Admin access denied" });
  }
  next();
}

// --------------------------------------------------
// HEALTH
// --------------------------------------------------
app.get("/health", (req, res) => {
  res.json({ success: true, service: "FX ARENA Coins", project: "fxa-playstore" });
});

// --------------------------------------------------
// INVITE
// Uses the Coins app deep link. Configure scheme in app.config.ts.
// --------------------------------------------------
app.get("/invite", (req, res) => {
  const ref = String(req.query.ref || "").trim();

  if (!ref || !/^[a-zA-Z0-9_-]{1,128}$/.test(ref)) {
    return res.status(400).send("Invalid referral code");
  }

  const deepLink = `fxarenacoins://welcome?ref=${encodeURIComponent(ref)}`;

  res.send(`<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body>
<p>Opening FX ARENA Coins...</p>
<p><a href="${deepLink}">Open FX ARENA Coins</a></p>
<script>window.location.href = ${JSON.stringify(deepLink)};</script>
</body></html>`);
});

// --------------------------------------------------
// VIRTUAL COINS TREASURY
// --------------------------------------------------
app.get("/api/treasury/balances", authenticate, requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection("treasury").doc("main").get();
    const data = snap.exists ? snap.data() : {};

    res.json({
      success: true,
      balance: data.balance || 0,
      lastUpdated: data.lastUpdated?.toDate?.().toISOString() || null,
    });
  } catch (err) {
    console.error("Treasury error:", err.message);
    res.status(500).json({ error: "Failed to fetch Coins treasury" });
  }
});

// --------------------------------------------------
// TOURNAMENT REGISTRATION AND REBUYS
// --------------------------------------------------
app.post("/tournament/register", authenticate, async (req, res) => {
  try {
    const { tournamentId } = req.body;
    if (!tournamentId) {
      return res.status(400).json({ error: "Missing tournamentId" });
    }

    await db.runTransaction(async (t) => {
      await treasury.registerTournament(t, req.user.uid, tournamentId);
    });

    res.json({ success: true, message: "Tournament registered" });
  } catch (err) {
    console.error("Registration error:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/tournament/rebuy", authenticate, async (req, res) => {
  try {
    const { tournamentId } = req.body;
    if (!tournamentId) {
      return res.status(400).json({ error: "Missing tournamentId" });
    }

    await db.runTransaction(async (t) => {
      await treasury.processRebuy(t, req.user.uid, tournamentId);
    });

    res.json({ success: true, message: "Coins rebuy successful" });
  } catch (err) {
    console.error("Rebuy error:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// These award virtual Coins only; no external money transfers.
app.post("/admin/process-tournament-payout", authenticate, requireAdmin, async (req, res) => {
  try {
    if (!req.body.tournamentId) {
      return res.status(400).json({ error: "Missing tournamentId" });
    }

    const result = await treasury.processTournamentPayout(req.body.tournamentId);
    res.json(result);
  } catch (err) {
    console.error("Tournament reward error:", err.message);
    res.status(400).json({ error: err.message });
  }
});

app.post("/admin/pay-participant", authenticate, requireAdmin, async (req, res) => {
  try {
    const { tournamentId, participantId } = req.body;
    if (!tournamentId || !participantId) {
      return res.status(400).json({ error: "Missing tournamentId or participantId" });
    }

    await treasury.payParticipant(tournamentId, participantId);
    res.json({ success: true, message: "Virtual Coins reward credited" });
  } catch (err) {
    console.error("Participant reward error:", err.message);
    res.status(400).json({ error: err.message });
  }
});

// --------------------------------------------------
// ADMIN TOURNAMENT COFFERS
// --------------------------------------------------
app.get("/admin/tournament/coffers", authenticate, requireAdmin, async (req, res) => {
  try {
    const tournamentsSnap = await db.collection("tournaments").get();
    const results = [];

    for (const doc of tournamentsSnap.docs) {
      const tournament = doc.data();
      const cofferSnap = await db.collection("tournamentCoffers").doc(doc.id).get();
      const coffer = cofferSnap.exists ? cofferSnap.data() : {};

      const regCount = coffer.registration?.count || 0;
      const regTotal = coffer.registration?.totalAmount || 0;
      const rebuyCount = coffer.rebuys?.count || 0;
      const rebuyTotal = coffer.rebuys?.totalAmount || 0;

      results.push({
        id: doc.id,
        name: tournament.name || "Unnamed",
        entryFee: tournament.entryFee || 0,
        rebuyFee: tournament.rebuyFee || 0,
        registrationCount: regCount,
        registrationTotal: regTotal,
        rebuyCount,
        rebuyTotal,
        totalGenerated: regTotal + rebuyTotal,
      });
    }

    res.json({ success: true, tournaments: results });
  } catch (err) {
    console.error("Coffers error:", err.message);
    res.status(500).json({ error: "Failed to fetch tournament coffers" });
  }
});

// --------------------------------------------------
// ADMIN VIRTUAL COINS ADJUSTMENTS
// --------------------------------------------------
async function adjustCoins(req, res, mode) {
  try {
    const { userId, amount, reason } = req.body;
    const value = Number(amount);

    if (!userId || !Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ error: "Invalid request" });
    }

    await db.runTransaction((t) =>
      treasury.adminAdjustBalance(
        t, userId, value, mode, reason || `Admin ${mode}`, req.user.uid
      )
    );

    res.json({ success: true, message: `Coins ${mode}ed successfully` });
  } catch (err) {
    console.error("Coins adjustment error:", err.message);
    res.status(400).json({ error: err.message });
  }
}

app.post("/admin/add-funds", authenticate, requireAdmin,
  (req, res) => adjustCoins(req, res, "add"));
app.post("/admin/subtract-funds", authenticate, requireAdmin,
  (req, res) => adjustCoins(req, res, "subtract"));

// --------------------------------------------------
// SUPPORT
// --------------------------------------------------
app.post("/support/send", authenticate, async (req, res) => {
  try {
    const { threadId, message } = req.body;
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message required" });
    }

    const userId = req.user.uid;
    const profile = req.userDoc;

    let threadRef;

    if (!threadId) {
      threadRef = await db.collection("supportThreads").add({
        userId,
        userEmail: profile.email || req.user.email || "No Email",
        username: profile.username || profile.displayName || req.user.name || "Player",
        status: "open",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessage: message.trim(),
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      threadRef = db.collection("supportThreads").doc(threadId);
      const existing = await threadRef.get();

      if (!existing.exists || existing.data().userId !== userId) {
        return res.status(404).json({ error: "Support thread not found" });
      }
    }

    await threadRef.collection("messages").add({
      sender: "user",
      text: message.trim(),
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await threadRef.update({
      lastMessage: message.trim(),
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "open",
    });

    res.json({ success: true, threadId: threadRef.id });
  } catch (err) {
    console.error("Support error:", err.message);
    res.status(500).json({ error: "Failed to send support message" });
  }
});

app.post("/admin/reply-support", authenticate, requireAdmin, async (req, res) => {
  try {
    const { threadId, message } = req.body;
    if (!threadId || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const threadRef = db.collection("supportThreads").doc(threadId);
    const threadSnap = await threadRef.get();
    if (!threadSnap.exists) {
      return res.status(404).json({ error: "Support thread not found" });
    }

    await threadRef.collection("messages").add({
      sender: "admin",
      text: message.trim(),
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      adminId: req.user.uid,
    });

    await threadRef.update({
      lastMessage: message.trim(),
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "answered",
      answeredBy: req.user.uid,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Support reply error:", err.message);
    res.status(500).json({ error: "Failed to reply to support" });
  }
});

// --------------------------------------------------
// USER PROFILE AND ACCOUNT
// --------------------------------------------------
app.get("/user/profile", authenticate, async (req, res) => {
  res.json({ success: true, user: { id: req.user.uid, ...req.userDoc } });
});

app.post("/user/delete-account", authenticate, async (req, res) => {
  try {
    await db.collection("users").doc(req.user.uid).update({
      deleted: true,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete account" });
  }
});

app.post("/admin/reset-password", authenticate, requireAdmin, async (req, res) => {
  try {
    if (!req.body.email) return res.status(400).json({ error: "Email required" });
    await admin.auth().generatePasswordResetLink(req.body.email);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Could not create reset link" });
  }
});

app.post("/admin/delete-user", authenticate, requireAdmin, async (req, res) => {
  try {
    if (!req.body.userId) return res.status(400).json({ error: "Missing userId" });
    await db.collection("users").doc(req.body.userId).update({
      deleted: true,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Could not delete user" });
  }
});

// --------------------------------------------------
// ADMIN NOTIFICATIONS AND LOGS
// --------------------------------------------------
app.post("/admin/send-notification", authenticate, requireAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message required" });
    }

    const ref = db.collection("alerts").doc();
    await ref.set({
      title: "Admin Message",
      message: message.trim(),
      type: "admin",
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, alertId: ref.id });
  } catch (err) {
    res.status(500).json({ error: "Failed to send notification" });
  }
});

async function getAdminLogs(res, mode) {
  try {
    const snap = await db.collection("adminLogs")
      .orderBy("createdAt", "desc").limit(100).get();

    const rows = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        admin: data.adminId || "Unknown",
        message: `${data.adminId || "Unknown"} → ${data.action || data.reason || "Performed action"}`,
        action: data.action || data.reason || "Performed action",
        createdAt: data.createdAt?.toDate?.().toISOString() || null,
      };
    });

    res.json(mode === "activity" ? rows.map(({ id, admin, action, createdAt }) =>
      ({ id, admin, action, createdAt })) : rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch admin logs" });
  }
}

app.get("/admin/system-logs", authenticate, requireAdmin,
  (req, res) => getAdminLogs(res, "logs"));
app.get("/admin/activity-history", authenticate, requireAdmin,
  (req, res) => getAdminLogs(res, "activity"));

// --------------------------------------------------
// TOURNAMENTS
// --------------------------------------------------
app.get("/tournaments", authenticate, async (req, res) => {
  try {
    const snap = await db.collection("tournaments")
      .orderBy("createdAt", "desc").get();

    res.json({
      success: true,
      tournaments: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tournaments" });
  }
});

app.get("/tournament/:tournamentId", authenticate, async (req, res) => {
  try {
    const snap = await db.collection("tournaments").doc(req.params.tournamentId).get();
    if (!snap.exists) return res.status(404).json({ error: "Tournament not found" });

    res.json({ success: true, tournament: { id: snap.id, ...snap.data() } });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tournament" });
  }
});

app.get("/tournament/:tournamentId/me", authenticate, async (req, res) => {
  try {
    const ref = db.collection("tournaments").doc(req.params.tournamentId)
      .collection("participants").doc(req.user.uid);
    const snap = await ref.get();

    res.json({
      success: true,
      joined: snap.exists,
      data: snap.exists ? snap.data() : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tournament state" });
  }
});

// --------------------------------------------------
// COINS TRANSACTIONS AND ALERTS
// --------------------------------------------------
app.get("/transactions", authenticate, async (req, res) => {
  try {
    const snap = await db.collection("transactions")
      .where("userId", "==", req.user.uid)
      .orderBy("createdAt", "desc").limit(50).get();

    res.json({
      success: true,
      transactions: snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.().toISOString() || null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

app.get("/alerts", authenticate, async (req, res) => {
  try {
    const snap = await db.collection("alerts")
      .orderBy("createdAt", "desc").limit(30).get();

    res.json({ success: true, alerts: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

app.get("/admin/transactions", authenticate, requireAdmin, async (req, res) => {
  try {
    let query = db.collection("transactions");
    if (req.query.type) query = query.where("type", "==", req.query.type);

    const snap = await query.orderBy("createdAt", "desc").limit(200).get();
    res.json(snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.().toISOString() || null,
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

app.get("/admin/pending-transactions", authenticate, requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection("transactions")
      .where("status", "==", "pending")
      .orderBy("createdAt", "desc").limit(100).get();

    res.json(snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId || null,
        username: data.username || null,
        publicId: data.publicId || null,
        user: data.username || data.publicId || data.userId || "Unknown",
        amount: data.amount || 0,
        status: data.status || "pending",
        createdAt: data.createdAt?.toDate?.().toISOString() || null,
      };
    }));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pending transactions" });
  }
});

app.post("/admin/toggle-freeze", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.collection("system").doc("settings").set(
      { frozen: !!req.body.freeze },
      { merge: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// --------------------------------------------------
// CURRENCY CONFIG (OPTIONAL LEGACY FRONTEND SUPPORT)
// --------------------------------------------------
app.get("/api/currency", (req, res) => {
  try {
    const { rates, BASE_CURRENCY } = require("./config/currency");
    res.json({ base: BASE_CURRENCY, rates });
  } catch {
    res.status(503).json({ error: "Currency configuration unavailable" });
  }
});

// --------------------------------------------------
// START
// --------------------------------------------------
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`FX ARENA Coins backend running on port ${PORT}`);
});
