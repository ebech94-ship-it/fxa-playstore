require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { testCampay } = require("./campay");
const { getCampayToken } = require("./campayAuth");


// If your Node version < 18, uncomment next two lines
// const fetch = require("node-fetch");
// global.fetch = fetch;

const app = express();

// ---------------------------------------------------------------------
// CORS + JSON
// ---------------------------------------------------------------------
app.use(express.json());
app.use(cors());
app.get("/api/test/campay", testCampay);


// ---------------------------------------------------------------------
// HEALTH CHECK ROUTE (CamPay reachability depends on server being up)
// ---------------------------------------------------------------------
app.get("/health", (req, res) => {
  res.send("Backend running");
});
app.get("/webhook/campay", (req, res) => {
  res.status(200).send("Campay webhook endpoint is live");
});

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
// MANUAL DEPOSIT (TESTING ONLY)
// ---------------------------------------------------------------------
app.post("/deposit", async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount)
      return res.status(400).json({ error: "Missing fields" });

    await treasury.addDepositToUser(userId, amount);
    await treasury.addDepositToTreasury(amount);

    res.json({ success: true, message: "Deposit successful" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------
// WITHDRAWAL
// ---------------------------------------------------------------------
app.post("/withdraw", async (req, res) => {
  try {
    const { userId, amount } = req.body;

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
app.post("/tournament-rebuy", async (req, res) => {
  try {
    const { userId, tournamentId, amount } = req.body;

    await treasury.processRebuy(userId, tournamentId, amount);

    res.json({ success: true, message: "Rebuy successful" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------
// TOURNAMENT SETTLEMENT
// ---------------------------------------------------------------------
app.post("/tournament-settle", async (req, res) => {
  try {
    const { tournamentId } = req.body;
    await treasury.processTournamentPayout(tournamentId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------
// CAMPAY - CREATE PAYMENT
// ---------------------------------------------------------------------
app.post("/campay/create-payment", async (req, res) => {
  try {
    const { amount, phone, operator, userId } = req.body;

    if (!amount || !phone || !operator || !userId) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const token = await getCampayToken();

    const response = await fetch(
      `${process.env.CAMPAY_BASE_URL}/collect/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({
          amount: Number(amount),
          currency: "XAF",
          from: phone,
          description: "Forex Tournament Deposit",
          external_reference: userId,
          operator, // MTN or ORANGE
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("CamPay collect error:", data);
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
  try {
    console.log("📩 CamPay webhook received:", req.body);

    const {
      reference,
      status,
      amount,
      currency,
      operator,
      external_reference, // this is userId
    } = req.body;

    if (!reference || !status || !amount || !external_reference) {
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    const txRef = String(reference);
    const txDoc = db.collection("campay_transactions").doc(txRef);
    const txSnap = await txDoc.get();

    // ⛔ Already processed
    if (txSnap.exists) {
      console.log("⚠️ Duplicate CamPay webhook ignored:", txRef);
      return res.status(200).json({ success: true });
    }

    // Save transaction record
    await txDoc.set({
      reference: txRef,
      userId: external_reference,
      amount: Number(amount),
      currency: currency || "XAF",
      operator: operator || null,
      status,
      createdAt: new Date(),
    });

    // Credit ONLY on success
    if (status === "SUCCESSFUL") {
      await treasury.addDepositToUser(
        external_reference,
        Number(amount)
      );
      await treasury.addDepositToTreasury(Number(amount));

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
