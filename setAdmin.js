const admin = require("firebase-admin");

// Load your Firebase Admin SDK private key
const serviceAccount = require("./backend/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// 👇 LIST OF ADMINS
const adminUIDs = [
  
  "Kts84GS92lfV8s6J2tESjBeecQL2",
  "4l7iIqhblyPYEt1gryFe0Zt19b52",
];

async function makeAdmins() {
  for (const uid of adminUIDs) {
    try {
      await admin.auth().setCustomUserClaims(uid, { admin: true });
      console.log(`🎉 SUCCESS: ${uid} is now ADMIN`);
    } catch (error) {
      console.error(`❌ ERROR for ${uid}:`, error);
    }
  }
  process.exit();
}

makeAdmins();
