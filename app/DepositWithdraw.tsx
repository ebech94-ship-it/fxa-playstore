import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { useApp } from "./AppContext";

import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL as string;


/* -------------------- Payment Methods -------------------- */
const paymentMethods = [
  { name: "MTN", color: "#FFCD00", icon: require("../assets/images/mtn.png"), enabled: true },
  { name: "Orange", color: "#FF7900", icon: require("../assets/images/orange.png"), enabled: true },
  { name: "Visa", color: "#1A1F71", icon: require("../assets/images/VISA.jpg"), enabled: false },
  { name: "MasterCard", color: "#EB001B", icon: require("../assets/images/mastercard.png"), enabled: false },
  { name: "BTC", color: "#555", icon: require("../assets/images/BT.jpg"), enabled: false },
  { name: "USDT", color: "#555", icon: require("../assets/images/USDT.jpg"), enabled: false },
];
const LIMITS = {
  mobile: {
    currency: "XAF",
    deposit: {
      min: 1000,
      max: 500000,
    },
    withdraw: {
      min: 2500,
    },
  },
  card: {
    currency: "USD",
    deposit: {
      min: 10,
      max: 5000,
    },
    withdraw: {
      min: 10,
    },
  },
};


export default function DepositWithdraw() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  const [isDeposit, setIsDeposit] = useState(true);
  const [activeMethod, setActiveMethod] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
const { appSettings, profile } = useApp();

  /* -------------------- Form State -------------------- */
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    amount: "",
    currency: "XAF",
    code: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
    walletAddress: "",
    note: "",
  });

  const isMobileMoney =
  activeMethod === "MTN" || activeMethod === "Orange";

