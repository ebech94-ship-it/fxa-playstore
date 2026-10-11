
// components/referral/ReferralTabs.tsx

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type TabType = "overview" | "rewards" | "leaderboard";

type Props = {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
};

const tabs: { key: TabType; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "rewards", label: "Rewards" },
  { key: "leaderboard", label: "Leaderboard" },
];

export default function ReferralTabs({
  activeTab,
  onChange,
}: Props) {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          activeOpacity={0.8}
          onPress={() => onChange(tab.key)}
          style={[
            styles.tab,
            activeTab === tab.key && styles.activeTab,
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.text,
              activeTab === tab.key && styles.activeText,
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#101a35",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 3,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: {
    backgroundColor: "#2563eb",
  },
  text: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  activeText: {
    color: "#fff",
    fontWeight: "800",
  },
});