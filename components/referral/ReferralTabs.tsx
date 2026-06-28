// components/referral/ReferralTabs.tsx

import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type TabType =
  | "overview"
  | "rewards"
  | "leaderboard";

type Props = {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
};

export default function ReferralTabs({
  activeTab,
  onChange,
}: Props) {
  return (
    <View style={styles.container}>
      {["overview", "rewards", "leaderboard"].map(
        (tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() =>
              onChange(tab as TabType)
            }
            style={[
              styles.tab,
              activeTab === tab &&
                styles.activeTab,
            ]}
          >
            <Text
              style={[
                styles.text,
                activeTab === tab &&
                  styles.activeText,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        )
      )}
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
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  activeTab: {
    backgroundColor: "#2563eb",
  },

  text: {
    color: "#94a3b8",
    fontWeight: "600",
    textTransform: "capitalize",
  },

  activeText: {
    color: "#fff",
  },
});