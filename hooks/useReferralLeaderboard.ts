import {
    collection,
    limit,
    onSnapshot,
    orderBy,
    query,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebaseConfig";

export type LeaderboardUser = {
  uid: string;
  displayName: string;
  publicId: string;
  referralCount: number;
};

export default function useReferralLeaderboard() {
  const [leaders, setLeaders] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "users"),
      orderBy("referralCount", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: LeaderboardUser[] = snapshot.docs.map((doc) => {
          const data = doc.data();

          return {
            uid: doc.id,
            displayName:
              data.username ||
              data.name ||
              data.publicId ||
              "Anonymous",
            publicId: data.publicId ?? "",
            referralCount: data.referralCount ?? 0,
          };
        });

        setLeaders(list);
        setLoading(false);
      },
      (err) => {
        console.log(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return {
    leaders,
    loading,
  };
}