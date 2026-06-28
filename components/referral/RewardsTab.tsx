import { getAuth } from "firebase/auth";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { claimReward } from "../../services/rewardService";
import RewardBagsStrip from "./RewardBagsStrip";

type Props = {
  validReferrals: number;
  referralPoints: number;
  tier: string;
};

export default function RewardsTab({
  validReferrals,
  referralPoints,
  tier,
}: Props) {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;

  const [loadingClaim, setLoadingClaim] = useState<number | null>(null);
  const [claimed, setClaimed] = useState<Record<string, boolean>>({});

  const rewards = [
    {
      title: "Invite 3 Friends",
      reward: "🎟 Free Tournament Ticket",
      target: 3,
    },
    {
      title: "Invite 10 Friends",
      reward: "🥉 Bronze Badge",
      target: 10,
    },
    {
      title: "Invite 20 Friends",
      reward: "🥈 Silver Badge",
      target: 20,
    },
    {
      title: "Invite 50 Friends",
      reward: "🏆 VIP Access",
      target: 50,
    },
  ];

  const handleClaim = async (item: any) => {
    if (!uid) return;

    const key = `${item.target}_referrals`;

    if (claimed[key]) return;

    setLoadingClaim(item.target);

    try {
      await claimReward({
        uid,
        rewardKey: key,
        target: item.target,
        referralCount: validReferrals,
        reward: item.reward,
      });

      setClaimed((prev) => ({
        ...prev,
        [key]: true,
      }));
    } catch (e) {
      console.log("claim failed", e);
    }

    setLoadingClaim(null);
  };

  return (
    <ScrollView style={styles.container}>
      <RewardBagsStrip validReferrals={validReferrals} />

      <Text style={styles.header}>🎁 Rewards Journey</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryText}>
          Current Tier: <Text style={styles.highlight}>{tier}</Text>
        </Text>

        <Text style={styles.summaryText}>
          Referral Points:{" "}
          <Text style={styles.highlight}>{referralPoints}</Text>
        </Text>

        <Text style={styles.summaryText}>
          Total Referrals:{" "}
          <Text style={styles.highlight}>{validReferrals}</Text>
        </Text>
      </View>

      {rewards.map((item, index) => {
        const progress = Math.min(validReferrals, item.target);
        const percent = (progress / item.target) * 100;
        const completed = validReferrals >= item.target;

        const key = `${item.target}_referrals`;
        const isClaimed = claimed[key];

        return (
          <View key={index} style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>

            <Text style={styles.reward}>{item.reward}</Text>

            <View style={styles.bar}>
              <View style={[styles.fill, { width: `${percent}%` }]} />
            </View>

            <Text style={styles.progressText}>
              {progress} / {item.target}
            </Text>

            <Text
              style={[
                styles.status,
                { color: completed ? "#22c55e" : "#facc15" },
              ]}
            >
              {completed
                ? "✅ Reward Unlocked"
                : `${item.target - validReferrals} more referral${
                    item.target - validReferrals === 1 ? "" : "s"
                  } needed`}
            </Text>

            {/* CLAIM BUTTON */}
            <View style={{ marginTop: 12 }}>
              {isClaimed ? (
                <View style={styles.claimedBtn}>
                  <Text style={styles.claimedText}>Claimed ✔</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => handleClaim(item)}
                  disabled={!completed || loadingClaim === item.target}
                  style={[
                    styles.claimBtn,
                    (!completed || loadingClaim === item.target) &&
                      styles.disabledBtn,
                  ]}
                >
                  <Text style={styles.claimBtnText}>
                    {loadingClaim === item.target
                      ? "Claiming..."
                      : completed
                      ? "Claim Reward"
                      : "Locked"}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}

      {validReferrals === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No referrals yet</Text>
          <Text style={styles.emptyText}>
            Invite your friends using your referral link to begin earning
            rewards.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
  },

  header: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },

  summaryCard: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#1e293b",
  },

  summaryText: {
    color: "#cbd5e1",
    marginBottom: 6,
    fontSize: 14,
  },

  highlight: {
    color: "#38bdf8",
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#0b1224",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
  },

  title: {
    color: "#fff",
    fontWeight: "700",
    marginBottom: 4,
  },

  reward: {
    color: "#38bdf8",
    marginBottom: 10,
  },

  bar: {
    height: 8,
    backgroundColor: "#1e293b",
    borderRadius: 20,
    overflow: "hidden",
  },

  fill: {
    height: "100%",
    backgroundColor: "#2563eb",
  },

  progressText: {
    color: "#94a3b8",
    marginTop: 6,
    fontSize: 12,
  },

  status: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
  },

  claimBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    alignItems: "center",
  },

  claimBtnText: {
    color: "#fff",
    fontWeight: "700",
  },

  disabledBtn: {
    backgroundColor: "#334155",
  },

  claimedBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#14532d",
    alignItems: "center",
  },

  claimedText: {
    color: "#22c55e",
    fontWeight: "700",
  },

  emptyCard: {
    marginTop: 20,
    padding: 20,
    borderRadius: 14,
    backgroundColor: "#111827",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1e293b",
  },

  emptyTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 8,
  },

  emptyText: {
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
  },
});