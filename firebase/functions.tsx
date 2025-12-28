import { doc, updateDoc } from "firebase/firestore";
import { db } from "./../firebaseConfig"; // adjust path if needed

export const updateBalance = async (userId: string, newBalance: number) => {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { balance: newBalance });
};
