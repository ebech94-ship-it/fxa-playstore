import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { auth } from "../../../firebaseConfig";

interface TreasuryData {
  balance: number;
  lastUpdated?: any;
}

interface Transaction {
  id: string;
  type: string;
  status: string;
  username?: string;
  amount: number;
  createdAt?: any;
}

export default function TreasurySection() {
  const [treasury, setTreasury] = useState<TreasuryData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // 💡 Glow animation for balance
  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1200, useNativeDriver: false }),
      ])
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,255,204,0.3)", "rgba(255,0,150,0.3)"],
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      try {
        const token = await user.getIdToken();

        // Fetch treasury balance
        const treasuryRes = await fetch(
          "https://forexapp2-backend.onrender.com/api/treasury/balances",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const treasuryData = await treasuryRes.json();
        setTreasury(treasuryData);

        // Fetch all transactions
        const txRes = await fetch(
          "https://forexapp2-backend.onrender.com/admin/transactions",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const txData = await txRes.json();
        setTransactions(txData);
      } catch (error) {
        console.log("Treasury fetch error:", error);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#6f00d6" />
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
      case "pending_admin_approval":
        return "#ffcc00";
      case "completed":
      case "paid":
        return "#00ff88";
      case "rejected":
        return "#ff0044";
      default:
        return "#ccc";
    }
  };

  return (
    <View style={styles.container}>
      {/* Glowing Treasury Balance */}
      <Animated.View style={[styles.balanceCard, { shadowColor: glowColor }]}>
        <Text style={styles.balanceTitle}>Treasury Balance</Text>
        <Text style={styles.balanceAmount}>{treasury?.balance ?? 0} FRS</Text>
        <Text style={styles.lastUpdated}>
          Last Updated:{" "}
          {treasury?.lastUpdated ? new Date(treasury.lastUpdated).toLocaleString() : "N/A"}
        </Text>
      </Animated.View>

      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableCell, styles.colType]}>Type</Text>
        <Text style={[styles.tableCell, styles.colStatus]}>Status</Text>
        <Text style={[styles.tableCell, styles.colUser]}>User</Text>
        <Text style={[styles.tableCell, styles.colAmount]}>Amount</Text>
        <Text style={[styles.tableCell, styles.colDate]}>Date</Text>
      </View>

      {/* Transactions Table */}
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {transactions.map((tx) => (
          <View key={tx.id} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.colType]}>{tx.type.toUpperCase()}</Text>
            <Text style={[styles.tableCell, styles.colStatus, { color: getStatusColor(tx.status) }]}>
              {tx.status.toUpperCase()}
            </Text>
            <Text style={[styles.tableCell, styles.colUser]}>{tx.username || "Unknown"}</Text>
            <Text style={[styles.tableCell, styles.colAmount, { color: getStatusColor(tx.status) }]}>
              {tx.amount} FRS
            </Text>
            <Text style={[styles.tableCell, styles.colDate]}>
              {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "No date"}
            </Text>
          </View>
        ))}

        {/* Total Balance Row */}
        <View style={[styles.tableRow, styles.totalRow]}>
          <Text style={[styles.tableCell, styles.colType]}>TOTAL</Text>
          <Text style={[styles.tableCell, styles.colStatus]}></Text>
          <Text style={[styles.tableCell, styles.colUser]}></Text>
          <Text style={[styles.tableCell, styles.colAmount]}></Text>
          <Text style={[styles.tableCell, styles.colDate, styles.totalBalance]}>
            {treasury?.balance ?? 0} FRS
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0e0e1a" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Balance Card
  balanceCard: {
    backgroundColor: "#1a1a2e",
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
  balanceTitle: { color: "#aaa", fontSize: 14, marginBottom: 6 },
  balanceAmount: { color: "#00ffcc", fontSize: 28, fontWeight: "bold" },
  lastUpdated: { color: "#777", marginTop: 6, fontSize: 12 },

  // Table
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomColor: "#444",
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomColor: "#222",
    borderBottomWidth: 1,
  },
  tableCell: {
    color: "#fff",
    fontSize: 13,
  },
  colType: { flex: 2 },
  colStatus: { flex: 2 },
  colUser: { flex: 3 },
  colAmount: { flex: 2 },
  colDate: { flex: 3 },

  totalRow: { backgroundColor: "#1a1a40" },
  totalBalance: { color: "#00ffcc", fontWeight: "bold" },
});