const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

function computeRankingScore(balance, startingBalance, rebuyInjectedTotal) {
  return balance - startingBalance - rebuyInjectedTotal;
}
 const REFERRAL_REWARDS = [
  {
    target: 3,
    key: "3_referrals",
    reward: {
      freeTournamentTickets: 1,
      referralPoints: 100,
    },
  },
  {
    target: 5,
    key: "5_referrals",
    reward: {
      walletBonus: 5,
      referralPoints: 250,
    },
  },
  {
    target: 10,
    key: "10_referrals",
    reward: {
      badge: "Bronze",
      referralPoints: 400,
    },
  },
  {
    target: 15,
    key: "15_referrals",
    reward: {
      freeTournamentTickets: 2,
      referralPoints: 600,
    },
  },
  {
    target: 20,
    key: "20_referrals",
    reward: {
      badge: "Silver",
      referralPoints: 900,
    },
  },
  {
    target: 30,
    key: "30_referrals",
    reward: {
      walletBonus: 10,
      referralPoints: 1500,
    },
  },
  {
    target: 50,
    key: "50_referrals",
    reward: {
      badge: "VIP",
      referralPoints: 2000,
    },
  },
  {
    target: 75,
    key: "75_referrals",
    reward: {
      profileFrame: "Premium",
      referralPoints: 3500,
    },
  },
  {
    target: 100,
    key: "100_referrals",
    reward: {
      badge: "Gold",
      referralPoints: 5000,
    },
  },
  {
    target: 150,
    key: "150_referrals",
    reward: {
      walletBonus: 15,
      referralPoints: 10000,
    },
  },
  {
    target: 250,
    key: "250_referrals",
    reward: {
      ambassadorStatus: "Elite Ambassador",
      referralPoints: 15000,
    },
  },
  {
    target: 500,
    key: "500_referrals",
    reward: {
      ambassadorStatus: "GodSpeed Ambassador",
      referralPoints: 50000,
    },
  },
  {
    target: 750,
    key: "750_referrals",
    reward: {
      leaderRecognition: true,
      referralPoints: 75000,
    },
  },
  {
    target: 1000,
    key: "1000_referrals",
    reward: {
      partnerEligibility: true,
      referralPoints: 100000,
    },
  },
];
async function getUserByPublicId(db, publicId) {
  if (!publicId || typeof publicId !== "string") return null;

  const snap = await db
    .collection("users")
    .where("publicId", "==", publicId)
    .limit(1)
    .get();

  if (snap.empty) return null;

  return snap.docs[0];
}

async function processReferralRewards(uid, db) {

  const userRef = db.doc(`users/${uid}`);
  const snap = await userRef.get();

  if (!snap.exists) return;

  const user = snap.data();

  const validReferrals = user.validReferrals || 0;
 const claimed = [...(user.claimedRewards || [])];

  const updates = {};

  for (const item of REFERRAL_REWARDS) {

    if (
      validReferrals >= item.target &&
      !claimed.includes(item.key)
    ) {

      claimed.push(item.key);

      if (item.reward.freeTournamentTickets) {
        updates.freeTournamentTickets =
          admin.firestore.FieldValue.increment(
            item.reward.freeTournamentTickets
          );
      }

      if (item.reward.referralPoints) {
        updates.referralPoints =
          admin.firestore.FieldValue.increment(
            item.reward.referralPoints
          );
      }

  

      if (item.reward.badge) {
        updates.referralBadge = item.reward.badge;
      }
if (item.reward.profileFrame) {
  updates.profileFrame = item.reward.profileFrame;
}

if (item.reward.ambassadorStatus) {
  updates.ambassadorStatus = item.reward.ambassadorStatus;
}

if (item.reward.leaderRecognition) {
  updates.leaderRecognition = true;
}

if (item.reward.partnerEligibility) {
  updates.partnerEligibility = true;
}
      await db.doc(`users/${uid}/activities/${item.key}`).set({
  id: item.key,
  text: `${item.key} reward unlocked 🎁`,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});
    }
  }

  if (claimed.length !== (user.claimedRewards || []).length) {

    updates.claimedRewards = claimed;

    await userRef.update(updates);
  }
}
/* =========================================================
   1. AUTH TRIGGER → CREATE USER PROFILE
   ========================================================= */
