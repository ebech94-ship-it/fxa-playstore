console.log("🔥🔥🔥 ACTIVE SERVER.JS LOADED 🔥🔥🔥");

require("dotenv").config();


// 🔒 CHECK WEBHOOK SECRET
if (!process.env.SWYCHR_WEBHOOK_SECRET) {
  console.warn("⚠️ SWYCHR_WEBHOOK_SECRET is NOT set");
} else {
  console.log(
    "SWYCHR_WEBHOOK_SECRET loaded:",
    !!process.env.SWYCHR_WEBHOOK_SECRET
  );
}
console.log("🔥 ACTIVE SERVER.JS LOADED 🔥");

const express = require("express");
const cors = require("cors");
// ---------------------------------------------------------------------
 // FIREBASE + TREASURY
// ---------------------------------------------------------------------
const { db } = require("./firebaseAdmin");
const treasury = require("./treasury");

const admin = require("firebase-admin");


// If your Node version < 18, uncomment next two lines
 const fetch = require("node-fetch");
 global.fetch = fetch;
// routes
const payinRoutes = require("./routes/payin");
const payoutRoutes = require("./routes/payout");



const app = express();

app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    console.log("📩", req.method, req.url);
  }
  next();
});

// ---------------------------------------------------------------------
// CORS + JSON
// ---------------------------------------------------------------------
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Middleware to verify Firebase ID token
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No Firebase token provided" });
  }

  const idToken = authHeader.split(" ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // attach decoded user info to request

    // 🔒 FREEZE CHECK (ADD HERE)
   const userSnap = await db.collection("users").doc(decodedToken.uid).get();
   
// ----------------------
// CORE MIDDLEWARE
// ----------------------


if (!userSnap.exists) {
  return res.status(403).json({ error: "User record not found" });
}

if (userSnap.data()?.frozen) {
  return res.status(403).json({ error: "Account frozen" });
}

if (userSnap.data()?.deleted) {
  return res.status(403).json({ error: "Account deleted" });
}
req.userDoc = userSnap.data();
    next(); // 👈 must be LAST
  } catch (err) {
    console.error("Firebase auth error:", err.message);
    return res.status(401).json({ error: "Invalid Firebase token" });
  }
};
const requireAdmin = (req, res, next) => {
console.log("USER CLAIMS:", req.user);
  try {

    // ✅ Check custom claim from Firebase token
    if (!req.user.admin) {
      return res.status(403).json({ error: "Admin access denied" });
    }

    next();
  } catch  {
    return res.status(500).json({ error: "Admin verification failed" });
  }
};


// ---------------------------------------------------------------------
// HEALTH CHECK ROUTE (backend reachability depends on server being up)
// ---------------------------------------------------------------------
// ----------------------
// HEALTH CHECK
// ----------------------
app.get("/health", (req, res) => {
  res.send("Backend running");
});


// ---------------------------------------------------------------------
// INVITE ROUTE
// ---------------------------------------------------------------------
app.get("/invite", (req, res) => {
  const ref = req.query.ref;

  if (!ref) {
    return res.status(400).send("Missing referral code");
  }

  // Deep link (opens the app if installed)
  const deepLink = `forextournamentsarena://welcome?ref=${ref}`;

  // Fallback URL (Vercel download page)
 const fallbackUrl = `https://forexarena.vercel.app/download?ref=${ref}`;
  // Serve a simple HTML page that tries deep link first
  res.send(`
    <html>
    <head>
    <meta http-equiv="refresh" content="2;url=${fallbackUrl}" />
  </head>
      <body>
        <script>
          // Try opening the app
          window.location = "${deepLink}";

          // If the app is not installed, redirect to Vercel after 1.5 seconds
          setTimeout(() => {
            window.location = "${fallbackUrl}";
          }, 2000);
        </script>
        <p>If you are not redirected, <a href="${fallbackUrl}">click here to download the app</a></p>
      </body>
    </html>
  `);
});



