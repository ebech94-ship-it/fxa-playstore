const { admin, db } = require("./firebaseAdmin");

module.exports = {
  /* ---------------------------------------------------
     1️⃣  DEPOSITS
  --------------------------------------------------- */
 async approveTransaction(txId, adminId) {
  const txRef = db.collection("transactions").doc(txId);
  const treasuryRef = db.collection("treasury").doc("main");

  await db.runTransaction(async (t) => {

    const txSnap = await t.get(txRef);
    if (!txSnap.exists) throw new Error("Transaction not found");

    const tx = txSnap.data();
    if (tx.status !== "pending")
      throw new Error("Already processed");

    const userRef = db.collection("users").doc(tx.userId);

    if (tx.type === "deposit") {

      // 🔺 Increase user wallet
      t.update(userRef, {
        realBalance: admin.firestore.FieldValue.increment(tx.amount),
      });

      // 🔺 Increase treasury
      t.set(treasuryRef, {
        balance: admin.firestore.FieldValue.increment(tx.amount),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

    }

    if (tx.type === "withdrawal") {
  throw new Error("Use payout approval endpoint");
}

    // ✅ Mark transaction approved
    t.update(txRef, {
      status: "deposit completed",
      approvedBy: adminId,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  });

  console.log(`✅ Transaction ${txId} approved safely`);
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

      const wallet = userSnap.data().realBalance || 0;
      

      if (wallet < amount) throw new Error("Insufficient balance");

      t.update(userRef, {   realBalance: admin.firestore.FieldValue.increment(-amount),});
      const cofferRef = db.collection("tournamentCoffers").doc(tournamentId);

// registration goes to T coffer

t.set(cofferRef, {
  registration: {
    count: admin.firestore.FieldValue.increment(1),
    totalAmount: admin.firestore.FieldValue.increment(amount),
  },
  lastUpdated: admin.firestore.Timestamp.now(),
}, { merge: true });

// Optional: still update collectedFunds if you want an overall total in tournament doc
t.update(tournamentRef, {
  collectedFunds: admin.firestore.FieldValue.increment(amount),
  lastUpdated: admin.firestore.Timestamp.now(),
});

      t.set(db.collection("transactions").doc(), {
        userId,
        tournamentId,
        amount,
        type: "tournament_fee",
        status: "tournament fee deducted",
        createdAt: admin.firestore.Timestamp.now(),
      });
    });

    console.log(`🎟 Tournament fee → ${userId} paid ${amount}`);
  },

  /* ---------------------------------------------------
     3️⃣  REBUYS
  --------------------------------------------------- */
  async processRebuy(userId, tournamentId) {
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
    if (!playerSnap.exists) throw new Error("Player not in tournament");
const wallet = userSnap.data().realBalance || 0;

const tournament = tournamentSnap.data();

    // ✅ 1. Check tournament ended
    if (Date.now() > tournament.endTime) {
      throw new Error("Tournament has ended");
    }
    
const startingBalance = tournamentSnap.data().startingBalance;
const rebuyFee = tournamentSnap.data().rebuyFee;

const player = playerSnap.data();
const initialBalance =
  player.initialBalance ??
  userSnap.data()?.accounts?.tournaments?.[tournamentId]?.initialBalance ??
  startingBalance;


// ✅ 50% RULE
if (player.balance >= initialBalance * 0.5) {
  throw new Error("Rebuy allowed only when balance is below 50%");
}


    if (!rebuyFee || rebuyFee <= 0)
      throw new Error("Rebuy not allowed");

    if (wallet < rebuyFee)
      throw new Error("Insufficient balance");

    // 🔻 deduct fixed rebuy fee
    t.update(userRef, {
      realBalance: admin.firestore.FieldValue.increment(-rebuyFee),
    });

    // 🔺 top up tournament balance
    t.update(playerRef, {
      balance: admin.firestore.FieldValue.increment(startingBalance),
      rebuys: admin.firestore.FieldValue.arrayUnion({
        amount: rebuyFee,
        at: admin.firestore.Timestamp.now(),
      }),
    });
// 🔁 SYNC USER SNAPSHOT (FIX 3)
t.update(userRef, {
  [`accounts.tournaments.${tournamentId}.balance`]:
    admin.firestore.FieldValue.increment(startingBalance),
});
    // 🏆  rebuy fee goes to cofer
   const cofferRef = db.collection("tournamentCoffers").doc(tournamentId);

t.set(cofferRef, {
  rebuys: {
    count: admin.firestore.FieldValue.increment(1),
    totalAmount: admin.firestore.FieldValue.increment(rebuyFee),
  },
  lastUpdated: admin.firestore.Timestamp.now(),
}, { merge: true });

// Optional: still update collectedFunds for total tracking
t.update(tournamentRef, {
  collectedFunds: admin.firestore.FieldValue.increment(rebuyFee),
  lastUpdated: admin.firestore.Timestamp.now(),
});

    // 🧾 log transaction
    t.set(db.collection("transactions").doc(), {
      userId,
      tournamentId,
      amount: rebuyFee,
      type: "rebuy",
     status: "rebuy completed",
      createdAt: admin.firestore.Timestamp.now(),
    });
  });

  console.log(`🔄 Rebuy processed for ${userId}`);
},

/* ---------------------------------------------------
   4️⃣  WITHDRAWALS
--------------------------------------------------- */
async processWithdrawal(userId, amount, momoNumber) {

  // ✅ 1. Validate amount BEFORE touching database
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    throw new Error("Invalid withdrawal amount");
  }

  const numericAmount = Number(amount);

  // ✅ 2. Validate momo number (basic check)
  if (!momoNumber || typeof momoNumber !== "string") {
    throw new Error("Invalid MoMo number");
  }

  const userRef = db.collection("users").doc(userId);

  await db.runTransaction(async (t) => {
    const userSnap = await t.get(userRef);

    if (!userSnap.exists) {
      throw new Error("User not found");
    }

    const wallet = userSnap.data().realBalance || 0;

    // ✅ 3. Check sufficient balance
    if (wallet < numericAmount) {
      throw new Error("User does not have enough balance");
    }

    // ✅ 4. Deduct user balance immediately
    t.update(userRef, {
      realBalance: admin.firestore.FieldValue.increment(-numericAmount),
    });

    // ✅ 5. Create transaction & payout inside same transaction
    const transactionRef = db.collection("transactions").doc();
    const payoutRef = db.collection("payouts").doc();

    t.set(transactionRef, {
      userId,
      amount: numericAmount,
      type: "withdrawal",
      status: "withdrawal completed",
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

  console.log(`📤 Withdrawal request for ${userId} → ${numericAmount}`);
},

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

  console.log(`❌ Transaction ${txId} rejected`);
},
  /* ---------------------------------------------------
     ADMIN — MOVE TOURNAMENT FUNDS TO TREASURY
  --------------------------------------------------- */
  async moveTournamentFundsToTreasury(tournamentId, amount) {
    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const treasuryRef = db.collection("treasury").doc("main");
 const cofferRef = db.collection("tournamentCoffers").doc(tournamentId);

    await db.runTransaction(async (t) => {
      const tournamentSnap = await t.get(tournamentRef);
      const treasurySnap = await t.get(treasuryRef);

      if (!tournamentSnap.exists) throw new Error("Tournament not found");
      if (!treasurySnap.exists) throw new Error("Treasury not found");

      const collectedFunds = tournamentSnap.data().collectedFunds || 0;

      if (collectedFunds < amount) {
        throw new Error("Not enough collected funds");
      }

      // 🔻 remove from tournament
      t.update(tournamentRef, {
        collectedFunds: admin.firestore.FieldValue.increment(-amount),
        lastUpdated: admin.firestore.Timestamp.now(),
      });

      // 🔺 add to treasury
      t.update(treasuryRef, {
        balance: admin.firestore.FieldValue.increment(amount),
        lastUpdated: admin.firestore.Timestamp.now(),
      });

    // 🔁 update tournamentCoffers with transferred amount
    t.update(cofferRef, {
      transferredToTreasury: admin.firestore.FieldValue.increment(amount),
      lastUpdated: admin.firestore.Timestamp.now(),
    });


      // 🧾 log transaction
      t.set(db.collection("transactions").doc(), {
        tournamentId,
        amount,
        type: "tournament_funds_to_treasury",
        status: "tournament funds transfer to treasury completed",
        createdAt: admin.firestore.Timestamp.now(),
      });
    });

    console.log(
      `🏦 Moved ${amount} from tournament ${tournamentId} to treasury`
    );
  },

async adminAdjustBalance(userId, amount, mode) {
  if (!["add", "subtract"].includes(mode)) {
  throw new Error("Invalid mode");
}

  const userRef = db.collection("users").doc(userId);
  const treasuryRef = db.collection("treasury").doc("main");

  const delta = mode === "subtract" ? -amount : amount;

  await db.runTransaction(async (t) => {
    t.update(userRef, {
      realBalance: admin.firestore.FieldValue.increment(delta),
    });

    t.update(treasuryRef, {
      balance: admin.firestore.FieldValue.increment(delta),
    });

    t.set(db.collection("transactions").doc(), {
      userId,
      amount,
      mode,
      type: "admin_adjustment",
      createdAt: admin.firestore.Timestamp.now(),
    });
  });
},

  /* ---------------------------------------------------
     5️⃣  TOURNAMENT PAYOUT (FINAL SETTLEMENT)
  --------------------------------------------------- */
 async processTournamentPayout(tournamentId) {
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const treasuryRef = db.collection("treasury").doc("main");

  /* ---------------------------------
     STEP 1: READ DATA (OUTSIDE TX)
  ---------------------------------- */
  const tournamentSnap = await tournamentRef.get();
  if (!tournamentSnap.exists) {
    throw new Error("Tournament not found");
  }

  const tournament = tournamentSnap.data();

  if (tournament.paidOut === true) {
    throw new Error("Tournament already paid out");
  }

  const prizePool = tournament.prizePool || 0;
  const payoutStructure = tournament.payoutStructure || [];

  if (!payoutStructure.length) {
    throw new Error("No payout structure defined");
  }

  const totalDefined = payoutStructure.reduce(
    (sum, p) => sum + p.amount,
    0
  );

  if (totalDefined !== prizePool) {
    throw new Error("Payout structure mismatch");
  }

  // 🏆 Get top players OUTSIDE transaction
  const playersSnap = await tournamentRef
    .collection("players")
    .orderBy("balance", "desc")
    .limit(payoutStructure.length)
    .get();

  if (playersSnap.empty) {
    throw new Error("No players found");
  }

  const winners = playersSnap.docs.map((doc, index) => ({
    userId: doc.id,
    payout: payoutStructure[index],
  }));

  /* ---------------------------------
     STEP 2: PAYOUT (INSIDE TX)
  ---------------------------------- */
  const payoutLogs = [];

  await db.runTransaction(async (t) => {
    const treasurySnap = await t.get(treasuryRef);

    if (!treasurySnap.exists) {
      throw new Error("Treasury not found");
    }

    const treasuryBalance = treasurySnap.data().balance || 0;

    if (treasuryBalance < prizePool) {
      throw new Error("Treasury insufficient");
    }

    let distributed = 0;

    // 💰 Pay winners
    for (const winner of winners) {
      if (!winner.payout) continue;

      const userRef = db.collection("users").doc(winner.userId);

      t.update(userRef, {
        realBalance: admin.firestore.FieldValue.increment(
          winner.payout.amount
        ),
        lastUpdated: admin.firestore.Timestamp.now(),
      });

      payoutLogs.push({
        userId: winner.userId,
        tournamentId,
        amount: winner.payout.amount,
        type: "tournament_win",
        rank: winner.payout.rank,
        createdAt: admin.firestore.Timestamp.now(),
      });

      distributed += winner.payout.amount;
    }

    // 🔻 Deduct treasury
    t.update(treasuryRef, {
      balance: admin.firestore.FieldValue.increment(-distributed),
      lastUpdated: admin.firestore.Timestamp.now(),
    });

    // ✅ Mark tournament completed
    t.update(tournamentRef, {
        status: "tournament payout completed",
      paidOut: true,
      paidOutAt: admin.firestore.Timestamp.now(),
    });
  });

  /* ---------------------------------
     STEP 3: LOG AFTER COMMIT
  ---------------------------------- */
  for (const log of payoutLogs) {
    await db.collection("transactions").add(log);
  }

  console.log(`🏆 Tournament ${tournamentId} payout completed`);
}

};