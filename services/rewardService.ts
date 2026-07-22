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
}: ClaimRewardParams) => {
  const userRef = doc(db, "users", uid);

  const snap = await getDoc(userRef);

  if (!snap.exists()) return;

  const data = snap.data();

  const alreadyClaimed =
    data.claimedRewards?.includes(rewardKey) ?? false;

  const validReferrals = data.validReferrals ?? 0;


  // safety
  if (alreadyClaimed) {
    throw new Error("Already claimed");
  }

  if (validReferrals < target) {
    throw new Error("Reward locked");
  }


  // mark claimed first
  await updateDoc(userRef, {
    claimedRewards: arrayUnion(rewardKey),
  });


  // 🎁 Reward distribution

  switch (target) {

    // 🎟 Starter
    case 3:
      await updateDoc(userRef,{
        freeTournamentTickets: increment(1),
      });
      break;


    // 💰 $5 wallet
    case 5:
      await updateDoc(userRef,{
        "accounts.real.balance": increment(5),
      });
      break;


    // 🥉 Bronze
    case 10:
      await updateDoc(userRef,{
        bronzeBadges: increment(1),
      });
      break;


    // 🎟 2 tickets
    case 15:
      await updateDoc(userRef,{
        freeTournamentTickets: increment(2),
      });
      break;


    // 🥈 Silver
    case 20:
      await updateDoc(userRef,{
        silverBadges: increment(1),
      });
      break;


    // 💰 $10 wallet
    case 30:
      await updateDoc(userRef,{
        "accounts.real.balance": increment(10),
      });
      break;


    // 🏆 VIP
    case 50:
      await updateDoc(userRef,{
        vipAccess:true,
      });
      break;


    // 💎 Premium frame
    case 75:
      await updateDoc(userRef,{
        premiumProfileFrame:true,
      });
      break;


    // 🥇 Gold
    case 100:
      await updateDoc(userRef,{
        goldBadges: increment(1),
      });
      break;


    // 💰 $15 wallet
    case 150:
      await updateDoc(userRef,{
        "accounts.real.balance": increment(15),
      });
      break;


    // 👑 Elite
    case 250:
      await updateDoc(userRef,{
        eliteAmbassador:true,
      });
      break;


    // 🌍 GodSpeed
    case 500:
      await updateDoc(userRef,{
        godSpeedAmbassador:true,
      });
      break;


    // 💼 Leader
    case 750:
      await updateDoc(userRef,{
        fxArenaLeaderRecognition:true,
      });
      break;


    // 🏛 Partner
    case 1000:
      await updateDoc(userRef,{
        godSpeedTechPartnerEligible:true,
      });
      break;


    default:
      console.log("No reward configured");
  }
};