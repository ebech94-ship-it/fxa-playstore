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
    2️⃣ WITHDRAWALS
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
  3️⃣  TOURNAMENT REGISTRATION (SINGLE SOURCE OF TRUTH)
--------------------------------------------------- */
async registerTournament(t, userId, tournamentId) {

  const userRef = db.collection("users").doc(userId);
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const participantRef = tournamentRef.collection("participants").doc(userId);
  const cofferRef = db.collection("tournamentCoffers").doc(tournamentId);

  const [userSnap, tournamentSnap, participantSnap] = await Promise.all([
    t.get(userRef),
    t.get(tournamentRef),
    t.get(participantRef),
  ]);

  if (!userSnap.exists) throw new Error("User not found");
  if (!tournamentSnap.exists) throw new Error("Tournament not found");
  if (participantSnap.exists) throw new Error("Already joined");

  const user = userSnap.data();
  const tournament = tournamentSnap.data();

  // 🔒 safety checks
  if (user.locks?.joiningTournament) {
    throw new Error("Tournament join in progress");
  }

  if (user.accounts?.activeTournamentId) {
    throw new Error("User already in a tournament");
  }

  const entryFee = tournament.entryFee || 0;
  const startingBalance = tournament.startingBalance || 0;

  if (entryFee > 0 && (user.realBalance || 0) < entryFee) {
    throw new Error("Insufficient wallet balance");
  }

  // 🔒 lock user
  t.update(userRef, {
    "locks.joiningTournament": true,
  });

  // 💸 deduct entry fee
  if (entryFee > 0) {
    t.update(userRef, {
      realBalance: admin.firestore.FieldValue.increment(-entryFee),
    });
  }

  // 💰 update tournament coffer
  t.set(
    cofferRef,
    {
      registration: {
        count: admin.firestore.FieldValue.increment(1),
        totalAmount: admin.firestore.FieldValue.increment(entryFee),
      },
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // 📊 update tournament stats (optional tracking)
  t.update(tournamentRef, {
    collectedFunds: admin.firestore.FieldValue.increment(entryFee),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 🧩 create participant
  t.set(participantRef, {
    uid: userId,
    username: user.username || "Participant",
    balance: startingBalance,
    initialBalance: startingBalance,
    performance: 0,
    rebuys: [],
    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 🧠 user snapshot
  const tRef = db
    .collection("users")
    .doc(userId)
    .collection("tournaments")
    .doc(tournamentId);

  await tRef.set({
    balance: startingBalance,
    initialBalance: startingBalance,
    performance: 0,
    name: tournament.name || "Tournament",
    symbol: tournament.symbol || "$",
    startTime: tournament.startTime || null,
    endTime: tournament.endTime || null,
    status: "ongoing",
    tournamentId,
    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // 🔓 unlock user
  t.update(userRef, {
    "locks.joiningTournament": admin.firestore.FieldValue.delete(),
  });

  // 🧾 transaction log
  t.set(db.collection("transactions").doc(), {
    userId,
    tournamentId,
    amount: entryFee,
    type: "tournament_registration",
    status: "completed",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`🎟 Tournament registered for ${userId}`);
},

 /* ---------------------------------------------------
   4️⃣   REBUYS (FINAL FIXED VERSION)
--------------------------------------------------- */
async processRebuy(t, userId, tournamentId) {

  const userRef = db.collection("users").doc(userId);
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const participantRef = tournamentRef.collection("participants").doc(userId);
  const treasuryRef = db.collection("treasury").doc("main");
  const cofferRef = db.collection("tournamentCoffers").doc(tournamentId);

  const [userSnap, tournamentSnap, participantSnap] = await Promise.all([
    t.get(userRef),
    t.get(tournamentRef),
    t.get(participantRef),
  ]);

  if (!userSnap.exists) throw new Error("User not found");
  if (!tournamentSnap.exists) throw new Error("Tournament not found");
  if (!participantSnap.exists) throw new Error("Participant not in tournament");

  const wallet = userSnap.data().realBalance || 0;
  const tournament = tournamentSnap.data();

  const rebuyFee = tournament.rebuyFee;
  const startingBalance = tournament.startingBalance;

  const participant = participantSnap.data();
  const currentBalance = participant.balance || 0;

  // 🚫 Rebuy rule
  if (currentBalance >= startingBalance / 2) {
    throw new Error("REBUY_NOT_ALLOWED");
  }

  // 💰 Wallet check
  if (wallet < rebuyFee) {
    throw new Error("Insufficient balance");
  }

  const now = Date.now();

  // 🚫 Spam protection
  if (participant.lastRebuyAt && now - participant.lastRebuyAt < 3000) {
    throw new Error("Too many requests");
  }

  // 💸 Deduct user wallet
  t.update(userRef, {
    realBalance: admin.firestore.FieldValue.increment(-rebuyFee),
  });

  // 🏦 ✅ Track in TOURNAMENT COFFER
  t.set(
    cofferRef,
    {
      rebuys: {
        count: admin.firestore.FieldValue.increment(1),
        totalAmount: admin.firestore.FieldValue.increment(rebuyFee),
      },
      lastUpdated: admin.firestore.Timestamp.now(),
    },
    { merge: true }
  );

  // 🏦 ✅ Track in MAIN TREASURY (GLOBAL ACCOUNTING)
  t.set(
    treasuryRef,
    {
      totalRebuyFees: admin.firestore.FieldValue.increment(rebuyFee),
      lastUpdated: admin.firestore.Timestamp.now(),
    },
    { merge: true }
  );

  // 🎯 Restore participant balance
  t.update(participantRef, {
    balance: admin.firestore.FieldValue.increment(startingBalance),
    lastRebuyAt: now,
    rebuys: admin.firestore.FieldValue.arrayUnion({
      amount: rebuyFee,
      at: admin.firestore.Timestamp.now(),
    }),
  });

  // 🔁 Sync user tournament snapshot
  const tRef = db
    .collection("users")
    .doc(userId)
    .collection("tournaments")
    .doc(tournamentId);

  t.update(tRef, {
    balance: admin.firestore.FieldValue.increment(startingBalance),
  });

  // 🧾 Transaction log
  t.set(db.collection("transactions").doc(), {
    userId,
    tournamentId,
    amount: rebuyFee,
    type: "rebuy",
    status: "rebuy completed",
    createdAt: admin.firestore.Timestamp.now(),
  });

  console.log(`🔄 Rebuy processed for ${userId}`);
},


  /* ---------------------------------------------------
   5️⃣  ADMIN — MOVE TOURNAMENT FUNDS TO TREASURY
  --------------------------------------------------- */
  /* ---------------------------------------------------
   5️⃣ ADMIN — MOVE TOURNAMENT FUNDS TO TREASURY (FIXED)
--------------------------------------------------- */
async moveTournamentFundsToTreasury(tournamentId, amount) {
  const treasuryRef = db.collection("treasury").doc("main");
  const cofferRef = db.collection("tournamentCoffers").doc(tournamentId);

  await db.runTransaction(async (t) => {
    const cofferSnap = await t.get(cofferRef);
    const treasurySnap = await t.get(treasuryRef);

    if (!cofferSnap.exists) {
      throw new Error("Tournament coffer not found");
    }

    const cofferData = cofferSnap.data() || {};

    // 💰 TOTAL FUNDS (SOURCE OF TRUTH)
    const totalFunds =
      (cofferData.registration?.totalAmount || 0) +
      (cofferData.rebuys?.totalAmount || 0);

    const transferredAlready = cofferData.transferredToTreasury || 0;

    const remaining = totalFunds - transferredAlready;

    if (amount > remaining) {
      throw new Error("Transfer amount exceeds available funds");
    }

    // 🏦 UPDATE TREASURY
    t.set(
      treasuryRef,
      {
        balance: admin.firestore.FieldValue.increment(amount),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 📦 UPDATE COFFER
    t.update(cofferRef, {
      transferredToTreasury:
        admin.firestore.FieldValue.increment(amount),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 🧾 LOG TRANSACTION (VERY IMPORTANT)
    t.set(db.collection("transactions").doc(), {
      type: "tournament_to_treasury",
      tournamentId,
      amount,
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  console.log(
    `🏦 ${amount} moved from tournament ${tournamentId} to treasury`
  );
},

async adminAdjustBalance(t, userId, amount, mode, reason = "", adminId = null) {
  if (!["add", "subtract"].includes(mode)) {
    throw new Error("Invalid mode");
  }

  const userRef = db.collection("users").doc(userId);
  const treasuryRef = db.collection("treasury").doc("main");

  const userSnap = await t.get(userRef);
  if (!userSnap.exists) throw new Error("User not found");

  const userBalance = userSnap.data().realBalance || 0;

  if (mode === "subtract" && userBalance < amount) {
    throw new Error("Insufficient user balance");
  }

  // 🔁 CORRECT ACCOUNTING
  const userDelta = mode === "add" ? amount : -amount;
  const treasuryDelta = mode === "add" ? -amount : amount;

  // 👤 update user
  t.update(userRef, {
    realBalance: admin.firestore.FieldValue.increment(userDelta),
    lastBalanceUpdate: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 🏦 update treasury
  t.set(
    treasuryRef,
    {
      balance: admin.firestore.FieldValue.increment(treasuryDelta),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // 🧾 log transaction (IMPROVED)
  t.set(db.collection("transactions").doc(), {
    userId,
    amount,
    type: mode === "add" ? "admin_credit" : "admin_debit",
    reason,
    performedBy: adminId || "unknown",
    status: "completed",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
},


/* ---------------------------------------------------
   🏆 TOURNAMENT PAYOUT (FINAL - SINGLE SOURCE OF TRUTH)
--------------------------------------------------- */
async processTournamentPayout(tournamentId) {

  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const treasuryRef = db.collection("treasury").doc("main");

  const payoutLogs = [];

  await db.runTransaction(async (t) => {

    // 🔒 1. LOAD TOURNAMENT
    const tournamentSnap = await t.get(tournamentRef);

    if (!tournamentSnap.exists) {
      throw new Error("Tournament not found");
    }

    const tournament = tournamentSnap.data();

    // 🚫 ALREADY DONE CHECK
    if (tournament.paidOut) {
      throw new Error("Tournament already paid out");
    }

    if (tournament.payoutLocked) {
      throw new Error("Payout already running");
    }

    const prizePool = tournament.prizePool || 0;
    const payoutStructure = tournament.payoutStructure || [];

    if (!payoutStructure.length) {
      throw new Error("No payout structure defined");
    }

    // 🔒 LOCK IMMEDIATELY
    t.update(tournamentRef, {
      payoutLocked: true,
    });

    // 🏆 GET PARTICIPANTS RANKED
    const participantSnap = await t.get(
      tournamentRef
        .collection("participants")
        .orderBy("performance", "desc")
        .orderBy("balance", "desc")
        .limit(payoutStructure.length)
    );

    if (participantSnap.empty) {
      throw new Error("No participants found");
    }

    const treasurySnap = await t.get(treasuryRef);

    if (!treasurySnap.exists) {
      throw new Error("Treasury not found");
    }

    const treasuryBalance = treasurySnap.data().balance || 0;

    if (treasuryBalance < prizePool) {
      throw new Error("Treasury insufficient");
    }

    let distributed = 0;

    const winners = participantSnap.docs.map((doc, index) => ({
      userId: doc.id,
      amount: payoutStructure[index].amount,
    }));

    // 💰 PAY WINNERS
    for (const winner of winners) {

      const userRef = db.collection("users").doc(winner.userId);
      const participantRef = tournamentRef.collection("participants").doc(winner.userId);

      const [userSnap, participantSnap] = await Promise.all([
        t.get(userRef),
        t.get(participantRef),
      ]);

      if (!userSnap.exists || !participantSnap.exists) continue;

      const participant = participantSnap.data();

      // 🚫 DOUBLE PROTECTION
      if (participant.paidOut) continue;

      t.update(userRef, {
        realBalance: admin.firestore.FieldValue.increment(winner.amount),
        lastBalanceUpdate: admin.firestore.FieldValue.serverTimestamp(),
      });

      t.update(participantRef, {
        paidOut: true,
      });

      distributed += winner.amount;

      payoutLogs.push({
        userId: winner.userId,
        tournamentId,
        amount: winner.amount,
        type: "tournament_payout",
        status: "PAID",
        createdAt: admin.firestore.Timestamp.now(),
      });
    }

    // 🚨 SAFETY CHECK
    if (distributed > prizePool) {
      throw new Error("Distribution exceeds prize pool");
    }

    // 💸 DEDUCT FROM TREASURY
    t.update(treasuryRef, {
      balance: admin.firestore.FieldValue.increment(-distributed),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 🏁 FINALIZE TOURNAMENT
    t.update(tournamentRef, {
      paidOut: true,
      payoutLocked: true,
      status: "completed",
      paidOutAt: admin.firestore.Timestamp.now(),
    });
  });

  // 🧾 LOG OUTSIDE TX
  for (const log of payoutLogs) {
    await db.collection("transactions").add(log);
  }

  console.log(`🏆 Tournament ${tournamentId} fully paid out`);
}

};