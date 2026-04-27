const express = require("express");
const router = express.Router();

const { db } = require("../firebaseAdmin");
const treasuryService = require("../services/treasuryService");
const admin = require("firebase-admin");

// ---------------------------------------------------------------------
// AUTH MIDDLEWARE
// ---------------------------------------------------------------------
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const idToken = authHeader.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);

    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ error: "Invalid token" });
  }
};

// ---------------------------------------------------------------------
// 1️⃣ TOURNAMENT REGISTER (FIXED + CLEAN PARTICIPANT MODEL)
// ---------------------------------------------------------------------
router.post("/register", authenticate, async (req, res) => {
  const userId = req.user.uid;

  try {
    const { tournamentId } = req.body;

    if (!tournamentId) {
      return res.status(400).json({ error: "Missing tournamentId" });
    }

    const userRef = db.collection("users").doc(userId);
    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const participantRef = tournamentRef.collection("participants").doc(userId);

    await db.runTransaction(async (t) => {
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

      // prevent double tournament entry
      if (user.accounts?.activeTournamentId) {
        throw new Error("Already in tournament");
      }

      const entryFee = Number(tournament.entryFee || 0);
      const startingBalance = Number(tournament.startingBalance || 0);

      if ((user.realBalance || 0) < entryFee) {
        throw new Error("Insufficient balance");
      }

      // --------------------------------------------------
      // LOCK USER DURING JOIN
      // --------------------------------------------------
      t.update(userRef, {
        "locks.joiningTournament": true,
        "locks.joiningAt": admin.firestore.FieldValue.serverTimestamp(),
      });

      // --------------------------------------------------
      // DEDUCT ENTRY FEE
      // --------------------------------------------------
      if (entryFee > 0) {
        t.update(userRef, {
          realBalance: admin.firestore.FieldValue.increment(-entryFee),
        });

        t.update(tournamentRef, {
          collectedFunds: admin.firestore.FieldValue.increment(entryFee),
        });
      }

      // --------------------------------------------------
      // SET ACTIVE TOURNAMENT (IMPORTANT FIX)
      // --------------------------------------------------
      t.update(userRef, {
        "accounts.activeTournamentId": tournamentId,
      });

      // --------------------------------------------------
      // CREATE PARTICIPANT (SOURCE OF TRUTH FOR TOURNAMENT)
      // --------------------------------------------------
      t.set(participantRef, {
        userId,
        tournamentId,

        // tournament virtual account
        balance: startingBalance,
        initialBalance: startingBalance,

        rebuyCount: 0,
        status: "active",

        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    // unlock user AFTER transaction
    await db.collection("users").doc(userId).update({
      "locks.joiningTournament": admin.firestore.FieldValue.delete(),
      "locks.joiningAt": admin.firestore.FieldValue.delete(),
    });

    return res.json({
      success: true,
      message: "Joined tournament successfully",
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err.message);

    // safe unlock fallback
    await db.collection("users").doc(userId).update({
      "locks.joiningTournament": admin.firestore.FieldValue.delete(),
      "locks.joiningAt": admin.firestore.FieldValue.delete(),
    });

    return res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------
// 2️⃣ REBUY (FIXED + PARTICIPANT-BASED LOGIC)
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// 2️⃣ REBUY (FIXED + CLEAN SINGLE SOURCE OF TRUTH)
// ---------------------------------------------------------------------
router.post("/rebuy", authenticate, async (req, res) => {
  const userId = req.user.uid;

  try {
    const { tournamentId } = req.body;

    if (!tournamentId) {
      return res.status(400).json({ error: "Missing tournamentId" });
    }

    const participantRef = db
      .collection("tournaments")
      .doc(tournamentId)
      .collection("participants")
      .doc(userId);

    await db.runTransaction(async (t) => {
      const participantSnap = await t.get(participantRef);

      if (!participantSnap.exists) {
        throw new Error("Not registered in tournament");
      }

      const participant = participantSnap.data();

      await treasuryService.processRebuyTransaction(
        t,
        userId,
        tournamentId,
        participant
      );
    });

    return res.json({
      success: true,
      message: "Rebuy successful",
    });

  } catch (err) {
    console.error("REBUY ERROR:", err.message);
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;