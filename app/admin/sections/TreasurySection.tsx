import { useEffect, useRef, useState, useCallback } from "react";
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
  balance: number; // USD
  lastUpdated?: any;
}

interface Transaction {
  id: string;
  type: string;
  status: string;
  username?: string;
  amount: number; // USD
  createdAt?: any;
}

export default function TreasurySection() {
  const API_BASE = "https://forexapp2-backend.onrender.com";

  const [treasury, setTreasury] = useState<TreasuryData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [displayedTx, setDisplayedTx] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);

  const glowAnim = useRef(new Animated.Value(0)).current;

  // -----------------------------
  // ANIMATION
  // -----------------------------
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [glowAnim]);

  // -----------------------------
  // TOKEN
  // -----------------------------
  const getToken = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  }, []);

  // -----------------------------
  // FETCH DATA
  // -----------------------------
  const fetchTreasury = useCallback(async () => {
    try {
      setLoadingTx(true);

      const token = await getToken();
      if (!token) return;

      // TREASURY (USD)
      const treasuryRes = await fetch(
        `${API_BASE}/api/treasury/balances`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const treasuryData = await treasuryRes.json();
      setTreasury(treasuryData);

      // TRANSACTIONS
      const txRes = await fetch(
        `${API_BASE}/admin/transactions`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const txData = await txRes.json();

      setTransactions(txData || []);
      setDisplayedTx((txData || []).slice(0, 10));
    } catch (e) {
      console.log("Treasury fetch error:", e);
    } finally {
      setLoadingTx(false);
    }
  }, [API_BASE, getToken]);

  useEffect(() => {
    fetchTreasury();
  }, [fetchTreasury]);

  // -----------------------------
  // LOAD MORE
  // -----------------------------
  const loadMoreTx = useCallback(() => {
    setDisplayedTx((prev) => {
      const next = transactions.slice(prev.length, prev.length + 10);
      if (next.length === 0) return prev;
      return [...prev, ...next];
    });
  }, [transactions]);

  // -----------------------------
  // STATUS COLORS
  // -----------------------------
  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
      case "locked":
      case "processing":
        return "#ffcc00";

      case "success":
      case "completed":
        return "#00ff88";

      case "failed":
        return "#ff0044";

      default:
        return "#ccc";
    }
  };

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,255,204,0.3)", "rgba(255,0,150,0.3)"],
  });

  // -----------------------------
  // LOADING
  // -----------------------------
  if (!treasury) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#6f00d6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* BALANCE */}
      <Animated.View style={styles.balanceCard}>
  
  {/* Glow overlay */}
  <Animated.View
    style={[
      StyleSheet.absoluteFillObject,
      {
        backgroundColor: glowColor,
        borderRadius: 16,
        opacity: 0.35,
      },
    ]}
  />

  <Text style={styles.balanceTitle}>Treasury Balance (USD)</Text>

  <Text style={styles.balanceAmount}>
    ${Number(treasury.balance || 0).toFixed(2)}
  </Text>

  <Text style={styles.lastUpdated}>
    Last Updated:{" "}
    {treasury.lastUpdated
      ? new Date(treasury.lastUpdated).toLocaleString()
      : "N/A"}
  </Text>
</Animated.View>

      {/* HEADER */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableCell, styles.colType]}>Type</Text>
        <Text style={[styles.tableCell, styles.colStatus]}>Status</Text>
        <Text style={[styles.tableCell, styles.colUser]}>User</Text>
        <Text style={[styles.tableCell, styles.colAmount]}>Amount</Text>
        <Text style={[styles.tableCell, styles.colDate]}>Date</Text>
      </View>

      {/* LIST */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        onScroll={({ nativeEvent }) => {
          if (
            nativeEvent.contentOffset.y +
              nativeEvent.layoutMeasurement.height >=
            nativeEvent.contentSize.height - 20
          ) {
            loadMoreTx();
          }
        }}
        scrollEventThrottle={100}
      >
        {loadingTx ? (
          <ActivityIndicator color="#fff" />
        ) : (
          displayedTx.map((tx) => (
            <View key={tx.id} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colType]}>
                {tx.type?.toUpperCase()}
              </Text>

              <Text
                style={[
                  styles.tableCell,
                  styles.colStatus,
                  { color: getStatusColor(tx.status) },
                ]}
              >
                {tx.status?.toUpperCase()}
              </Text>

              <Text style={[styles.tableCell, styles.colUser]}>
                {tx.username || "Unknown"}
              </Text>

              <Text style={[styles.tableCell, styles.colAmount]}>
                ${Number(tx.amount || 0).toFixed(2)}
              </Text>

              <Text style={[styles.tableCell, styles.colDate]}>
                {tx.createdAt
                  ? new Date(tx.createdAt).toLocaleString()
                  : "No date"}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* TOTAL */}
      <View style={[styles.tableRow, styles.totalRow]}>
        <Text style={[styles.tableCell, styles.colType]}>TOTAL</Text>
        <Text style={styles.tableCell}></Text>
        <Text style={styles.tableCell}></Text>
        <Text style={styles.tableCell}></Text>

        <Text style={[styles.tableCell, styles.totalBalance]}>
          ${Number(treasury.balance || 0).toFixed(2)}
        </Text>
      </View>
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