import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";

type ActivityItem = {
  id: string;
  text: string;
};

type Props = {
  publicId: string;
  landingLink: string;

  referralCount: number;
  referralPoints: number;

  activeReferrals?: number;
  weeklyProgress?: number;
  weeklyTarget?: number;

  activities?: ActivityItem[];

  copyLink: () => void;
  shareLink: () => void;
};

export default function OverviewTab({
  publicId,
  landingLink,
  referralCount,
  referralPoints,
  activeReferrals = 0,
  weeklyProgress = 0,
  weeklyTarget = 3,
  activities = [],
  copyLink,
  shareLink,
}: Props) {
  const progress =
    weeklyTarget > 0
      ? Math.min((weeklyProgress / weeklyTarget) * 100, 100)
      : 0;

      const copyUserId = async () => {
  await Clipboard.setStringAsync(publicId);
};

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.container}
    >
      {/* INVITE CODE CARD */}
      <View style={styles.cardGlow}>
        <Text style={styles.sectionTitle}>
          🔐 Your Invite Identity
        </Text>

        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>
            Referral Code
          </Text>
         <TouchableOpacity onPress={copyUserId}>
  <Text style={styles.code}>
    {publicId || "Generating..."} 📋
  </Text>
</TouchableOpacity>
        </View>

        <Text style={styles.linkText}>
          {landingLink}
        </Text>
      </View>

      {/* ACTION BUTTONS */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={copyLink}
        >
          <Text style={styles.primaryText}>
            Copy Link
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={shareLink}
        >
          <Text style={styles.secondaryText}>
            Share
          </Text>
        </TouchableOpacity>
      </View>

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

      {/* STATS ENGINE */}
      <View style={styles.statsCard}>
        <Text style={styles.sectionTitle}>
          ⚡ Referral Power
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {referralCount}
            </Text>
            <Text style={styles.statLabel}>
              Friends
            </Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {activeReferrals}
            </Text>
            <Text style={styles.statLabel}>
              Active
            </Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {referralPoints}
            </Text>
            <Text style={styles.statLabel}>
              Points
            </Text>
          </View>
        </View>
      </View>

      {/* WEEKLY CHALLENGE */}
      <View style={styles.challengeCard}>
        <Text style={styles.sectionTitle}>
          🔥 Weekly Challenge
        </Text>

        <Text style={styles.challengeText}>
          Invite {weeklyTarget} friends this week and unlock bonus rewards.
        </Text>

        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress}%` },
            ]}
          />
        </View>

        <Text style={styles.progressText}>
          {weeklyProgress} / {weeklyTarget} completed
        </Text>
      </View>

      {/* ACTIVITY FEED */}
      <View style={styles.feedCard}>
        <Text style={styles.sectionTitle}>
          📡 Live Activity
        </Text>

        {activities.length === 0 ? (
          <Text style={styles.feedItem}>
            No referral activity yet.
          </Text>
        ) : (
          activities.map((item) => (
            <Text
              key={item.id}
              style={styles.feedItem}
            >
              ✓ {item.text}
            </Text>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
  },

  cardGlow: {
    backgroundColor: "#0f1b3d",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1f3c88",
    shadowColor: "#3b82f6",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    marginBottom: 14,
  },

  sectionTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },

  codeBox: {
    backgroundColor: "#0b1224",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
  },

  codeLabel: {
    color: "#94a3b8",
    fontSize: 12,
    marginBottom: 4,
  },

  code: {
    color: "#38bdf8",
    fontSize: 14,
    fontWeight: "700",
  },

  linkText: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 10,
  },

  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },

  primaryBtn: {
    flex: 1,
    backgroundColor: "#2563eb",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#2563eb",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  primaryText: {
    color: "#fff",
    fontWeight: "700",
  },

  secondaryText: {
    color: "#38bdf8",
    fontWeight: "600",
  },

  statsCard: {
    backgroundColor: "#0b1224",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  statBox: {
    alignItems: "center",
    flex: 1,
  },

  statValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },

  statLabel: {
    color: "#94a3b8",
    fontSize: 12,
  },

  challengeCard: {
    backgroundColor: "#0f172a",
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
  },

  challengeText: {
    color: "#cbd5e1",
    marginBottom: 10,
  },

  progressBar: {
    height: 8,
    backgroundColor: "#1e293b",
    borderRadius: 20,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#38bdf8",
  },

  progressText: {
    color: "#94a3b8",
    marginTop: 6,
    fontSize: 12,
  },

  feedCard: {
    backgroundColor: "#0b1224",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
  },

  feedItem: {
    color: "#cbd5e1",
    marginBottom: 6,
    fontSize: 13,
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