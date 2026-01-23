// PaymentsSection.tsx
import {
  addDoc,
  collection,
  doc,
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
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
import { db } from "../../../firebaseConfig";

type PaymentDoc = {
  id?: string;
  uid?: string;
  username?: string;
  amount?: number;
  method?: string;
  screenshot?: string;
  date?: any;
  processing?: boolean;
};

const PaymentsSection = () => {
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [selected, setSelected] = useState<PaymentDoc | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectModal, setRejectModal] = useState(false);

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
    const ref = collection(db, "pendingPayments");
    return onSnapshot(ref, (snap) => {
      setPayments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
  }, []);

  const approve = async () => {
    if (!selected || loading) return;
    setLoading(true);

    try {
      await runTransaction(db, async (tx) => {
        const pendingRef = doc(db, "pendingPayments", selected.id!);
        const snap = await tx.get(pendingRef);
        if (!snap.exists()) throw new Error("Already processed");

        tx.set(doc(collection(db, "approvedPayments")), {
          ...selected,
          originalId: selected.id,
          approvedAt: serverTimestamp(),
        });

        if (selected.uid) {
          tx.update(doc(db, "users", selected.uid), {
            "accounts.real.balance": increment(Number(selected.amount)),
          });
        }

        tx.delete(pendingRef);
      });

      await addDoc(collection(db, "notifications"), {
        uid: selected.uid,
        title: "Payment Approved",
        message: `Your payment of ${selected.amount} was approved.`,
        createdAt: serverTimestamp(),
        read: false,
      });

      setModalVisible(false);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const reject = async () => {
    if (!selected || loading) return;
    setLoading(true);

    try {
      await runTransaction(db, async (tx) => {
        tx.set(doc(collection(db, "rejectedPayments")), {
          ...selected,
          originalId: selected.id,
          reason: rejectReason || "Rejected by admin",
          rejectedAt: serverTimestamp(),
        });
        tx.delete(doc(db, "pendingPayments", selected.id!));
      });

      await addDoc(collection(db, "notifications"), {
        uid: selected.uid,
        title: "Payment Rejected",
        message: rejectReason || "Payment rejected",
        createdAt: serverTimestamp(),
        read: false,
      });

      setRejectModal(false);
      setModalVisible(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.Text style={styles.header}>💳 Payments Approval</Animated.Text>

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

            {selected?.screenshot && (
              <Image source={{ uri: selected.screenshot }} style={styles.image} />
            )}

            <TouchableOpacity style={styles.approve} onPress={approve} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btn}>Approve</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.reject} onPress={() => setRejectModal(true)}>
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
