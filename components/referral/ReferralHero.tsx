
// components/referral/ReferralHero.tsx

import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  referralCount: number;
  points: number;
  coins?: number;
  tier: string;
  nextTierTarget: number;
};

export default function ReferralHero({
  referralCount,
  points,
  coins = 0,
  tier,
  nextTierTarget,
}: Props) {
  const progress =
    nextTierTarget > 0
      ? Math.min((referralCount / nextTierTarget) * 100, 100)
      : 100;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🎁 Invite & Earn</Text>

      <Text style={styles.tier}>{tier} Referrer</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.value}>{referralCount}</Text>
          <Text style={styles.label}>Valid Referrals</Text>
        </View>

        <View style={styles.stat}>
          <Text style={styles.value}>{coins.toLocaleString()}</Text>
          <Text style={styles.label}>Virtual Coins 🪙</Text>
        </View>

        <View style={styles.stat}>
          <Text style={styles.value}>{points.toLocaleString()}</Text>
          <Text style={styles.label}>Referral Points</Text>
        </View>
      </View>

      {nextTierTarget > 0 && (
        <>
          <Text style={styles.nextReward}>
            Next milestone: {nextTierTarget} referrals
          </Text>

          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%` },
              ]}
            />
          </View>
        </>
      )}

      <Text style={styles.disclaimer}>
        Coins are virtual rewards and cannot be withdrawn or redeemed for cash.
      </Text>
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
    gap: 8,
    marginTop: 20,
  },
  stat: {
    flex: 1,
  },
  value: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  label: {
    color: "#94a3b8",
    marginTop: 4,
    fontSize: 11,
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
  disclaimer: {
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 14,
  },
});
