console.log("🔥🔥🔥 ACTIVE SERVER.JS LOADED 🔥🔥🔥");

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { getCampayToken } = require("./campayAuth");
const admin = require("firebase-admin");
const { Buffer } = require("buffer"); 

// If your Node version < 18, uncomment next two lines
// const fetch = require("node-fetch");
// global.fetch = fetch;

const app = express();
function verifySignature(req) {
  const secret = process.env.CAMPAY_WEBHOOK_SECRET;
  if (!secret) return true; // CamPay hasn't given secret yet

  const signature =
    req.headers["x-campay-signature"] ||
    req.headers["x-signature"];

  if (!signature) return false;

  const crypto = require("crypto");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(req.rawBody) // ✅ MUST be raw body
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}


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
    next();
  } catch (err) {
    console.error("Firebase auth error:", err.message);
    return res.status(401).json({ error: "Invalid Firebase token" });
  }
};

// ---------------------------------------------------------------------
// HEALTH CHECK ROUTE (CamPay reachability depends on server being up)
// ---------------------------------------------------------------------
app.get("/health", (req, res) => {
  res.send("Backend running");
});
const { initiateCampayPayment } = require("./campay");

app.post("/api/campay/initiate", initiateCampayPayment);


// ---------------------------------------------------------------------
// INVITE ROUTE
// ---------------------------------------------------------------------
app.get("/invite", (req, res) => {
  const ref = req.query.ref;

  if (!ref) {
    return res.status(400).send("Missing referral code");
  }

  const redirectUrl = `forextournamentsarena://welcome?ref=${ref}`;
  return res.redirect(302, redirectUrl);
});

// ---------------------------------------------------------------------
// FIREBASE + TREASURY
// ---------------------------------------------------------------------
const { db } = require("./firebaseAdmin");
const treasury = require("./treasury");

