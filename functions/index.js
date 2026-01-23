const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.onAuthUserCreate = functions.auth.user().onCreate(async (user) => {
  if (!user) return;

  await admin.firestore().doc(`users/${user.uid}`).set({
    uid: user.uid,
    email: user.email || null,
    phone: user.phoneNumber || null,
    provider: user.providerData?.[0]?.providerId || null,

    profileCompleted: false,
    verified: false,
    verifiedAt: null,

    createdAt: admin.firestore.FieldValue.serverTimestamp(),

    accounts: {
      demo: { balance: 1000, type: "practice" },
      real: { balance: 0, type: "real" },
      tournament: { balance: 0, type: "tournament" },
    },
  });
});
