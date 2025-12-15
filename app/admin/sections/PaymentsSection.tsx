// PaymentsSection.tsx
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../../firebaseConfig"; // adjust if your path differs

type PaymentDoc = {
  id?: string;
  uid?: string;
  username?: string;
  amount?: number;
  method?: string;
  screenshot?: string; // URL (optional)
  date?: string | number;
  meta?: Record<string, any>;
};

const PaymentsSection: React.FC = () => {
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [selected, setSelected] = useState<PaymentDoc | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectModalVisible, setRejectModalVisible] = useState(false);

  // nice glow animation for header
  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1300, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1300, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glowAnim]);
  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(130,0,255,0.35)", "rgba(0,180,255,0.35)"],
  });

  // subscribe to pendingPayments collection
  useEffect(() => {
    const ref = collection(db, "pendingPayments");
    const unsub = onSnapshot(ref, (snap) => {
      const list: PaymentDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      // sort newest first if date exists
      list.sort((a, b) => {
        const da = a.date ? Number(a.date) : 0;
        const dbv = b.date ? Number(b.date) : 0;
        return dbv - da;
      });
      setPayments(list);
    });
    return () => unsub();
  }, []);

  // Approve flow: add to approvedPayments, update user balance, delete pending, notify
  const approvePayment = async (p: PaymentDoc) => {
    if (!p?.id) return;
    setLoading(true);
    try {
      // add approved record
      await addDoc(collection(db, "approvedPayments"), {
        uid: p.uid ?? null,
        username: p.username ?? null,
        amount: p.amount ?? 0,
        method: p.method ?? null,
        screenshot: p.screenshot ?? null,
        originalId: p.id,
        approvedAt: serverTimestamp(),
        adminNote: `Approved by admin`,
      });

      // update user balance if uid exists
      if (p.uid) {
        const userRef = doc(db, "users", p.uid);
        // use increment to avoid race conditions
        await updateDoc(userRef, {
          balance: increment(Number(p.amount ?? 0)),
          lastCreditedAt: serverTimestamp(),
        });
      }

      // optional: add a notification doc for the user
      if (p.uid) {
        await addDoc(collection(db, "notifications"), {
          uid: p.uid,
          title: "Payment Approved",
          message: `Your payment of ${p.amount} via ${p.method} was approved.`,
          createdAt: serverTimestamp(),
          read: false,
        });
      }

      // finally delete pending
      await deleteDoc(doc(db, "pendingPayments", p.id));
      Alert.alert("Success", `Payment approved — ${p.amount} moved to user.`);
      setModalVisible(false);
      setSelected(null);
    } catch (err: any) {
      console.error("approvePayment error", err);
      Alert.alert("Error", err?.message ?? "Could not approve payment");
    } finally {
      setLoading(false);
    }
  };

  // Reject flow: move to rejectedPayments with optional reason, delete pending
  const rejectPayment = async (p: PaymentDoc, reason?: string) => {
    if (!p?.id) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "rejectedPayments"), {
        uid: p.uid ?? null,
        username: p.username ?? null,
        amount: p.amount ?? 0,
        method: p.method ?? null,
        screenshot: p.screenshot ?? null,
        originalId: p.id,
        rejectedAt: serverTimestamp(),
        reason: reason ?? "Rejected by admin",
      });

      // notify user if uid
      if (p.uid) {
        await addDoc(collection(db, "notifications"), {
          uid: p.uid,
          title: "Payment Rejected",
          message: `Your payment of ${p.amount} was rejected. Reason: ${reason ?? "See admin"}`,
          createdAt: serverTimestamp(),
          read: false,
        });
      }

      await deleteDoc(doc(db, "pendingPayments", p.id));
      Alert.alert("Rejected", `Payment rejected and moved to rejectedPayments.`);
      setRejectModalVisible(false);
      setModalVisible(false);
      setSelected(null);
    } catch (err: any) {
      console.error("rejectPayment error", err);
      Alert.alert("Error", err?.message ?? "Could not reject payment");
    } finally {
      setLoading(false);
    }
  };

  // quick UI helper to open detail modal
  const openDetail = (p: PaymentDoc) => {
    setSelected(p);
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.header, { shadowColor: glowColor }]}>
        💳 Payments & Approvals
      </Animated.Text>

      <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 14 }}>
        {payments.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.empty}>No pending payments</Text>
          </View>
        ) : (
          payments.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.card}
              onPress={() => openDetail(p)}
              activeOpacity={0.95}
            >
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.username}>{p.username ?? "Unknown"}</Text>
                  <Text style={styles.method}>{p.method ?? "—"}</Text>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.amount}>${Number(p.amount ?? 0).toFixed(2)}</Text>
                  <Text style={styles.date}>
                    {p.date ? new Date(Number(p.date)).toLocaleString() : "Unknown"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* DETAILS MODAL */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalHeader}>Payment Details</Text>

            {!selected ? (
              <Text style={styles.modalText}>No selection</Text>
            ) : (
              <>
                <Text style={styles.modalText}>User: {selected.username ?? "—"}</Text>
                <Text style={styles.modalText}>UID: {selected.uid ?? "—"}</Text>
                <Text style={styles.modalText}>Amount: ${Number(selected.amount ?? 0).toFixed(2)}</Text>
                <Text style={styles.modalText}>Method: {selected.method ?? "—"}</Text>

                {selected.screenshot ? (
                  <Image source={{ uri: selected.screenshot }} style={styles.screenshot} />
                ) : (
                  <Text style={styles.noImage}>No screenshot uploaded</Text>
                )}

                <View style={{ marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.approveBtn, { opacity: loading ? 0.8 : 1 }]}
                    onPress={() =>
                      Alert.alert(
                        "Approve Payment",
                        `Approve ${selected?.amount} to ${selected?.username}?`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Approve",
                            onPress: () => approvePayment(selected),
                          },
                        ]
                      )
                    }
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveText}>Approve</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => setRejectModalVisible(true)}
                    disabled={loading}
                  >
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.closeBtn} onPress={() => { setModalVisible(false); setSelected(null); }}>
                    <Text style={styles.closeText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* REJECT REASON MODAL */}
      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalHeader}>Reject Payment</Text>
            <Text style={styles.modalText}>Reason (optional):</Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="e.g. invalid screenshot / mismatch"
              placeholderTextColor="#888"
              style={styles.rejectInput}
              multiline
            />

            <View style={{ marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.rejectBtn, { marginBottom: 8 }]}
                onPress={() => {
                  if (!selected) return;
                  rejectPayment(selected, rejectReason || "Rejected by admin");
                }}
              >
                <Text style={styles.rejectText}>Confirm Reject</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.closeText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default PaymentsSection;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#07070a" },

  header: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
  },

  emptyWrap: { padding: 40, alignItems: "center" },
  empty: { color: "#777", fontSize: 15 },

  card: {
    backgroundColor: "#0f1116",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1b1e2a",
  },

  cardRow: { flexDirection: "row", alignItems: "center" },

  username: { color: "#fff", fontWeight: "700", fontSize: 16 },
  method: { color: "#aaa", fontSize: 13, marginTop: 3 },

  amount: { color: "#7cf", fontWeight: "800", fontSize: 16 },
  date: { color: "#666", fontSize: 11 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    padding: 20,
  },

  modalBox: {
    backgroundColor: "#0b0c10",
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#222",
  },

  modalHeader: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  modalText: { color: "#ddd", fontSize: 14, marginBottom: 6 },

  screenshot: { width: "100%", height: 200, borderRadius: 10, marginTop: 8 },

  noImage: { color: "#777", marginVertical: 8 },

  approveBtn: {
    backgroundColor: "#19a974",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
  },
  approveText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  rejectBtn: {
    backgroundColor: "#b00020",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  rejectText: { color: "#fff", fontWeight: "700" },

  closeBtn: {
    backgroundColor: "#222",
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    alignItems: "center",
  },
  closeText: { color: "#ddd" },

  closeTextAlt: { color: "#999" },

  rejectInput: {
    backgroundColor: "#111",
    color: "#fff",
    padding: 10,
    borderRadius: 8,
    minHeight: 60,
    marginTop: 8,
  },
});