// ---------------------------------------------------------------------
// TREASURY TEST ROUTE
// ---------------------------------------------------------------------
app.get("/api/treasury/balances", async (req, res) => {
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
      const tournament = tournamentSnap.data();

      const entryFee = tournament.entryFee || 0;
      const startingBalance = tournament.startingBalance || 0;
      const prizePool = tournament.prizePool || 0;

      if (entryFee > 0 && (user.walletBalance || 0) < entryFee) {
        throw new Error("Insufficient wallet balance");
      }

      // 🔻 Deduct entry fee
      if (entryFee > 0) {
        t.update(userRef, {
          walletBalance: admin.firestore.FieldValue.increment(-entryFee),
        });

        t.update(tournamentRef, {
          prizePool: prizePool + entryFee,
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

    });

    res.json({ success: true, message: "Tournament registered successfully" });
  } catch (err) {
    console.error("Tournament register error:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------
// WITHDRAWAL
// ---------------------------------------------------------------------
app.post("/withdraw", authenticate, async (req, res) => {

  try {
    const userId = req.user.uid;
const { amount } = req.body;


    if (!userId || !amount)
      return res.status(400).json({ error: "Missing fields" });

    await treasury.processWithdrawal(userId, amount);

    res.json({ success: true, message: "Withdrawal request created" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------
// TOURNAMENT REBUY
// ---------------------------------------------------------------------
app.post("/tournament-rebuy", authenticate, async (req, res) => {

  try {
    const userId = req.user.uid;
const { tournamentId, amount } = req.body;

    await treasury.processRebuy(userId, tournamentId, amount);

    res.json({ success: true, message: "Rebuy successful" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});



// ---------------------------------------------------------------------
// TOURNAMENT SETTLEMENT
// ---------------------------------------------------------------------
app.post("/campay/create-payment", authenticate, async (req, res) => {
 
  try {
    const { amount, phone, operator, method,currency } = req.body;
     // ✅ ADD THIS BLOCK
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    if (method === "mobile" && !/^2376\d{8}$/.test(phone)) {
      return res.status(400).json({ error: "Invalid phone format" });
    }
const amountNum = Number(amount);

if (!Number.isInteger(amountNum) || amountNum < 1000 || amountNum > 500000) {
  return res.status(400).json({ error: "Invalid deposit amount" });
}

    // Use the userId from verified Firebase token (safer!)
    const userId = req.user.uid;

    

    // Mobile money validation
    if (method === "mobile" && (!phone || !operator)) {
      return res.status(400).json({ error: "Phone and operator are required for mobile money" });
    }

    const token = await getCampayToken();
    const txId = `DEP_${userId}_${Date.now()}`;

    const bodyPayload = {
      amount: Number(amount),
      currency: currency || "XAF",
      description: "Forex Tournament Deposit",
      external_reference: txId,
       metadata: { userId },
    };

    if (method === "mobile") {
      bodyPayload.from = phone;
      bodyPayload.operator = operator;
    }
await db.collection("transactions").doc(txId).set({
  reference: txId,
  userId,
  amount: Number(amount),
  currency: currency || "XAF",
  status: "PENDING",
  createdAt: admin.firestore.Timestamp.now(),
});

  /* 🚫 CARD PAYMENTS DISABLED */
if (method === "card") {
  return res
    .status(400)
    .json({ error: "Card payments not enabled" });
}

/* 📞 MOBILE MONEY ONLY */
const endpoint = `${process.env.CAMPAY_BASE_URL}/collect/`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify(bodyPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("CamPay collect/card error:", data);
      return res.status(400).json(data);
    }

    res.json({
      success: true,
      message: "Payment request sent to CamPay",
      reference: data.reference || null,
      status: data.status || "PENDING",
    });

  } catch (err) {
    console.error("CamPay create-payment error:", err.message);
    res.status(500).json({ error: "CamPay payment failed" });
  }
});



// ---------------------------------------------------------------------
// CAMPAY WEBHOOK (CALLBACK URL)
// ---------------------------------------------------------------------


app.post("/webhook/campay", async (req, res) => {


if (!verifySignature(req)) {
    console.error("❌ Invalid CamPay webhook signature");
    return res.status(401).json({ error: "Invalid signature" });
  }
  try {
    console.log("📩 CamPay webhook received:", req.body);

    const {
      reference,
      status,
      amount,
      currency,
      operator,
       metadata,
    } = req.body;
    
const userId = metadata?.userId;

    if (!reference || !status || !amount || !userId) {
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    const txRef = String(reference);
    const txDoc = db.collection("transactions").doc(txRef);
    const txSnap = await txDoc.get();

if (!txSnap.exists) {
  return res.status(404).json({ error: "Unknown transaction reference" });
}


    // ⛔ Already processed
  if (txSnap.exists && txSnap.data().creditedAt) {
  console.log("⚠️ Duplicate CamPay webhook ignored:", txRef);
  return res.status(200).json({ success: true });
}
const successStates = ["SUCCESS", "SUCCESSFUL", "COMPLETED"];
const failureStates = ["FAILED", "CANCELLED", "EXPIRED"];

if (![...successStates, ...failureStates].includes(status)) {
  console.warn("⚠️ Unknown CamPay status:", status);
  return res.status(200).json({ ignored: true });
}



    // Save transaction record
    await txDoc.set(
  {
    reference: txRef,
    userId,
    amount: Number(amount),
    currency: currency || "XAF",
    operator: operator || null,
    status: successStates.includes(status) ? "COMPLETED" : status,
    rawStatus: req.body,
    updatedAt: admin.firestore.Timestamp.now(),
  },
  { merge: true }
);


    // Credit ONLY on success


if (successStates.includes(status)) {
   await treasury.processCampayDeposit(
  userId,
  Number(amount),
  txRef
);


      console.log("💰 CamPay deposit credited:", txRef);
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("CamPay webhook error:", err.message);
    res.status(500).json({ success: false });
  }
});


// ---------------------------------------------------------------------
// START SERVER
// ---------------------------------------------------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
