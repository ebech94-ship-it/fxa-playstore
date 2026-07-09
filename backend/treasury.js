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
  prizeModel,
  lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
}, { merge: true });
  }
if (prizeModel === "dynamic") {
  t.update(tournamentRef, {
    prizePool: admin.firestore.FieldValue.increment(entryFee),
  });
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
      symbol: tournament.symbol || "$",

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
  const startingBalance = Number(participant.startingBalance || tournament.startingBalance || 0);

  const rebuyUnlocked = currentBalance < startingBalance * 0.5;
  if (!rebuyUnlocked) throw new Error("REBUY_NOT_ALLOWED");

  const now = Date.now();
  const lastRebuy = participant.lastRebuyAt?.toMillis?.() || 0;
  if (now - lastRebuy < 3000) throw new Error("Too many requests");

  if (now > tournament.endTime) throw new Error("TOURNAMENT_ENDED");
  if (wallet < rebuyFee) throw new Error("Insufficient balance");

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

  const prizeModel = tournament.prizeModel || "sponsored";
const prizePool =
  prizeModel === "dynamic"
    ? Number(tournament.collectedFunds || 0)
    : Number(tournament.prizePool || 0);

const payoutStructure = tournament.payoutStructure || [];


if (!Array.isArray(payoutStructure) || payoutStructure.length === 0) {
  throw new Error("Invalid payout structure");
}


// validate pool percentage
if (prizeModel === "dynamic") {

  const totalPercentage =
    payoutStructure.reduce(
      (sum,p)=>sum + Number(p.percentage || 0),
      0
    );


  if (totalPercentage > 100.01) {
  throw new Error("Pool payout percentage cannot exceed 100%");
}

}
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
  .collection("participants");

const participantSnap = await t.get(participantsQuery);

if (participantSnap.empty) {
  throw new Error("No participants");
}


const players = participantSnap.docs.map((doc)=>({
  id: doc.id,
  data: doc.data(),
}));


// SAME RANKING LOGIC AS FRONTEND
players.sort((a,b)=>{

  const aData = a.data;
  const bData = b.data;


  const aPerformance =
    (aData.balance ?? 0)
    - (aData.startingBalance ?? 0)
    - (aData.rebuyInjectedTotal ?? 0);


  const bPerformance =
    (bData.balance ?? 0)
    - (bData.startingBalance ?? 0)
    - (bData.rebuyInjectedTotal ?? 0);


  return bPerformance - aPerformance;

});


const winners = players
.slice(0, payoutStructure.length)
.map((player,i)=>{

const payoutRule = payoutStructure[i];

let amount = 0;


if(prizeModel === "dynamic"){

amount =
prizePool *
(Number(payoutRule.percentage || 0) / 100);

}else{

amount =
Number(payoutRule.amount || 0);

}


return {
userId: player.id,
rank:payoutRule.rank,
amount:Math.floor(amount)
};

})
.filter(w=>w.amount>0);
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
           payoutStatus: "paid",
          payoutAmount: w.amount,
          payoutAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        distributed += w.amount;

        payoutLogs.push({
          userId: w.userId,
          tournamentId,
          amount: w.amount,
          type: "tournament_payout",
          status: "PAID",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      if (distributed > prizePool) {
        throw new Error("Over-distribution detected");
      }

     // Nothing was actually paid
if (distributed <= 0) {
  throw new Error("No payouts were processed");
}

// Deduct only what was actually distributed
t.update(treasuryRef, {
  balance: admin.firestore.FieldValue.increment(-distributed),
  lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
});

// Mark tournament completed ONLY after successful payments
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

return {
  success: true,
  message: "Tournament payout completed",
};

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
},

 async payParticipant(tournamentId, participantId) {
  const tournamentRef = db.collection("tournaments").doc(tournamentId);
  const participantRef = tournamentRef.collection("participants").doc(participantId);
  const userRef = db.collection("users").doc(participantId);
  const treasuryRef = db.collection("treasury").doc("main");

  const tournamentSnap = await tournamentRef.get();
  if (!tournamentSnap.exists) throw new Error("Tournament not found");

  const tournament = tournamentSnap.data();

  if (tournament.paidOut) throw new Error("Tournament already fully paid");
  if (!Array.isArray(tournament.payoutStructure)) {
    throw new Error("Invalid payout structure");
  }

  const participantSnap = await participantRef.get();
  if (!participantSnap.exists) throw new Error("Participant not found");

  const participant = participantSnap.data();

  if (participant.paidOut) {
    throw new Error("Participant already paid");
  }

  // 1️⃣ Get leaderboard sorted EXACTLY like bulk payout
  const leaderboardSnap = await tournamentRef
.collection("participants")
.get();


const leaderboard = leaderboardSnap.docs.map((d)=>({
id:d.id,
data:d.data(),
}));


leaderboard.sort((a,b)=>{

const aPerformance =
(a.data.balance ?? 0)
- (a.data.startingBalance ?? 0)
- (a.data.rebuyInjectedTotal ?? 0);


const bPerformance =
(b.data.balance ?? 0)
- (b.data.startingBalance ?? 0)
- (b.data.rebuyInjectedTotal ?? 0);


return bPerformance - aPerformance;

});

 

  // 2️⃣ Find rank
  const rank = leaderboard.findIndex((p) => p.id === participantId) + 1;

  if (rank <= 0) throw new Error("Participant not ranked");

  // 3️⃣ Get payout
// 3️⃣ Get payout (SAME LOGIC AS BULK PAYOUT)
const payout = tournament.payoutStructure[rank - 1];

if (!payout) {
  throw new Error("No payout for this rank");
}

if (
  tournament.prizeModel === "sponsored" &&
  Number(payout.amount || 0) <= 0
) {
  throw new Error("No payout for this rank");
}

if (
  tournament.prizeModel === "dynamic" &&
  Number(payout.percentage || 0) <= 0
) {
  throw new Error("No payout for this rank");
}

  let amount;

if (tournament.prizeModel === "dynamic") {

 
    const prizeModel = tournament.prizeModel || "sponsored";

 const prizePool =
  prizeModel === "dynamic"
    ? Number(tournament.collectedFunds || 0)
    : Number(tournament.prizePool || 0);

  amount =
    prizePool *
    (Number(payout.percentage || 0) / 100);

} else {
  amount = Number(payout.amount);
}
const treasurySnap = await treasuryRef.get();

if (!treasurySnap.exists) {
 throw new Error("Treasury missing");
}

if ((treasurySnap.data().balance || 0) < amount) {
 throw new Error("Treasury insufficient");
}
  // 4️⃣ Run transaction
  await db.runTransaction(async (t) => {
    const userSnap = await t.get(userRef);
    if (!userSnap.exists) throw new Error("User not found");

    // credit user wallet
    t.update(userRef, {
      "accounts.real.balance": admin.firestore.FieldValue.increment(amount),
    });

    // mark participant paid
    t.update(participantRef, {
      paidOut: true,
      payoutStatus: "paid",
      payoutAmount: amount,
      payoutAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // reduce treasury
    t.update(treasuryRef, {
      balance: admin.firestore.FieldValue.increment(-amount),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });

    // log transaction
    t.set(db.collection("transactions").doc(), {
      userId: participantId,
      tournamentId,
      amount,
      type: "tournament_payout",
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  console.log(`💰 Paid participant ${participantId} → rank ${rank}`);
},
};