// ---------------------------------------------------------------------
// TREASURY TEST ROUTE
// ---------------------------------------------------------------------
app.get("/api/treasury/balances", authenticate, requireAdmin, async (req, res) => {

  try {
    const doc = await db.collection("treasury").doc("main").get();

    const data = doc.data();

res.json({
  success: true,
  balance: data?.balance || 0,
  lastUpdated: data?.lastUpdated
    ? data.lastUpdated.toDate().toISOString()
    : null,
});
  } catch (err) {
    console.error("Treasury check error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------------------------------------------------
   🎟 TOURNAMENT REGISTER ROUTE
--------------------------------------------------- */
app.post("/tournament/register", authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { tournamentId } = req.body;

    if (!tournamentId) {
      return res.status(400).json({ error: "Missing tournamentId" });
    }

    await db.runTransaction(async (t) => {
      const tourRef = db.collection("tournaments").doc(tournamentId);
      const tourSnap = await t.get(tourRef);

      if (!tourSnap.exists) {
        throw new Error("TOURNAMENT_NOT_FOUND");
      }

      await treasury.registerTournament(t, userId, tournamentId);
    });

    return res.json({
      success: true,
      message: "Tournament registered successfully",
    });

  } catch (err) {
    console.error("Tournament register error:", err.message);

    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});


/* ---------------------------------------------------
   🔄 TOURNAMENT REBUY ROUTE
--------------------------------------------------- */
app.post("/tournament/rebuy", authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { tournamentId } = req.body;

    if (!tournamentId) {
      return res.status(400).json({ error: "Missing tournamentId" });
    }

    await db.runTransaction(async (t) => {
      const tourRef = db.collection("tournaments").doc(tournamentId);
      const tourSnap = await t.get(tourRef);

      if (!tourSnap.exists) {
        throw new Error("TOURNAMENT_NOT_FOUND");
      }

      await treasury.processRebuy(t, userId, tournamentId);
    });

    return res.json({
      success: true,
      message: "Rebuy successful",
    });

  } catch (err) {
    console.error("Rebuy error:", err.message);

    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});

/* ---------------------------------------------------
    TOURNAMENT PAYOUT (RACE-CONDITION SAFE)
--------------------------------------------------- */
app.post("/admin/process-tournament-payout", authenticate, requireAdmin, async (req, res) => {
  try {
    const { tournamentId } = req.body;

    if (!tournamentId) {
      return res.status(400).json({ error: "Missing tournamentId" });
    }

    await treasury.processTournamentPayout(tournamentId);

    res.json({
      success: true,
      message: "Tournament payout completed successfully",
    });

  } catch (err) {
    console.error("Payout error:", err.message);
    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});
app.post("/admin/pay-participant", authenticate, requireAdmin, async (req, res) => {
  try {
    const { tournamentId, participantId } = req.body;

    if (!tournamentId || !participantId) {
      return res.status(400).json({
        error: "Missing tournamentId or participantId",
      });
    }

    await treasury.payParticipant(tournamentId, participantId);

    res.json({
      success: true,
      message: "Participant paid successfully",
    });

  } catch (err) {
    console.error("Participant payout error:", err);

    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});

// ----------------------
// ADMIN — ALL TOURNAMENT COFFERS (TABLE VIEW)
// ----------------------
app.get("/admin/tournament/coffers", authenticate, requireAdmin, async (req, res) => {
  try {
    const tournamentsSnap = await db.collection("tournaments").get();

    const results = [];

    for (const doc of tournamentsSnap.docs) {
      const tournament = doc.data();
      const tournamentId = doc.id;

      const cofferSnap = await db
        .collection("tournamentCoffers")
        .doc(tournamentId)
        .get();

      const coffer = cofferSnap.exists ? cofferSnap.data() : {};

      const regCount = coffer.registration?.count || 0;
      const regTotal = coffer.registration?.totalAmount || 0;

      const rebuyCount = coffer.rebuys?.count || 0;
      const rebuyTotal = coffer.rebuys?.totalAmount || 0;

      results.push({
        id: tournamentId,
        name: tournament.name || "Unnamed",
        entryFee: tournament.entryFee || 0,
        rebuyFee: tournament.rebuyFee || 0,

        registrationCount: regCount,
        registrationTotal: regTotal,

        rebuyCount: rebuyCount,
        rebuyTotal: rebuyTotal,

        totalGenerated: regTotal + rebuyTotal,
      });
    }

    res.json({
      success: true,
      tournaments: results,
    });

  } catch (err) {
    console.error("COFFERS TABLE ERROR:", err.message);
    res.status(500).json({ error: "Failed to fetch coffer table" });
  }
});


app.post("/admin/add-funds", authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;

    if (!userId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Invalid request" });
    }

    await db.runTransaction(async (t) => {
      await treasury.adminAdjustBalance(
        t,
        userId,
        Number(amount),
        "add",
        reason || "Admin credit",
         req.user.uid
      );
    });

    res.json({ success: true, message: "Funds added successfully" });

  } catch (err) {
    console.error("ADD FUNDS ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/admin/subtract-funds", authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;

    if (!userId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Invalid request" });
    }
 
    await db.runTransaction(async (t) => {
      await treasury.adminAdjustBalance(
        t,
        userId,
        Number(amount),
        "subtract",
        reason || "Admin debit",
          req.user.uid
      );
    });

    res.json({ success: true, message: "Funds subtracted successfully" });

  } catch (err) {
    console.error("SUBTRACT FUNDS ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------
// SUPPORT-SENDING
// ---------------------------------------------------------------------
app.post("/support/send", authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { threadId, message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message required" });
    }

    // 🔍 Fetch user profile
    const profileSnap = await db.collection("users").doc(userId).get();
    const profile = profileSnap.exists ? profileSnap.data() : {};

    // ✅ GUARANTEED identity resolution (never empty)
    const resolvedEmail =
      profile?.email ||
      req.user.email ||
      "No Email";

    const resolvedUsername =
      profile?.username ||
      profile?.displayName ||
      req.user.name ||
      "Unknown User";

    let threadRef;

    // 🧵 CREATE NEW THREAD
    if (!threadId) {
      threadRef = await db.collection("supportThreads").add({
        userId,
        userEmail: resolvedEmail,
        username: resolvedUsername,

        status: "open",
createdAt: admin.firestore.FieldValue.serverTimestamp(),


        lastMessage: message,
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      threadRef = db.collection("supportThreads").doc(threadId);
    }

    // 💬 ADD MESSAGE (clean — no need to repeat email every time)
    await threadRef.collection("messages").add({
      sender: "user",
      text: message,
      read: false,
      createdAt: admin.firestore.FieldValue.server(),
    });

    // 🔄 Update thread metadata
    await threadRef.update({
      lastMessage: message,
      lastMessageAt: admin.firestore.FieldValue.server(),
      status: "open",
    });

    res.json({ success: true, threadId: threadRef.id });

  } catch (err) {
    console.error("USER SUPPORT ERROR:", err.message);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ---------------------------------------------------------------------
// ADMIN — SEND NOTIFICATION
// ---------------------------------------------------------------------
app.post("/admin/send-notification", authenticate, requireAdmin, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message required" });
    }

    const alertRef = db.collection("alerts").doc(); // explicit doc
    await alertRef.set({
      title: "📢 Admin Message",
      message,
      type: "admin",
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, alertId: alertRef.id });
  } catch (err) {
    console.error("SEND NOTIFICATION ERROR:", err);
    res.status(500).json({ error: "Failed to send notification" });
  }
});



app.post("/admin/reply-support", authenticate, requireAdmin, async (req, res) => {
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

    const threadData = threadSnap.data();

    // ✅ Add admin reply
    await threadRef.collection("messages").add({
      sender: "admin",
      text: message.trim(),
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      adminId: req.user.uid, // 🔥 track which admin replied
    });

    // ✅ Update thread metadata
    await threadRef.update({
      lastMessage: message.trim(),
      lastMessageAt:admin.firestore.FieldValue.serverTimestamp(),
      status: "answered",
      answeredBy: req.user.uid, // 🔥 track responder
    });

    res.json({
      success: true,
      repliedTo: threadData.username || "Unknown User",
    });

  } catch (err) {
    console.error("REPLY SUPPORT ERROR:", err.message);
    res.status(500).json({ error: "Failed to send reply" });
  }
});



app.post("/admin/reset-password", authenticate, requireAdmin, async (req, res) => {
  const { email } = req.body;

  await admin.auth().generatePasswordResetLink(email);
  res.json({ success: true });
});

app.post("/admin/delete-user", authenticate, requireAdmin, async (req, res) => {
  const { userId } = req.body;

  await db.collection("users").doc(userId).update({
    deleted: true,
    deletedAt: admin.firestore.FieldValue.server(),
  });

  res.json({ success: true });
});

// ---------------------------------------------------------------------
// ADMIN — SYSTEM LOGS & ACTIVITY HISTORY
// ---------------------------------------------------------------------

// Example system logs endpoint
app.get("/admin/system-logs", authenticate, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("adminLogs").orderBy("createdAt", "desc").limit(100).get();
    console.log("LOG COUNT:", snapshot.size);
    const logs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        message: `${data.adminId || "Unknown"} → ${data.action || data.reason || "Performed action"}`,
        createdAt: data.createdAt?.toDate?.().toISOString() || null,
      };
    });
    res.json(logs);
  } catch (err) {
    console.error("Fetch system logs error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Example admin activity history endpoint
app.get("/admin/activity-history", authenticate, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("adminLogs").orderBy("createdAt", "desc").limit(100).get();
    console.log("LOG COUNT:", snapshot.size);
    const activities = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        admin: data.adminId || "Unknown",
        action: data.action || data.reason || "Performed action",
          createdAt: data.createdAt?.toDate?.().toISOString() || null,
      };
    });
    res.json(activities);
  } catch (err) {
    console.error("Fetch admin activity error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
// ----------------------
// ROUTES
// ----------------------
app.use("/api/payin", payinRoutes);
app.use("/api/payout", payoutRoutes);     // withdrawals
// ---------------------------------------------------------------------
// CURRENCY CONVERTER
// ---------------------------------------------------------------------
const { rates, BASE_CURRENCY } = require("./config/currency");


app.get("/api/currency", (req, res) => {
  res.json({
    base: BASE_CURRENCY,
    rates,
  });
  });
  // ----------------------
// ROUTES USER
// ----------------------
  app.get("/user/profile", authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;

    const userSnap = await db.collection("users").doc(userId).get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      user: {
        id: userSnap.id,
        ...userSnap.data(),
      },
    });

  } catch (err) {
    console.error("PROFILE ERROR:", err.message);
    res.status(500).json({ error: "Failed to load profile" });
  }
});
// ----------------------
// TOURNAMENT LIST (FRONTEND)
// ----------------------
app.get("/tournaments", authenticate, async (req, res) => {
  try {
    const snapshot = await db
      .collection("tournaments")
      .orderBy("createdAt", "desc")
      .get();

    const tournaments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      tournaments,
    });

  } catch (err) {
    console.error("TOURNAMENT LIST ERROR:", err.message);
    res.status(500).json({ error: "Failed to fetch tournaments" });
  }
});
// ----------------------
// TOURNAMENT DETAILS
// ----------------------
app.get("/tournament/:tournamentId", authenticate, async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const snap = await db.collection("tournaments").doc(tournamentId).get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    res.json({
      success: true,
      tournament: {
        id: snap.id,
        ...snap.data(),
      },
    });

  } catch (err) {
    console.error("TOURNAMENT DETAIL ERROR:", err.message);
    res.status(500).json({ error: "Failed to fetch tournament" });
  }
});

