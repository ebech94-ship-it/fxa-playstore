// PaymentsPage.tsx

import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp
} from "firebase/firestore";


import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
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
  View
} from "react-native";
import { auth, db } from "../firebaseConfig";


const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL as string;

// Debug: verify env is loaded
console.log("API_BASE ===>", API_BASE);

// 🔹 Conversion API (dummy)
const fakeConversionRateAPI = async (currency: string) => {
  const rates: Record<string, number> = {
    USD: 1,
    XAF: 595,
    EUR: 0.92,
    NGN: 775,
    BTC: 0.000038,
    USDT: 1,
  };
  return rates[currency] || 1;
};

// 🔹 Payment method icons
const paymentMethods = [
  { name: "MTN", color: "#FFCD00", icon: require("../assets/images/mtn.png"), enabled: true },
  { name: "Orange", color: "#FF7900", icon: require("../assets/images/orange.png"), enabled: true },
  { name: "Visa", color: "#1A1F71", icon: require("../assets/images/VISA.jpg"), enabled: true },
  { name: "MasterCard", color: "#EB001B", icon: require("../assets/images/mastercard.png"), enabled: true },

  // Disabled for now
  { name: "BTC", color: "#555", icon: require("../assets/images/BT.jpg"), enabled: false },
  { name: "USDT", color: "#555", icon: require("../assets/images/USDT.jpg"), enabled: false },
];


export default function PaymentsPage() {
  const [isDeposit, setIsDeposit] = useState(true);
  const [amount, setAmount] = useState(""); // string from TextInput
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [convertedAmount, setConvertedAmount] = useState("0");
  const [activeMethod, setActiveMethod] = useState("");

  const [modalVisible, setModalVisible] = useState(false);


  const [loading, setLoading] = useState(false);

  const router = useRouter();
  

  // track auth state gracefully
  const [currentUser, setCurrentUser] = useState(auth.currentUser);


  // ---------------------------
// FORM STATE & HANDLERS
// ---------------------------
const [formData, setFormData] = useState({
  fullName: "",
  phone: "",
  amount: "",
  code: "",
  cardNumber: "",
  expiry: "",
  cvv: "",
  walletAddress: "",
  note: "",
});

const handleChange = (key: string, value: string) => {
  setFormData((prev) => ({ ...prev, [`${key}`]: value }));
};

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setCurrentUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Convert currency automatically and compute platform fee & net
  useEffect(() => {
    let mounted = true;
    const convert = async () => {
      const rate = await fakeConversionRateAPI(selectedCurrency);
      const amt = parseFloat(amount) || 0;
      // enforce non-negative
      const positiveAmt = amt < 0 ? 0 : amt;
      if (mounted) {
      
        
        setConvertedAmount((positiveAmt * rate).toFixed(2));
      }
    };
    convert();
    return () => {
      mounted = false;
    };
  }, [amount, selectedCurrency]);
  

  // Open form modal
  // Open form modal
const openForm = async (method: string) => {
  setActiveMethod(method);

  // Force XAF for CamPay
  if (method === "MTN" || method === "Orange") {
  setSelectedCurrency("XAF");
}

if (method === "Visa" || method === "MasterCard") {
  setSelectedCurrency("USD"); // or XAF depending on backend
}


  // PREFILL amount into modal form
  setFormData((prev) => ({
    ...prev,
   amount: amount || "0",   // auto-insert amount typed on main page
    fullName: currentUser?.displayName || "",
    phone: prev.phone,     // keep old
    code: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
    walletAddress: "",
    note: "",
  }));

  setModalVisible(true);
};


 // -------------------------
// Deposit (create payment)
// -------------------------
const handleCampayPayment = async (form: any) => {
  if (!currentUser?.uid) return;

  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken(); // 🔹 This is correct

  console.log("👶 STEP 3 TOKEN:", token); // just to verify in console

  try {
    const res = await fetch(`${API_BASE}/campay/create-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`, // 🔹 must be 'Bearer <token>'
      },
      body: JSON.stringify({
      userId: currentUser.uid,
        amount: Number(form.amount),
        method: activeMethod === "MTN" || activeMethod === "Orange" ? "mobile" : "card",
        operator: activeMethod, // only needed for mobile
        phone: activeMethod === "MTN" || activeMethod === "Orange" ? form.phone : undefined,
      }),
    });

    const text = await res.text();
    console.log("📦 BACKEND RESPONSE:", text); // raw response

    const data = JSON.parse(text);

    if (!res.ok) {
      alert("Payment Error: " + (data.error || "Failed"));
      return;
    }

    alert("Payment request sent! Confirm on your phone.");

  } catch (err) {
    alert("Network error: Server unreachable");
    console.error(err);
  }
};


