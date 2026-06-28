const { admin, db } = require("./firebaseAdmin");

module.exports = {

/* ---------------------------------------------------
   1️⃣ WITHDRAWALS
--------------------------------------------------- */
async processWithdrawal(userId, amount, momoNumber) {

  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    throw new Error("Invalid withdrawal amount");
  }

  const numericAmount = Number(amount);

  if (!momoNumber || typeof momoNumber !== "string") {
    throw new Error("Invalid MoMo number");
  }

  const userRef = db.collection("users").doc(userId);

  await db.runTransaction(async (t) => {
    const userSnap = await t.get(userRef);
    const user = userSnap.data();

    if (!userSnap.exists) throw new Error("User not found");

    const wallet = userSnap.data()?.accounts?.real?.balance || 0;

    if (wallet < numericAmount) {
      throw new Error("User does not have enough balance");
    }

    t.update(userRef, {
      "accounts.real.balance": admin.firestore.FieldValue.increment(-numericAmount),
    });

    const treasuryRef = db.collection("treasury").doc("main");

    t.set(
      treasuryRef,
      {
        balance: admin.firestore.FieldValue.increment(-numericAmount),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const transactionRef = db.collection("transactions").doc();
    const payoutRef = db.collection("payouts").doc();

    t.set(transactionRef, {
      userId,
       username: user.username || "Unknown",
      amount: numericAmount,
      type: "withdrawal",
      status: "pending",
      createdAt: admin.firestore.FieldValue.server(),
    });

    t.set(payoutRef, {
      userId,
      amount: numericAmount,
      momoNumber,
      status: "pending",
      transactionId: transactionRef.id,
      createdAt: admin.firestore.FieldValue.server(),
    });
  });

  console.log(`📤 Withdrawal request for ${userId} → ${numericAmount}`);
},

/* ---------------------------------------------------
   2️⃣ TOURNAMENT REGISTRATION (FINAL CLEAN VERSION)
--------------------------------------------------- */
async registerTournament(t, userId, tournamentId) {

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
  if (participantSnap.exists) throw new Error("Already joined");

  const user = userSnap.data();
  const tournament = tournamentSnap.data();

  const entryFee = Number(tournament.entryFee || 0);
  const startingBalance = Number(tournament.startingBalance || 0);

  if (entryFee < 0 || startingBalance < 0) {
    throw new Error("Invalid tournament config");
  }

  if (user.locks?.joiningTournament) {
    throw new Error("Tournament join in progress");
  }

  if (entryFee > 0 && (user.accounts?.real?.balance || 0) < entryFee) {
    throw new Error("Insufficient wallet balance");
  }

  // lock user
  t.update(userRef, {
    "locks.joiningTournament": true,
  });

  // wallet deduction + treasury
  if (entryFee > 0) {
    t.update(userRef, {
      "accounts.real.balance": admin.firestore.FieldValue.increment(-entryFee),
    });

    t.set(treasuryRef, {
      balance: admin.firestore.FieldValue.increment(entryFee),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    t.set(cofferRef, {
      registration: {
        count: admin.firestore.FieldValue.increment(1),
        totalAmount: admin.firestore.FieldValue.increment(entryFee),
      },
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  // tournament global update
  t.update(tournamentRef, {
    collectedFunds: admin.firestore.FieldValue.increment(entryFee),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 🟡 LEADERBOARD CACHE (FAST UI ONLY)
  t.set(participantRef, {
    uid: userId,
    username: user.username || "Player",
    publicId: user.publicId || null,
    countryCode: user.countryCode || null,
referrerId: user.referredBy || null,
    tournamentId,
    tournamentName: tournament.name || "Tournament",

    balance: startingBalance,
    rebuyCount: 0,

    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 🧠 USER DOC = SINGLE SOURCE OF TRUTH
  t.update(userRef, {
    [`accounts.tournaments.${tournamentId}`]: {
      tournamentId,
      name: tournament.name || "Tournament",
      entryFee,
      symbol: tournament.symbol || "$",

      startingBalance,
      balance: startingBalance,
      initialBalance: startingBalance,

      prizePool: tournament.prizePool || 0,

      joined: true,
      status:
  Date.now() < tournament.startTime
    ? "upcoming"
    : Date.now() <= tournament.endTime
    ? "ongoing"
    : "finished",

      rebuyCount: 0,
      rebuys: [],

      startTime: tournament.startTime || null,
      endTime: tournament.endTime || null,

      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  });

  // unlock
  t.update(userRef, {
    "locks.joiningTournament": admin.firestore.FieldValue.delete(),
  });

  // transaction log
  t.set(db.collection("transactions").doc(), {
    userId,
    username: user.username || "Unknown",
    tournamentId,
    amount: entryFee,
    type: "tournament_registration",
    status: "completed",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`🎟 Tournament registered for ${userId}`);
},

/* ---------------------------------------------------
   3️⃣ REBUYS (FINAL SOURCE OF TRUTH VERSION)
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
  if (!participantSnap.exists) throw new Error("Not in tournament");

  const user = userSnap.data();
  const tournament = tournamentSnap.data();
  const participant = participantSnap.data();

  const rebuyFee = Number(tournament.rebuyFee || 0);
  const wallet = user.accounts?.real?.balance || 0;

  if (rebuyFee <= 0) throw new Error("Invalid rebuy fee");

  const currentBalance = Number(participant.balance || 0);
  const initialBalance = Number(participant.initialBalance || tournament.startingBalance || 0);

  const rebuyUnlocked = currentBalance < initialBalance * 0.5;
  if (!rebuyUnlocked) throw new Error("REBUY_NOT_ALLOWED");

  const now = Date.now();
  const lastRebuy = participant.lastRebuyAt?.toMillis?.() || 0;
  if (now - lastRebuy < 3000) throw new Error("Too many requests");

  if (now > tournament.endTime) throw new Error("TOURNAMENT_ENDED");
  if (wallet < rebuyFee) throw new Error("Insufficient balance");

  // wallet deduction
  t.update(userRef, {
    "accounts.real.balance": admin.firestore.FieldValue.increment(-rebuyFee),
  });

  // treasury
  t.set(treasuryRef, {
    balance: admin.firestore.FieldValue.increment(rebuyFee),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // coffer
  t.set(cofferRef, {
    rebuys: {
      count: admin.firestore.FieldValue.increment(1),
      totalAmount: admin.firestore.FieldValue.increment(rebuyFee),
    },
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // 🟡 PARTICIPANT CACHE (UI ONLY)
  t.update(participantRef, {
    balance: admin.firestore.FieldValue.increment(initialBalance),
    rebuyCount: admin.firestore.FieldValue.increment(1),
    lastRebuyAt: admin.firestore.FieldValue.serverTimestamp(),

    rebuys: admin.firestore.FieldValue.arrayUnion({
      amount: rebuyFee,
      at: Date.now(),
    }),

    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 🧠 USER DOC = SOURCE OF TRUTH
  t.update(userRef, {
    [`accounts.tournaments.${tournamentId}.balance`]:
      admin.firestore.FieldValue.increment(initialBalance),

    [`accounts.tournaments.${tournamentId}.rebuyCount`]:
      admin.firestore.FieldValue.increment(1),

    [`accounts.tournaments.${tournamentId}.rebuys`]:
      admin.firestore.FieldValue.arrayUnion({
        amount: rebuyFee,
        at: Date.now(),
      }),
  });

  // transaction log
  t.set(db.collection("transactions").doc(), {
    userId,
    username: user.username || "Unknown",
    tournamentId,
    amount: rebuyFee,
    type: "rebuy",
    status: "completed",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`🔄 Rebuy processed for ${userId}`);
},
/* ---------------------------------------------------
   4️⃣ ADMIN ADJUST BALANCE (UNCHANGED SAFE)
--------------------------------------------------- */
async adminAdjustBalance(t, userId, amount, mode, reason = "", adminId = null) {

  if (!["add", "subtract"].includes(mode)) {
    throw new Error("Invalid mode");
  }

  const userRef = db.collection("users").doc(userId);
  const treasuryRef = db.collection("treasury").doc("main");

  const userSnap = await t.get(userRef);
  const user = userSnap.data();
  if (!userSnap.exists) throw new Error("User not found");

  const userBalance = userSnap.data().accounts.real.balance || 0;

  if (mode === "subtract" && userBalance < amount) {
    throw new Error("Insufficient user balance");
  }

  const userDelta = mode === "add" ? amount : -amount;
  const treasuryDelta = mode === "add" ? -amount : amount;

  t.update(userRef, {
    "accounts.real.balance": admin.firestore.FieldValue.increment(userDelta),
    lastBalanceUpdate: admin.firestore.FieldValue.serverTimestamp(),
  });

  t.set(
    treasuryRef,
    {
      balance: admin.firestore.FieldValue.increment(treasuryDelta),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  t.set(db.collection("transactions").doc(), {
     userId,
     username: user.username || "Unknown",
    amount,
    type: mode === "add" ? "admin_credit" : "admin_debit",
    reason,
    performedBy: adminId || "unknown",
    status: "completed",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
},

/* ---------------------------------------------------
   5️⃣ PAYOUT (UNCHANGED CORE LOGIC)
--------------------------------------------------- */
async processTournamentPayout(tournamentId) {

  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const treasuryRef = db.collection("treasury").doc("main");

  const payoutLogs = [];

  try {

    await db.runTransaction(async (t) => {

      // ======================
      // READS FIRST
      // ======================
      const tournamentSnap = await t.get(tournamentRef);

      if (!tournamentSnap.exists) {
        throw new Error("Tournament not found");
      }

      const tournament = tournamentSnap.data();

      if (tournament.paidOut) {
        throw new Error("Already paid out");
      }

      if (tournament.payoutLocked) {
        throw new Error("Payout running");
      }

      const prizePool = Number(tournament.prizePool || 0);
      const payoutStructure = tournament.payoutStructure || [];

      if (!Array.isArray(payoutStructure) || payoutStructure.length === 0) {
        throw new Error("Invalid payout structure");
      }

      const treasurySnap = await t.get(treasuryRef);

      if (!treasurySnap.exists) {
        throw new Error("Treasury missing");
      }

      const treasuryBalance = treasurySnap.data().balance || 0;

      if (treasuryBalance < prizePool) {
        throw new Error("Treasury insufficient");
      }

      const participantsQuery = tournamentRef
        .collection("participants")
        .orderBy("performance", "desc")
        .limit(payoutStructure.length);

      const participantSnap = await t.get(participantsQuery);

      if (participantSnap.empty) {
        throw new Error("No participants");
      }

      const winners = participantSnap.docs
        .slice(0, payoutStructure.length)
        .map((doc, i) => ({
          userId: doc.id,
          amount: Number(payoutStructure[i]?.amount || 0),
        }))
        .filter((w) => w.amount > 0);

      // ======================
      // READ ALL WINNER DOCS
      // ======================
      const winnerData = [];

      for (const w of winners) {

        const userRef = db.collection("users").doc(w.userId);
        const partRef = tournamentRef.collection("participants").doc(w.userId);

        const [userSnap, partSnap] = await Promise.all([
          t.get(userRef),
          t.get(partRef),
        ]);

        winnerData.push({
          w,
          userRef,
          partRef,
          userSnap,
          partSnap,
        });
      }

      // ======================
      // WRITES START HERE
      // ======================
      t.update(tournamentRef, {
        payoutLocked: true,
        status: "processing",
      });

      let distributed = 0;

      for (const item of winnerData) {

        const {
          w,
          userRef,
          partRef,
          userSnap,
          partSnap,
        } = item;

        if (!userSnap.exists || !partSnap.exists) continue;

        if (partSnap.data().paidOut) continue;

        t.update(userRef, {
          "accounts.real.balance":
            admin.firestore.FieldValue.increment(w.amount),
        });

        t.update(partRef, {
          paidOut: true,
          payoutAmount: w.amount,
          payoutAt: admin.firestore.FieldValue.toISOString(),
        });
t.update(partRef, {
  performance: admin.firestore.FieldValue.increment(w.amount),
});
        distributed += w.amount;

        payoutLogs.push({
          userId: w.userId,
          tournamentId,
          amount: w.amount,
          type: "tournament_payout",
          status: "PAID",
          createdAt: admin.firestore.FieldValue.toISOString(),
        });
      }

      if (distributed > prizePool) {
        throw new Error("Over-distribution detected");
      }

      t.update(treasuryRef, {
        balance: admin.firestore.FieldValue.increment(-distributed),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });

      t.update(tournamentRef, {
        paidOut: true,
        payoutLocked: false,
        status: "completed",
        paidOutAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    });

    for (const log of payoutLogs) {
      await db.collection("transactions").add(log);
    }

    console.log(`🏆 Tournament ${tournamentId} paid out`);

  } catch (error) {

    await db.runTransaction(async (t) => {
      t.update(tournamentRef, {
        status: "live",
        payoutLocked: false,
      });
    });

    console.error("Payout failed:", error.message);
    throw error;
  }
}
};