require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const treasury = require("./treasury");
const { admin, db, FieldValue } = require("./firebaseAdmin");

const app = express();
app.use(express.json());
app.use(cors());

/* ---------------------------------------------------
   REGISTER FOR TOURNAMENT
--------------------------------------------------- */
app.post("/tournament-register", async (req, res) => {
  try {
    const { userId, tournamentId, feeAmount } = req.body;

    if (!userId || !tournamentId || !feeAmount) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // Process server-side
    await treasury.payTournamentFee(userId, feeAmount, tournamentId);

    return res.json({ success: true, message: "Registration successful" });
  } catch (err) {
    console.error("Registration error:", err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});
/* ---------------------------------------------------
   REBUY
--------------------------------------------------- */
app.post("/tournament-rebuy", async (req, res) => {
  try {
    const { userId, tournamentId, amount } = req.body;

    if (!userId || !tournamentId || !amount) {
      return res.status(400).json({ error: "Missing fields" });
    }

    await treasury.processRebuy(userId, tournamentId, amount);

    return res.json({
      success: true,
      message: "Rebuy successful",
    });
  } catch (err) {
    console.error("Rebuy error:", err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// ========================================
// CREATE PAYMENT
// ========================================
app.post("/create-payment", async (req, res) => {
  try {
    const { amount, currency, email, userId } = req.body;

    const tx_ref = "tx-" + Date.now() + "-" + userId;
   
    const payload = {
      tx_ref,
      amount,
      currency,
      redirect_url: "http://10.217.176.22:4000/payment-callback",
      customer: { email },

      customizations: {
        title: "Deposit Wallet",
        description: "Forex Tournaments Deposit",
      },

      meta: {
        userId,
        type: "deposit",
        amount,
      },
    };

    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      payload,
      {
        headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
      }
    );

    res.json({ link: response.data.data.link });

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Payment creation failed" });
  }
});


// ========================================
// PAYMENT CALLBACK (Flutterwave returns here)
// ========================================
app.get("/payment-callback", async (req, res) => {
  const { transaction_id } = req.query;
  if (!transaction_id) return res.send("Missing transaction ID");

  try {
    const verify = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      {
        headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
      }
    );

    const data = verify.data.data;

    if (data.status !== "successful") {
      return res.send("PAYMENT FAILED");
    }

    const userId = data.meta.userId;
    const amount = Number(data.meta.amount);
    const type = data.meta.type;

// NEW CALLS HERE // UPDATE WALLET
    await treasury.addDepositToUser(userId, amount);
    await treasury.addDepositToTreasury(amount);

    
   

    // SAVE TRANSACTION HISTORY
    await db.collection("transactions").add({
      userId,
      amount,
      type,
      status: "successful",
      createdAt: admin.firestore.Timestamp.now(),
    });

    res.send("PAYMENT SUCCESS — WALLET UPDATED");

  } catch (err) {
    console.error(err);
    res.send("ERROR VERIFYING PAYMENT");
  }
});


// ========================================
// MANUAL PAYMENT ACTION (Admin Utility)
// ========================================
app.post("/payment-action", async (req, res) => {
  try {
    const { userId, amount, type } = req.body;

    const userRef = db.collection("users").doc(userId);

    if (type === "deposit") {
      await userRef.update({
        walletBalance: FieldValue.increment(amount),
      });
      return res.json({ message: `Deposit successful: +${amount}` });
    }

    if (type === "withdrawal") {
      await userRef.update({
        walletBalance: FieldValue.increment(-amount),
      });
      return res.json({ message: `Withdrawal processed: -${amount}` });
    }

    res.status(400).json({ message: "Invalid payment type" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


// ========================================
app.listen(4000, () => console.log("Backend running on port 4000"));
