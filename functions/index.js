const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
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
        pendingReferrals: 0,
        activeReferrals: 0,
        validReferrals: 0,
        referralPoints: 0,
        referralEarnings: 0,
        coins: 0,

        claimedRewards: [],
        freeTournamentTickets: 0,

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

    const activityRef = db.doc(`users/${referredBy}/activities/${uid}`);

    await activityRef.set({
      id: uid,
      text: "New user joined using your link",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const refUserRef = db.doc(`users/${referredBy}`);
    const refUserSnap = await refUserRef.get();

    if (!refUserSnap.exists) return;

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

    const refUserRef = db.doc(`users/${referrerId}`);
    const refUserSnap = await refUserRef.get();

    if (!refUserSnap.exists) return;

    await refUserRef.update({
      validReferrals: admin.firestore.FieldValue.increment(1),
      activeReferrals: admin.firestore.FieldValue.increment(1),
      referralPoints: admin.firestore.FieldValue.increment(50),
      coins: admin.firestore.FieldValue.increment(50),
    });

    await db.doc(`users/${referrerId}/activities/${uid}`).set({
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
   4. PLACE TRADE
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

  const userRef = db.doc(`users/${uid}`);
  const participantRef = db.doc(
    `tournaments/${tournamentId}/participants/${uid}`
  );

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const participantSnap = await tx.get(participantRef);

    if (!participantSnap.exists) {
      throw new functions.https.HttpsError("failed-precondition", "NOT_JOINED");
    }

    const userData = userSnap.data() || {};
    const balance =
      userData.accounts?.tournaments?.[tournamentId]?.balance || 0;

    if (balance < amount) {
      throw new functions.https.HttpsError("resource-exhausted", "NO_FUNDS");
    }

    tx.update(userRef, {
      [`accounts.tournaments.${tournamentId}.balance`]: balance - amount,
      lastTournamentSync: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.update(participantRef, {
      balance: balance - amount,
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

  const userRef = db.doc(`users/${uid}`);
  const tradeRef = db.doc(`users/${uid}/openTrades/${tradeId}`);
  const closedTradeRef = db.doc(`users/${uid}/closedTrades/${tradeId}`);

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const tradeSnap = await tx.get(tradeRef);

    if (!tradeSnap.exists) {
      throw new functions.https.HttpsError("not-found", "TRADE_NOT_FOUND");
    }

    const trade = tradeSnap.data();

    let balance =
      userSnap.data()?.accounts?.tournaments?.[tournamentId]?.balance || 0;

    const isWin = result === "GAIN";
    const payout = isWin ? trade.amount * 1.95 : 0;

    if (isWin) balance += payout;

    tx.update(userRef, {
      [`accounts.tournaments.${tournamentId}.balance`]: balance,
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