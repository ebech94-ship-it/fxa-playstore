const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

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

    let count = 1;

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

    // SAFETY CHECKS
  // SAFETY CHECKS
if (!referredBy) return;
if (referredBy === uid) return;
if (typeof referredBy !== "string") return;

const activityRef = db.doc(`users/${referredBy}/activities/${uid}`);

await activityRef.set({
  id: uid,
  text: `New user joined using your link`,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});
    const refUserRef = db.doc(`users/${referredBy}`);
    const refUserSnap = await refUserRef.get();

    if (!refUserSnap.exists) return;

    const refData = refUserSnap.data();

    // PREVENT DOUBLE REFERRAL PROCESSING
    if (refData?.referralProcessedBy?.includes(uid)) return;

    await refUserRef.update({
      referralCount: admin.firestore.FieldValue.increment(1),
      pendingReferrals: admin.firestore.FieldValue.increment(1),

      referralProcessedBy:
        admin.firestore.FieldValue.arrayUnion(uid),
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
    const participantData = snap.data();

    if (!participantData) return;

    const referrerId = participantData.referrerId;

    // SAFETY CHECKS
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
  text: `Referral joined first tournament 🎯`,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});

    await db.doc(`users/${uid}`).update({
      participatedInTournament: true,
      referralStatus: "PARTICIPATED",
    });
  });

/* =========================================================
   4. TOURNAMENT TRADE (USER DOC AS SOURCE OF TRUTH)
========================================================= */

exports.placeTournamentTrade = functions.https.onCall(
  async (data, context) => {
    const db = admin.firestore();

    const uid = context.auth?.uid;

    if (!uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login required"
      );
    }

    const { tournamentId, amount } = data;

    if (!tournamentId || !amount || amount <= 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid trade data"
      );
    }

    const userRef = db.doc(`users/${uid}`);
    const participantRef = db.doc(
      `tournaments/${tournamentId}/participants/${uid}`
    );

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const participantSnap = await tx.get(participantRef);

      if (!participantSnap.exists) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "NOT_JOINED_TOURNAMENT"
        );
      }

      if (!userSnap.exists) {
  throw new functions.https.HttpsError(
    "failed-precondition",
    "USER_DOC_NOT_FOUND"
  );
}

const userData = userSnap.data() || {};

const balance =
  userData.accounts?.tournaments?.[tournamentId]?.balance || 0;

      if (balance < amount) {
        throw new functions.https.HttpsError(
          "resource-exhausted",
          "INSUFFICIENT_BALANCE"
        );
      }

      const newBalance = balance - amount;

      // update USER DOC (source of truth)
      tx.update(userRef, {
        [`accounts.tournaments.${tournamentId}.balance`]: newBalance,
        lastTournamentSync: admin.firestore.FieldValue.serverTimestamp(),
      });

      // optional: keep participant in sync for queries/UI
      tx.update(participantRef, {
        balance: newBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return { success: true };
  }
);

/* =========================================================
   SETTLE TOURNAMENT TRADE (USER DOC AS SOURCE OF TRUTH)
========================================================= */

exports.settleTournamentTrade = functions.https.onCall(
  async (data, context) => {
    const db = admin.firestore();

    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login required"
      );
    }

    const { tournamentId, tradeId, result, closePrice } = data;

    if (!tournamentId || !tradeId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing trade data"
      );
    }

    const userRef = db.doc(`users/${uid}`);

    const participantRef = db.doc(
      `tournaments/${tournamentId}/participants/${uid}`
    );

    const tradeRef = db.doc(
      `tournaments/${tournamentId}/participants/${uid}/closedTrades/${tradeId}`
    );

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const participantSnap = await tx.get(participantRef);

      if (!participantSnap.exists) {
        throw new functions.https.HttpsError(
  "failed-precondition",
  "PARTICIPANT_NOT_FOUND"
);
      }
if (!userSnap.exists) {
  throw new functions.https.HttpsError(
    "failed-precondition",
    "USER_DOC_NOT_FOUND"
  );
}

const userData = userSnap.data() || {};

      let balance =
        userData?.accounts?.tournaments?.[tournamentId]?.balance || 0;

      // ONLY TRUST SERVER DECISION (result), NOT CLIENT PAYOUT
      const tradeSnap = await tx.get(tradeRef);

if (!tradeSnap.exists) {
  throw new functions.https.HttpsError(
    "not-found",
    "TRADE_NOT_FOUND"
  );
}

const trade = tradeSnap.data() || {};

const amount = trade.amount || 0;
const payout = result === "GAIN" ? amount * 1.95 : 0;

if (result === "GAIN") {
  balance += payout;
}

      if (result === "LOSS") {
        balance -= 0; // already deducted at entry
      }

      // update USER DOC (source of truth)
      tx.update(userRef, {
        [`accounts.tournaments.${tournamentId}.balance`]: balance,
        lastTournamentSync: admin.firestore.FieldValue.serverTimestamp(),
      });

      // keep participant doc in sync (UI/read optimization)
      tx.update(participantRef, {
        balance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.set(tradeRef, {
        result,
        payout,
        closePrice,
        settledAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return { success: true };
  }
);