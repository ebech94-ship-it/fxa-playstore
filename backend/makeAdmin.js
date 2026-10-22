
require("dotenv").config();
const { admin, db } = require("./firebaseAdmin");

const ADMIN_UID = "4l7iIqhblyPYEt1gryFe0Zt19b52";

async function makeAdmin() {
  try {
    // Confirm the account exists in the Coins Firebase project.
    const user = await admin.auth().getUser(ADMIN_UID);
    console.log("Account:", user.email || user.uid);

    // Preserve any existing custom claims.
    await admin.auth().setCustomUserClaims(ADMIN_UID, {
      ...(user.customClaims || {}),
      admin: true,
    });

    // Confirm the user's Coins Firestore record exists.
    const userDoc = await db.collection("users").doc(ADMIN_UID).get();

    if (!userDoc.exists) {
      console.log("WARNING: No users document exists for this UID.");
    }

    console.log("SUCCESS: Admin claim assigned in fxa-playstore.");
  } catch (error) {
    console.error("FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

makeAdmin();
