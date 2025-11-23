const admin = require("firebase-admin");
const db = admin.firestore();

module.exports = {
  /* ---------------------------------------------------
     1️⃣  DEPOSITS
  --------------------------------------------------- */
  async addDepositToUser(userId, amount) {
    const userRef = db.collection("users").doc(userId);

    await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      const wallet = snap.data().walletBalance || 0;

      t.update(userRef, {
        walletBalance: wallet + amount,
        lastUpdated: new Date(),
      });
    });

    // Record deposit transaction
    await db.collection("transactions").add({
      userId,
      amount,
      type: "deposit",
      status: "success",
      timestamp: new Date(),
    });

    console.log("Deposit added → user:", userId, "amount:", amount);
  },

  async addDepositToTreasury(amount) {
    const treasuryRef = db.collection("treasury").doc("main");

    await db.runTransaction(async (t) => {
      const snap = await t.get(treasuryRef);
      const balance = snap.data()?.balance || 0;

      t.set(
        treasuryRef,
        { balance: balance + amount, lastUpdated: new Date() },
        { merge: true }
      );
    });

    console.log("Treasury updated +", amount);
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

      const wallet = userSnap.data().walletBalance || 0;
      const pool = tournamentSnap.data().prizePool || 0;

      if (wallet < amount) throw new Error("Insufficient balance");

      // Deduct from wallet
      t.update(userRef, {
        walletBalance: wallet - amount,
        lastUpdated: new Date(),
      });

      // Add to tournament pool
      t.update(tournamentRef, {
        prizePool: pool + amount,
      });
    });

    // Log transaction
    await db.collection("transactions").add({
      userId,
      amount,
      tournamentId,
      type: "tournament_fee",
      timestamp: new Date(),
    });

    console.log(`Tournament fee paid by ${userId} → ${amount}`);
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

      const wallet = userSnap.data().walletBalance || 0;
      const pool = tournamentSnap.data().prizePool || 0;

      if (wallet < amount) throw new Error("Insufficient balance for rebuy");

      // Deduct from wallet
      t.update(userRef, {
        walletBalance: wallet - amount,
      });

      // Add to prize pool
      t.update(tournamentRef, {
        prizePool: pool + amount,
      });
    });

    // Log rebuy
    await db.collection("transactions").add({
      userId,
      tournamentId,
      amount,
      type: "rebuy",
      timestamp: new Date(),
    });

    console.log(`Rebuy processed for ${userId} → ${amount}`);
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

      const wallet = userSnap.data().walletBalance || 0;
      const treasuryBalance = treasurySnap.data()?.balance || 0;

      if (wallet < amount) throw new Error("User does not have enough balance");
      if (treasuryBalance < amount) throw new Error("Treasury insufficient");

      // Deduct from user
      t.update(userRef, {
        walletBalance: wallet - amount,
        lastUpdated: new Date(),
      });

      // Deduct from treasury
      t.update(treasuryRef, {
        balance: treasuryBalance - amount,
        lastUpdated: new Date(),
      });
    });

    // Log withdrawal
    await db.collection("transactions").add({
      userId,
      amount,
      type: "withdrawal",
      status: "pending_admin_approval",
      timestamp: new Date(),
    });

    console.log(`Withdrawal request: user ${userId} → ${amount}`);
  },
};
