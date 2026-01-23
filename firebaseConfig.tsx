// firebaseConfig.tsx (RE-EXPORT ONLY)
import app from "@/lib/firebase";
import { getStorage } from "firebase/storage";
export { default as app, auth, db } from "@/lib/firebase";

export const storage = getStorage(app);
