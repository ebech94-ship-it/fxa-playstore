// components/AccountSwitcher.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";


type AccountType = "demo" | "real" | "tournament";

type AccountSwitcherProps = {
  balances: {
    demo: number;
    real: number;
    tournament: number;
  };
  activeAccount: AccountType;
  onSwitch: (id: AccountType) => void;
  onTopUp?: () => void;
    onDeposit?: () => void;   
      onWithdraw?: () => void;
};

export default function AccountSwitcher({
  balances,
  activeAccount,
  onSwitch,
  onTopUp,
}: AccountSwitcherProps) {
  const [expanded, setExpanded] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const router = useRouter();

  const toggleExpand = () => setExpanded(!expanded);

  const handleSelect = (id: AccountType) => {
    onSwitch?.(id);
    setExpanded(false);
    if (id === "real") {
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 4000);
    }
  };

  const getColor = (id: AccountType) =>
    id === "real" ? "#facc15" : id === "tournament" ? "#fb7185" : "#60a5fa";

  const renderButtons = (id: AccountType) => {
    if (id === "demo") {
      return (
        <TouchableOpacity
          onPress={onTopUp}
          style={[styles.button, { backgroundColor: "#3b82f6" }]}
        >
          <Text style={styles.buttonText}>Top Up</Text>
        </TouchableOpacity>
      );
    }

    if (id === "real") {
      return (
        <View style={styles.row}>
          <TouchableOpacity
            onPress={() => router.push("/DepositWithdraw")}
            style={[styles.button, { backgroundColor: "#4CAF50" }]}
          >
            <Text style={styles.buttonText}>Deposit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/DepositWithdraw")}
            style={[styles.button, { backgroundColor: "#9333ea" }]}
          >
            <Text style={styles.buttonText}>Withdraw</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null; // tournament has no buttons
  };

  return (
    <View style={styles.container}>
      {/* Bank icon + current active balance */}
      <TouchableOpacity onPress={toggleExpand} style={styles.iconRow}>
  <MaterialCommunityIcons name="bank" size={26} color="#fff" />
  <Text style={[styles.activeBalance, { color: getColor(activeAccount) }]}>
    ${balances[activeAccount].toFixed(2)}
  </Text>
</TouchableOpacity>


      {/* Expanded accounts dropdown (scrollable if needed) */}
      {expanded && (
        <ScrollView style={styles.dropdown} showsVerticalScrollIndicator={false}>
          {Object.keys(balances).map((id) => (
            <View
              key={id}
              style={[
                styles.card,
                {
                  borderColor:
                    activeAccount === id ? getColor(id as AccountType) : "#374151",
                  backgroundColor:
                    activeAccount === id ? "#1f2937" : "#111827",
                },
              ]}
            >
              <TouchableOpacity onPress={() => handleSelect(id as AccountType)}>
                <Text style={styles.cardTitle}>
                  {id.charAt(0).toUpperCase() + id.slice(1)} Account
                </Text>
                <Text
                  style={[styles.balance, { color: getColor(id as AccountType) }]}
                >
                  ${balances[id as keyof typeof balances].toFixed(2)}
                </Text>
              </TouchableOpacity>

              {/* Action buttons */}
              <View style={{ marginTop: 6 }}>{renderButtons(id as AccountType)}</View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Real account warning */}
      {showWarning && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>⚠ Real money at risk, no real trading here</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 20,
    alignItems: "flex-end",
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#374151",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activeBalance: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  dropdown: {
    marginTop: 8,
    width: 220,
    maxHeight: 300,
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  balance: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  warning: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
  },
  warningText: {
    backgroundColor: "rgba(255,0,0,0.85)",
    color: "#fff",
    padding: 8,
    borderRadius: 6,
    fontWeight: "bold",
  },
});