// ----------------------
// USER TOURNAMENT STATE
// ----------------------
app.get("/tournament/:tournamentId/me", authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { tournamentId } = req.params;

    const doc = await db
      .collection("tournaments")
      .doc(tournamentId)
      .collection("participants")
      .doc(userId)
      .get();

    if (!doc.exists) {
      return res.json({
        success: true,
        joined: false,
        data: null,
      });
    }

    res.json({
      success: true,
      joined: true,
      data: doc.data(),
    });

  } catch (err) {
    console.error("USER TOURNAMENT STATE ERROR:", err.message);
    res.status(500).json({ error: "Failed to fetch user tournament state" });
  }
});

// ----------------------
// USER TRANSACTIONS
// ----------------------
app.get("/transactions", authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;

    const snapshot = await db
      .collection("transactions")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const transactions = snapshot.docs.map(doc => {
  const data = doc.data();

  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.().toISOString() || null,
  };
});

    res.json({
      success: true,
      transactions,
    });

  } catch (err) {
    console.error("TRANSACTIONS ERROR:", err.message);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});
// ----------------------
// USER ALERTS
// ----------------------
app.get("/alerts", authenticate, async (req, res) => {
  try {
    const snapshot = await db
      .collection("alerts")
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();

    const alerts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      alerts,
    });

  } catch (err) {
    console.error("ALERTS ERROR:", err.message);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});
