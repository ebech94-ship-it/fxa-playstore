const express = require("express");
const router = express.Router();
const { db } = require("../firebaseAdmin");
const admin = require("firebase-admin");
const fetch = require("node-fetch");


const { XAF_TO_USD, BASE_CURRENCY } = require("../config/currency");
// ----------------------
// FIREBASE AUTH FOR PAYOUT
// ----------------------
const authenticate = async (req, res, next) => {

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "No Firebase token provided"
    });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {

    const decodedToken =
      await admin.auth().verifyIdToken(idToken);

    req.user = decodedToken;

    console.log("🔥 PAYOUT AUTH USER:", {
      uid: decodedToken.uid,
      email: decodedToken.email || "NO_EMAIL",
      phone: decodedToken.phone_number || "NO_PHONE"
    });

    next();

  } catch (err) {

    console.error(
      "PAYOUT AUTH ERROR:",
      err.message
    );

    return res.status(401).json({
      error: "Invalid Firebase token"
    });
  }
};
// ----------------------
// TOKEN CACHE (PAYOUT)
// ----------------------
let payoutToken = null;
let tokenExpiry = null;

async function getPayoutToken() {
  if (payoutToken && tokenExpiry && Date.now() < tokenExpiry - 120000) {
    return payoutToken;
  }

  const response = await fetch("https://api.accountpe.com/api/payout/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.SWYCHR_EMAIL,
      password: process.env.SWYCHR_PASSWORD,
    }),
  });

  if (!response.ok) {
  const errorText = await response.text();
  console.error("❌ Payout auth failed:", errorText);
  throw new Error("Payout auth failed");
}

const data = await response.json();

if (!data.token) {
  console.error("❌ No payout token received");
  throw new Error("Failed to get payout token");
}

  payoutToken = data.token;
  tokenExpiry = Date.now() + 55 * 60 * 1000;

  return payoutToken;
}
// ----------------------
// GET ACCOUNTPE PAYOUT METHOD ID
// ----------------------
async function getPayoutMethodId(country_code, methodName){

  const token = await getPayoutToken();

  const response = await fetch(
    "https://api.accountpe.com/api/payout/payout_methods",
    {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        Authorization:`Bearer ${token}`
      },
      body:JSON.stringify({
        country_code
      })
    }
  );

  const data = await response.json();

  console.log(
    "========== AVAILABLE PAYOUT METHODS =========="
  );
  console.log(JSON.stringify(data,null,2));


  const methods =
    data?.data?.payment_methods || [];


  const method =
    methods.find(
      m =>
      m.payment_method &&
      m.payment_method.toLowerCase()
      === methodName.toLowerCase()
    );


  if(!method){

    throw new Error(
      `Payout method ${methodName} not found for ${country_code}`
    );
  }


  return method.payment_method;
}
// ----------------------
// FRONTEND COMPATIBILITY ROUTE
// ----------------------
router.post("/create-request", async (req, res, next) => {
  req.url = "/";
  return router.handle(req, res, next);
});

