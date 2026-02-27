// PaymentsSection.tsx
//import {  collection,  onSnapshot, } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
//import { db } from "../../../firebaseConfig";
import { getAuth } from "firebase/auth";

type PaymentDoc = {
  id: string;
  userId: string;
  username?: string;
  amount: number;
  method?: string;
   type: "deposit" | "withdrawal";
  status: "pending" | "deposit completed" | "REJECTED";
  createdAt: any;
  processing?: boolean;
};

const PaymentsSection = () => {
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [selected, setSelected] = useState<PaymentDoc | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectModal, setRejectModal] = useState(false);
  
const auth = getAuth();

  const glow = useRef(new Animated.Value(0)).current;
   // 🔁 Glow animation (runs once)
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

useEffect(() => {
  const unsubscribe = auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const token = await user.getIdToken();
        const res = await fetch(
        "https://forexapp2-backend.onrender.com/admin/transactions?type=deposit&status=pending",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        setPayments(data);
      } catch (err) {
        console.error("Failed to fetch payments:", err);
      }
    } else {
      setPayments([]);
    }
  });

  return () => unsubscribe();
}, [auth]); // ✅ add auth here

 const approve = async () => {
  if (!selected || loading) return;

  if (!selected.amount || Number(selected.amount) <= 0) {
    Alert.alert("Invalid amount");
    return;
  }

  setLoading(true);

  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");

    const token = await user.getIdToken();

    const res = await fetch(
      "https://forexapp2-backend.onrender.com/transactions/approve",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ txId: selected.id }),
      }
    );

    if (!res.ok) throw new Error("Approval failed");

    Alert.alert("Success", "Payment approved");
    setPayments((prev) =>
  prev.filter((p) => p.id !== selected.id)
);
    setModalVisible(false);
    setSelected(null);
  } catch (e: any) {
    Alert.alert("Error", e.message || "Approval error");
  } finally {
    setLoading(false);
  }
};

const reject = async () => {
  if (!selected || loading) return;

  setLoading(true);

  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");

    const token = await user.getIdToken();

    const res = await fetch(
      "https://forexapp2-backend.onrender.com/transactions/reject",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ txId: selected.id, reason: rejectReason|| "Rejected by admin",
        }),
      }
    );

    if (!res.ok) throw new Error("Reject failed");
setPayments((prev) =>
  prev.filter((p) => p.id !== selected?.id)
);
    setRejectModal(false);
    setModalVisible(false);
    setSelected(null);
    setRejectReason("");
  } catch (e: any) {
    Alert.alert("Error", e?.message || "Rejection failed");
  } finally {
    setLoading(false);
  }
};


  return (
    <View style={styles.container}>
      <Animated.Text style={styles.header}>💳 Deposit Approvals</Animated.Text>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
  {payments.length === 0 ? (
    <View style={styles.emptyWrap}>
      <Animated.Text
        style={[
          styles.emptyText,
          {
            opacity: glow.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 1],
            }),
          },
        ]}
      >
        No pending payments
      </Animated.Text>
    </View>
  ) : (
    payments.map((p) => (
      <TouchableOpacity
        key={p.id}
        style={styles.card}
        onPress={() => {
          setSelected(p);
          setModalVisible(true);
        }}
      >
        <Text style={styles.username}>{p.username}</Text>
<Text style={styles.amount}>${p.amount}</Text>
<Text style={{ color: "#aaa", fontSize: 12 }}>
  {p.method || "Method"} • ID: {p.id}
</Text>
      </TouchableOpacity>
    ))
  )}
</ScrollView>
      <Modal visible={modalVisible} transparent>
        <View style={styles.overlay}>
          <View style={styles.box}>
            <Text style={styles.title}>Payment Details</Text>
            <Text style={styles.text}>User: {selected?.username}</Text>
            <Text style={styles.text}>Amount: ${selected?.amount}</Text>
<Text style={styles.text}>  Method: {selected?.method || "N/A"}</Text>
<Text style={styles.text}>
  Date: {selected?.createdAt
    ? new Date(selected.createdAt).toLocaleString()
    : "No date"}
</Text>
<Text style={[styles.text, { color: "#7cf" }]}> Type: Deposit</Text>
            <TouchableOpacity
  style={styles.approve}
  onPress={approve}
  disabled={loading}
>
 {loading ? <ActivityIndicator color="#fff" /> : <Text
  style={styles.btn}>Approve</Text>}
            </TouchableOpacity>

            <TouchableOpacity
  style={styles.reject}
  onPress={() => setRejectModal(true)}
  disabled={loading}
                >

              <Text style={styles.btn}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={rejectModal} transparent>
        <View style={styles.overlay}>
          <View style={styles.box}>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Reason"
              placeholderTextColor="#777"
              style={styles.input}
            />
            <TouchableOpacity style={styles.reject} onPress={reject}>
              <Text style={styles.btn}>Confirm Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default PaymentsSection;

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
  image: { width: "100%", height: 200, borderRadius: 10, marginVertical: 8 },
  approve: { backgroundColor: "#19a974", padding: 12, borderRadius: 10, marginTop: 10 },
  reject: { backgroundColor: "#b00020", padding: 12, borderRadius: 10, marginTop: 10 },
  btn: { color: "#fff", fontWeight: "800", textAlign: "center" },
  input: { backgroundColor: "#111", color: "#fff", borderRadius: 8, padding: 10 },
emptyWrap: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  paddingTop: 40,
},
emptyText: {
  color: "#6b7280",
  fontSize: 14,
  fontWeight: "600",
},

});