exports.onAuthUserCreate = functions.auth.user().onCreate(async (user) => {
  if (!user) return;

  const db = admin.firestore();

  const counterRef = db.doc("meta/userCounter");
  const userRef = db.doc(`users/${user.uid}`);

  await db.runTransaction(async (tx) => {
    const counterSnap = await tx.get(counterRef);

    let count = 0;

    if (counterSnap.exists) {
      count = counterSnap.data().count || 0;
    }

    count = count + 1;

    tx.set(counterRef, { count }, { merge: true });

    const publicId = `FXA-ID-${String(count).padStart(6, "0")}`;

    tx.set(
      userRef,
      {
        uid: user.uid,
        publicId,
        email: user.email || null,
        phone: user.phoneNumber || null,
        provider: user.providerData?.[0]?.providerId || null,
        referredBy: null,

        referralCount: 0,
      rebuyCostTotal: 0,

        pendingReferrals: 0,
        activeReferrals: 0,
        validReferrals: 0,
        referralPoints: 0,
        referralEarnings: 0,
        coins: 0,

        claimedRewards: [],
        freeTournamentTickets: 0,
referralBadge: null,
        profileCompleted: false,
        verified: false,
        verifiedAt: null,

        createdAt: admin.firestore.FieldValue.serverTimestamp(),

        accounts: {
          demo: { balance: 1000, type: "practice" },
          real: { balance: 0, type: "real" },
          tournaments: {},
        },
      },
      { merge: true }
    );
  });
});

/* =========================================================
   2. FIRESTORE TRIGGER → REFERRALS
   ========================================================= */
