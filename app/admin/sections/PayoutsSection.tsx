import { getAuth } from "firebase/auth";
import { useEffect, useState, useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

type Transaction = {
  id: string;
  userId: string;
  userName?: string;
  amount: number;
  type: "deposit" | "withdrawal";
  status: string;
  createdAt?: any;
};

export default function PaymentsSection() {
  const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const auth = getAuth();

  const fetchTransactions = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken();

      const res = await fetch(`${API_BASE}/admin/transactions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      setTransactions(data || []);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  }, [API_BASE, auth]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>📊 Admin Ledger</Text>

      <ScrollView>
        {transactions.length === 0 ? (
          <Text style={styles.empty}>No transactions</Text>
        ) : (
          transactions.map((t) => (
            <View key={t.id} style={styles.card}>
              <Text style={styles.user}>{t.userName || t.userId}</Text>
              <Text style={styles.amount}>
                {t.type.toUpperCase()} • ${t.amount}
              </Text>

              <Text style={styles.meta}>Status: {t.status}</Text>
              <Text style={styles.meta}>ID: {t.id}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#07070a" },
  header: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center" },
  card: { backgroundColor: "#111", padding: 12, borderRadius: 10, marginBottom: 10 },
  user: { color: "#fff", fontWeight: "700" },
  amount: { color: "#7cf" },
  meta: { color: "#aaa", fontSize: 12 },
  empty: { color: "#666", textAlign: "center", marginTop: 20 },
});