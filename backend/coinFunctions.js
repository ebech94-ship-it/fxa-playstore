
const express = require("express");
const { admin, db } = require("./firebaseAdmin");

const router = express.Router();
const FieldValue = admin.firestore.FieldValue;

function computeRankingScore(balance, startingBalance, rebuyInjectedTotal) {
  return balance - startingBalance - rebuyInjectedTotal;
}

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Login required" });
    }

    const decoded = await admin.auth().verifyIdToken(header.slice(7));
    const userSnap = await db.collection("users").doc(decoded.uid).get();

    if (!userSnap.exists) {
  if (req.path === "/onAuthUserCreate") {
    req.uid = decoded.uid;
    req.authUser = decoded;
    return next();
  }

  return res.status(403).json({ error: "User record not found" });
}

    const user = userSnap.data();

    if (user.frozen || user.deleted) {
      return res.status(403).json({ error: "Account unavailable" });
    }

    req.uid = decoded.uid;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid Firebase token" });
  }
}

router.use(authenticate);

// PLACE TOURNAMENT TRADE
router.post("/placeTournamentTrade", async (req, res) => {
  try {
    const { tournamentId, amount, tradeId, entryPrice, direction } = req.body;

    if (
      typeof tournamentId !== "string" ||
      !tournamentId.trim() ||
      typeof tradeId !== "string" ||
      !tradeId.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isFinite(entryPrice) ||
      !["BUY", "SELL", "LONG", "SHORT"].includes(direction)
    ) {
      return res.status(400).json({ error: "Invalid trade data" });
    }

    const uid = req.uid;
    const participantRef = db.doc(
      `tournaments/${tournamentId}/participants/${uid}`
    );
    const tradeRef = db.doc(`users/${uid}/openTrades/${tradeId}`);
    const closedTradeRef = db.doc(`users/${uid}/closedTrades/${tradeId}`);

    await db.runTransaction(async (tx) => {
      const participantSnap = await tx.get(participantRef);
      const openSnap = await tx.get(tradeRef);
      const closedSnap = await tx.get(closedTradeRef);

      if (!participantSnap.exists) throw new Error("NOT_JOINED");
      if (openSnap.exists || closedSnap.exists) throw new Error("TRADE_ID_USED");

      const participant = participantSnap.data();
      const balance = Number(participant.balance || 0);

      if (balance < amount) throw new Error("NO_FUNDS");

      const startingBalance = Number(participant.startingBalance || 0);
      const rebuyInjectedTotal = Number(participant.rebuyInjectedTotal || 0);
      const newBalance = balance - amount;

      tx.update(participantRef, {
        balance: newBalance,
        performance: participant.performance || {
          pnl: 0, roi: 0, wins: 0, losses: 0, trades: 0, winRate: 0,
        },
        rankingScore: computeRankingScore(
          newBalance, startingBalance, rebuyInjectedTotal
        ),
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.create(tradeRef, {
        id: tradeId,
        tournamentId,
        amount,
        entryPrice,
        direction,
        openedAt: FieldValue.serverTimestamp(),
      });
    });

    return res.json({ success: true });
  } catch (error) {
    const known = {
      NOT_JOINED: [403, "You have not joined this tournament"],
      NO_FUNDS: [400, "Insufficient tournament balance"],
      TRADE_ID_USED: [409, "This trade ID has already been used"],
    };

    const result = known[error.message];
    return res.status(result ? result[0] : 500).json({
      error: result ? result[1] : "Could not place trade",
    });
  }
});

// SETTLE TOURNAMENT TRADE
router.post("/settleTournamentTrade", async (req, res) => {
  try {
    const { tournamentId, tradeId, result } = req.body;

    if (
      typeof tournamentId !== "string" ||
      !tournamentId.trim() ||
      typeof tradeId !== "string" ||
      !tradeId.trim() ||
      !["GAIN", "LOSS"].includes(result)
    ) {
      return res.status(400).json({ error: "Invalid settlement data" });
    }

    const uid = req.uid;
    const tradeRef = db.doc(`users/${uid}/openTrades/${tradeId}`);
    const closedTradeRef = db.doc(`users/${uid}/closedTrades/${tradeId}`);
    const participantRef = db.doc(
      `tournaments/${tournamentId}/participants/${uid}`
    );

    await db.runTransaction(async (tx) => {
      const tradeSnap = await tx.get(tradeRef);
      const closedSnap = await tx.get(closedTradeRef);
      const participantSnap = await tx.get(participantRef);

      if (!tradeSnap.exists) throw new Error("TRADE_NOT_FOUND");
      if (closedSnap.exists) throw new Error("TRADE_ALREADY_SETTLED");
      if (!participantSnap.exists) throw new Error("NOT_JOINED");

      const trade = tradeSnap.data();

      if (trade.tournamentId !== tournamentId) {
        throw new Error("TOURNAMENT_MISMATCH");
      }

      const participant = participantSnap.data();
      const startingBalance = Number(participant.startingBalance || 0);
      const rebuyInjectedTotal = Number(participant.rebuyInjectedTotal || 0);
      const performance = participant.performance || {
        pnl: 0, roi: 0, wins: 0, losses: 0, trades: 0, winRate: 0,
      };

      const isWin = result === "GAIN";
      const payout = isWin ? Number(trade.amount) * 1.95 : 0;
      const balance = Number(participant.balance || 0) + payout;
      const trades = Number(performance.trades || 0) + 1;
      const wins = Number(performance.wins || 0) + (isWin ? 1 : 0);
      const losses = Number(performance.losses || 0) + (isWin ? 0 : 1);
      const pnl = balance - startingBalance;

      tx.update(participantRef, {
        balance,
        performance: {
          pnl,
          roi: startingBalance > 0 ? (pnl / startingBalance) * 100 : 0,
          wins,
          losses,
          trades,
          winRate: (wins / trades) * 100,
        },
        rankingScore: computeRankingScore(
          balance, startingBalance, rebuyInjectedTotal
        ),
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.create(closedTradeRef, {
        ...trade,
        result,
        payout,
        settledAt: FieldValue.serverTimestamp(),
      });

      tx.delete(tradeRef);
    });

    return res.json({ success: true });
  } catch (error) {
    const known = {
      TRADE_NOT_FOUND: [404, "Trade not found"],
      TRADE_ALREADY_SETTLED: [409, "Trade already settled"],
      NOT_JOINED: [403, "Tournament participant not found"],
      TOURNAMENT_MISMATCH: [400, "Tournament mismatch"],
    };

    const result = known[error.message];
    return res.status(result ? result[0] : 500).json({
      error: result ? result[1] : "Could not settle trade",
    });
  }
});

const REFERRAL_REWARDS = [
  { target: 3, key: "3_referrals", reward: { freeTournamentTickets: 1, referralPoints: 100 } },
  { target: 5, key: "5_referrals", reward: { walletBonus: 5, referralPoints: 250 } },
  { target: 10, key: "10_referrals", reward: { badge: "Bronze", referralPoints: 400 } },
  { target: 15, key: "15_referrals", reward: { freeTournamentTickets: 2, referralPoints: 600 } },
  { target: 20, key: "20_referrals", reward: { badge: "Silver", referralPoints: 900 } },
  { target: 30, key: "30_referrals", reward: { walletBonus: 10, referralPoints: 1500 } },
  { target: 50, key: "50_referrals", reward: { badge: "VIP", referralPoints: 2000 } },
  { target: 75, key: "75_referrals", reward: { profileFrame: "Premium", referralPoints: 3500 } },
  { target: 100, key: "100_referrals", reward: { badge: "Gold", referralPoints: 5000 } },
  { target: 150, key: "150_referrals", reward: { walletBonus: 15, referralPoints: 10000 } },
  { target: 250, key: "250_referrals", reward: { ambassadorStatus: "Elite Ambassador", referralPoints: 15000 } },
  { target: 500, key: "500_referrals", reward: { ambassadorStatus: "GodSpeed Ambassador", referralPoints: 50000 } },
  { target: 750, key: "750_referrals", reward: { leaderRecognition: true, referralPoints: 75000 } },
  { target: 1000, key: "1000_referrals", reward: { partnerEligibility: true, referralPoints: 100000 } },
];

async function findUserByPublicId(publicId) {
  if (typeof publicId !== "string" || !publicId.trim()) return null;

  const snap = await db.collection("users")
    .where("publicId", "==", publicId.trim())
    .limit(1)
    .get();

  return snap.empty ? null : snap.docs[0];
}

// Process registration referral once only.
async function processRegistrationReferral(uid) {
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();

  if (!userSnap.exists) return;

  const user = userSnap.data();
  const referredBy = user.referredBy;

  if (!referredBy || typeof referredBy !== "string") return;

  const referrer = await findUserByPublicId(referredBy);
  if (!referrer || referrer.id === uid) return;

  const referrerRef = referrer.ref;
  const activityRef = db.doc(`users/${referrer.id}/activities/${uid}`);

  await db.runTransaction(async (tx) => {
    const refSnap = await tx.get(referrerRef);
    if (!refSnap.exists) return;

    const refData = refSnap.data();
    const processed = refData.referralProcessedBy || [];

    if (processed.includes(uid)) return;

    tx.update(referrerRef, {
      referralCount: Number(refData.referralCount || 0) + 1,
      pendingReferrals: Number(refData.pendingReferrals || 0) + 1,
      referralProcessedBy: FieldValue.arrayUnion(uid),
    });

    tx.set(activityRef, {
      id: uid,
      text: "New user joined using your link",
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

// Replacement for Firebase Auth onCreate trigger.

router.post("/onAuthUserCreate", async (req, res) => {
  try {
    const uid = req.uid;
    const authUser = await admin.auth().getUser(uid);
    const userRef = db.doc(`users/${uid}`);
    const counterRef = db.doc("meta/userCounter");

    const requestedReferral =
      typeof req.body?.referredBy === "string"
        ? req.body.referredBy.trim()
        : "";

    const requestedName =
      typeof req.body?.displayName === "string"
        ? req.body.displayName.trim()
        : "";

    const requestedPhone =
      typeof req.body?.phone === "string"
        ? req.body.phone.trim()
        : "";

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const counterSnap = await tx.get(counterRef);

      const existing = userSnap.exists ? userSnap.data() : {};
      let publicId = existing.publicId;

      if (!publicId) {
        const count =
          Number(
            counterSnap.exists
              ? counterSnap.data().count || 0
              : 0
          ) + 1;

        publicId = `FXA-ID-${String(count).padStart(6, "0")}`;
        tx.set(counterRef, { count }, { merge: true });
      }

      const profile = {
        uid,
        publicId,
        email: authUser.email || existing.email || null,
        phone:
          authUser.phoneNumber ||
          existing.phone ||
          requestedPhone ||
          null,
        displayName:
          requestedName ||
          existing.displayName ||
          authUser.displayName ||
          null,
        provider:
          authUser.providerData?.[0]?.providerId ||
          existing.provider ||
          null,
      };

      if (!userSnap.exists) {
        Object.assign(profile, {
          referredBy: requestedReferral || null,
          referralCount: 0,
          pendingReferrals: 0,
          activeReferrals: 0,
          validReferrals: 0,
          referralPoints: 0,
          referralEarnings: 0,
          rebuyCostTotal: 0,
          coins: 0,
          claimedRewards: [],
          freeTournamentTickets: 0,
          referralBadge: null,
          profileCompleted: false,
          verified: false,
          verifiedAt: null,
          createdAt: FieldValue.serverTimestamp(),
          accounts: {
            demo: { balance: 1000, type: "practice" },
            real: { balance: 0, type: "coins" },
            tournaments: {},
          },
        });
      } else if (!existing.referredBy && requestedReferral) {
        profile.referredBy = requestedReferral;
      }

      // Firebase-confirmed phone numbers are verified.
      if (authUser.phoneNumber) {
        profile.verified = true;
        profile.verifiedAt =
          existing.verifiedAt || FieldValue.serverTimestamp();
      }

      tx.set(userRef, profile, { merge: true });
    });

    await processRegistrationReferral(uid);

    return res.json({ success: true });
  } catch (error) {
    console.error("onAuthUserCreate:", error);
    return res.status(500).json({
      error: "Could not create user profile",
    });
  }
});


// Replacement for the Firestore user-document creation trigger.
// Safe to call again: referralProcessedBy prevents duplicate counting.
router.post("/onUserDocumentCreate", async (req, res) => {
  try {
    await processRegistrationReferral(req.uid);
    return res.json({ success: true });
  } catch (error) {
    console.error("onUserDocumentCreate:", error);
    return res.status(500).json({ error: "Could not process referral" });
  }
});

// Replacement for the tournament participant creation trigger.
router.post("/onTournamentJoin", async (req, res) => {
  try {
    const uid = req.uid;
    const { tournamentId } = req.body || {};

    if (typeof tournamentId !== "string" || !tournamentId.trim()) {
      return res.status(400).json({ error: "Invalid tournamentId" });
    }

    const participantRef = db.doc(
      `tournaments/${tournamentId}/participants/${uid}`
    );
    const userRef = db.doc(`users/${uid}`);

    const participantSnap = await participantRef.get();

    if (!participantSnap.exists) {
      return res.status(404).json({ error: "Tournament participant not found" });
    }

    const referrerId = participantSnap.data().referrerId;
    const referrer = await findUserByPublicId(referrerId);

    // No valid referrer: still record the user's tournament participation.
    if (!referrer || referrer.id === uid) {
      await userRef.set({
        participatedInTournament: true,
        referralStatus: "PARTICIPATED",
      }, { merge: true });

      return res.json({ success: true, referralRewarded: false });
    }

    const referrerRef = referrer.ref;
    const activityRef = db.doc(
      `users/${referrer.id}/activities/${uid}`
    );

    let alreadyProcessed = false;

    await db.runTransaction(async (tx) => {
      const participant = await tx.get(participantRef);
      const refSnap = await tx.get(referrerRef);
      const joiningUser = await tx.get(userRef);

      if (!participant.exists) throw new Error("PARTICIPANT_MISSING");
      if (!refSnap.exists) throw new Error("REFERRER_MISSING");

      const participantData = participant.data();

      if (participantData.referralRewardProcessed === true) {
        alreadyProcessed = true;
        return;
      }

      const refData = refSnap.data();
      const newValid = Number(refData.validReferrals || 0) + 1;
      const claimed = [...(refData.claimedRewards || [])];

      let bonusCoins = 50;
      let bonusPoints = 50;
      let bonusTickets = 0;
      const updates = {};

      for (const item of REFERRAL_REWARDS) {
        if (newValid < item.target || claimed.includes(item.key)) continue;

        claimed.push(item.key);
        bonusCoins += Number(item.reward.walletBonus || 0);
        bonusPoints += Number(item.reward.referralPoints || 0);
        bonusTickets += Number(item.reward.freeTournamentTickets || 0);

        if (item.reward.badge) updates.referralBadge = item.reward.badge;
        if (item.reward.profileFrame) updates.profileFrame = item.reward.profileFrame;
        if (item.reward.ambassadorStatus) updates.ambassadorStatus = item.reward.ambassadorStatus;
        if (item.reward.leaderRecognition) updates.leaderRecognition = true;
        if (item.reward.partnerEligibility) updates.partnerEligibility = true;

        tx.set(db.doc(`users/${referrer.id}/activities/${item.key}`), {
          id: item.key,
          text: `${item.key} reward unlocked 🎁`,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      tx.update(referrerRef, {
        ...updates,
        validReferrals: newValid,
        activeReferrals: Number(refData.activeReferrals || 0) + 1,
        referralPoints: Number(refData.referralPoints || 0) + bonusPoints,
        coins: Number(refData.coins || 0) + bonusCoins,
        freeTournamentTickets:
          Number(refData.freeTournamentTickets || 0) + bonusTickets,
        claimedRewards: claimed,
      });

      tx.update(participantRef, {
        referralRewardProcessed: true,
      });

      tx.set(userRef, {
        participatedInTournament: true,
        referralStatus: "PARTICIPATED",
      }, { merge: true });

      tx.set(activityRef, {
        id: uid,
        text: "Referral joined first tournament 🎯",
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return res.json({
      success: true,
      referralRewarded: !alreadyProcessed,
    });
  } catch (error) {
    console.error("onTournamentJoin:", error);
    return res.status(500).json({ error: "Could not process tournament referral" });
  }
});

module.exports = router;
