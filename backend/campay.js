const fetch = require("node-fetch");
const admin = require("firebase-admin");
const { db } = require("./firebaseAdmin");
const { getCampayToken } = require("./campayAuth");

async function initiateCampayPayment(req, res) {
 
  try {
    const { amount, phone, userId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone required" });
    }

    if (!userId) {
      return res.status(400).json({ success: false, message: "UserId required" });
    }

    // ✅ CREATE REFERENCE FIRST
    const txRef = `fx-${Date.now()}`;

    // ✅ SAVE TRANSACTION BEFORE CAMPAY CALL
    await db.collection("transactions").doc(txRef).set({
      reference: txRef,
       userId: req.body.userId,
      amount: Number(amount),
      currency: "XAF",
      status: "PENDING",
      createdAt: admin.firestore.Timestamp.now(),
    });

    const token = await getCampayToken();

    const response = await fetch(
      `${process.env.CAMPAY_BASE_URL}/collect/`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Number(amount),
          currency: "XAF",
          from: phone,
          description: "ForexApp deposit",
          external_reference: txRef, // ✅ SAME REFERENCE
          metadata: { userId },     // ✅ IMPORTANT
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({ success: false, data });
    }

    return res.json({
      success: true,
      reference: txRef, // 👈 RETURN SAME REF
      status: data.status || "PENDING",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = { initiateCampayPayment };
