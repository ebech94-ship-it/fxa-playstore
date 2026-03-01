import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../../firebaseConfig";

type PayoutStatus = "pending" | "paid" | "rejected";

interface TransactionResponse {
  transactionId: string;
  uid: string;
  userName: string;
  amount: number;
  method: string;
  wallet?: string;
  status: PayoutStatus;
  createdAt?: any;
}

interface Payout {
  id: string;
  uid: string;
  userName: string;
  amount: number;
  method: string;
  wallet?: string;
  status: PayoutStatus;
  createdAt?: any;
}

export default function PayoutsSection() {
  const API_BASE = process.env.BACKEND_URL as string;

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [selected, setSelected] = useState<Payout | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);

  const glow = useRef(new Animated.Value(0)).current;

  // Glow animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 1200, useNativeDriver: false }),
      ])
    ).start();
  }, [glow]);

  // Fetch pending withdrawals
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setPayouts([]);
        return;
      }

      try {
        const token = await user.getIdToken();

        const res = await fetch(
          `${API_BASE}/admin/transactions?type=withdrawal&status=pending`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const data = await res.json();

        setPayouts(
          data.map((p: TransactionResponse) => ({
            id: p.transactionId,
            uid: p.uid,
            userName: p.userName,
            amount: p.amount,
            method: p.method,
            wallet: p.wallet,
            status: p.status,
            createdAt: p.createdAt,
          }))
        );
      } catch (err) {
        console.error("Failed to fetch payouts:", err);
      }
    });

    return () => unsubscribe();
  }, [API_BASE]);

  // Approve payout
  const approve = async () => {
    if (!selected || loading) return;

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const token = await user.getIdToken();

      const res = await fetch(`${API_BASE}/admin/approve-payout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transactionId: selected.id }),
      });

      if (!res.ok) throw new Error("Approval failed");

      setPayouts((prev) => prev.filter((p) => p.id !== selected.id));
      setModalVisible(false);
      setSelected(null);
      alert("Payout approved");
    } catch (e: any) {
      alert(e.message || "Approval error");
    } finally {
      setLoading(false);
    }
  };

  // Reject payout
  const reject = async () => {
    if (!selected || loading) return;

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const token = await user.getIdToken();

      const res = await fetch(`${API_BASE}/admin/reject-payout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transactionId: selected.id,
          reason: rejectReason || "Rejected by admin",
        }),
      });

      if (!res.ok) throw new Error("Reject failed");

      setPayouts((prev) => prev.filter((p) => p.id !== selected.id));
      setRejectModal(false);
      setModalVisible(false);
      setSelected(null);
      setRejectReason("");
    } catch (e: any) {
      alert(e?.message || "Rejection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>💸 Withdrawal Approvals</Text>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {payouts.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No pending withdrawals</Text>
          </View>
        ) : (
          payouts.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.card}
              onPress={() => {
                setSelected(p);
                setModalVisible(true);
              }}
            >
              <Text style={styles.username}>{p.userName}</Text>
              <Text style={styles.amount}>{p.amount} FRS</Text>
              <Text style={{ color: "#aaa", fontSize: 12 }}>
                {p.method} • ID: {p.id}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Details Modal */}
      <Modal visible={modalVisible} transparent>
        <View style={styles.overlay}>
          <View style={styles.box}>
            <Text style={styles.title}>Payout Details</Text>
            <Text style={styles.text}>User: {selected?.userName}</Text>
            <Text style={styles.text}>Amount: {selected?.amount} FRS</Text>
            <Text style={styles.text}>Method: {selected?.method}</Text>
            <Text style={styles.text}>Wallet: {selected?.wallet || "N/A"}</Text>

            <TouchableOpacity style={styles.approve} onPress={approve} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btn}>MARK PAID</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reject}
              onPress={() => setRejectModal(true)}
              disabled={loading}
            >
              <Text style={styles.btn}>REJECT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal visible={rejectModal} transparent>
        <View style={styles.overlay}>
          <View style={styles.box}>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Reason"
              placeholderTextColor="#777"
              style={styles.input}
              multiline
            />
            <TouchableOpacity style={styles.reject} onPress={reject}>
              <Text style={styles.btn}>CONFIRM REJECT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#07070a" },
  header: { color: "#fff", fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  card: { backgroundColor: "#111", padding: 14, borderRadius: 12, marginBottom: 10 },
  username: { color: "#fff", fontWeight: "700" },
  amount: { color: "#7cf" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 20 },
  box: { backgroundColor: "#0b0c10", padding: 18, borderRadius: 14 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 10 },
  text: { color: "#ddd", marginBottom: 6 },
  approve: { backgroundColor: "#19a974", padding: 12, borderRadius: 10, marginTop: 10 },
  reject: { backgroundColor: "#b00020", padding: 12, borderRadius: 10, marginTop: 10 },
  btn: { color: "#fff", fontWeight: "800", textAlign: "center" },
  input: { backgroundColor: "#111", color: "#fff", borderRadius: 8, padding: 10 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 40 },
  emptyText: { color: "#6b7280", fontSize: 14, fontWeight: "600" },
});