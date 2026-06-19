import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

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
   createdAt: new Date().toISOString(),

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