// ----------------------
// ERROR HANDLER
// ----------------------
app.use((err, req, res, next) => {
  console.error("🔥 SERVER ERROR:", err);
  res.status(500).json({ error: "Internal server error" });
});
// ---------------------------------------------------------------------

// ----------------------
// START SERVER
// ---------------------------------------------------------------------
// ----------------------
const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
  console.log("Routes loaded: payin, payout, tournament, admin");


app.get("/admin/transactions", authenticate, requireAdmin, async (req, res) => {
  try {
    const { type } = req.query;

    let query = db.collection("transactions");

    if (type) {
      query = query.where("type", "==", type);
    }

    // ALWAYS ensure createdAt exists
    query = query.orderBy("createdAt", "desc").limit(200);

    const snap = await query.get();

   const transactions = snap.docs.map(doc => {

  const data = doc.data();

  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.().toISOString() || null,
  };
});

    res.json(transactions);
  } catch (err) {
    console.error("ADMIN TRANSACTIONS ERROR:", err.code, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/admin/toggle-freeze", authenticate, requireAdmin, async (req, res) => {
 const { freeze } = req.body;

await db.collection("system").doc("settings").set(
  {
    frozen: !!freeze,
  },
  { merge: true }
);

  res.json({ success: true });
});

app.get("/admin/pending-transactions", authenticate, requireAdmin, async (req, res) => {
  try {
    const query = db
      .collection("transactions")
      .where("status", "==", "pending")
      .orderBy("createdAt", "desc")
      .limit(100);

    const snap = await query.get();

   const transactions = snap.docs.map(doc => {
  const data = doc.data();

  return {
    id: doc.id,
    user: data.username || "Unknown",
    amount: data.amount || 0,
    status: data.status || "pending",
      createdAt: data.createdAt?.toDate?.().toISOString() || null,
  };
});

    res.json(transactions);
  } catch (err) {
   console.error("FULL ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});