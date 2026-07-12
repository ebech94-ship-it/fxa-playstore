import { ScrollView, StyleSheet, Text, View } from "react-native";

type RewardItem = {
  target: number;
  points: number;
  title: string;
};

type Props = {

  validReferrals: number;
};

export default function RewardBagsStrip({ validReferrals }: Props) {
  const rewards: RewardItem[] = [
    { target: 3, points: 100, title: "Starter Bag" },
    { target: 10, points: 400, title: "Bronze Bag" },
    { target: 20, points: 900, title: "Silver Bag" },
    { target: 50, points: 2000, title: "VIP Chest" },
     { target: 100, points: 5000, title: "Diamond Vault" },

  { target: 250, points: 15000, title: "Elite Vault" },

  { target: 500, points: 50000, title: "GodSpeed Vault" },

  { target: 1000, points: 100000, title: "Tech Partner Vault" },
  ];

  return (
    <View style={styles.wrapper}>
      <Text style={styles.header}>🔥 Reward Vault</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {rewards.map((item) => {
         const unlocked = validReferrals >= item.target;
const remaining = Math.max(item.target - validReferrals, 0);
const progress = Math.min(validReferrals / item.target, 1);

          return (
            <View
              key={item.target}
              style={[
                styles.card,
                unlocked ? styles.unlocked : styles.locked,
              ]}
            >
              <Text style={styles.icon}>
                {
 item.target >= 1000
 ? "🏛"
 : item.target >= 500
 ? "👑"
 : item.target >= 250
 ? "🚀"
 : item.target >= 100
 ? "💎"
 : item.target >= 50
 ? "🏆"
 : unlocked
 ? "🔥"
 : "🎁"
}
              </Text>

              <Text style={styles.title}>{item.title}</Text>

              <Text style={styles.meta}>{item.target} referrals</Text>

              <Text style={styles.points}>+{item.points} pts</Text>

              {/* progress bar */}
              <View style={styles.bar}>
                <View
                  style={[
                    styles.fill,
                    unlocked ? styles.fillUnlocked : styles.fillLocked,
                    { width: `${progress * 100}%` },
                  ]}
                />
              </View>

              <Text style={styles.status}>
  {unlocked ? "CLAIM READY" : `${remaining} more to unlock`}
</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 12,
    marginBottom: 10,
  },

  header: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
    letterSpacing: 0.5,
    textAlign: "center",
  },

  scroll: {
    paddingRight: 10,
  },

  card: {
    width: 120,
    height: 120, // reduced height (clean compact premium feel)
    borderRadius: 16,
    marginRight: 12,
    padding: 10,
    justifyContent: "center",
    borderWidth: 1,
    textAlign: "center",
    alignItems: "center",
    // glow effect base
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },

  locked: {
    backgroundColor: "#0b1220",
    borderColor: "#1f2937",
    opacity: 0.85,
 textAlign: "center",
  },

  unlocked: {
    backgroundColor: "#111827",
    borderColor: "#f59e0b",

    shadowColor: "#f59e0b",
    shadowOpacity: 0.5,
    shadowRadius: 14,
     textAlign: "center",
  },

  icon: {
    fontSize: 26, // bigger icon for attraction
    marginBottom: 4,
     textAlign: "center",
  },

  title: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
     textAlign: "center",
  },

  meta: {
    color: "#9ca3af",
    fontSize: 10,
    marginTop: 2,
     textAlign: "center",
  },

  points: {
    color: "#fbbf24", // gold money vibe
    fontSize: 11,
    marginTop: 2,
    fontWeight: "700",
     textAlign: "center",
  },

  bar: {
    height: 5,
    backgroundColor: "#1f2937",
    borderRadius: 10,
    marginTop: 6,
    overflow: "hidden",
  },

  fill: {
    height: "100%",
    borderRadius: 10,
  },

  fillLocked: {
    backgroundColor: "#f97316", // fire orange
  },

  fillUnlocked: {
    backgroundColor: "#fbbf24", // gold glow
  },

  status: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: "700",
    color: "#cbd5e1",
    letterSpacing: 0.5,
     textAlign: "center",
  },
});