// components/referral/ReferralHero.tsx

import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  referralCount: number;
  points: number;
  tier: string;
  nextTierTarget: number;
};

export default function ReferralHero({
  referralCount,
  points,
  tier,
  nextTierTarget,
}: Props) {
  const progress = Math.min(
    (referralCount / nextTierTarget) * 100,
    100
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🎁 Invite & Earn</Text>

      <Text style={styles.tier}>
        {tier} Referrer
      </Text>

      <View style={styles.statsRow}>
        <View>
          <Text style={styles.value}>
            {referralCount}
          </Text>
          <Text style={styles.label}>
            Referrals
          </Text>
        </View>

        <View>
          <Text style={styles.value}>
            {points}
          </Text>
          <Text style={styles.label}>
            Points
          </Text>
        </View>
      </View>

      <Text style={styles.nextReward}>
        Next Reward: {nextTierTarget} Referrals
      </Text>

      <View style={styles.progressBg}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress}%` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#101a35",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1f3c88",
    marginBottom: 16,
  },

  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },

  tier: {
    color: "#facc15",
    marginTop: 6,
    fontSize: 16,
    fontWeight: "600",
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },

  value: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },

  label: {
    color: "#94a3b8",
    marginTop: 4,
  },

  nextReward: {
    color: "#cbd5e1",
    marginTop: 18,
    marginBottom: 8,
  },

  progressBg: {
    height: 10,
    backgroundColor: "#1e293b",
    borderRadius: 50,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
  },
});