const IS_CAMPAY_SANDBOX = true;
// -------------------------

  // Withdrawal (request)
  // -------------------------
  const handleWithdrawal = async () => {
    const numericAmount = Number(amount);
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid amount to withdraw (greater than 0).");
      return;
    }
    if (!currentUser?.uid) {
      Alert.alert("Not logged in", "Please log in to request withdrawal.");
      return;
    }
    try {
      const uid = currentUser.uid;
      const userRef = doc(db, "users", uid);

      // Atomic transaction: check balance and deduct (create a pending withdrawal record)
      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) {
          throw new Error("User not found");
        }
        const walletBalance = userSnap.data().walletBalance || 0;

        if (numericAmount > walletBalance) {
          throw new Error("Insufficient balance");
        }

        const fee = numericAmount * 0.04;
        const net = numericAmount - fee;

        // create withdrawal request doc
        const withdrawalRef = collection(db, "withdrawals");
        await tx.set(doc(withdrawalRef), {
  userId: uid,
  amount: numericAmount,
  fee,
  netAmount: net,
  currency: selectedCurrency,
  method: activeMethod,
  destination: formData.phone || formData.walletAddress || null,
  status: "pending",
  createdAt: serverTimestamp(),
  type: "withdrawal",
});


        // deduct user's wallet balance immediately (consider 'hold' semantics in future)
        // using transaction ensures atomicity with the withdrawal doc
        tx.update(userRef, { walletBalance: walletBalance - numericAmount });
      });

      Alert.alert(
        "Withdrawal Request Sent",
        `Amount: ${numericAmount.toFixed(2)} ${selectedCurrency}\nPlatform fee: ${(numericAmount * 0.04).toFixed(
          2
        )} ${selectedCurrency}\nNet: ${(numericAmount * 0.96).toFixed(2)} ${selectedCurrency}\n\nRequest is pending.`
      );
    } catch (error: any) {
      console.error("Withdrawal error:", error);
      if (error.message && error.message.includes("Insufficient")) {
        Alert.alert("Insufficient Balance", "You do not have enough balance to withdraw this amount.");
      } else if (error.message && error.message.includes("User not found")) {
        Alert.alert("User Error", "User record not found. Please log in again.");
      } else {
        Alert.alert("Withdrawal Failed", "An error occurred. Try again later.");
      }
    } finally {
     
    }
  };

  // If not logged in show friendly message and stop rendering actions.
  if (!currentUser) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: "#fff", marginBottom: 12 }}>You are not logged in.</Text>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={() => {
            // route to login/signup page (adjust your route)
            router.push("/welcome");
          }}
        >
          <Text style={styles.confirmButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

const isValidCameroonPhone = (phone: string, operator: string) => {
  // must be digits only
  if (!/^\d+$/.test(phone)) return false;

  // must start with country code
  if (!phone.startsWith("237")) return false;

  // must be 12 digits total
  if (phone.length !== 12) return false;

  const MTN_PREFIXES = ["67", "68", "650", "651", "652", "653", "654", "655"];
  const ORANGE_PREFIXES = ["69", "655", "656", "657", "658", "659"];

  if (operator === "MTN") {
    return MTN_PREFIXES.some(p => phone.startsWith("237" + p));
  }

  if (operator === "Orange") {
    return ORANGE_PREFIXES.some(p => phone.startsWith("237" + p));
  }

  return false;
};

// Submit form depending on deposit/withdraw
const submitForm = async () => {
  console.log("Submitting form:", formData);
  const auth = getAuth();
const user = auth.currentUser;


if (!activeMethod) {
  Alert.alert("Select Payment Method", "Please choose a payment method.");
  return;
}

if (!user) {
  Alert.alert("Not logged in", "Please log in again.");
  return;
}

  const numericAmount = Number(formData.amount);
  if (!formData.amount || isNaN(numericAmount) || numericAmount <= 0) {
    Alert.alert("Invalid Amount", "Please enter a valid amount.");
    return;
  }

  // 🔴 Deposit-specific validation
  if (isDeposit) {
    const isMoMo = activeMethod === "MTN" || activeMethod === "Orange";
    const isCard = activeMethod === "Visa" || activeMethod === "MasterCard";

    // 🔹 Mobile Money (MTN / Orange)
    if (isMoMo) {
     if (!isValidCameroonPhone(formData.phone, activeMethod)) {
  Alert.alert(
    "Invalid Phone Number",
    `Please enter a valid ${activeMethod} Cameroon number starting with 237`
  );
  return;
}


      if (selectedCurrency !== "XAF") {
        Alert.alert("Invalid Currency", "Mobile money requires XAF");
        return;
      }

      // CamPay sandbox rule (MoMo only)
     // CamPay sandbox rule (MoMo only)
if (IS_CAMPAY_SANDBOX && numericAmount > 10) {
  Alert.alert(
    "Sandbox Limit",
    "Test mode: maximum deposit is 10 XAF"
  );
  return;
}

    }

    // 🔹 Cards (Visa / MasterCard)
    if (isCard) {
      if (!["USD", "XAF"].includes(selectedCurrency)) {
        Alert.alert("Invalid Currency", "Cards support USD or XAF only");
        return;
      }
    }
  }

  setLoading(true);

  try {
    if (isDeposit) {
      await handleCampayPayment(formData);
    } else {
      await handleWithdrawal();
    }

    setFormData({
      fullName: "",
      phone: "",
      amount: "",
      code: "",
      cardNumber: "",
      expiry: "",
      cvv: "",
      walletAddress: "",
      note: "",
    });

    setModalVisible(false);
  } catch (err) {
    console.error("SubmitForm error:", err);
    Alert.alert("Error", "Unable to complete your request.");
  } finally {
    setLoading(false);
  }
};


 
  return (
    <ScrollView style={styles.container}>
      {/* Header with gradient */}
      <LinearGradient colors={["#6a5acd", "#00ffff"]} style={styles.headerContainer}>
        <Text style={styles.headerText}>{isDeposit ? "Deposit" : "Withdraw"}</Text>
      </LinearGradient>

      {/* Deposit/Withdraw Switch */}
      <View style={styles.switchContainer}>
        <Text style={{ color: "#fff" }}>Deposit</Text>
        <Switch
          value={isDeposit}
          onValueChange={() => setIsDeposit(!isDeposit)}
          trackColor={{ false: "#FF6B6B", true: "#4ACFAC" }}
          thumbColor={"#fff"}
        />
        <Text style={{ color: "#fff" }}>Withdraw</Text>
      </View>

      {/* Amount Input */}
      <Text style={styles.inputLabel}>Enter Amount</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        placeholderTextColor="#aaa"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />

      {/* Currency (Auto-selected by payment method) */}
<Text style={styles.inputLabel}>Currency</Text>
<View style={styles.input}>
  <Text style={{ color: "#fff", fontSize: 16 }}>
    {selectedCurrency}
  </Text>
</View>


      {/* Converted Amount */}
      <Text style={styles.convertedText}>
  {activeMethod === "MTN" || activeMethod === "Orange"
    ? `Amount to pay: ${amount || 0} XAF`
    : `Equivalent: ${convertedAmount} ${selectedCurrency}`}
</Text>


      {/* Payment Methods */}
      <Text style={styles.methodHeader}>Select Payment Method</Text>
      <View style={styles.methodsContainer}>
        {paymentMethods.map((method, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.methodButton, { backgroundColor: method.color }]}
            onPress={() => {
  if (!method.enabled) {
    Alert.alert("Coming Soon", `${method.name} payments will be available later.`);
    return;
  }
  openForm(method.name);
}}

          >
            <Image source={method.icon} style={styles.methodIcon} />
            <Text style={styles.methodText}>{method.name}</Text>
          </TouchableOpacity>
        ))}
      </View>



      {/* Modal Forms */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <ScrollView contentContainerStyle={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{activeMethod} Payment Form</Text>

            {/* MTN / Orange Form */}
            {(activeMethod === "MTN" || activeMethod === "Orange") && (
              <>
                <TextInput placeholder="Full Name" value={formData.fullName} onChangeText={v => handleChange("fullName", v)} style={styles.modalInput} placeholderTextColor="#888" />
                <TextInput placeholder="Phone Number" value={formData.phone} onChangeText={v => handleChange("phone", v)} style={styles.modalInput} keyboardType="phone-pad" placeholderTextColor="#888" />
              <View style={styles.modalInput}>
  <Text style={{ color: "#fff" }}>
    Amount: {formData.amount} {selectedCurrency}
  </Text>
</View>

                <TextInput placeholder="Ref:" value={formData.code} onChangeText={v => handleChange("code", v)} style={styles.modalInput} keyboardType="numeric" placeholderTextColor="#888" />
              </>
            )}

            {/* Visa / MasterCard Form */}
            {(activeMethod === "Visa" || activeMethod === "MasterCard") && (
              <>
                <TextInput placeholder="Full Name" value={formData.fullName} onChangeText={v => 
                handleChange("fullName", v)} style={styles.modalInput} placeholderTextColor="#888" />
                <TextInput placeholder="Card Number" value={formData.cardNumber} onChangeText={v =>
                 handleChange("cardNumber", v)} style={styles.modalInput} keyboardType="numeric" placeholderTextColor="#888" />
                <TextInput placeholder="Expiry Date (MM/YY)" value={formData.expiry} onChangeText={v => 
                handleChange("expiry", v)} style={styles.modalInput} placeholderTextColor="#888" />
                <TextInput placeholder="CVV" value={formData.cvv} onChangeText={v => 
                handleChange("cvv", v)} style={styles.modalInput} keyboardType="numeric" placeholderTextColor="#888" />
               <View style={styles.modalInput}>
  <Text style={{ color: "#fff" }}>
    Amount: {formData.amount} {selectedCurrency}
  </Text>
</View>

              </>
            )}

            {/* BTC / USDT Form */}
            {(activeMethod === "BTC" || activeMethod === "USDT") && (
              <>
                <TextInput placeholder="Wallet Address" value={formData.walletAddress} onChangeText={v => handleChange("walletAddress", v)} style={styles.modalInput} placeholderTextColor="#888" />
               <View style={styles.modalInput}>
  <Text style={{ color: "#fff" }}>
    Amount: {formData.amount} {selectedCurrency}
  </Text>
</View>

                <TextInput placeholder="Transaction Note (Optional)" value={formData.note} 
                onChangeText={v => handleChange("note", v)} style={styles.modalInput} placeholderTextColor="#888" />
              </>
            )}

            {/* Modal buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: "#FF6B6B" }]}
               onPress={() => setModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
             <TouchableOpacity
  disabled={loading}
  style={[ styles.modalButton,
    { backgroundColor: loading ? "#999" : "#6a5acd" },
  ]}
  onPress={submitForm}
>
  <View style={{ flexDirection: "row", alignItems: "center" }}>
    {loading && ( <ActivityIndicator  color="#fff"  size="small"  style={{ marginRight: 8 }}
      />
    )}
    <Text style={styles.modalButtonText}>
      {loading ? "Processing..." : "Submit"}
    </Text>
  </View>
</TouchableOpacity>

            </View>

          </View>
        </ScrollView>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1e1e2f", padding: 20 },
  headerContainer: { borderRadius: 12, padding: 15, marginBottom: 20, bottom: 9 },
  headerText: { fontSize: 28, fontWeight: "bold", color: "#fff", textAlign: "center" },
  switchContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  inputLabel: { color: "#00ffff", fontSize: 16, marginBottom: 5 },
  input: { backgroundColor: "#2e2e3e", color: "#fff", padding: 12, borderRadius: 8, marginBottom: 20 },
  pickerContainer: { backgroundColor: "#2e2e3e", borderRadius: 8, marginBottom: 20 },
  picker: { color: "#fff" },
  convertedText: { color: "#4ACFAC", fontSize: 18, fontWeight: "bold", marginBottom: 20 },
  methodHeader: { color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  methodsContainer: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20, justifyContent: "space-between" },
  methodButton: { flexDirection: "row", alignItems: "center", borderRadius: 10, padding: 10, marginBottom: 10, minWidth: "48%" },
  methodIcon: { width: 24, height: 24, marginRight: 10 },
  methodText: { color: "#fff", fontWeight: "bold" },
  confirmButton: { backgroundColor: "#6a5acd", padding: 20, bottom: 20, borderRadius: 12, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5, },
  confirmButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '85%', backgroundColor: '#2C2C44', padding: 20, borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 15, textAlign: 'center' },
  modalInput: { backgroundColor: '#1C1C2E', borderRadius: 10, padding: 12, color: '#fff', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalButton: { flex: 0.48, padding: 12, borderRadius: 10, alignItems: 'center' },
  modalButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
