const { admin, db } = require("./firebaseAdmin");

module.exports = {

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
const prizeModel = tournament.prizeModel || "sponsored";

  const entryFee = Number(tournament.entryFee || 0);
  const startingBalance = Number(tournament.startingBalance || 0);

  if (entryFee < 0 || startingBalance < 0) {
    throw new Error("Invalid tournament config");
  }

  if (user.locks?.joiningTournament) {
    throw new Error("Tournament join in progress");
  }

 if (
  entryFee > 0 &&
  Number(user.accounts?.real?.balance ?? 0) < entryFee
) {
  throw new Error("Insufficient Coins balance");
}

  // lock user
  t.update(userRef, {
    "locks.joiningTournament": true,
  });

  // wallet deduction + treasury
  if (entryFee > 0) {
   t.update(userRef, {
  "accounts.real.balance":
    admin.firestore.FieldValue.increment(-entryFee),
  coins: admin.firestore.FieldValue.increment(-entryFee),
});
    

    t.set(treasuryRef, {
      balance: admin.firestore.FieldValue.increment(Number(entryFee.toFixed(2))),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

   t.set(cofferRef, {
  registration: {
    count: admin.firestore.FieldValue.increment(1),
    totalAmount: admin.firestore.FieldValue.increment(Number(entryFee.toFixed(2)))
  },
  prizeModel,
  lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
}, { merge: true });
  }
if (prizeModel === "dynamic") {
  t.update(tournamentRef, {


    prizePool:
      admin.firestore.FieldValue.increment(Number(entryFee.toFixed(2))),
  });
}
  // tournament global update
  t.update(tournamentRef, {
    collectedFunds: admin.firestore.FieldValue.increment(Number(entryFee.toFixed(2))),
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
    startingBalance: startingBalance,
    rebuyCount: 0,
rebuyInjectedTotal: 0,
performance: {
  pnl: 0,
  roi: 0,
  wins: 0,
  losses: 0,
  trades: 0,
  winRate: 0,
  rebuyInjectedTotal: 0,
},
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 🧠 USER DOC = SINGLE SOURCE OF TRUTH
  t.update(userRef, {
    [`accounts.tournaments.${tournamentId}`]: {
      tournamentId,
      name: tournament.name || "Tournament",
      entryFee,
      symbol: tournament.symbol || "Coins",

      startingBalance,
      balance: startingBalance,
    prizePool:
 prizeModel==="sponsored"
 ? tournament.prizePool || 0
 : null,
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
   username: user.username || user.displayName || "Unknown",
 publicId: user.publicId || null,
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

 const rebuyFee = Number(tournament.rebuyFee ?? 0);

if (!Number.isFinite(rebuyFee) || rebuyFee < 0) {
  throw new Error("Invalid rebuy fee");
}
 const wallet = Number(user.accounts?.real?.balance ?? 0);

  const currentBalance = Number(participant.balance || 0);
  const startingBalance = Number(participant.startingBalance || tournament.startingBalance || 0);

  const rebuyUnlocked = currentBalance < startingBalance * 0.5;
  if (!rebuyUnlocked) throw new Error("REBUY_NOT_ALLOWED");

  const now = Date.now();
  const lastRebuy = participant.lastRebuyAt?.toMillis?.() || 0;
  if (now - lastRebuy < 3000) throw new Error("Too many requests");

  if (now > tournament.endTime) throw new Error("TOURNAMENT_ENDED");
 if (wallet < rebuyFee) throw new Error("Insufficient Coins balance");
  const newBalance = currentBalance + startingBalance;

const newRebuyCount = (participant.rebuyCount || 0) + 1;

const newInjectedTotal =
  (participant.rebuyInjectedTotal || 0) + startingBalance;

const newRebuys = [
  ...(participant.rebuys || []),
  {
    amount: rebuyFee,
    at: Date.now(),
  },
];

  // wallet deduction
 // wallet deduction + treasury + coffer (ONLY IF REBUY HAS A FEE)
if (rebuyFee > 0) {

  t.update(userRef, {
  "accounts.real.balance":
    admin.firestore.FieldValue.increment(-rebuyFee),
  coins: admin.firestore.FieldValue.increment(-rebuyFee),
});

  t.set(treasuryRef, {
    balance:
      admin.firestore.FieldValue.increment(Number(rebuyFee.toFixed(2))),
    lastUpdated:
      admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  t.set(cofferRef, {
    rebuys: {
      count:
        admin.firestore.FieldValue.increment(1),
      totalAmount:
        admin.firestore.FieldValue.increment(Number(rebuyFee.toFixed(2))),
    },
    lastUpdated:
      admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

}

  // 🟡 PARTICIPANT CACHE (UI ONLY)
 t.set(participantRef, {
  balance: newBalance,
  startingBalance,

  rebuyCount: newRebuyCount,
  rebuyInjectedTotal: newInjectedTotal,
  rebuys: newRebuys,

  lastRebuyAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
}, { merge: true });


  // transaction log
  t.set(db.collection("transactions").doc(), {
    userId,
    username: user.username || user.displayName || "Unknown",
 publicId: user.publicId || null,
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
if (!Number.isFinite(amount) || amount <= 0) {
  throw new Error("Invalid amount");
}
  const userBalance = Number(user.coins ?? 0);

  if (mode === "subtract" && userBalance < amount) {
    throw new Error("Insufficient user balance");
  }

  const userDelta = mode === "add" ? amount : -amount;
  const treasuryDelta = mode === "add" ? -amount : amount;

  t.update(userRef, {
   coins: admin.firestore.FieldValue.increment(userDelta),
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
    username: user.username || user.displayName || "Unknown",
 publicId: user.publicId || null,
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

  await db.runTransaction(async (t) => {
    const tournamentSnap = await t.get(tournamentRef);
    const treasurySnap = await t.get(treasuryRef);

    if (!tournamentSnap.exists) throw new Error("Tournament not found");
    if (!treasurySnap.exists) throw new Error("Treasury missing");

    const tournament = tournamentSnap.data();

    if (tournament.paidOut) throw new Error("Already paid out");

    const prizeModel = tournament.prizeModel || "sponsored";
    const prizePool = prizeModel === "dynamic"
      ? Number(tournament.collectedFunds || 0)
      : Number(tournament.prizePool || 0);

    if (!Number.isFinite(prizePool) || prizePool < 0) {
      throw new Error("Invalid prize pool");
    }

    const payoutStructure = tournament.payoutStructure || [];

    if (!Array.isArray(payoutStructure) || payoutStructure.length === 0) {
      throw new Error("Invalid payout structure");
    }

    const rules = payoutStructure.map((p) => ({
      rank: Number(p.rank),
      amount: Number(p.amount || 0),
      percentage: Number(p.percentage || 0),
    })).sort((a, b) => a.rank - b.rank);

    const seenRanks = new Set();

    for (const rule of rules) {
      if (!Number.isInteger(rule.rank) || rule.rank < 1 ||
          seenRanks.has(rule.rank)) {
        throw new Error("Invalid or duplicate payout rank");
      }

      seenRanks.add(rule.rank);

      if (prizeModel === "dynamic") {
        if (!Number.isFinite(rule.percentage) ||
            rule.percentage < 0) {
          throw new Error("Invalid payout percentage");
        }
      } else if (!Number.isFinite(rule.amount) || rule.amount < 0) {
        throw new Error("Invalid sponsored payout amount");
      }
    }

    if (prizeModel === "dynamic") {
      const totalPercentage = rules.reduce(
        (sum, rule) => sum + rule.percentage, 0
      );

      if (totalPercentage > 100.0001) {
        throw new Error("Payout percentages exceed 100%");
      }
    }

    const participantsSnap = await t.get(
      tournamentRef.collection("participants")
    );

    if (participantsSnap.empty) throw new Error("No participants");

    const players = participantsSnap.docs.map((doc) => ({
      id: doc.id,
      data: doc.data(),
    }));

    players.sort((a, b) => {
      const scoreA =
        Number(a.data.balance || 0) -
        Number(a.data.startingBalance || 0) -
        Number(a.data.rebuyInjectedTotal || 0);

      const scoreB =
        Number(b.data.balance || 0) -
        Number(b.data.startingBalance || 0) -
        Number(b.data.rebuyInjectedTotal || 0);

      return scoreB - scoreA;
    });

    const winners = [];

    for (const rule of rules) {
      const player = players[rule.rank - 1];
      if (!player) continue;

      const amount = Math.floor(
        prizeModel === "dynamic"
          ? prizePool * rule.percentage / 100
          : rule.amount
      );

      if (amount > 0) {
        winners.push({
          userId: player.id,
          amount,
          rank: rule.rank,
        });
      }
    }

    if (winners.length === 0) {
      throw new Error("No payouts to process");
    }

    const winnerData = [];

    // Read every winner before making transaction writes.
    for (const winner of winners) {
      const userRef = db.collection("users").doc(winner.userId);
      const participantRef = tournamentRef
        .collection("participants").doc(winner.userId);

      const [userSnap, participantSnap] = await Promise.all([
        t.get(userRef),
        t.get(participantRef),
      ]);

      if (!userSnap.exists || !participantSnap.exists) {
        throw new Error(`Winner records missing: ${winner.userId}`);
      }

      winnerData.push({
        ...winner,
        userRef,
        participantRef,
        alreadyPaid: participantSnap.data().paidOut === true,
      });
    }

    const payable = winnerData.filter((w) => !w.alreadyPaid);
    const distributed = payable.reduce((sum, w) => sum + w.amount, 0);

    if (distributed <= 0) {
      throw new Error("All configured winners have already been paid");
    }

    if (distributed > prizePool) {
      throw new Error("Payouts exceed the prize pool");
    }

    const treasuryBalance = Number(treasurySnap.data().balance || 0);

    if (!Number.isFinite(treasuryBalance) ||
        treasuryBalance < distributed) {
      throw new Error("Treasury has insufficient Coins");
    }

    for (const winner of payable) {
      t.update(winner.userRef, {
  "accounts.real.balance": admin.firestore.FieldValue.increment(winner.amount),
});

      t.update(winner.participantRef, {
        paidOut: true,
        payoutStatus: "paid",
        payoutAmount: winner.amount,
        payoutAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      payoutLogs.push({
        userId: winner.userId,
        tournamentId,
        amount: winner.amount,
        rank: winner.rank,
        type: "tournament_payout",
        status: "completed",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
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
      totalCoinsPaid: distributed,
    });
  });

  // Log after the payout transaction commits.
  for (const log of payoutLogs) {
    await db.collection("transactions").add(log);
  }

  console.log(`Tournament ${tournamentId} Coins payouts completed`);

  return {
    success: true,
    message: "Tournament Coins payouts completed",
  };
},


 

async payParticipant(tournamentId, participantId) {
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const participantRef = tournamentRef
    .collection("participants").doc(participantId);
  const userRef = db.collection("users").doc(participantId);
  const treasuryRef = db.collection("treasury").doc("main");

  await db.runTransaction(async (t) => {
    const [tournamentSnap, treasurySnap, participantsSnap,
      participantSnap, userSnap] = await Promise.all([
      t.get(tournamentRef),
      t.get(treasuryRef),
      t.get(tournamentRef.collection("participants")),
      t.get(participantRef),
      t.get(userRef),
    ]);

    if (!tournamentSnap.exists) throw new Error("Tournament not found");
    if (!treasurySnap.exists) throw new Error("Treasury missing");
    if (!participantSnap.exists) throw new Error("Participant not found");
    if (!userSnap.exists) throw new Error("User not found");

    const tournament = tournamentSnap.data();
    const participant = participantSnap.data();

    if (tournament.paidOut) {
      throw new Error("Tournament payouts already completed");
    }

    if (participant.paidOut) {
      throw new Error("Participant already paid");
    }

    const prizeModel = tournament.prizeModel || "sponsored";
    const payoutStructure = tournament.payoutStructure || [];

    if (!Array.isArray(payoutStructure) || payoutStructure.length === 0) {
      throw new Error("Invalid payout structure");
    }

    const leaderboard = participantsSnap.docs.map((doc) => ({
      id: doc.id,
      data: doc.data(),
    }));

    leaderboard.sort((a, b) => {
      const scoreA =
        Number(a.data.balance || 0) -
        Number(a.data.startingBalance || 0) -
        Number(a.data.rebuyInjectedTotal || 0);

      const scoreB =
        Number(b.data.balance || 0) -
        Number(b.data.startingBalance || 0) -
        Number(b.data.rebuyInjectedTotal || 0);

      return scoreB - scoreA;
    });

    const rank = leaderboard.findIndex(
      (player) => player.id === participantId
    ) + 1;

    if (rank < 1) throw new Error("Participant not ranked");

    const payout = payoutStructure.find(
      (rule) => Number(rule.rank) === rank
    );

    if (!payout) throw new Error("No payout configured for this rank");

    let amount;

    if (prizeModel === "dynamic") {
      const prizePool = Number(tournament.collectedFunds || 0);
      const percentage = Number(payout.percentage || 0);

      if (!Number.isFinite(prizePool) || prizePool < 0 ||
          !Number.isFinite(percentage) || percentage <= 0 ||
          percentage > 100) {
        throw new Error("Invalid dynamic payout");
      }

      amount = Math.floor(prizePool * percentage / 100);
    } else {
      amount = Math.floor(Number(payout.amount || 0));
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid payout amount");
    }

    const treasuryBalance = Number(treasurySnap.data().balance || 0);

    if (!Number.isFinite(treasuryBalance) ||
        treasuryBalance < amount) {
      throw new Error("Treasury has insufficient Coins");
    }

    t.update(userRef, {
  "accounts.real.balance": admin.firestore.FieldValue.increment(amount),
});

    t.update(participantRef, {
      paidOut: true,
      payoutStatus: "paid",
      payoutAmount: amount,
      payoutAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    t.update(treasuryRef, {
      balance: admin.firestore.FieldValue.increment(-amount),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });

    t.set(db.collection("transactions").doc(), {
      userId: participantId,
      tournamentId,
      amount,
      rank,
      type: "tournament_payout",
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  console.log(`Paid ${participantId} ${tournamentId} tournament reward in Coins`);

  return { success: true, message: "Participant paid in Coins" };
},

};