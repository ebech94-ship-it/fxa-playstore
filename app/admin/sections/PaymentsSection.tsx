import { getAuth } from "firebase/auth";
import { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Transaction = {
  id: string;
  userId: string;
  username?: string;
  amount: number;
  type: "deposit" | "withdrawal";
  status: "pending" | "completed" | "failed";
  method?: string;
  createdAt?: any;
};

export default function PaymentsSection() {
  const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;

  const [transactions, setTransactions] = useState<Transaction[]>([]);


  // -----------------------------
  // FETCH TRANSACTIONS (READ ONLY)
  // -----------------------------
  const fetchTransactions = useCallback(async () => {
  try {
    const user = getAuth().currentUser; // 👈 FIX HERE (no dependency issue)
    if (!user) return;

    const token = await user.getIdToken();

    const res = await fetch(
      `${API_BASE}/admin/transactions?type=deposit`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json();
    setTransactions(data || []);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}, [API_BASE]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>📊 Deposits Monitor</Text>

      <ScrollView>
        {transactions.length === 0 ? (
          <Text style={styles.emptyText}>No transactions yet</Text>
        ) : (
          transactions.map((t) => (
            <View key={t.id} style={styles.card}>
              <Text style={styles.username}>
                {t.username || t.userId}
              </Text>

              <Text style={styles.amount}>
                ${t.amount}
              </Text>

              <Text style={styles.meta}>
                {t.type} • {t.status}
              </Text>

              <Text style={styles.meta}>
                Method: {t.method || "N/A"}
              </Text>

              <Text style={styles.meta}>
                ID: {t.id}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#07070a" },
  header: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  username: { color: "#fff", fontWeight: "700" },
  amount: { color: "#7cf" },
  meta: { color: "#aaa", fontSize: 12 },
  emptyText: { color: "#666", textAlign: "center", marginTop: 20 },
});