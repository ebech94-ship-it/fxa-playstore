import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
//import { getAuth } from "firebase/auth";
import * as Linking from "expo-linking";

import { useApp } from "./AppContext";
/*import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";*/
 import { XAF_TO_USD } from "../config/currency";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { auth } from "../firebaseConfig";

// const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL as string;


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
      min: 1500,
    },
  },
  card: {
    currency: "USD",
    deposit: {
      min: 2.5,
      max: 5000,
    },
    withdraw: {
      min: 10,
    },
  },
};

const EXCHANGE_RATES = {
  USD: 1,
  XAF: XAF_TO_USD,
};
const convertCurrency = (amount: number, from: "USD" | "XAF", to: "USD" | "XAF") => {
  if (!EXCHANGE_RATES[from] || !EXCHANGE_RATES[to]) return 0;
  const amountInUSD = amount / EXCHANGE_RATES[from];
  return +(amountInUSD * EXCHANGE_RATES[to]).toFixed(2);
};

export default function DepositWithdraw() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  const [isDeposit, setIsDeposit] = useState(true);
  const [activeMethod, setActiveMethod] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [loading, setLoading] = useState(false);
const { appSettings, profile } = useApp();
const [convertedAmount, setConvertedAmount] = useState(0);

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
    operator: "",  
  });

  const isMobileMoney =
  activeMethod === "MTN" || activeMethod === "Orange";

