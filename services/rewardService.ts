import {
  doc,
  updateDoc,
  arrayUnion,
  increment,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

type ClaimRewardParams = {
  uid: string;
  rewardKey: string;
  target: number;
  referralCount: number;
  reward: string;
};

export const claimReward = async ({
  uid,
  rewardKey,
  target,
  referralCount,
  reward,
}: ClaimRewardParams) => {
  const userRef = doc(db, "users", uid);

  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const data = snap.data();

  // ✅ FIX: use rewardKey instead of reward.id
  const alreadyClaimed =
    data.claimedRewards?.includes(rewardKey) ?? false;

  const validReferrals = data.validReferrals ?? 0;

  // ❌ safety checks
  if (alreadyClaimed) return;
  if (validReferrals < target) return;

  // ✅ mark reward as claimed
  await updateDoc(userRef, {
    claimedRewards: arrayUnion(rewardKey),
  });

  // 🎁 GIVE REWARD BASED ON TARGET (since reward is just a string)
  if (target === 3) {
    await updateDoc(userRef, {
      freeTournamentTickets: increment(1),
    });
  }

  if (target === 10) {
    await updateDoc(userRef, {
      bronzeBadges: increment(1),
    });
  }

  if (target === 20) {
    await updateDoc(userRef, {
      silverBadges: increment(1),
    });
  }

  if (target === 50) {
    await updateDoc(userRef, {
      vipAccess: true,
    });
  }
};