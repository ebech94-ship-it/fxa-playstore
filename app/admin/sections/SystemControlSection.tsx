// SystemControlSection.tsx
import { getAuth } from "firebase/auth";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";

type Transaction = { id: string; user: string; amount: number; status: string };

export default function SystemControlSection() {
  const [frozen, setFrozen] = useState(false);
  const [pendingTxs, setPendingTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("https://forexapp2-backend.onrender.com/admin/pending-transactions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendingTxs(data);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFreeze = async () => {
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("https://forexapp2-backend.onrender.com/admin/toggle-freeze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ freeze: !frozen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFrozen(!frozen);
      Alert.alert("Success", `System ${!frozen ? "frozen" : "unfrozen"}`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  useEffect(() => { fetchTransactions(); }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚡ System Control</Text>

      <TouchableOpacity style={[styles.freezeBtn, frozen && styles.freezeActive]} onPress={toggleFreeze}>
        <Text style={styles.freezeText}>{frozen ? "Unfreeze System" : "Freeze System"}</Text>
      </TouchableOpacity>

      <Text style={styles.subTitle}>💰 Pending Transactions</Text>

      {loading ? <ActivityIndicator size="large" color="#3b82f6" /> :
        <FlatList
          data={pendingTxs}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <Text style={styles.index}>{index + 1}.</Text>
              <Text style={styles.txUser}>{item.user}</Text>
              <Text style={styles.txAmount}>{item.amount} $</Text>
              <Text style={styles.txStatus}>{item.status}</Text>
            </View>
          )}
        />
      }
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07081a", padding: 16 },
  title: { fontSize: 20, fontWeight: "900", color: "#fff", marginBottom: 16 },
  freezeBtn: { padding: 12, backgroundColor: "#16a34a", borderRadius: 8, alignItems: "center", marginBottom: 20 },
  freezeActive: { backgroundColor: "#dc2626" },
  freezeText: { color: "#fff", fontWeight: "800" },
  subTitle: { fontSize: 16, fontWeight: "700", color: "#fff", marginBottom: 10 },
  row: { flexDirection: "row", padding: 10, backgroundColor: "#12122a", marginBottom: 6, borderRadius: 8, alignItems: "center" },
  index: { width: 30, color: "#facc15", fontWeight: "800" },
  txUser: { flex: 1, color: "#fff" },
  txAmount: { width: 80, color: "#22c55e", fontWeight: "800" },
  txStatus: { width: 80, color: "#3b82f6", fontWeight: "800" },
});