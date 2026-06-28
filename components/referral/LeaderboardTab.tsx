import React from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";

type Leader = {
  uid: string;
  displayName: string;
  referralCount: number;
};

type Props = {
  leaders: Leader[];
  myRank?: number | null;
  myReferralCount: number;
};

export default function LeaderboardTab({
  leaders,
  myRank,
  myReferralCount,
}: Props) {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>
        🏆 Referral Leaders
      </Text>

      {leaders.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            No leaderboard data yet
          </Text>

          <Text style={styles.emptyText}>
            Invite friends to become one of the first referral leaders.
          </Text>
        </View>
      ) : (
        leaders.map((user, index) => (
          <View key={user.uid} style={styles.card}>
            <Text style={styles.rank}>
              #{index + 1}
            </Text>

            <Text
              style={styles.name}
              numberOfLines={1}
            >
              {user.displayName || "Anonymous"}
            </Text>

            <Text style={styles.value}>
              {user.referralCount} invite
              {user.referralCount === 1 ? "" : "s"}
            </Text>
          </View>
        ))
      )}

      <View style={styles.myCard}>
        <Text style={styles.myTitle}>
          Your Position
        </Text>

        <Text style={styles.myValue}>
          {myRank ? `#${myRank}` : "Not ranked yet"} •{" "}
          {myReferralCount} referral
          {myReferralCount === 1 ? "" : "s"}
        </Text>
      </View>
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

  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#0b1224",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
    alignItems: "center",
  },

  rank: {
    color: "#38bdf8",
    fontWeight: "700",
    width: 40,
  },

  name: {
    color: "#fff",
    flex: 1,
    marginHorizontal: 10,
  },

  value: {
    color: "#94a3b8",
  },

  myCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#111c3a",
    borderWidth: 1,
    borderColor: "#2563eb",
  },

  myTitle: {
    color: "#94a3b8",
  },

  myValue: {
    color: "#fff",
    fontWeight: "700",
    marginTop: 4,
  },

  emptyCard: {
    padding: 20,
    borderRadius: 14,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1e293b",
    alignItems: "center",
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