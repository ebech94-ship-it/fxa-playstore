import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebaseConfig";

export type ReferralUser = {
  uid: string;

  publicId: string;

  displayName: string;
coins: number;
  referralCount: number;
  referralPoints: number;
  referralEarnings: number;

 validReferrals: number; // ✅ ADD THIS
  activeReferrals?: number; // optional but useful

  tier: string;
  nextTierTarget: number;
};

function getTier(referrals: number) {
  if (referrals >= 100)
    return { tier: "Diamond", nextTierTarget: referrals };

  if (referrals >= 50)
    return { tier: "Gold", nextTierTarget: 100 };

  if (referrals >= 20)
    return { tier: "Silver", nextTierTarget: 50 };

  if (referrals >= 10)
    return { tier: "Bronze", nextTierTarget: 20 };

  return { tier: "Starter", nextTierTarget: 10 };
}

export default function useReferralUserData(uid?: string) {
  const [data, setData] = useState<ReferralUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setData(null);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        if (!snap.exists()) {
          setData(null);
          setLoading(false);
          return;
        }

        const user = snap.data();
const coins = Number(user.coins ?? 0);
        const referralCount = user.referralCount ?? 0;
        const referralPoints = user.referralPoints ?? 0;
        const referralEarnings = user.referralEarnings ?? 0;


  const validReferrals = user.validReferrals ?? 0;
  
        const { tier, nextTierTarget } = getTier(validReferrals);

        setData({
          uid,

          publicId: user.publicId ?? "",

          displayName:
            user.displayName ||
            user.username ||
            "New User",

          referralCount,
          referralPoints,
          referralEarnings,
validReferrals,
coins,
          tier,
          nextTierTarget,
        });

        setLoading(false);
      },
      (err) => {
        console.error("Referral listener failed:", err);
        setLoading(false);
      }
    );

    return unsub;
  }, [uid]);

  return { data, loading };
}