const { admin, db } = require("./firebaseAdmin");

module.exports = {
  /* ---------------------------------------------------
     1️⃣  DEPOSITS
  --------------------------------------------------- */
  async processCampayDeposit(userId, amount, txRef) {
  const userRef = db.collection("users").doc(userId);
  const treasuryRef = db.collection("treasury").doc("main");
  const txRefDoc = db.collection("transactions").doc(txRef);

  await db.runTransaction(async (t) => {
    // 1️⃣ Check if already processed
    const txSnap = await t.get(txRefDoc);
  if (txSnap.exists && txSnap.data().status === "COMPLETED") {
  return;
}
if (txSnap.exists && txSnap.data().creditedAt) {
  return;
}


    // 2️⃣ Credit user wallet
    t.update(userRef, {
      walletBalance: admin.firestore.FieldValue.increment(amount),
      lastUpdated: admin.firestore.Timestamp.now(),
    });

    // 3️⃣ Credit treasury
    t.set(
      treasuryRef,
      {
        balance: admin.firestore.FieldValue.increment(amount),
        lastUpdated: admin.firestore.Timestamp.now(),
      },
      { merge: true }
    );

    // 4️⃣ Save transaction USING SAME REF
  // 4️⃣ Mark transaction as successful (do NOT overwrite)
t.set(
  txRefDoc,
  {
      status: "COMPLETED",
    creditedAt: admin.firestore.Timestamp.now(),
  },
  { merge: true }
);


  });

  console.log(`💰 Campay deposit processed safely: ${txRef}`);
},

  async addDepositToUser(userId, amount) {
    const userRef = db.collection("users").doc(userId);

    await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new Error("User not found");

      
      t.update(userRef, {
        walletBalance: admin.firestore.FieldValue.increment(amount),
        lastUpdated: admin.firestore.Timestamp.now(),
      });

      // ✅ log inside transaction
      t.set(db.collection("transactions").doc(), {
        userId,
        amount,
        type: "deposit",
        status: "COMPLETED",
        createdAt: admin.firestore.Timestamp.now(),
      });
    });

    console.log(`💰 Deposit added → ${userId} +${amount}`);
  },

  async addDepositToTreasury(amount) {
    const treasuryRef = db.collection("treasury").doc("main");

    await db.runTransaction(async (t) => {
     
     
      t.set(
        treasuryRef,
        {
        balance: admin.firestore.FieldValue.increment(amount),

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
      

      if (wallet < amount) throw new Error("Insufficient balance");

      t.update(userRef, {   walletBalance: admin.firestore.FieldValue.increment(-amount),});
      t.update(tournamentRef, {
         prizePool: admin.firestore.FieldValue.increment(amount),
        collectedFunds: admin.firestore.FieldValue.increment(amount), // 💰 real money
        lastUpdated: admin.firestore.Timestamp.now(),
      });

      t.set(db.collection("transactions").doc(), {
        userId,
        tournamentId,
        amount,
        type: "tournament_fee",
        status: "COMPLETED",
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

    const wallet = userSnap.data().walletBalance || 0;
    const pool = tournamentSnap.data().prizePool || 0;

    const startingBalance = tournamentSnap.data().startingBalance;
    const rebuyFee = tournamentSnap.data().rebuyFee;

    if (!rebuyFee || rebuyFee <= 0)
      throw new Error("Rebuy not allowed");

    if (wallet < rebuyFee)
      throw new Error("Insufficient balance");

    // 🔻 deduct fixed rebuy fee
    t.update(userRef, {
      walletBalance: admin.firestore.FieldValue.increment(-rebuyFee),
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
    // 🏆 prize pool grows by rebuy fee
    t.update(tournamentRef, {
      prizePool: pool + rebuyFee,
       collectedFunds: admin.firestore.FieldValue.increment(rebuyFee),
      lastUpdated: admin.firestore.Timestamp.now(),
    });

    // 🧾 log transaction
    t.set(db.collection("transactions").doc(), {
      userId,
      tournamentId,
      amount: rebuyFee,
      type: "rebuy",
     status: "COMPLETED",
      createdAt: admin.firestore.Timestamp.now(),
    });
  });

  console.log(`🔄 Rebuy processed for ${userId}`);
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

      t.update(userRef, {
  walletBalance: admin.firestore.FieldValue.increment(-amount),
});
t.update(treasuryRef, {
  balance: admin.firestore.FieldValue.increment(-amount),
});


      // ✅ log inside transaction
      t.set(db.collection("transactions").doc(), {
        userId,
        amount,
        type: "withdrawal",
        status: "pending_admin_approval",
        createdAt: admin.firestore.Timestamp.now(),
      });
    });

    console.log(`📤 Withdrawal request for ${userId} → ${amount}`);
  },


  /* ---------------------------------------------------
     ADMIN — MOVE TOURNAMENT FUNDS TO TREASURY
  --------------------------------------------------- */
  async moveTournamentFundsToTreasury(tournamentId, amount) {
    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const treasuryRef = db.collection("treasury").doc("main");

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

      // 🧾 log transaction
      t.set(db.collection("transactions").doc(), {
        tournamentId,
        amount,
        type: "tournament_funds_to_treasury",
        status: "COMPLETED",
        createdAt: admin.firestore.Timestamp.now(),
      });
    });

    console.log(
      `🏦 Moved ${amount} from tournament ${tournamentId} to treasury`
    );
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
        walletBalance: admin.firestore.FieldValue.increment(
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
        status: "COMPLETED",
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