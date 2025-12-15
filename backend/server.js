require("dotenv").config();

const express = require("express");
const cors = require("cors");


const app = express();

// ---------------------------------------------------------------------
// CORS + JSON + RAW BODY SUPPORT FOR WEBHOOKS
// ---------------------------------------------------------------------
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf; // needed for Flutterwave Secret Hash validation
    },
  })
);
app.use(cors());

// ---------------------------------------------------------------------
// HEALTH CHECK ROUTE
// ---------------------------------------------------------------------
app.post("/health", (req, res) => {
  res.send("Backend running");
});

// Firebase
const { db } = require("./firebaseAdmin");

// Treasury logic
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
    console.error("Treasury check error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------
// BASIC DEPOSIT (NO FLUTTERWAVE)
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
// REBUY
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
// FLUTTERWAVE INITIALIZATION
// ---------------------------------------------------------------------
const Flutterwave = require("flutterwave-node-v3");
const flw = new Flutterwave(
  process.env.FLW_PUBLIC_KEY,
  process.env.FLW_SECRET_KEY
);

// ---------------------------------------------------------------------
// CREATE PAYMENT SESSION (FLUTTERWAVE)
// ---------------------------------------------------------------------
app.post("/create-payment", async (req, res) => {
  try {
    const { amount, currency, email, userId } = req.body;

    if (!amount || !currency || !email || !userId) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

    const txRef = `tx-${userId}-${Date.now()}`;

    const response = await flw.Payment.initialize({
      tx_ref: txRef,
      amount,
      currency,
      customer: { email },
      redirect_url: `${process.env.BACKEND_URL}/flutterwave-redirect`,
    });

    res.json({
      success: true,
      link: response.data.link,
      txRef,
    });
  } catch (err) {
    console.error("Payment init error:", err.message);
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
// REDIRECT HANDLER (GET) - User returns after payment
// ---------------------------------------------------------------------
app.get("/flutterwave-redirect", async (req, res) => {
  try {
    const { status, tx_ref, transaction_id } = req.query;

    if (status !== "successful") {
      return res.send("Payment not successful");
    }

    // verify transaction
    const verify = await flw.Transaction.verify({ id: transaction_id });

    if (verify.data.status === "successful") {
      const amount = verify.data.amount;
      const userId = tx_ref.split("-")[1];

      await treasury.addDepositToUser(userId, amount);
      await treasury.addDepositToTreasury(amount);

      console.log("🎉 Verified via redirect:", userId, amount);
    }

    res.send("Payment successful!");
  } catch (err) {
    console.error("Redirect verification error:", err.message);
    res.status(500).send("Verification error");
  }
});

// ---------------------------------------------------------------------
// WEBHOOK HANDLER (POST) - Server-to-server confirmation
// ---------------------------------------------------------------------
app.post("/webhook/flutterwave", async (req, res) => {
  const signature = req.headers["verif-hash"];
  const secretHash = process.env.FLW_SECRET_HASH;

  // Immediately respond 200 so Flutterwave stops retrying
  res.status(200).send("OK");

  // After sending 200, continue processing asynchronously
  if (!signature || signature !== secretHash) {
    console.log("❌ Invalid webhook hash");
    return; // stop processing
  }

  const event = req.body;

  try {
    if (event?.data?.status === "successful") {
      const { tx_ref, amount } = event.data;
      const userId = tx_ref.split("-")[1];

      await treasury.addDepositToUser(userId, amount);
      await treasury.addDepositToTreasury(amount);

      console.log("💰 Webhook confirmed:", userId, amount);
    }
  } catch (err) {
    console.error("Webhook processing error:", err.message);
  }
});

// ---------------------------------------------------------------------
// TEST WEBHOOK ENDPOINT (SAFE - DOES NOT AFFECT DATA)
// ---------------------------------------------------------------------
app.post("/test-webhook", (req, res) => {
  const fs = require("fs");
  const timestamp = new Date().toISOString();

  fs.appendFileSync("webhook-test.log", `Webhook hit at: ${timestamp}\n`);

  console.log("🔔 Test webhook hit:", timestamp);

  res.status(200).send("TEST_OK");
});

// ---------------------------------------------------------------------
// START SERVER
// ---------------------------------------------------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
