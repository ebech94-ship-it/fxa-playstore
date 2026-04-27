const { admin, db } = require("../firebaseAdmin");

module.exports = {

  // ===================================================
  // 1. APPROVE TRANSACTIONS (DEPOSIT / WITHDRAW LOGIC)
  // ===================================================
  async approveTransaction(txId, adminId) {
    const txRef = db.collection("transactions").doc(txId);
    const treasuryRef = db.collection("treasury").doc("main");

    await db.runTransaction(async (t) => {

      const txSnap = await t.get(txRef);
      if (!txSnap.exists) throw new Error("Transaction not found");

      const tx = txSnap.data();
      if (tx.status !== "pending") throw new Error("Already processed");

      const userRef = db.collection("users").doc(tx.userId);

      // -------------------------
      // DEPOSIT
      // -------------------------
      if (tx.type === "deposit") {

        t.update(userRef, {
          realBalance: admin.firestore.FieldValue.increment(tx.amount),
        });

        t.set(treasuryRef, {
          balance: admin.firestore.FieldValue.increment(tx.amount),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      // -------------------------
      // WITHDRAWAL BLOCK (handled elsewhere)
      // -------------------------
      if (tx.type === "withdrawal") {
        throw new Error("Use payout approval endpoint");
      }

      t.update(txRef, {
        status: "approved",
        approvedBy: adminId,
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  },

  // ===================================================
  // 2. TOURNAMENT ENTRY FEE
  // ===================================================
  async payTournamentFee(userId, amount, tournamentId) {

    const userRef = db.collection("users").doc(userId);
    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const cofferRef = db.collection("tournamentCoffers").doc(tournamentId);

    await db.runTransaction(async (t) => {

      const userSnap = await t.get(userRef);
      const tournamentSnap = await t.get(tournamentRef);

      if (!userSnap.exists) throw new Error("User not found");
      if (!tournamentSnap.exists) throw new Error("Tournament not found");

      const wallet = userSnap.data().realBalance || 0;
      if (wallet < amount) throw new Error("Insufficient balance");

      // debit user
      t.update(userRef, {
        realBalance: admin.firestore.FieldValue.increment(-amount),
      });

      // update tournament coffer
      t.set(cofferRef, {
        registration: {
          count: admin.firestore.FieldValue.increment(1),
          totalAmount: admin.firestore.FieldValue.increment(amount),
        },
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      t.update(tournamentRef, {
        collectedFunds: admin.firestore.FieldValue.increment(amount),
      });

      // log
      t.set(db.collection("transactions").doc(), {
        userId,
        tournamentId,
        amount,
        type: "tournament_fee",
        status: "completed",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  },

  // ===================================================
  // 3. REBUY (UNIFIED + SAFE)
  // ===================================================
  async processRebuy(userId, tournamentId) {

    const userRef = db.collection("users").doc(userId);
    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const participantRef = db.collection("tournaments")
      .doc(tournamentId)
      .collection("participants")
      .doc(userId);

    const cofferRef = db.collection("tournamentCoffers").doc(tournamentId);

    await db.runTransaction(async (t) => {

      const [userSnap, tournamentSnap, participantSnap] = await Promise.all([
        t.get(userRef),
        t.get(tournamentRef),
        t.get(participantRef),
      ]);

      if (!userSnap.exists) throw new Error("User not found");
      if (!tournamentSnap.exists) throw new Error("Tournament not found");
      if (!participantSnap.exists) throw new Error("Not registered");

      const user = userSnap.data();
      const tournament = tournamentSnap.data();
      const participant = participantSnap.data();

      const rebuyFee = Number(tournament.rebuyFee || 0);
      const startingBalance = Number(tournament.startingBalance || 0);

      if (user.realBalance < rebuyFee) {
        throw new Error("Insufficient balance");
      }

      if (participant.balance >= startingBalance / 2) {
        throw new Error("REBUY_NOT_ALLOWED");
      }

      // cooldown (anti spam)
      const lastRebuy = participant.lastRebuyAt || 0;
      if (Date.now() - lastRebuy < 5000) {
        throw new Error("Too many requests");
      }

      // debit wallet
      t.update(userRef, {
        realBalance: admin.firestore.FieldValue.increment(-rebuyFee),
      });

      // refill balance
      t.update(participantRef, {
        balance: admin.firestore.FieldValue.increment(startingBalance),
        lastRebuyAt: Date.now(),
        rebuyCount: admin.firestore.FieldValue.increment(1),
      });

      // update coffers
      t.set(cofferRef, {
        rebuys: {
          count: admin.firestore.FieldValue.increment(1),
          totalAmount: admin.firestore.FieldValue.increment(rebuyFee),
        },
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      // log
      t.set(db.collection("transactions").doc(), {
        userId,
        tournamentId,
        amount: rebuyFee,
        type: "rebuy",
        status: "completed",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  },

  // ===================================================
  // 4. WITHDRAWAL REQUEST
  // ===================================================
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

      // deduct wallet
      t.update(userRef, {
        realBalance: admin.firestore.FieldValue.increment(-numericAmount),
      });

      const txRef = db.collection("transactions").doc();
      const payoutRef = db.collection("payouts").doc();

      t.set(txRef, {
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
        transactionId: txRef.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  },

  // ===================================================
  // 5. REJECT TRANSACTION
  // ===================================================
  async rejectTransaction(txId, adminId) {
    const txRef = db.collection("transactions").doc(txId);

    await db.runTransaction(async (t) => {

      const txSnap = await t.get(txRef);
      if (!txSnap.exists) throw new Error("Transaction not found");

      const tx = txSnap.data();
      if (tx.status !== "pending") throw new Error("Already processed");

      t.update(txRef, {
        status: "rejected",
        rejectedBy: adminId,
        rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  }
};