const { admin, db } = require("./firebaseAdmin");

module.exports = {
  /* ---------------------------------------------------
     1️⃣  DEPOSITS
  --------------------------------------------------- */
  async addDepositToUser(userId, amount) {
    const userRef = db.collection("users").doc(userId);

    await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new Error("User not found");

      const wallet = snap.data().walletBalance || 0;

      t.update(userRef, {
        walletBalance: wallet + amount,
        lastUpdated: admin.firestore.Timestamp.now(),
      });
    });

    await db.collection("transactions").add({
      userId,
      amount,
      type: "deposit",
      status: "success",
      createdAt: admin.firestore.Timestamp.now(),
    });

    console.log(`💰 Deposit added → ${userId} +${amount}`);
  },

  async addDepositToTreasury(amount) {
    const treasuryRef = db.collection("treasury").doc("main");

    await db.runTransaction(async (t) => {
      const snap = await t.get(treasuryRef);
      const balance = snap.data()?.balance || 0;

      t.set(
        treasuryRef,
        {
          balance: balance + amount,
          lastUpdated: admin.firestore.Timestamp.now(),
        },
        { merge: true }
      );
    });

    console.log(`🏦 Treasury updated +${amount}`);
  },

  /* ---------------------------------------------------
     2️⃣  TOURNAMENT FEES
  --------------------------------------------------- */
  async payTournamentFee(userId, amount, tournamentId) {
    const userRef = db.collection("users").doc(userId);
    const tournamentRef = db.collection("tournaments").doc(tournamentId);

    await db.runTransaction(async (t) => {
      const userSnap = await t.get(userRef);
      const tournamentSnap = await t.get(tournamentRef);

      if (!userSnap.exists) throw new Error("User not found");
      if (!tournamentSnap.exists) throw new Error("Tournament not found");

      const wallet = userSnap.data().walletBalance || 0;
      const pool = tournamentSnap.data().prizePool || 0;

      if (wallet < amount) throw new Error("Insufficient balance");

      t.update(userRef, { walletBalance: wallet - amount });
      t.update(tournamentRef, {
        prizePool: pool + amount,
        lastUpdated: admin.firestore.Timestamp.now(),
      });
    });

    await db.collection("transactions").add({
      userId,
      tournamentId,
      amount,
      type: "tournament_fee",
      status: "success",
      createdAt: admin.firestore.Timestamp.now(),
    });

    console.log(`🎟 Tournament fee → ${userId} paid ${amount}`);
  },

  /* ---------------------------------------------------
     3️⃣  REBUYS
  --------------------------------------------------- */
  async processRebuy(userId, tournamentId, amount) {
    const userRef = db.collection("users").doc(userId);
    const tournamentRef = db.collection("tournaments").doc(tournamentId);

    await db.runTransaction(async (t) => {
      const userSnap = await t.get(userRef);
      const tournamentSnap = await t.get(tournamentRef);

      if (!userSnap.exists) throw new Error("User not found");
      if (!tournamentSnap.exists) throw new Error("Tournament not found");

      const wallet = userSnap.data().walletBalance || 0;
      const pool = tournamentSnap.data().prizePool || 0;

      if (wallet < amount) throw new Error("Insufficient balance");

      t.update(userRef, { walletBalance: wallet - amount });
      t.update(tournamentRef, {
        prizePool: pool + amount,
        lastUpdated: admin.firestore.Timestamp.now(),
      });
    });

    await db.collection("transactions").add({
      userId,
      tournamentId,
      amount,
      type: "rebuy",
      status: "success",
      createdAt: admin.firestore.Timestamp.now(),
    });

    console.log(`🔄 Rebuy processed for ${userId} → ${amount}`);
  },

  /* ---------------------------------------------------
     4️⃣  WITHDRAWALS
  --------------------------------------------------- */
  async processWithdrawal(userId, amount) {
    const userRef = db.collection("users").doc(userId);
    const treasuryRef = db.collection("treasury").doc("main");

    await db.runTransaction(async (t) => {
      const userSnap = await t.get(userRef);
      const treasurySnap = await t.get(treasuryRef);

      if (!userSnap.exists) throw new Error("User not found");

      const wallet = userSnap.data().walletBalance || 0;
      const treasuryBalance = treasurySnap.data()?.balance || 0;

      if (wallet < amount)
        throw new Error("User does not have enough balance");

      if (treasuryBalance < amount)
        throw new Error("Treasury does not have enough funds");

      t.update(userRef, { walletBalance: wallet - amount });
      t.update(treasuryRef, { balance: treasuryBalance - amount });
    });

    await db.collection("transactions").add({
      userId,
      amount,
      type: "withdrawal",
      status: "pending_admin_approval",
      createdAt: admin.firestore.Timestamp.now(),
    });

    console.log(`📤 Withdrawal request for ${userId} → ${amount}`);
  },

  /* ---------------------------------------------------
     5️⃣  TOURNAMENT PAYOUT (FINAL SETTLEMENT)
  --------------------------------------------------- */
  async processTournamentPayout(tournamentId) {
    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const treasuryRef = db.collection("treasury").doc("main");

    const payoutLogs = [];

    await db.runTransaction(async (t) => {
      const tournamentSnap = await t.get(tournamentRef);
      if (!tournamentSnap.exists) throw new Error("Tournament not found");

      const tournament = tournamentSnap.data();
      if (tournament.paidOut) throw new Error("Tournament already paid");

      const prizePool = tournament.prizePool || 0;
      const payoutStructure = tournament.payoutStructure || [];

      if (!payoutStructure.length)
        throw new Error("No payout structure defined");

      const totalDefined = payoutStructure.reduce(
        (sum, p) => sum + p.amount,
        0
      );

      if (totalDefined !== prizePool)
        throw new Error("Payout structure mismatch");

      const treasurySnap = await t.get(treasuryRef);
      const treasuryBalance = treasurySnap.data()?.balance || 0;

      if (treasuryBalance < prizePool)
        throw new Error("Treasury insufficient");

      const playersSnap = await db
        .collection("tournamentParticipants")
        .doc(tournamentId)
        .collection("players")
        .orderBy("balance", "desc")
        .limit(payoutStructure.length)
        .get();

      let distributed = 0;

      playersSnap.docs.forEach((playerDoc, i) => {
        const payout = payoutStructure[i];
        if (!payout) return;

        const userRef = db.collection("users").doc(playerDoc.id);

        t.update(userRef, {
          walletBalance: admin.firestore.FieldValue.increment(payout.amount),
          lastUpdated: admin.firestore.Timestamp.now(),
        });

        payoutLogs.push({
          userId: playerDoc.id,
          tournamentId,
          amount: payout.amount,
          type: "tournament_win",
          rank: payout.rank,
          createdAt: admin.firestore.Timestamp.now(),
        });

        distributed += payout.amount;
      });

      t.update(treasuryRef, {
        balance: treasuryBalance - distributed,
      });

      t.update(tournamentRef, {
        status: "completed",
        paidOut: true,
        paidOutAt: admin.firestore.Timestamp.now(),
      });
    });

    // 🔹 Log payouts AFTER transaction
    for (const log of payoutLogs) {
      await db.collection("transactions").add(log);
    }

    console.log(`🏆 Tournament ${tournamentId} payout completed`);
  },
};