exports.onUserDocumentCreate = functions.firestore
  .document("users/{uid}")
  .onCreate(async (snap, context) => {
    const db = admin.firestore();

    const data = snap.data();
    const uid = context.params.uid;

    const referredBy = data?.referredBy;

    if (!referredBy) return;
    if (referredBy === uid) return;
    if (typeof referredBy !== "string") return;

  const refUserSnap = await getUserByPublicId(db, referredBy);

if (!refUserSnap) return;

const refUserRef = refUserSnap.ref;

const activityRef = db.doc(
  `users/${refUserRef.id}/activities/${uid}`
);
    await activityRef.set({
      id: uid,
      text: "New user joined using your link",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const refData = refUserSnap.data();

    if (refData?.referralProcessedBy?.includes(uid)) return;

    await refUserRef.update({
      referralCount: admin.firestore.FieldValue.increment(1),
      pendingReferrals: admin.firestore.FieldValue.increment(1),
      referralProcessedBy: admin.firestore.FieldValue.arrayUnion(uid),
    });
  });

/* =========================================================
   3. TOURNAMENT JOIN → REFERRAL + REWARD
   ========================================================= */
exports.onTournamentJoin = functions.firestore
  .document("tournaments/{tournamentId}/participants/{uid}")
  .onCreate(async (snap, context) => {
    const db = admin.firestore();

    const uid = context.params.uid;
    const data = snap.data();

    const referrerId = data?.referrerId;

    if (!referrerId) return;
   if (referrerId === uid) return;
if (typeof referrerId !== "string") return;

const refUserSnap = await getUserByPublicId(db, referrerId);

if (!refUserSnap) return;

const refUserRef = refUserSnap.ref;

    await refUserRef.update({
      validReferrals: admin.firestore.FieldValue.increment(1),
      activeReferrals: admin.firestore.FieldValue.increment(1),
      referralPoints: admin.firestore.FieldValue.increment(50),
      coins: admin.firestore.FieldValue.increment(50),
    });
// CHECK REFERRAL MILESTONE REWARDS
await processReferralRewards(refUserRef.id, db);


   await db.doc(`users/${refUserRef.id}/activities/${uid}`).set({
      id: uid,
      text: "Referral joined first tournament 🎯",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.doc(`users/${uid}`).update({
      participatedInTournament: true,
      referralStatus: "PARTICIPATED",
    });
  });

/* =========================================================
   4. PLACE TRADE (FIXED CLEAN VERSION)
   ========================================================= */
exports.placeTournamentTrade = functions.https.onCall(async (data, context) => {
  const db = admin.firestore();

  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const { tournamentId, amount, tradeId, entryPrice, direction } = data;

  if (!tournamentId || !amount || amount <= 0 || !tradeId) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid trade");
  }

  const participantRef = db.doc(
    `tournaments/${tournamentId}/participants/${uid}`
  );

  await db.runTransaction(async (tx) => {

    const participantSnap = await tx.get(participantRef);

    if (!participantSnap.exists) {
      throw new functions.https.HttpsError("failed-precondition", "NOT_JOINED");
    }

    const participant = participantSnap.data();
    const balance = participant.balance || 0;

    if (balance < amount) {
      throw new functions.https.HttpsError("resource-exhausted", "NO_FUNDS");
    }

    const newBalance = balance - amount;

    const performance = participant.performance || {
      pnl: 0,
      roi: 0,
      wins: 0,
      losses: 0,
      trades: 0,
      winRate: 0,
    };

    const startingBalance = participant.startingBalance || 0;
    const rebuyInjectedTotal = participant.rebuyInjectedTotal || 0;

    const rankingScore = computeRankingScore(
      newBalance,
      startingBalance,
      rebuyInjectedTotal
    );

    tx.update(participantRef, {
      balance: newBalance,
      performance,
      rankingScore,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const tradeRef = db.doc(`users/${uid}/openTrades/${tradeId}`);

    tx.set(tradeRef, {
      id: tradeId,
      tournamentId,
      amount,
      entryPrice,
      direction,
      openedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { success: true };
});
/* =========================================================
   5. SETTLE TRADE
   ========================================================= */
exports.settleTournamentTrade = functions.https.onCall(async (data, context) => {
  const db = admin.firestore();

  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const { tournamentId, tradeId, result } = data;

  if (!tournamentId || !tradeId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing trade data");
  }

  const tradeRef = db.doc(`users/${uid}/openTrades/${tradeId}`);
  const closedTradeRef = db.doc(`users/${uid}/closedTrades/${tradeId}`);
const participantRef = db.doc(
  `tournaments/${tournamentId}/participants/${uid}`
);

  await db.runTransaction(async (tx) => {
   
    const tradeSnap = await tx.get(tradeRef);

    if (!tradeSnap.exists) {
      throw new functions.https.HttpsError("not-found", "TRADE_NOT_FOUND");
    }

    const trade = tradeSnap.data();

   const participantSnap = await tx.get(participantRef);
const participant = participantSnap.data();

let balance = participant.balance || 0;

const startingBalance = participant.startingBalance || 0;

const rebuyInjectedTotal =
  participant.rebuyInjectedTotal || 0;

const performance = participant.performance || {
  pnl: 0,
  roi: 0,
  wins: 0,
  losses: 0,
  trades: 0,
  winRate: 0,
};
    const isWin = result === "GAIN";
    const payout = isWin ? trade.amount * 1.95 : 0;

    balance = balance + (isWin ? payout : 0);
    const trades = performance.trades + 1;

const wins = performance.wins + (isWin ? 1 : 0);

const losses = performance.losses + (isWin ? 0 : 1);

const pnl = balance - startingBalance;

const roi = startingBalance > 0 ? (pnl / startingBalance) * 100 : 0;
const winRate = trades > 0 ? (wins / trades) * 100 : 0;

 const rankingScore = computeRankingScore(
  balance,
  startingBalance,
  rebuyInjectedTotal
);

// 👇 ADD THIS HERE
tx.update(participantRef, {
  balance,
  performance: {
    pnl,
    roi,
    wins,
    losses,
    trades,
    winRate,
  },
  rankingScore,
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});
    tx.set(closedTradeRef, {
      ...trade,
      result,
      payout,
      settledAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.delete(tradeRef);
  });

  return { success: true };
});
