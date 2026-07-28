const admin = require("firebase-admin");

const serviceAccount = require("./backend/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function createAdminDoc() {
  await db.collection("admins")
    .doc("4l7iIqhblyPYEt1gryFe0Zt19b52")
    .set({
      role: "admin"
    });

  console.log("Firestore admin created");
  process.exit();
}

createAdminDoc();