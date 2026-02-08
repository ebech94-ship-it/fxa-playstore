import {
  collection,
   onSnapshot,
} from "firebase/firestore";
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
import { db } from "../../../firebaseConfig";

type PayoutStatus = "pending" | "paid" | "rejected";

interface Payout {
  id: string;
  uid: string;
  userName: string;
  amount: number;
  method: string;
  wallet: string;
  status: PayoutStatus;
  createdAt?: any;
  processing?: boolean;
}

export default function PayoutsSection() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [filter, setFilter] =
    useState<"all" | "pending" | "paid" | "rejected">("all");
  const [selected, setSelected] = useState<Payout | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [reasonModal, setReasonModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  // glow
  const glowAnim = useRef(new Animated.Value(0)).current;
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(30, 58, 66, 0.4)", "rgba(255,0,120,0.4)"],
  });

  // fetch payouts
  useEffect(() => {
    const ref = collection(db, "payouts");
    return onSnapshot(ref, (snap) => {
      const arr: Payout[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      arr.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });
      setPayouts(arr);
    });
  }, []);

  const filtered =
    filter === "all" ? payouts : payouts.filter((p) => p.status === filter);

  // approve payout
 const markPaid = async () => {
  if (!selected || busy) return;

  setBusy(true);

  try {
    const res = await fetch(
      "https://forexapp2-backend.onrender.com/admin/approve-payout",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutId: selected.id,
        }),
      }
    );

    if (!res.ok) throw new Error("Payout approval failed");

    alert("Payout marked as paid");
    setModalVisible(false);
  } catch (e: any) {
    alert(e.message || "Error approving payout");
  } finally {
    setBusy(false);
  }
};


  // reject payout
 const rejectPayout = async () => {
  if (!selected || busy) return;

  setBusy(true);

  try {
    const res = await fetch(
      "https://forexapp2-backend.onrender.com/admin/reject-payout",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutId: selected.id,
          reason: rejectReason || "Rejected by admin",
        }),
      }
    );

    if (!res.ok) throw new Error("Rejection failed");

    setRejectReason("");
    setReasonModal(false);
    setModalVisible(false);
  } catch (e: any) {
    alert(e.message || "Error rejecting payout");
  } finally {
    setBusy(false);
  }
};



  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { shadowColor: glowColor }]}>
        <Text style={styles.headerText}>Withdrawal Payouts</Text>
      </Animated.View>

      <View style={styles.filters}>
        {["all", "pending", "paid", "rejected"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterActive]}
            onPress={() => setFilter(f as any)}
          >
            <Text style={styles.filterText}>{f.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView>
        {filtered.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.card}
           onPress={() => {
  if (p.status !== "pending") return;
  setSelected(p);
  setModalVisible(true);
}}

          >
            <Text style={styles.name}>{p.userName}</Text>
            <Text style={styles.amount}>Amount: {p.amount} FRS</Text>
            <Text style={[styles.status, styles[p.status]]}>
              {p.status.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal transparent visible={modalVisible}>
        <View style={styles.modalWrap}>
          <View style={styles.modalBox}>
            {selected && (
              <>
                <Text style={styles.modalTitle}>Payout Details</Text>
                <Text style={styles.modalText}>User: {selected.userName}</Text>
                <Text style={styles.modalText}>Amount: {selected.amount} FRS</Text>

                <View style={styles.modalBtns}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={markPaid}
                    disabled={busy}
                  >
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>MARK PAID</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => setReasonModal(true)}
                    disabled={busy}
                  >
                    <Text style={styles.btnText}>REJECT</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal transparent visible={reasonModal}>
        <View style={styles.modalWrap}>
          <View style={styles.reasonBox}>
            <TextInput
              placeholder="Reason..."
              placeholderTextColor="#777"
              value={rejectReason}
              onChangeText={setRejectReason}
              style={styles.input}
              multiline
            />
            <TouchableOpacity style={styles.rejectConfirmBtn} onPress={rejectPayout}>
              <Text style={styles.btnText}>CONFIRM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  header: { padding: 18, borderRadius: 14, backgroundColor: "#141427", marginBottom: 14 },
  headerText: { fontSize: 22, color: "white", fontWeight: "bold", textAlign: "center" },
  filters: { flexDirection: "row", justifyContent: "space-around", marginBottom: 12 },
  filterBtn: { padding: 8, backgroundColor: "#2a2a3d", borderRadius: 12 },
  filterActive: { backgroundColor: "#6f00d6" },
  filterText: { color: "white", fontSize: 12 },
  card: { padding: 16, backgroundColor: "#1a1a29", borderRadius: 14, marginBottom: 12 },
  name: { color: "white", fontWeight: "bold" },
  amount: { color: "#ccc" },
  status: { marginTop: 6, fontWeight: "bold" },
  pending: { color: "orange" },
  paid: { color: "#00ff88" },
  rejected: { color: "#ff0044" },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  modalBox: { backgroundColor: "#111", padding: 20, borderRadius: 14 },
  modalTitle: { color: "white", fontSize: 18, marginBottom: 10 },
  modalText: { color: "#ddd", marginBottom: 6 },
  modalBtns: { flexDirection: "row", marginTop: 12 },
  approveBtn: { flex: 1, backgroundColor: "#00cc66", padding: 12, borderRadius: 10, marginRight: 6 },
  rejectBtn: { flex: 1, backgroundColor: "#cc0033", padding: 12, borderRadius: 10, marginLeft: 6 },
  btnText: { textAlign: "center", color: "#fff", fontWeight: "bold" },
  reasonBox: { backgroundColor: "#111", padding: 20, borderRadius: 14 },
  input: { backgroundColor: "#1d1d1d", color: "white", borderRadius: 10, padding: 12 },
  rejectConfirmBtn: { backgroundColor: "#ff0044", padding: 12, borderRadius: 10, marginTop: 12 },
});