// ----------------------
// CREATE PAYOUT
// ----------------------
router.post("/", authenticate, async (req, res) => {
console.log("🔥 WITHDRAW ROUTE HIT");
console.log("📌 BODY:", req.body);
console.log("👤 PAYOUT USER:", {
  uid: req.user?.uid,
  email: req.user?.email || "NO_EMAIL",
  phone: req.user?.phone_number || "NO_PHONE"
});
  let transactionId;

  try {
  const {
      beneficiary_name,
      mobile_no,
      amount,
      payment_method,
      bank_code,
      account_number,
      remarks,
      country_code
    } = req.body;

    if (!beneficiary_name || !mobile_no || !amount || !payment_method || !country_code) {
      return res.status(400).json({ error: "Missing required fields" });
    }

const accountpeMethod =
await getPayoutMethodId(
  country_code,
  payment_method
);

const uid = req.user.uid;
 
const formattedMobile =
mobile_no.startsWith("+237")
? mobile_no
: "+237"+mobile_no;

    const userRef = db.collection("users").doc(uid);

    // 💰 AMOUNT LOGIC
    const withdrawalUSD = Number(amount);

    if (!withdrawalUSD || withdrawalUSD <= 0) {
      throw new Error("INVALID_AMOUNT");
    }

    if (withdrawalUSD < 1) {
      throw new Error("MIN_WITHDRAWAL_1_USD");
    }

    // 🔄 CONVERSION
    const grossXAF = Math.round(withdrawalUSD * XAF_TO_USD);

    const feeUSD = Number((withdrawalUSD * 0.01).toFixed(2)); // 1%
    const feeXAF = Math.round(feeUSD * XAF_TO_USD);

    const netXAF = grossXAF - feeXAF;

    // 🆔 TRANSACTION ID
 transactionId = `PAYOUT_${Date.now()}_${Math.random()
.toString(36)
.substring(2, 8)
.toUpperCase()}`;

    // 🚫 PREVENT DUPLICATE PROCESSING (MOVED UP - SAFE)
   const existing = await db
  .collection("payouts")
  .where("userId", "==", uid)
  .where("status", "in", ["pending", "processing"])
  .limit(1)
  .get();

console.log("📌 Existing processing payouts:", existing.size);

if (!existing.empty) {
  console.log("📌 Existing payout document:", existing.docs[0].id);
  console.log("📌 Existing payout data:", existing.docs[0].data());

  throw new Error("PAYOUT_ALREADY_PROCESSING");
}
    // ----------------------
    // FIRESTORE TRANSACTION FIRST (LOCK FUNDS)
    // ----------------------
    let payoutRef;

    await db.runTransaction(async (t) => {
      const userSnap = await t.get(userRef);

  if (!userSnap.exists) {
    throw new Error("USER_NOT_FOUND");
  }
      const balance = userSnap.data()?.accounts?.real?.balance || 0;

      if (balance < withdrawalUSD) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      // 🔒 Deduct user balance
      t.update(userRef, {
  "accounts.real.balance": admin.firestore.FieldValue.increment(-withdrawalUSD),
});

      // 🧾 Create payout (LOCKED STATE)
      payoutRef = db.collection("payouts").doc(transactionId);

      t.set(payoutRef, {
        userId: uid,
        transactionId,

        amount: withdrawalUSD,
        fee: feeUSD,
        netAmount: withdrawalUSD - feeUSD,
        
         currency: BASE_CURRENCY, 
        payoutAmount: netXAF,
        payoutCurrency: "XAF",

        beneficiary_name,
        mobile_no: formattedMobile,
       
payment_method,
accountpeMethod,

 // ✅ ADD THESE (IMPORTANT)
  country_code,
  bank_code,
  account_number,
  remarks,

        status: "pending",
        retryCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        processedWebhook:false,
      });

      // 💰 Treasury update
      const treasuryRef = db.collection("treasury").doc("main");

      t.set(
        treasuryRef,
        {
          balance: admin.firestore.FieldValue.increment(feeUSD),
          totalFees: admin.firestore.FieldValue.increment(feeUSD),
          lastUpdated:admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // 🧾 Audit log
      const auditRef = db.collection("withdrawalFees").doc(transactionId);

      t.set(auditRef, {
        type: "withdrawal_fee",
        amount: feeUSD,
        currency: "USD",
        userId: uid,
        transactionId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
console.log("✅ Firestore transaction committed successfully.");
    // 🔑 GET TOKEN (MOVED AFTER LOCK)
  // 🔑 GET TOKEN
const token = await getPayoutToken();

// 🌐 CREATE PAYOUT
const response = await fetch(
  "https://api.accountpe.com/api/payout/create_transaction",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": transactionId,
    },
    body: JSON.stringify({
      country_code,
      beneficiary_name,
      mobile_no: formattedMobile,
      amount: netXAF,
      transaction_id: transactionId,
       payment_method: accountpeMethod,
      remarks: remarks || "",
      bank_code,
      account_number,
    }),
  }
);

const payoutData = await response.json();

console.log("========== SWYCHR PAYOUT ==========");
console.log(JSON.stringify(payoutData, null, 2));
console.log("===================================");

 // -------------------------------------------------
// PROVIDER REJECTED REQUEST
// -------------------------------------------------
if (
 !response.ok ||
 Number(payoutData?.status) !== 200) {

  await payoutRef.update({
    status: "failed",
    payoutResponse: payoutData,
    failedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.runTransaction(async (t) => {

    t.update(userRef, {
      "accounts.real.balance":
        admin.firestore.FieldValue.increment(withdrawalUSD),
    });

    const treasuryRef = db.collection("treasury").doc("main");

    t.set(
      treasuryRef,
      {
        balance: admin.firestore.FieldValue.increment(-feeUSD),
        totalFees: admin.firestore.FieldValue.increment(-feeUSD),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  });

  return res.status(400).json({
    success: false,
    error: payoutData?.message || "Provider rejected payout",
  });
}

// -------------------------------------------------
// PROVIDER ACCEPTED REQUEST
// -------------------------------------------------

await payoutRef.update({
  status: "processing",
  payoutResponse: payoutData,
  providerAcceptedAt:
    admin.firestore.FieldValue.serverTimestamp(),
});

return res.json({
  success: true,
  transactionId,
  message: "Withdrawal submitted successfully",
});
 

  } catch (error) {
    if (error.message === "INSUFFICIENT_BALANCE") {
      return res.status(400).json({ error: "Insufficient balance" });
    }
if (error.message === "PAYOUT_ALREADY_PROCESSING") {
  return res.status(400).json({
    error: "You already have a withdrawal being processed."
  });
}
if (error.message === "MIN_WITHDRAWAL_1_USD") {
  return res.status(400).json({
    error: "Minimum withdrawal is 1 USD."
  });
}
   
    console.error("Payout error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ----------------------
// WEBHOOK (SECURED)
// ----------------------
// ----------------------
// WEBHOOK (PRODUCTION SAFE + PAYIN STYLE)
// ----------------------
router.post("/webhook", async (req, res) => {

  console.log("🔥🔥🔥 SWYCHR WEBHOOK HIT 🔥🔥🔥");
  console.log("Time:", new Date().toISOString());
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Body:", JSON.stringify(req.body, null, 2));

  try {
    const signature =
  req.headers["x-swychr-signature"] ||
  req.headers["webhook-hash"];

console.log("Received Signature:", signature);
console.log("Expected Signature:", process.env.SWYCHR_WEBHOOK_SECRET);
    // ----------------------
    // VERIFY SIGNATURE
    // ----------------------
    if (process.env.SWYCHR_WEBHOOK_SECRET) {

      if (signature !== process.env.SWYCHR_WEBHOOK_SECRET) {

        await db.collection("webhook_logs").add({
          type: "invalid_signature",
          rawPayload: req.body,
          receivedAt:
            admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(401).json({
          error:"Unauthorized"
        });
      }
    }


    const payload = req.body;


    // ----------------------
    // EXTRACT DATA
    // ----------------------
    if (!payload?.data?.data?.attributes) {

      await db.collection("webhook_logs").add({
        type:"invalid_payload",
        rawPayload:payload,
        receivedAt:
          admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({
        received:true
      });
    }


    const {
      status,
      transaction_id,
      amount
    } = payload.data.data.attributes;


    console.log("========== PAYOUT ATTRIBUTES ==========");
    console.log({
      status,
      transaction_id,
      amount
    });
    console.log("======================================");


    if (!transaction_id) {

      return res.status(200).json({
        received:true
      });

    }


    // ----------------------
    // MAP PROVIDER STATUS
    // SAME STYLE AS PAYIN
    // ----------------------

    const providerStatus = Number(status);

    const mappedStatus =
  providerStatus === 0 ? "pending" :
  providerStatus === 1 ? "completed" :
  providerStatus === 2 ? "failed" :
  providerStatus === 3 ? "expired" :
  providerStatus === 4 ? "processing" :
  providerStatus === 5 ? "declined" :
  providerStatus === 6 ? "rejected" :
  "unknown";

console.log("Provider Status:", providerStatus);
console.log("Mapped Status:", mappedStatus);
    console.log("🔥 PAYOUT STATUS:", {
      transaction_id,
      mappedStatus
    });



    // ----------------------
    // FIND PAYOUT
    // ----------------------

    const snapshot = await db
      .collection("payouts")
      .where("transactionId","==",transaction_id)
      .limit(1)
      .get();


    if(snapshot.empty){

      await db.collection("webhook_logs").add({
        type:"payout_not_found",
        transactionId:transaction_id,
        receivedAt:
          admin.firestore.FieldValue.serverTimestamp(),
      });


      return res.status(200).json({
        received:true
      });
    }


    const payoutRef = snapshot.docs[0].ref;



    // ----------------------
    // PENDING / PROCESSING
    // ----------------------

    if(
      mappedStatus === "pending" ||
      mappedStatus === "processing"
    ){

      await payoutRef.update({

        status:mappedStatus,

        lastUpdated:
          admin.firestore.FieldValue.serverTimestamp(),

      });


      return res.status(200).json({
        received:true
      });
    }



    // ----------------------
    // COMPLETED PAYOUT
    // ----------------------

    if(mappedStatus === "completed"){


      await db.runTransaction(async(t)=>{


        const snap = await t.get(payoutRef);

        const payout = snap.data();


        if(!payout) {
          throw new Error("Payout missing");
        }


        if(
          payout.status === "completed" ||
          payout.processedWebhook
        ){

          return;
        }



        const userRef =
          db.collection("users")
          .doc(payout.userId);



        const userSnap =
          await t.get(userRef);



        const user=userSnap.data();



        const beforeBalance =
          user?.accounts?.real?.balance || 0;



        // UPDATE PAYOUT

        t.update(payoutRef,{

          status:"completed",

          processedWebhook:true,

          completedAt:
            admin.firestore.FieldValue.serverTimestamp(),

        });



        // TREASURY SETTLEMENT

        const treasuryRef =
          db.collection("treasury")
          .doc("main");


        t.set(
          treasuryRef,
          {

            balance:
              admin.firestore.FieldValue.increment(
                -payout.amount
              ),

            lastUpdated:
              admin.firestore.FieldValue.serverTimestamp(),

          },
          {
            merge:true
          }
        );



        // LEDGER

        t.set(
          db.collection("ledger").doc(),
          {

            userId:payout.userId,

            username:user?.username || "Unknown",

            type:"payout",

            amount:payout.amount,

            currency:"USD",

            beforeBalance,

            afterBalance:beforeBalance,

            reference:transaction_id,

            createdAt:
              admin.firestore.FieldValue.serverTimestamp(),

          }
        );

        // TRANSACTION HISTORY

        t.set(
          db.collection("transactions").doc(),
          {

            userId:payout.userId,

            username:user?.username || "Unknown",

            type:"payout",

            amount:payout.amount,

            transactionId:transaction_id,

            status:"completed",

            createdAt:
              admin.firestore.FieldValue.serverTimestamp(),
          }
        );
      });
    }
    // ----------------------
    // FAILED / CANCELLED / REFUNDED
    // ----------------------

   if(
 mappedStatus === "failed" ||
 mappedStatus === "declined" ||
 mappedStatus === "rejected" ||
 mappedStatus === "cancelled" ||
 mappedStatus === "refunded"
){

      await db.runTransaction(async(t)=>{

        const snap =
          await t.get(payoutRef);

        const payout=snap.data();

        if(!payout) return;

        if(payout.processedWebhook){

          return;
        }
        const userRef =
          db.collection("users")
          .doc(payout.userId);

        const userSnap =
          await t.get(userRef);

        const user=userSnap.data();

        const beforeBalance =
          user?.accounts?.real?.balance || 0;

          // REFUND USER

        t.update(userRef,{

          "accounts.real.balance":
            admin.firestore.FieldValue.increment(
              payout.amount
            ),
        });

        // UPDATE PAYOUT

        t.update(payoutRef,{
          status:mappedStatus,
          processedWebhook:true,
          refundedAt:
            admin.firestore.FieldValue.serverTimestamp(),
        });

        // REMOVE RESERVED FEE

        const treasuryRef =
          db.collection("treasury")
          .doc("main");
        t.set(
          treasuryRef,
          {
            balance:
              admin.firestore.FieldValue.increment(
                -payout.fee
              ),
            totalFees:
              admin.firestore.FieldValue.increment(
                -payout.fee
              ),

            lastUpdated:
              admin.firestore.FieldValue.serverTimestamp(),

          },
          {
            merge:true
          }
        );

        // REFUND LEDGER

        t.set(
          db.collection("ledger").doc(),
          {
            userId:payout.userId,
            username:user?.username || "Unknown",
            type:"refund",
            amount:payout.amount,
            currency:"USD",
            beforeBalance,
            afterBalance:
              beforeBalance + payout.amount,
            reference:transaction_id,
            createdAt:
              admin.firestore.FieldValue.serverTimestamp(),
          }
        );
      });
    }

    await db.collection("webhook_logs").add({
      transactionId:transaction_id,
      status:mappedStatus,
      rawPayload:payload,
      receivedAt:
        admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      received:true
    });

  } catch(error){
    console.error(
      "Payout webhook error:",
      error.message
    );
    await db.collection("webhook_logs").add({
      type:"error",
      error:error.message,
      receivedAt:
        admin.firestore.FieldValue.serverTimestamp(),
    }).catch(()=>{});
    // IMPORTANT:
    // Swychr should receive 200
    // to avoid duplicate retries
    return res.status(200).json({
      received:true
    });
  }
});
// ----------------------
// STATUS CHECK
// ----------------------
router.post("/status", async (req, res) => {
  try {
    const { transaction_id } = req.body;

    if (!transaction_id) {
      return res.status(400).json({ error: "transaction_id required" });
    }

    const token = await getPayoutToken();

    const response = await fetch(
      "https://api.accountpe.com/api/payout/transaction_status",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transaction_id }),
      }
    );

    const statusData = await response.json();

    return res.json({
      success: true,
      status: statusData,
    });

  } catch (err) {
    console.error("Status error:", err.message);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


// ----------------------
// ADMIN RETRY PAYOUT
// ----------------------
router.post("/admin/retry-payout", async (req, res) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: "transactionId required" });
    }

    const payoutRef = db.collection("payouts").doc(transactionId);
    const snap = await payoutRef.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Payout not found" });
    }

    const payout = snap.data();

    if (!["failed"].includes(payout.status)) {
      return res.status(400).json({ error: "Cannot retry this payout" });
    }

    const token = await getPayoutToken();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(
      "https://api.accountpe.com/api/payout/create_transaction",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": transactionId,
        },
        body: JSON.stringify({
          country_code: payout.country_code,
          beneficiary_name: payout.beneficiary_name,
          mobile_no: payout.mobile_no,
          amount: payout.payoutAmount,
          transaction_id: transactionId,
          payment_method: payout.payment_method,
          remarks: payout.remarks || "",
          bank_code: payout.bank_code,
          account_number: payout.account_number,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    const data = await response.json();

    if (!response.ok || data?.status !== 0) {
      await payoutRef.update({ status: "failed" });
      return res.status(500).json({ error: "Retry failed" });
    }

    await payoutRef.update({
      status: "pending",
      retryCount: admin.firestore.FieldValue.increment(1),
      payoutResponse: data,
    });

    return res.json({
      success: true,
      message: "Retry initiated",
      transactionId,
    });

  } catch (err) {
    console.error("Retry error:", err);
    return res.status(500).json({ error: err.message });
  }
});
module.exports = router;