import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
  Modal,
  TextInput,
} from "react-native";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  increment,
  getDoc,
} from "firebase/firestore";
import { db } from "../../../firebaseConfig";

// -------------------------
// TYPES
// -------------------------
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
}

// -------------------------
// COMPONENT
// -------------------------
export default function PayoutsSection() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [filter, setFilter] =
    useState<"all" | "pending" | "paid" | "rejected">("all");

  const [selected, setSelected] = useState<Payout | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [reasonModal, setReasonModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // -------------------------
// GLOW ANIMATION (SAFE FIX)
// -------------------------
const glowAnim = useRef(new Animated.Value(0)).current;

useEffect(() => {
  const animation = Animated.loop(
    Animated.sequence([
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: false,
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: false,
      }),
    ])
  );

  animation.start();

  return () => animation.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,200,255,0.4)", "rgba(255,0,120,0.4)"],
  });

  // -------------------------
  // FETCH PAYOUTS
  // -------------------------
  useEffect(() => {
    const ref = collection(db, "payouts");
    const unsub = onSnapshot(ref, (snap) => {
      let arr: Payout[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));

      // Sort: pending first → newest first
      arr.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;

        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });

      setPayouts(arr);
    });

    return () => unsub();
  }, []);

  const filtered =
    filter === "all" ? payouts : payouts.filter((p) => p.status === filter);

  // -------------------------
  // APPROVE PAYOUT
  // -------------------------
  const markPaid = async () => {
    if (!selected) return;

    // Deduct balance from user
    const userRef = doc(db, "users", selected.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      await updateDoc(userRef, {
        balance: increment(-Math.abs(selected.amount)),
      });
    }

    // Update payout
    await updateDoc(doc(db, "payouts", selected.id), {
      status: "paid",
      paidAt: serverTimestamp(),
    });

    // Notify user
    await addDoc(collection(db, "notifications"), {
      uid: selected.uid,
      title: "Payout Approved",
      message: `Your payout of ${selected.amount} FRS has been approved.`,
      createdAt: serverTimestamp(),
      read: false,
    });

    setModalVisible(false);
  };

  // -------------------------
  // REJECT PAYOUT
  // -------------------------
  const rejectPayout = async () => {
    if (!selected) return;

    await updateDoc(doc(db, "payouts", selected.id), {
      status: "rejected",
      rejectedAt: serverTimestamp(),
      reason: rejectReason,
    });

    // Notify user
    await addDoc(collection(db, "notifications"), {
      uid: selected.uid,
      title: "Payout Rejected",
      message: rejectReason || "Your payout request was rejected.",
      createdAt: serverTimestamp(),
      read: false,
    });

    setRejectReason("");
    setReasonModal(false);
    setModalVisible(false);
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <View style={styles.container}>
      {/* Animated Header */}
      <Animated.View style={[styles.header, { shadowColor: glowColor }]}>
        <Text style={styles.headerText}>Payouts Management</Text>
      </Animated.View>

      {/* FILTERS */}
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

      {/* LIST */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {filtered.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.card}
            onPress={() => {
              setSelected(p);
              setModalVisible(true);
            }}
          >
            <Text style={styles.name}>{p.userName}</Text>
            <Text style={styles.amount}>Amount: {p.amount} FRS</Text>
            <Text style={styles.method}>Method: {p.method}</Text>
            <Text style={[styles.status, styles[p.status]]}>
              {p.status.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* DETAILS MODAL */}
      <Modal transparent visible={modalVisible} animationType="fade">
        <View style={styles.modalWrap}>
          <View style={styles.modalBox}>
            {selected && (
              <>
                <Text style={styles.modalTitle}>Payout Details</Text>

                <Text style={styles.modalText}>User: {selected.userName}</Text>
                <Text style={styles.modalText}>Amount: {selected.amount} FRS</Text>
                <Text style={styles.modalText}>Method: {selected.method}</Text>
                <Text style={styles.modalText}>Wallet: {selected.wallet}</Text>

                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.approveBtn} onPress={markPaid}>
                    <Text style={styles.btnText}>MARK AS PAID</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => setReasonModal(true)}
                  >
                    <Text style={styles.btnText}>REJECT</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.closeBtn}
                >
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* REJECT REASON MODAL */}
      <Modal transparent visible={reasonModal} animationType="slide">
        <View style={styles.modalWrap}>
          <View style={styles.reasonBox}>
            <Text style={styles.modalTitle}>Reject Reason</Text>

            <TextInput
              placeholder="Enter detailed reason..."
              placeholderTextColor="#777"
              value={rejectReason}
              onChangeText={setRejectReason}
              style={styles.input}
              multiline
            />

            <TouchableOpacity style={styles.rejectConfirmBtn} onPress={rejectPayout}>
              <Text style={styles.btnText}>CONFIRM REJECTION</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setReasonModal(false)}
              style={styles.closeBtn}
            >
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// -------------------------
// STYLES
// -------------------------
const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },

  header: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: "#141427",
    shadowOpacity: 1,
    shadowRadius: 25,
    marginBottom: 14,
  },

  headerText: {
    fontSize: 22,
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },

  filters: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },

  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#2a2a3d",
    borderRadius: 12,
  },

  filterActive: { backgroundColor: "#6f00d6" },

  filterText: { color: "white", fontSize: 12 },

  card: {
    padding: 16,
    backgroundColor: "#1a1a29",
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },

  name: { color: "white", fontSize: 16, fontWeight: "bold" },
  amount: { color: "#ddd", marginTop: 4 },
  method: { color: "#bbb", marginTop: 4 },

  status: {
    marginTop: 10,
    fontWeight: "bold",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: "flex-start",
    overflow: "hidden",
  },

  pending: { backgroundColor: "#ffaa0055", color: "orange" },
  paid: { backgroundColor: "#00ff8855", color: "#00ff88" },
  rejected: { backgroundColor: "#ff004455", color: "#ff0044" },

  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: 20,
  },

  modalBox: {
    backgroundColor: "#111",
    padding: 20,
    borderRadius: 14,
  },

  modalTitle: {
    color: "white",
    fontSize: 20,
    marginBottom: 12,
    fontWeight: "bold",
    textAlign: "center",
  },

  modalText: { color: "#ddd", marginBottom: 8 },

  modalBtns: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },

  approveBtn: {
    backgroundColor: "#00cc66",
    padding: 12,
    borderRadius: 10,
    flex: 1,
    marginRight: 8,
  },

  rejectBtn: {
    backgroundColor: "#cc0033",
    padding: 12,
    borderRadius: 10,
    flex: 1,
    marginLeft: 8,
  },

  btnText: { textAlign: "center", color: "white", fontWeight: "bold" },

  closeBtn: { marginTop: 14, padding: 8 },
  closeText: { textAlign: "center", color: "#888" },

  reasonBox: {
    backgroundColor: "#111",
    padding: 22,
    borderRadius: 14,
  },

  input: {
    backgroundColor: "#1d1d1d",
    color: "white",
    borderRadius: 10,
    padding: 12,
    minHeight: 90,
    marginTop: 10,
    textAlignVertical: "top",
  },

  rejectConfirmBtn: {
    backgroundColor: "#ff0044",
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
  },
});
