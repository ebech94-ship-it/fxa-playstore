
import {
  doc,
  runTransaction,
  arrayUnion,
  increment,
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
}: ClaimRewardParams) => {
  const userRef = doc(db, "users", uid);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);

    if (!snap.exists()) {
      throw new Error("User not found");
    }

    const data = snap.data();
    const alreadyClaimed =
      data.claimedRewards?.includes(rewardKey) ?? false;
    const validReferrals = Number(data.validReferrals ?? 0);

    if (alreadyClaimed) {
      throw new Error("Already claimed");
    }

    if (validReferrals < target) {
      throw new Error("Reward locked");
    }

    // Build the reward update before marking it claimed.
    let rewardUpdate: Record<string, unknown>;

    switch (target) {
      case 3:
        rewardUpdate = {
          freeTournamentTickets: increment(1),
        };
        break;

      case 5:
        rewardUpdate = {
          coins: increment(5),
        };
        break;

      case 10:
        rewardUpdate = {
          bronzeBadges: increment(1),
        };
        break;

      case 15:
        rewardUpdate = {
          freeTournamentTickets: increment(2),
        };
        break;

      case 20:
        rewardUpdate = {
          silverBadges: increment(1),
        };
        break;

      case 30:
        rewardUpdate = {
          coins: increment(10),
        };
        break;

      case 50:
        rewardUpdate = { vipAccess: true };
        break;

      case 75:
        rewardUpdate = { premiumProfileFrame: true };
        break;

      case 100:
        rewardUpdate = {
          goldBadges: increment(1),
        };
        break;

      case 150:
        rewardUpdate = {
          coins: increment(15),
        };
        break;

      case 250:
        rewardUpdate = { eliteAmbassador: true };
        break;

      case 500:
        rewardUpdate = { godSpeedAmbassador: true };
        break;

      case 750:
        rewardUpdate = {
          fxArenaLeaderRecognition: true,
        };
        break;

      case 1000:
        rewardUpdate = {
          godSpeedTechPartnerEligible: true,
        };
        break;

      default:
        throw new Error("No reward configured for this milestone");
    }

    transaction.update(userRef, {
      ...rewardUpdate,
      claimedRewards: arrayUnion(rewardKey),
    });
  });
};
