import { doc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const createUserAccounts = async (
  uid: string,
  name: string,
  email: string,
  referredBy: string | null = null
) => {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  // 🛑 DO NOT overwrite existing users
  if (snap.exists()) return;

  await setDoc(userRef, {
    uid,
    name,
    email,
    referredBy,
    profileCompleted: false,
    createdAt: serverTimestamp(),

    accounts: {
      demo: {
        balance: 10000,
        currency: "USD",
      },
      real: {
        balance: 0,
        currency: "USD",
      },
      tournament: {
        balance: 0,
        currency: "USD",
        joined: false,
      },
    },
  });
};
