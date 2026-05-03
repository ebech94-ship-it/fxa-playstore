console.log("🔥🔥🔥 ACTIVE SERVER.JS LOADED 🔥🔥🔥");

require("dotenv").config();

// 🔒 CHECK WEBHOOK SECRET
if (!process.env.SWYCHR_WEBHOOK_SECRET) {
  console.warn("⚠️ SWYCHR_WEBHOOK_SECRET is NOT set");
} else {
  console.log("SECRET LOADED:", process.env.SWYCHR_WEBHOOK_SECRET);
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


app.options("*", cors());
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

    res.json({
      success: true,
      balance: doc.data()?.balance || 0,
      lastUpdated: doc.data()?.lastUpdated || null,
    });
  } catch (err) {
    console.error("Treasury check error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
// ---------------------------------------------------------------------
// TOURNAMENT REGISTER (CLEAN - SINGLE SOURCE OF TRUTH)
// ---------------------------------------------------------------------
app.post("/tournament/register", authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { tournamentId } = req.body;

    if (!tournamentId) {
      return res.status(400).json({ error: "Missing tournamentId" });
    }

    await db.runTransaction(async (t) => {
      // 💰 ALL REGISTRATION LOGIC HANDLED IN TREASURY
      await treasury.registerTournament(t, userId, tournamentId);
    });

    res.json({
      success: true,
      message: "Tournament registered successfully",
    });

  } catch (err) {
    console.error("Tournament register error:", err.message);
    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});
// ---------------------------------------------------------------------
// TOURNAMENT REBUY (CLEAN - SINGLE SOURCE OF TRUTH)
// ---------------------------------------------------------------------
app.post("/tournament/rebuy", authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { tournamentId } = req.body;

    if (!tournamentId) {
      return res.status(400).json({ error: "Missing tournamentId" });
    }

    await db.runTransaction(async (t) => {
      // ✅ ALL logic handled inside treasury
      await treasury.processRebuy(t, userId, tournamentId);
    });

    res.json({ success: true, message: "Rebuy successful" });

  } catch (err) {
    console.error("Rebuy error:", err.message);
    res.status(400).json({ success: false, error: err.message });
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
// ADMIN — MOVE TO TREASURY (CLEAN)
// ---------------------------------------------------------------------
app.post(  "/admin/moveTournamentFundsToTreasury",  authenticate,
  requireAdmin,  async (req, res) => {
    try {
      const { tournamentId, amount } = req.body;

      if (!tournamentId || !amount || Number(amount) <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid tournamentId or amount",
        });
      }

      await treasury.moveTournamentFundsToTreasury(
        tournamentId,
        Number(amount)
      );

      return res.json({
        success: true,
        message: `Transferred ${amount} FRS to treasury`,
      });
    } catch (err) {
      console.error("❌ Move to treasury error:", err.message);

      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 🔄 Update thread metadata
    await threadRef.update({
      lastMessage: message,
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
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
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
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

app.post("/admin/toggle-freeze", authenticate, requireAdmin, async (req, res) => {
  const { userId, freeze } = req.body;

  await db.collection("users").doc(userId).update({
    frozen: !!freeze,
  });

  res.json({ success: true });
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
    deletedAt: admin.firestore.FieldValue.serverTimestamp(),
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
    const logs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        message: `${data.adminId || "Unknown"} → ${data.action || data.reason || "Performed action"}`,
        timestamp: data.createdAt?.toMillis() || Date.now(),
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
    const activities = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        admin: data.adminId || "Unknown",
        action: data.action || data.reason || "Performed action",
        timestamp: data.createdAt?.toMillis() || Date.now(),
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
app.use("/api/payout", payoutRouter);     // withdrawals
// ---------------------------------------------------------------------
// CURRENCY CONVERTER
// ---------------------------------------------------------------------
const { rates, BASE_CURRENCY } = require("./config/currency");


app.get("/api/currency", (req, res) => {
  res.json({
    base: BASE_CURRENCY,
    rates,
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
});