const methodLimits = isMobileMoney ? LIMITS.mobile : LIMITS.card;


  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setCurrentUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    setActiveMethod("");
    setModalVisible(false);
  }, [isDeposit]);

  /* -------------------- Open Modal -------------------- */
  const openForm = (method: string) => {
    if (!method) return;

    setActiveMethod(method);

    setFormData((prev) => ({
      ...prev,
      currency:
        method === "MTN" || method === "Orange" ? "XAF" : "USD",
      fullName: currentUser?.displayName || "",
    }));

    setModalVisible(true);
  };


  /* -------------------- CamPay Deposit (UNCHANGED) -------------------- */
  const handleCampayPayment = async () => {
    const token = await getAuth().currentUser?.getIdToken();

    const res = await fetch(`${API_BASE}/campay/create-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
  userId: currentUser?.uid,
  amount: Number(formData.amount),
  currency: formData.currency,
  method: isMobileMoney ? "mobile" : "card",
  operator: activeMethod,
  phone: isMobileMoney ? formData.phone : undefined,
}),

    });

    const data = await res.json();

    if (!res.ok) {
      Alert.alert("Payment Error", data.error || "Failed");
      return;
    }

    Alert.alert(
  "Payment Pending",
  "Confirm on your phone. Balance will update after confirmation."
);

  };

  /* -------------------- Withdrawal -------------------- */
 const handleWithdrawal = async () => {
  const numericAmount = Number(formData.amount);
  if (!numericAmount || numericAmount <= 0) {
    Alert.alert("Invalid Amount", "Enter a valid amount.");
    return;
  }
  if (!appSettings.enablePayouts) {
  Alert.alert(
    "Payouts Disabled",
    "Payout requests are temporarily disabled. Please try again later."
  );
  return;
}

if (appSettings.maintenanceMode) {
  Alert.alert(
    "Maintenance Mode",
    "Withdrawals are unavailable during maintenance."
  );
  return;
}


  await runTransaction(db, async (tx) => {
    tx.set(doc(collection(db, "payouts")), {
      uid: currentUser!.uid,
      userName: currentUser?.displayName || "User",
      amount: numericAmount,
      method: activeMethod,
      wallet: formData.phone || formData.walletAddress || "",
      status: "pending",
      createdAt: serverTimestamp(),
    });
  });

  await addDoc(collection(db, "notifications"), {
    uid: currentUser!.uid,
    title: "Withdrawal Requested",
    message: `Your payout request of ${numericAmount} ${formData.currency} is pending admin approval.`,
    type: "payout",
    createdAt: serverTimestamp(),
    read: false,
  });

  Alert.alert("Request Sent", "Waiting for admin approval.");
};


  /* -------------------- Submit -------------------- */
  const submitForm = async () => {
  if (!currentUser) return;

  // 🔒 Min / Max validation
 const amount = Number(formData.amount);

if (isDeposit) {
  if (amount < methodLimits.deposit.min) {
    Alert.alert(
      "Minimum Deposit",
      `Minimum deposit is ${methodLimits.deposit.min.toLocaleString()} ${methodLimits.currency}`
    );
    return;
  }

  if (amount > methodLimits.deposit.max) {
    Alert.alert(
      "Maximum Deposit",
      `Maximum deposit is ${methodLimits.deposit.max.toLocaleString()} ${methodLimits.currency}`
    );
    return;
  }
} else {
  if (amount < methodLimits.withdraw.min) {
    Alert.alert(
      "Minimum Withdrawal",
      `Minimum withdrawal is ${methodLimits.withdraw.min.toLocaleString()} ${methodLimits.currency}`
    );
    return;
  }
}
if (isDeposit && isMobileMoney) {
  if (!/^2376\d{8}$/.test(formData.phone)) {
    Alert.alert(
      "Invalid Phone",
      "Phone must be in format 2376XXXXXXXX"
    );
    return;
  }
}
  try { 
   setLoading(true);

    if (isDeposit) {
      await handleCampayPayment();
    } else {
      await handleWithdrawal();
    }

    setModalVisible(false);
    setFormData({
      fullName: "",
      phone: "",
      amount: "",
      currency: "XAF",
      code: "",
      cardNumber: "",
      expiry: "",
      cvv: "",
      walletAddress: "",
      note: "",
    });
  } catch {
    Alert.alert("Error", "Something went wrong.");
  } finally {
    setLoading(false);
  }
};


  /* -------------------- Auth Guard -------------------- */
  if (!currentUser) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: "#fff", marginBottom: 12 }}>
            This is a preview mode — you can explore the app safely. No real actions or transactions are possible here.
          </Text>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={() => router.push("/welcome")}
        >
          <Text style={styles.confirmButtonText}> Return to Welcome</Text>
        </TouchableOpacity>
      </View>
    );
  }
  /* -------------------- Preview Guard -------------------- */
if (profile?.preview) {
  return (
    <View
      style={[
        styles.container,
        { justifyContent: "center", alignItems: "center" },
      ]}
    >
      <Text
        style={{
          color: "#FACC15",
          fontSize: 18,
          fontWeight: "bold",
          marginBottom: 10,
        }}
      >
        Preview Mode
      </Text>

      <Text
        style={{
          color: "#ccc",
          textAlign: "center",
          marginBottom: 20,
        }}
      >
     Deposits and withdrawals are not available in this version.
You can navigate and explore the app safely without making any real transactions.
      </Text>

      <TouchableOpacity
        style={styles.confirmButton}
        onPress={() => router.back()}
      >
        <Text style={styles.confirmButtonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

  /* -------------------- UI -------------------- */
  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={["#6a5acd", "#00ffff"]} style={styles.headerContainer}>
        <Text style={styles.headerText}>
          {isDeposit ? "Deposit" : "Withdraw"}
        </Text>
      </LinearGradient>

      <View style={styles.switchContainer}>
        <Text style={{ color: "#fff" }}>Deposit</Text>
        <Switch value={isDeposit} onValueChange={() => setIsDeposit(!isDeposit)} />
        <Text style={{ color: "#fff" }}>Withdraw</Text>
      </View>

      <Text style={styles.methodHeader}>Select Method</Text>
      <View style={styles.methodsContainer}>
        {paymentMethods.map((m, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.methodButton, { backgroundColor: m.color, opacity: m.enabled ? 1 : 0.4 }]}
            onPress={() => {
              if (!m.enabled) {
                Alert.alert("Coming Soon", `${m.name} not available yet.`);
                return;
              }
              openForm(m.name);
            }}
          >
            <Image source={m.icon} style={styles.methodIcon} />
            <Text style={styles.methodText}>{m.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* -------------------- MODAL -------------------- */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{activeMethod} Form</Text>

            <TextInput
              placeholder="Full Name"
              value={formData.fullName}
              onChangeText={(v) => handleChange("fullName", v)}
              style={styles.modalInput}
              placeholderTextColor="#888"
            />

            <TextInput
  placeholder="Amount"
  value={formData.amount}
  onChangeText={(v) => handleChange("amount", v)}
  keyboardType="numeric"
  style={styles.modalInput}
  placeholderTextColor="#888"
/>
{/* Inline validation error */}
{formData.amount !== "" &&
 Number(formData.amount) <
  (isDeposit
    ? methodLimits.deposit.min
    : methodLimits.withdraw.min) && (
    <Text style={styles.amountError}>
      Amount is below minimum allowed
    </Text>
)}<Text style={styles.amountHint}>
  {isDeposit ? (
    <>
      Min deposit:{" "}
      <Text style={styles.amountHighlight}>
        {methodLimits.deposit.min.toLocaleString()}{" "}
        {methodLimits.currency}
      </Text>{" "}
      • Max deposit:{" "}
      <Text style={styles.amountHighlight}>
        {methodLimits.deposit.max.toLocaleString()}{" "}
        {methodLimits.currency}
      </Text>
    </>
  ) : (
    <>
      Min withdrawal:{" "}
      <Text style={styles.amountHighlight}>
        {methodLimits.withdraw.min.toLocaleString()}{" "}
        {methodLimits.currency}
      </Text>
    </>
  )}
</Text>


            {(activeMethod === "MTN" || activeMethod === "Orange") && (
              <TextInput
                placeholder="Phone (237...)"
                value={formData.phone}
                onChangeText={(v) => handleChange("phone", v)}
                keyboardType="phone-pad"
                style={styles.modalInput}
                placeholderTextColor="#888"
              />
            )}

            {(activeMethod === "Visa" || activeMethod === "MasterCard") && (
              <>
                <TextInput placeholder="Card Number" style={styles.modalInput} />
                <TextInput placeholder="MM/YY" style={styles.modalInput} />
                <TextInput placeholder="CVV" style={styles.modalInput} />
              </>
            )}

            {(activeMethod === "BTC" || activeMethod === "USDT") && (
              <TextInput
                placeholder="Wallet Address"
                value={formData.walletAddress}
                onChangeText={(v) => handleChange("walletAddress", v)}
                style={styles.modalInput}
                placeholderTextColor="#888"
              />
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#FF6B6B" }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#6a5acd" }]}
                onPress={submitForm}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/* -------------------- Styles -------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1e1e2f", padding: 20 },
  headerContainer: { padding: 15, borderRadius: 12, marginBottom: 20 },
  headerText: { fontSize: 26, fontWeight: "bold", color: "#fff", textAlign: "center" },
  switchContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  methodHeader: { color: "#fff", fontSize: 18, marginBottom: 10 },
  methodsContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  methodButton: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, minWidth: "48%", marginBottom: 10 },
  methodIcon: { width: 24, height: 24, marginRight: 10 },
  methodText: { color: "#fff", fontWeight: "bold" },
  confirmButton: { backgroundColor: "#6a5acd", padding: 15, borderRadius: 10 },
  confirmButtonText: { color: "#fff", fontWeight: "bold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalContainer: { width: "85%", backgroundColor: "#2C2C44", padding: 20, borderRadius: 15 },
  modalTitle: { color: "#fff", fontSize: 20, marginBottom: 15, textAlign: "center" },
  modalInput: { backgroundColor: "#1C1C2E", borderRadius: 10, padding: 12, color: "#fff", marginBottom: 15 },
  modalButtons: { flexDirection: "row", justifyContent: "space-between" },
  modalButton: { flex: 0.48, padding: 12, borderRadius: 10, alignItems: "center" },
  modalButtonText: { color: "#fff", fontWeight: "bold" },
  amountHint: {
  fontSize: 12,
  color: "#9CA3AF",
  marginTop: -10,
  marginBottom: 15,
},

amountHighlight: {
  color: "#FACC15",
  fontWeight: "600",
}, amountError: {
  color: "#FB7185",
  fontSize: 12,
  marginTop: -8,
  marginBottom: 10,
},


});
