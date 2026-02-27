// backend/services/transactions.ts
import { db, FieldValue } from "../firebaseAdmin"; // adjust path

// Define transaction types
export type TransactionType = "deposit" | "withdrawal";

// Transaction interface (for TypeScript safety)
export interface Transaction {
  userId: string;
  type: TransactionType;
  amount: number;
  momoNumber?: string | null;
  status: "pending" | "completed" | "rejected";
  reference: string;
  createdAt: any; // Firestore timestamp
  processedAt?: any;
  processedBy?: string;
}

// Create a new transaction
export async function createTransaction(
  userId: string,
  type: TransactionType,
  amount: number,
  momoNumber?: string
): Promise<string> {
  const txRef = db.collection("realTransactions").doc();
  await txRef.set({
    userId,
    type,
    amount,
    momoNumber: momoNumber || null,
    status: "pending",
    reference: `TX-${Date.now()}`,
    createdAt: FieldValue.serverTimestamp(),
  });
  return txRef.id;
}

// Approve transaction (admin)
export async function approveTransaction(txId: string, adminId: string): Promise<void> {
  const txRef = db.collection("realTransactions").doc(txId);

  await db.runTransaction(async (t) => {
    const txSnap = await t.get(txRef);
    if (!txSnap.exists) throw new Error("Transaction not found");

    const tx = txSnap.data() as Transaction;
    if (tx.status !== "pending") throw new Error("Transaction already processed");

    const userRef = db.collection("users").doc(tx.userId);
    const userSnap = await t.get(userRef);
    const userData = userSnap.data() || {};
    let newBalance = userData.realBalance || 0;

    if (tx.type === "deposit") newBalance += tx.amount;
    if (tx.type === "withdrawal") {
      if (newBalance < tx.amount) throw new Error("Insufficient balance");
      newBalance -= tx.amount;
    }

    t.update(userRef, { realBalance: newBalance });
    t.update(txRef, {
      status: "completed",
      processedAt: FieldValue.serverTimestamp(),
      processedBy: adminId,
    });
  });
}

// Reject transaction (admin)
export async function rejectTransaction(txId: string, adminId: string): Promise<void> {
  const txRef = db.collection("realTransactions").doc(txId);

  await db.runTransaction(async (t) => {
    const txSnap = await t.get(txRef);
    if (!txSnap.exists) throw new Error("Transaction not found");

    const tx = txSnap.data() as Transaction;
    if (tx.status !== "pending") throw new Error("Transaction already processed");

    t.update(txRef, {
      status: "rejected",
      processedAt: FieldValue.serverTimestamp(),
      processedBy: adminId,
    });
  });
}

// Example function to handle external payments
export async function handleExternalPayment(
  userId: string,
  amount: number,
  momoNumber?: string
): Promise<string> {
  // 1️⃣ Create transaction in Firestore (pending)
  const txId = await createTransaction(userId, "deposit", amount, momoNumber);

  // 2️⃣ Call your external payment provider API here
  // Example: await sendMomoPaymentRequest(userId, amount, momoNumber, txId);

  // 3️⃣ When external provider confirms success, call approveTransaction
  // Example: await approveTransaction(txId, "admin-id-from-system");

  return txId;
}