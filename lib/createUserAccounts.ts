import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export const createUserAccounts = async (uid: string) => {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  // Do not overwrite existing users
  if (snap.exists()) return;

  // 👉 you can continue creating user here if needed
};