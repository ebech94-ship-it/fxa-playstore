// firebaseConfig.tsx
import  {app, auth, db } from "@/lib/firebase";
import { getStorage } from "firebase/storage";

// ✅ now `app` is a modular FirebaseApp
export const storage = getStorage(app);

export { app, auth, db };

