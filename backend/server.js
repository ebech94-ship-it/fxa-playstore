require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Buffer } = require("buffer");
const { testCampay } = require("./campay");

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

    const response = await fetch(
      `${process.env.CAMPAY_BASE_URL}/collect`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.CAMPAY_USERNAME}:${process.env.CAMPAY_PASSWORD}`
            ).toString("base64"),
        },
        body: JSON.stringify({
          amount,
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
      console.error("CamPay error:", data);
      return res.status(400).json(data);
    }

    res.json({
      success: true,
      message: "Payment request sent",
      data,
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

    const { status, amount, reference } = req.body;

    if (status === "SUCCESSFUL") {
      await treasury.addDepositToUser(reference, Number(amount));
      await treasury.addDepositToTreasury(Number(amount));

      console.log("💰 CamPay deposit confirmed:", reference, amount);
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
