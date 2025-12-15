const admin = require("firebase-admin");

// Load your Firebase Admin SDK private key
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Your UID
const uid = "6c53js6NnbYgEIFBH9T1TD6xDAv2";

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log("🎉 SUCCESS: User is now ADMIN!");
    process.exit();
  })
  .catch((error) => {
    console.error("❌ ERROR:", error);
  });
