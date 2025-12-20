// components/AccountSwitcher.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import type { AccountType, TournamentAccount } from "../types/accounts";

import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/* ================= TYPES ================= */

type AccountSwitcherProps = {
  balances: {
    demo: number;
    real: number;
  };
  tournaments: TournamentAccount[]; 
  activeAccount: AccountType;
  onSwitch: (account: AccountType) => void;
  onTopUp?: () => void;
  onDeposit?: () => void;
  onWithdraw?: () => void;
};

/* ================= COMPONENT ================= */

export default function AccountSwitcher({
  balances,
  tournaments,
  activeAccount,
  onSwitch,
  onTopUp,
}: AccountSwitcherProps) {
  const [expanded, setExpanded] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const router = useRouter();

  const toggleExpand = () => setExpanded((v) => !v);

  /* ================= HELPERS ================= */

  const getColor = (account: AccountType) => {
    if (account.type === "real") return "#facc15";
    if (account.type === "tournament") return "#fb7185";
    return "#60a5fa";
  };

  const getActiveBalance = () => {
    if (activeAccount.type === "demo") return balances.demo;
    if (activeAccount.type === "real") return balances.real;

    const t = tournaments.find(
      (x) => x.id === activeAccount.tournamentId
    );
    return t?.balance ?? 0;
  };

  const handleSelect = (account: AccountType) => {
    onSwitch(account);
    setExpanded(false);

    if (account.type === "real") {
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 4000);
    }
  };

  /* ================= RENDER ================= */

  return (
    <View style={styles.container}>
      {/* ACTIVE ACCOUNT */}
      <TouchableOpacity onPress={toggleExpand} style={styles.iconRow}>
        <MaterialCommunityIcons name="bank" size={26} color="#fff" />
        <Text
          style={[
            styles.activeBalance,
            { color: getColor(activeAccount) },
          ]}
        >
          ${getActiveBalance().toFixed(2)}
        </Text>
      </TouchableOpacity>

      {/* DROPDOWN */}
      {expanded && (
        <ScrollView style={styles.dropdown} showsVerticalScrollIndicator={false}>
          {/* DEMO */}
          <View
            style={[
              styles.card,
              activeAccount.type === "demo" && styles.activeCard,
            ]}
          >
            <TouchableOpacity
              onPress={() => handleSelect({ type: "demo" })}
            >
              <Text style={styles.cardTitle}>Demo Account</Text>
              <Text style={[styles.balance, { color: "#60a5fa" }]}>
                ${balances.demo.toFixed(2)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onTopUp}
              style={[styles.button, { backgroundColor: "#3b82f6" }]}
            >
              <Text style={styles.buttonText}>Top Up</Text>
            </TouchableOpacity>
          </View>

          {/* REAL */}
          <View
            style={[
              styles.card,
              activeAccount.type === "real" && styles.activeCard,
            ]}
          >
            <TouchableOpacity
              onPress={() => handleSelect({ type: "real" })}
            >
              <Text style={styles.cardTitle}>Real Account</Text>
              <Text style={[styles.balance, { color: "#facc15" }]}>
                ${balances.real.toFixed(2)}
              </Text>
            </TouchableOpacity>

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
          </View>

          {/* TOURNAMENTS */}
          {tournaments.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Tournaments</Text>

              {tournaments.map((t) => {
                const isActive =
                  activeAccount.type === "tournament" &&
                  activeAccount.tournamentId === t.id;

                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() =>
                      handleSelect({
                        type: "tournament",
                        tournamentId: t.id,
                      })
                    }
                    style={[
                      styles.card,
                      isActive && styles.activeCard,
                    ]}
                  >
                    <Text style={styles.cardTitle}>{t.name}</Text>
                    <Text style={{ color: "#fb7185", fontSize: 12 }}>
                      ${t.balance.toFixed(2)} • {t.status.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      )}

      {/* WARNING */}
      {showWarning && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            ⚠ Real money at risk, no real trading here
          </Text>
        </View>
      )}
    </View>
  );
}

/* ================= STYLES ================= */

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
    width: 240,
    maxHeight: 350,
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  activeCard: {
    borderColor: "#22d3ee",
    backgroundColor: "#1f2937",
  },
  cardTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  balance: {
    fontSize: 13,
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 6,
  },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  sectionTitle: {
    color: "#9ca3af",
    fontSize: 12,
    marginVertical: 6,
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
