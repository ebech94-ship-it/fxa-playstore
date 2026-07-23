import * as Clipboard from "expo-clipboard";
import { getAuth } from "firebase/auth";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import LeaderboardTab from "../components/referral/LeaderboardTab";
import OverviewTab from "../components/referral/OverviewTab";
import ReferralHero from "../components/referral/ReferralHero";
import ReferralTabs from "../components/referral/ReferralTabs";

import RewardsTab from "../components/referral/RewardsTab";
import useReferralLeaderboard from "../hooks/useReferralLeaderboard";
import useReferralUserData from "../hooks/useReferralUserData";



export default function InviteEarnScreen() {
  const user = getAuth().currentUser;

  const [activeTab, setActiveTab] = useState<
    "overview" | "rewards" | "leaderboard"
  >("overview");

  // ==============================
  // LIVE USER DATA
  // ==============================
  const { data, loading } = useReferralUserData(user?.uid);

  // ==============================
  // LIVE LEADERBOARD
  // ==============================
  const {
    leaders,
    loading: leaderboardLoading,
  } = useReferralLeaderboard();

  if (!user) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.text}>
        Referral Program Preview
      </Text>

      <Text
        style={{
          color: "#9CA3AF",
          textAlign: "center",
          marginTop: 12,
          lineHeight: 20,
        }}
      >
        Explore how our referral rewards system works.
        {"\n\n"}
        Sign in to generate your personal invite link,
        track referrals, earn points, and access the leaderboard.
      </Text>
      <Text
style={{
color:"#9CA3AF",
fontSize:12,
textAlign:"center",
marginTop:15,
}}
>
Referral rewards are promotional benefits provided by Forex Tournaments Arena.
Eligibility and rewards may vary based on program rules.
</Text>
    </ScrollView>
  );
}

  if (loading || leaderboardLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>
          Loading referral data...
        </Text>
      </View>
    );
  }

  // ==============================
  // LIVE VALUES
  // ==============================
  const publicId = data?.publicId ?? "";

  const referralCount = data?.referralCount ?? 0;
  const referralPoints = data?.referralPoints ?? 0;

  const tier = data?.tier ?? "Bronze";
  const nextTierTarget = data?.nextTierTarget ?? 20;

  const landingLink = publicId
    ? `https://www.republic.beauty/?ref=${publicId}`
    : "";

  // ==============================
  // USER RANK
  // ==============================
  const myRankIndex = leaders.findIndex(
    (item) => item.uid === user.uid
  );

  const myRank =
    myRankIndex >= 0 ? myRankIndex + 1 : null;

  // ==============================
  // ACTIONS
  // ==============================
  const copyLink = async () => {
    if (!landingLink) return;

    await Clipboard.setStringAsync(landingLink);

    Alert.alert(
      "Copied",
      "Invite link copied to clipboard"
    );
  };

  const shareLink = async () => {
    if (!landingLink) return;

    try {
      await Share.share({
        message: `🏆 Join me on Forex Arena!

Compete in trading tournaments, climb the leaderboard and win rewards.

Use my invite link:
${landingLink}`,
      });
    } catch (err) {
      console.error("Share failed", err);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      {/* HERO */}
      <ReferralHero
        referralCount={referralCount}
        points={referralPoints}
        tier={tier}
        nextTierTarget={nextTierTarget}
      />
           {/* BAGS BAR */}


      {/* TABS */}
      <ReferralTabs
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* OVERVIEW */}
      {activeTab === "overview" && (
      <OverviewTab
  publicId={publicId}
  landingLink={landingLink}
  copyLink={copyLink}
  shareLink={shareLink}
  referralCount={referralCount}
  referralPoints={referralPoints}
/>
      )}

          {/* REWARDS */}
      {activeTab === "rewards" && (
        <RewardsTab
           validReferrals={data?.validReferrals ?? 0}
          referralPoints={referralPoints}
          tier={tier}
        />
      )}

      {/* LEADERBOARD */}
      {activeTab === "leaderboard" && (
        <LeaderboardTab
          leaders={leaders}
          myRank={myRank}
          myReferralCount={referralCount}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#050816",
  },

  content: {
    padding: 16,
  },

  container: {
    flex: 1,
    backgroundColor: "#0d0d0f",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  text: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
  },
 
});