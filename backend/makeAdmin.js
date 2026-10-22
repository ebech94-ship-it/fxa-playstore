
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { admin, db } = require("./firebaseAdmin");

const ADMIN_UID = "SlmTRqXqTohab50QTEZmPFscnum2";

async function makeAdmin() {
  try {
    const user = await admin.auth().getUser(ADMIN_UID);
    console.log("Account:", user.email || user.uid);

    await admin.auth().setCustomUserClaims(ADMIN_UID, {
      ...(user.customClaims || {}),
      admin: true,
    });

    const userRef = db.collection("users").doc(ADMIN_UID);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      await userRef.set({
        uid: ADMIN_UID,
        email: user.email || "",
        role: "admin",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log("Created Coins Firestore user document.");
    } else {
      console.log("Coins Firestore user document already exists.");
    }

    console.log("SUCCESS: Admin configured for fxa-playstore.");
  } catch (error) {
    console.error("FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

makeAdmin();
