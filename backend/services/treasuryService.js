const { admin, db } = require("../firebaseAdmin");

module.exports = {

  // ---------------------------------------------------
  // APPROVE DEPOSIT
  // ---------------------------------------------------
  async approveTransaction(txId, adminId) {
    const txRef = db.collection("transactions").doc(txId);
    const treasuryRef = db.collection("treasury").doc("main");

    await db.runTransaction(async (t) => {

      const txSnap = await t.get(txRef);
      if (!txSnap.exists) throw new Error("Transaction not found");

      const tx = txSnap.data();
      if (tx.status !== "pending") throw new Error("Already processed");

      const userRef = db.collection("users").doc(tx.userId);

      if (tx.type === "deposit") {

        t.update(userRef, {
          realBalance: admin.firestore.FieldValue.increment(tx.amount),
        });

        t.update(treasuryRef, {
          balance: admin.firestore.FieldValue.increment(tx.amount),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });

      } else if (tx.type === "withdrawal") {
        throw new Error("Use payout approval endpoint");
      }

      t.update(txRef, {
        status: "approved",
        approvedBy: adminId,
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    });
  },

  // ---------------------------------------------------
  // REBUY (SINGLE SOURCE OF TRUTH)
  // ---------------------------------------------------
  async processRebuyTransaction(t, userId, tournamentId, participant) {

    const userRef = db.collection("users").doc(userId);
    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const participantRef = db.collection("tournaments")
      .doc(tournamentId)
      .collection("participants")
      .doc(userId);

    const [userSnap, tournamentSnap] = await Promise.all([
      t.get(userRef),
      t.get(tournamentRef),
    ]);

    if (!userSnap.exists) throw new Error("User not found");
    if (!tournamentSnap.exists) throw new Error("Tournament not found");

    const user = userSnap.data();
    const tournament = tournamentSnap.data();

    const rebuyFee = Number(tournament.rebuyFee || 0);
    const startingBalance = Number(tournament.startingBalance || 0);

    if ((user.realBalance || 0) < rebuyFee) {
      throw new Error("Insufficient balance");
    }

    const currentBalance = participant.balance || 0;

    if (currentBalance >= startingBalance / 2) {
      throw new Error("REBUY_NOT_ALLOWED");
    }

    // deduct from user wallet
    t.update(userRef, {
      realBalance: admin.firestore.FieldValue.increment(-rebuyFee),
    });

    // add to tournament participant balance
    t.update(participantRef, {
      balance: admin.firestore.FieldValue.increment(rebuyFee),
      rebuyCount: admin.firestore.FieldValue.increment(1),
      lastRebuyAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  },

  // ---------------------------------------------------
  // WITHDRAWAL REQUEST
  // ---------------------------------------------------
  async processWithdrawal(userId, amount, momoNumber) {

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      throw new Error("Invalid withdrawal amount");
    }

    const userRef = db.collection("users").doc(userId);

    await db.runTransaction(async (t) => {

      const userSnap = await t.get(userRef);
      if (!userSnap.exists) throw new Error("User not found");

      const wallet = userSnap.data().realBalance || 0;

      if (wallet < numericAmount) {
        throw new Error("Insufficient balance");
      }

      t.update(userRef, {
        realBalance: admin.firestore.FieldValue.increment(-numericAmount),
      });

      const transactionRef = db.collection("transactions").doc();
      const payoutRef = db.collection("payouts").doc();

      t.set(transactionRef, {
        userId,
        amount: numericAmount,
        type: "withdrawal",
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      t.set(payoutRef, {
        userId,
        amount: numericAmount,
        momoNumber,
        status: "pending",
        transactionId: transactionRef.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    });
  }

};