const methodLimits = isMobileMoney ? LIMITS.mobile : LIMITS.card;
const [lang, setLang] = useState<"en" | "fr">("en");

  const handleChange = (key: string, value: string) => {
  if (key === "amount") {
  const num = Number(value);
  if (num > 0) {
    const converted = convertCurrency(
      num,
      formData.currency as "XAF" | "USD",
      formData.currency === "XAF" ? "USD" : "XAF"
    );
    setConvertedAmount(converted);
  } else {
    setConvertedAmount(0);
  }
}
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

useEffect(() => {
  if (profile?.displayName) {
    setFormData((prev) => ({
      ...prev,
     fullName: profile?.displayName || currentUser?.email?.split("@")[0] || "",
    }));
  }
}, [profile, currentUser?.email]);

  /* -------------------- Open Modal -------------------- */
  const openForm = (method: string) => {
    if (!method) return;

    setActiveMethod(method);

    setFormData((prev) => ({
      ...prev,
      currency:
        method === "MTN" || method === "Orange" ? "XAF" : "USD",
      fullName: profile?.displayName || "",
      operator: method, 
    }));

    setModalVisible(true);
  };
/* -------------------- Mobile Money Deposit -------------------- */
const handleDeposit = async () => {
  try {
    const numericAmount = Number(formData.amount);

    if (!numericAmount || numericAmount <= 0) {
      Alert.alert("Invalid Amount", "Enter a valid amount.");
      return;
    }

    if (!formData.phone) {
      Alert.alert(
        "Phone Required",
        "Enter the phone number used for payment."
      );
      return;
    }

    if (!auth.currentUser) {
      Alert.alert("Auth Error", "User not logged in.");
      return;
    }

    const token = await auth.currentUser.getIdToken(true);
    const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;

    console.log("🔵 DEPOSIT REQUEST:", {
      API_BASE,
      name: formData.fullName,
      email: auth.currentUser?.email,
      momoNumber: formData.phone,
      amount: numericAmount,
    });

    // ✅ CORRECT ENDPOINT & PAYLOAD
    const res = await fetch(`${API_BASE}/api/payin/create-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: formData.fullName,                    // ✅ ADDED
        email: auth.currentUser?.email,            // ✅ ADDED
        momoNumber: formData.phone,                // ✅ CORRECT
        amount: numericAmount,                     // ✅ CORRECT
      }),
    });

    console.log("Response status:", res.status);

    const data = await res.json();
    console.log("Backend response:", data);

    if (!res.ok) {
      Alert.alert("Error", data.error || "Failed to create payment link");
      return;
    }

   if (data.paymentUrl) {
  setModalVisible(false);

  Alert.alert(
    "Continue Payment",
    "You will be redirected to complete your payment securely.",
    [
      {
        text: "Proceed",
        onPress: () => Linking.openURL(data.paymentUrl),
      },
    ]
  );
} else {
  Alert.alert("Error", "No payment link received.");
}
  } catch (err) {
    console.error("Deposit error:", err);
    Alert.alert("Error", "Could not submit deposit request.");
  }
};

/* -------------------- Mobile Money Withdrawal -------------------- */
const handleWithdrawal = async () => {
  const numericAmount = Number(formData.amount);

  if (!numericAmount || numericAmount <= 0) {
    Alert.alert("Invalid Amount", "Enter a valid amount.");
    return;
  }

  if (!formData.phone) {
    Alert.alert("Phone Required", "Enter withdrawal phone number.");
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

  try {
    if (!auth.currentUser) {
      Alert.alert("Auth Error", "User not logged in.");
      return;
    }

    const token = await auth.currentUser.getIdToken(true);
    const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (!API_BASE) {
  Alert.alert("Config Error", "API URL not set");
  return;
}

    // 🔥 FIXED PAYLOAD (MATCHES BACKEND / ACCOUNTPE SPEC)
    const payload = {
      country_code: "CM", // Cameroon (change if needed)
      beneficiary_name: formData.fullName,
      mobile_no: formData.phone,
      amount: numericAmount,
      transaction_id: `txn_${Date.now()}`,
      payment_method: "mobile_money", // important for API routing
      bank_code: "",
      account_number: "",
      remarks: "Tournament withdrawal",
    };

    console.log("🔴 WITHDRAWAL REQUEST:", {
      API_BASE,
      ...payload,
      email: auth.currentUser?.email,
    });

    const res = await fetch(`${API_BASE}/api/payout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    console.log("Response status:", res.status);

    const data = await res.json().catch(() => ({}));
    console.log("Backend response:", data);

    if (!res.ok) {
      Alert.alert("Error", data.message || "Failed to create withdrawal");
      return;
    }
setModalVisible(false);

Alert.alert(
  "Request Sent",
  "Your withdrawal request was submitted successfully."
);
  } catch (err) {
    console.error("Withdrawal error:", err);
    Alert.alert("Error", "Could not submit withdrawal request.");
  }
};

  /* -------------------- Submit -------------------- */
const submitForm = async () => {
  console.log("Submit button pressed", formData);
  if (!currentUser) return;

  const amount = Number(formData.amount);

  // 🔒 Min / Max validation
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

  // 📱 Phone validation
  if (isDeposit && isMobileMoney) {
    if (!/^(237)?6\d{8}$/.test(formData.phone)) {
      Alert.alert(
        "Invalid Phone",
        "Phone must be in format 2376XXXXXXXX"
      );
      return;
    }
  }

  // ✅ ONLY THIS — NO API CALL HERE
  setConfirmVisible(true);
};
const confirmAndSend = async () => {
  try {
    setLoading(true);

    if (isDeposit) {
      await handleDeposit();
    } else {
      await handleWithdrawal();
    }

    setConfirmVisible(false);
    setModalVisible(false);

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
<Modal visible={modalVisible} transparent  animationType="fade"
  onRequestClose={() => setModalVisible(false)}>
       <KeyboardAvoidingView
  style={styles.modalOverlay}
  behavior={Platform.OS === "ios" ? "padding" : "padding"}
>
            <ScrollView
      style={styles.modalContainer}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
    >
            <Text style={styles.modalTitle}>{activeMethod} Form</Text>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 10 }}>
  <TouchableOpacity onPress={() => setLang("en")}>
    <Text style={{ color: lang === "en" ? "#FACC15" : "#888", marginRight: 10 }}>EN</Text>
  </TouchableOpacity>
  <TouchableOpacity onPress={() => setLang("fr")}>
    <Text style={{ color: lang === "fr" ? "#FACC15" : "#888" }}>FR</Text>
  </TouchableOpacity>
</View>

            <TextInput
              placeholder="Full Name"
              value={formData.fullName}
              onChangeText={(v) => handleChange("fullName", v)}
              style={styles.modalInput}
              placeholderTextColor="#888"
            />

            <TextInput
placeholder="Enter amount"
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
  placeholder="Enter your Mobile Money number (237...)"
    value={formData.phone}
    onChangeText={(v) => handleChange("phone", v)}
    keyboardType="phone-pad"
    style={styles.modalInput}
    placeholderTextColor="#888"
  />
  
)}
{Number(formData.amount) > 0 && (
  <Text style={{ color: "#00ffff", fontSize: 12, marginBottom: 10 }}>
    {isDeposit
      ? `You will have ≈ ${convertedAmount.toLocaleString()} USD`
      : `You will receive ≈ ${convertedAmount.toLocaleString()} XAF`}
  </Text>
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
              disabled={
  loading ||
  !formData.amount ||
  Number(formData.amount) <= 0 ||
  (isMobileMoney && !formData.phone)
}
              >
                {loading ? (
  <View style={{ flexDirection: "row", alignItems: "center" }}>
    <ActivityIndicator color="#fff" size="small" />
    <Text style={[styles.modalButtonText, { marginLeft: 8 }]}>
      Submitting...
    </Text>
  </View>
) : (
  <Text style={styles.modalButtonText}>Submit</Text>
)}
              </TouchableOpacity>
            </View>
            </ScrollView>
       </KeyboardAvoidingView>
      </Modal>
      <Modal visible={confirmVisible} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <View style={styles.modalContainer}>
      <Text style={styles.modalTitle}>Confirm Transaction</Text>

      <Text style={{ color: "#fff", marginBottom: 10 }}>
        Type: {isDeposit ? "Deposit" : "Withdraw"}
      </Text>

      <Text style={{ color: "#fff", marginBottom: 10 }}>
        Amount: {formData.amount} {formData.currency}
      </Text>

      <Text style={{ color: "#fff", marginBottom: 10 }}>
        Method: {activeMethod}
      </Text>

      {isMobileMoney && (
        <Text style={{ color: "#fff", marginBottom: 10 }}>
          Phone: {formData.phone}
        </Text>
      )}

      <View style={styles.modalButtons}>
        <TouchableOpacity
          style={[styles.modalButton, { backgroundColor: "#FF6B6B" }]}
          onPress={() => setConfirmVisible(false)}
        >
          <Text style={styles.modalButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
  style={[styles.modalButton, { backgroundColor: "#6a5acd" }]}
  onPress={confirmAndSend}
  disabled={loading}
>
          <Text style={styles.modalButtonText}>Confirm</Text>
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
  modalContainer: {width: "90%",
  maxHeight: "85%", backgroundColor: "#2C2C44", padding: 20, borderRadius: 15 },
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
depositInstructions: {
  backgroundColor: "#111",
  padding: 12,
  borderRadius: 8,
  marginBottom: 15,
},

instructionTitle: {
  color: "#fff",
  fontWeight: "bold",
  marginBottom: 8,
},

instructionText: {
  color: "#ccc",
  fontSize: 12,
  marginBottom: 4,
},

numberText: {
  color: "#00ff99",
  fontWeight: "bold",
  marginBottom: 4,
},

userIdText: {
  color: "#ffaa00",
  fontWeight: "bold",
},


});
