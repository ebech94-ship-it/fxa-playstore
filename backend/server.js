console.log("🔥🔥🔥 ACTIVE SERVER.JS LOADED 🔥🔥🔥");

require("dotenv").config();

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

const app = express();



// ---------------------------------------------------------------------
// CORS + JSON
// ---------------------------------------------------------------------
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(cors());
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
  const fallbackUrl = `https://forex-app-p1.vercel.app/download?ref=${ref}`;

  // Serve a simple HTML page that tries deep link first
  res.send(`
    <html>
      <body>
        <script>
          // Try opening the app
          window.location = "${deepLink}";

          // If the app is not installed, redirect to Vercel after 1.5 seconds
          setTimeout(() => {
            window.location = "${fallbackUrl}";
          }, 1500);
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

// ----------------------
// TRANSACTIONS (MERGED)
// ----------------------

// USER: create deposit/withdrawal
app.post("/transactions", authenticate, async (req, res) => {
  try {
    const { type, amount, momoNumber, operator } = req.body;

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, error: "Invalid amount" });
    }

    if (type === "deposit") {

      const txRef = await db.collection("transactions").add({
        userId: req.user.uid,
        amount: parsedAmount,
        type: "deposit",
        status: "pending",
        momoNumber,
        operator,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.json({ success: true, txId: txRef.id });
    }

    if (type === "withdrawal") {

      await treasury.processWithdrawal(
        req.user.uid,
        parsedAmount,
        momoNumber
      );

      return res.json({ success: true });
    }

    return res.status(400).json({ success: false, error: "Invalid type" });

  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ADMIN: approve transaction
app.post("/transactions/approve", authenticate, requireAdmin, async (req, res) => {
  try {
    const { txId } = req.body;
    await treasury.approveTransaction(txId, req.user.uid);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ADMIN: reject transaction
app.post("/transactions/reject", authenticate, requireAdmin, async (req, res) => {
  try {
    const { txId } = req.body;
    await treasury.rejectTransaction(txId, req.user.uid);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});
// ---------------------------------------------------------------------
// TOURNAMENTS HANDLING
// ---------------------------------------------------------------------
app.post("/tournament/register", authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { tournamentId } = req.body;

    if (!tournamentId)
      return res.status(400).json({ error: "Missing tournamentId" });

    const userRef = db.collection("users").doc(userId);
    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const playerRef = tournamentRef.collection("players").doc(userId);

    await db.runTransaction(async (t) => {
      const [userSnap, tournamentSnap, playerSnap] = await Promise.all([
        t.get(userRef),
        t.get(tournamentRef),
        t.get(playerRef),
      ]);

      if (!userSnap.exists) throw new Error("User not found");
      if (!tournamentSnap.exists) throw new Error("Tournament not found");
      if (playerSnap.exists) throw new Error("Already joined");

      const user = userSnap.data();

    if (user.accounts?.activeTournamentId) {
       throw new Error("User already in a tournament");
          }

   
if (user.locks?.joiningTournament) {
  throw new Error("Tournament join in progress");
}
t.update(userRef, {
  "locks.joiningTournament": true,
});

      const tournament = tournamentSnap.data();
      // ✅ ADD THIS BLOCK TO ENSURE COFFERS EXIST
  const cofferRef = db.collection("tournamentCoffers").doc(tournamentId);
  t.set(
    cofferRef,
    {
      registration: { count: 0, totalAmount: 0 },
      rebuys: { count: 0, totalAmount: 0 },
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

      const entryFee = tournament.entryFee || 0;
      const startingBalance = tournament.startingBalance || 0;
      

      if (entryFee > 0 && (user.realBalance || 0) < entryFee) {
        throw new Error("Insufficient wallet balance");
      }

      // 🔻 Deduct entry fee
      if (entryFee > 0) {
        t.update(userRef, {
          realBalance: admin.firestore.FieldValue.increment(-entryFee),
        });

        t.update(tournamentRef, {
  prizePool: admin.firestore.FieldValue.increment(entryFee),
  collectedFunds: admin.firestore.FieldValue.increment(entryFee),
  lastUpdated: admin.firestore.Timestamp.now(),
});

      }

      // 🧩 Create tournament player
      t.set(playerRef, {
        uid: userId,
        username: user.username || "Player",
        balance: startingBalance,
        rebuys: [],
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 🧠 Create tournament account snapshot
      t.set(
  userRef,
  {
    "accounts.activeTournamentId": tournamentId,
    [`accounts.tournaments.${tournamentId}`]: {
      balance: startingBalance,
      initialBalance: startingBalance,
      status: "ongoing",
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  },
  { merge: true }
);
t.set(
  userRef,
  {
    locks: {
      joiningTournament: admin.firestore.FieldValue.delete(),
    },
  },
  { merge: true }
);

    });
    

    res.json({ success: true, message: "Tournament registered successfully" });
  } catch (err) {
    console.error("Tournament register error:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
  
});


app.get("/admin/transactions", authenticate, requireAdmin, async (req, res) => {
  const { type, status } = req.query;
  const snapshot = await db.collection("transactions")
    .where("type", "==", type)
    .where("status", "==", status)
    .get();
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.json(data);
});


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
// TOURNAMENT REBUY
// ---------------------------------------------------------------------
app.post("/tournament-rebuy", authenticate, async (req, res) => {

  try {
    const userId = req.user.uid;
const { tournamentId } = req.body;
if (!tournamentId) {
  return res.status(400).json({ error: "Missing tournamentId" });
}


    await treasury.processRebuy(userId, tournamentId );

    res.json({ success: true, message: "Rebuy successful" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
app.post("/admin/add-funds", authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;

    if (!userId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const userRef = db.collection("users").doc(userId);
    const logRef = db.collection("adminLogs").doc();

    await db.runTransaction(async (t) => {
      const userSnap = await t.get(userRef);
      if (!userSnap.exists) throw new Error("User not found");

      // 💰 Credit wallet
      t.update(userRef, {
        realBalance: admin.firestore.FieldValue.increment(Number(amount)),
        lastBalanceUpdate: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 🧾 Audit log (VERY IMPORTANT)
      t.set(logRef, {
        action: "ADD_FUNDS",
        targetUserId: userId,
        amount: Number(amount),
        reason: reason || "Admin credit",
        adminId: req.user.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
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

    const userRef = db.collection("users").doc(userId);
    const logRef = db.collection("adminLogs").doc();

    await db.runTransaction(async (t) => {
      const userSnap = await t.get(userRef);
      if (!userSnap.exists) throw new Error("User not found");

      const currentBalance = userSnap.data().realBalance || 0;

      if (currentBalance < amount) {
        throw new Error("Insufficient user balance");
      }

      // 💸 Debit wallet
      t.update(userRef, {
        realBalance: admin.firestore.FieldValue.increment(-Number(amount)),
        lastBalanceUpdate: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 🧾 Audit log
      t.set(logRef, {
        action: "SUBTRACT_FUNDS",
        targetUserId: userId,
        amount: Number(amount),
        reason: reason || "Admin debit",
        adminId: req.user.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    res.json({ success: true, message: "Funds subtracted successfully" });
  } catch (err) {
    console.error("SUBTRACT FUNDS ERROR:", err.message);
    res.status(500).json({ error: err.message });
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

app.post("/admin/approve-payout", authenticate, requireAdmin, async (req, res) => {
  const { transactionId } = req.body;
  if (!transactionId) return res.status(400).json({ error: "Missing transactionId" });

  const treasuryRef = db.collection("treasury").doc("main");

  // 🔍 Find payout by transactionId
  const payoutsQuery = await db.collection("payouts")
    .where("transactionId", "==", transactionId)
    .limit(1)
    .get();

  if (payoutsQuery.empty) return res.status(404).json({ error: "Payout not found" });

  const payoutRef = payoutsQuery.docs[0].ref;

  await db.runTransaction(async (t) => {
    const snap = await t.get(payoutRef);
    const treasurySnap = await t.get(treasuryRef);
    const balance = treasurySnap.data()?.balance || 0;

    if (balance < snap.data().amount) throw new Error("Treasury insufficient");
    if (snap.data().status !== "pending") throw new Error("Already processed");

    // ✅ Deduct treasury
    t.update(treasuryRef, {
      balance: admin.firestore.FieldValue.increment(-snap.data().amount),
    });

    // ✅ Mark payout as paid
    t.update(payoutRef, {
      status: "paid",
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ✅ Update original transaction status
    t.update(
      db.collection("transactions").doc(transactionId),
      {
        status: "PAID",
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      }
    );
  });

  res.json({ success: true });
});

app.post("/admin/reject-payout", authenticate, requireAdmin, async (req, res) => {
  const { transactionId, reason } = req.body;
  if (!transactionId) return res.status(400).json({ error: "Missing transactionId" });

  // 🔍 Find payout by transactionId
  const payoutsQuery = await db.collection("payouts")
    .where("transactionId", "==", transactionId)
    .limit(1)
    .get();

  if (payoutsQuery.empty) return res.status(404).json({ error: "Payout not found" });

  const payoutRef = payoutsQuery.docs[0].ref;

  await db.runTransaction(async (t) => {
    const snap = await t.get(payoutRef);
    const userRef = db.collection("users").doc(snap.data().userId);

    // ✅ Refund user
    t.update(userRef, {
      realBalance: admin.firestore.FieldValue.increment(snap.data().amount),
    });

    // ✅ Mark payout as rejected
    t.update(payoutRef, {
      status: "rejected",
      reason: reason || "Rejected by admin",
      rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ✅ Update original transaction
    t.update(
      db.collection("transactions").doc(transactionId),
      {
        status: "REJECTED",
        rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
      }
    );
  });

  res.json({ success: true });
});

app.post("/admin/pay-tournament-winner", authenticate, requireAdmin, async (req, res) => {
  const { tournamentId, userId, amount, rank } = req.body;

  if (!tournamentId || !userId || !amount || !rank) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const userRef = db.collection("users").doc(userId);
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const treasuryRef = db.collection("treasury").doc("main");

  const payoutRef = db
    .collection("tournaments")
    .doc(tournamentId)
    .collection("payouts")
    .doc(userId); // one payout per user per tournament

  const txRef = db.collection("transactions").doc();

  try {
    await db.runTransaction(async (t) => {
      const [userSnap, tournamentSnap, treasurySnap, payoutSnap] =
        await Promise.all([
          t.get(userRef),
          t.get(tournamentRef),
          t.get(treasuryRef),
          t.get(payoutRef),
        ]);

      if (!userSnap.exists) throw new Error("User not found");
      if (!tournamentSnap.exists) throw new Error("Tournament not found");

      const tournament = tournamentSnap.data();
      const treasuryBalance = treasurySnap.data()?.balance || 0;

      // ✅ Ensure tournament is completed
      const now = Date.now();

if (now <= tournament.endTime) {
  throw new Error("Tournament not finished yet");
}

      // ✅ Prevent double payout
      if (payoutSnap.exists) {
        throw new Error("Winner already paid");
      }

      // ✅ Treasury check
      if (treasuryBalance < amount) {
        throw new Error("Treasury insufficient");
      }

      // 💰 Credit user wallet
      t.update(userRef, {
        realBalance: admin.firestore.FieldValue.increment(amount),
        lastBalanceUpdate: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 💸 Deduct treasury
      t.update(treasuryRef, {
        balance: admin.firestore.FieldValue.increment(-amount),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 🏆 Store payout record (anti-double-pay protection)
      t.set(payoutRef, {
        userId,
        tournamentId,
        rank,
        amount,
        paidBy: req.user.uid,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 🧾 Log transaction
      t.set(txRef, {
        transactionId: txRef.id,
        userId,
        tournamentId,
        amount,
        type: "tournament_payout",
        rank,
        status: "PAID",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    res.json({ success: true, message: "Winner paid successfully" });
  } catch (err) {
    console.error("Tournament payout error:", err.message);
    res.status(400).json({ success: false, error: err.message });
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
// ADMIN — MOVE TO TREASURY
// ---------------------------------------------------------------------
app.post("/admin/moveTournamentFundsToTreasury", authenticate, requireAdmin, async (req, res) => {
  try {
    const { tournamentId, amount } = req.body;

    if (!tournamentId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: "Invalid request" });
    }

    const cofferRef = db.collection("tournamentCoffers").doc(tournamentId);
    const treasuryRef = db.collection("treasury").doc("main");

    await db.runTransaction(async (t) => {
      const cofferSnap = await t.get(cofferRef);
      const treasurySnap = await t.get(treasuryRef);

      if (!cofferSnap.exists) throw new Error("Tournament coffer not found");

      const cofferData = cofferSnap.data() || {};
      const totalFunds =
        (cofferData.registration?.totalAmount || 0) +
        (cofferData.rebuys?.totalAmount || 0);

      const transferredAlready = cofferData.transferredToTreasury || 0;
      const remaining = totalFunds - transferredAlready;

      if (Number(amount) > remaining) {
        throw new Error("Transfer amount exceeds available funds");
      }

      const currentTreasury = treasurySnap.exists ? treasurySnap.data()?.balance || 0 : 0;

      // ✅ Update treasury balance
      t.set(
        treasuryRef,
        { 
          balance: currentTreasury + Number(amount),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      // ✅ Update coffer with transferred amount
      t.update(cofferRef, {
        transferredToTreasury: admin.firestore.FieldValue.increment(Number(amount)),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    res.json({ success: true, message: `Transferred ${amount} FRS to treasury` });
  } catch (err) {
    console.error("Move to treasury error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
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

// ---------------------------------------------------------------------
// START SERVER
// ---------------------------------------------------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
