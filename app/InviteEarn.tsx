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
      <View style={styles.container}>
        <Text style={styles.text}>
          Please log in to invite friends
        </Text>
      </View>
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
    ? `https://forexarena.vercel.app/?ref=${publicId}`
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
      {/* HOW REFERRALS WORK */}
<View style={styles.infoCard}>
  <Text style={styles.infoTitle}>💡 How referrals work</Text>

  <Text style={styles.infoText}>
    Share your invite link with friends. A referral becomes valid only when your friend:
  </Text>

  <Text style={styles.infoText}>
    • Downloads Forex Arena using your invite link{"\n"}
    • Creates an account{"\n"}
    • Joins their first tournament
  </Text>

  <Text style={styles.infoText}>
    Once these steps are completed, your referral will count and you will receive your referral rewards automatically.
  </Text>
</View>

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
  infoCard: {
  backgroundColor: "#101425",
  borderRadius: 12,
  padding: 14,
  marginTop: 16,
  borderWidth: 1,
  borderColor: "#1f2a44",
},

infoTitle: {
  color: "#8c52ff",
  fontSize: 14,
  fontWeight: "700",
  marginBottom: 8,
},

infoText: {
  color: "#cfd6ff",
  fontSize: 13,
  lineHeight: 18,
},
});