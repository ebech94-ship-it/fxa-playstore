// PaymentsPage.tsx
import { Picker } from "@react-native-picker/picker";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp
} from "firebase/firestore";


import { WebView, WebViewNavigation } from 'react-native-webview';

import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
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
  { name: "MTN", color: "#FFCD00", icon: require("../assets/images/mtn.png") },
  { name: "Orange", color: "#FF7900", icon: require("../assets/images/orange.png") },
  { name: "Visa", color: "#1A1F71", icon: require("../assets/images/VISA.jpg") },
  { name: "MasterCard", color: "#EB001B", icon: require("../assets/images/mastercard.png") },
  { name: "BTC", color: "#F7931A", icon: require("../assets/images/BT.jpg") },
  { name: "USDT", color: "#26A17B", icon: require("../assets/images/USDT.jpg") },
];

export default function PaymentsPage() {
  const [isDeposit, setIsDeposit] = useState(true);
  const [amount, setAmount] = useState(""); // string from TextInput
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [convertedAmount, setConvertedAmount] = useState("0");
  const [activeMethod, setActiveMethod] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
const [paymentModalVisible, setPaymentModalVisible] = useState(false);


  const [loading, setLoading] = useState(false);

  const router = useRouter();
  

  // track auth state gracefully
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
const [paymentLink, setPaymentLink] = useState<string | null>(null);


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

  // PREFILL amount into modal form
  setFormData((prev) => ({
    ...prev,
    amount: amount,   // auto-insert amount typed on main page
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
 const handleFlutterwavePayment = async (form: any) => {
  console.log("Starting Flutterwave payment...", form);

  const numeric = parseFloat(form.amount);
  if (!form.amount || isNaN(numeric) || numeric <= 0) {
    Alert.alert("Invalid amount", "Please enter a valid amount greater than 0.");
    return;
  }

  if (!currentUser?.email || !currentUser?.uid) {
    Alert.alert("Not logged in", "Please login to make a deposit.");
    return;
  }

  setLoading(true);

  try {
    const res = await fetch(`${API_BASE}/create-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: numeric,
        currency: selectedCurrency,
        email: currentUser.email,
        userId: currentUser.uid,
        type: "deposit",
        method: activeMethod,
        fullName: form.fullName,
        phone: form.phone,
        note: form.note,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Create payment FAILED:", res.status, text);
      Alert.alert("Payment Error", "Could not create payment. Try again.");
      return;
    }

    const data = await res.json();
    console.log("Payment created:", data);

    const payLink = data.link;
    if (!payLink) {
      Alert.alert("Error", "No payment link returned by the server.");
      return;
    }
setPaymentLink(payLink);
setPaymentModalVisible(true);

  } catch (err) {
    console.error("Flutterwave Payment Error:", err);
    Alert.alert("Network Error", "Unable to reach payment server.");
  } finally {
    setLoading(false);
  }
};

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

    setLoading(true);

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
      setLoading(false);
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


// Submit form depending on deposit/withdraw
const submitForm = async () => {
  console.log("Submitting form:", formData);

  if (!formData.amount || Number(formData.amount) <= 0) {
    Alert.alert("Invalid Amount", "Please enter a valid amount.");
    return;
  }

  setLoading(true);

  try {
    if (isDeposit) {
      await handleFlutterwavePayment(formData);   // pass full form
    } else {
      await handleWithdrawal();     // pass amount only
    }

    // Only reset AFTER success
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

      {/* Currency Picker */}
      <Text style={styles.inputLabel}>Select Currency</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedCurrency}
          onValueChange={(itemValue) => setSelectedCurrency(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="USD" value="USD" />
          <Picker.Item label="XAF" value="XAF" />
          <Picker.Item label="EUR" value="EUR" />
          <Picker.Item label="NGN" value="NGN" />
          <Picker.Item label="BTC" value="BTC" />
          <Picker.Item label="USDT" value="USDT" />
        </Picker>
      </View>

      {/* Converted Amount */}
      <Text style={styles.convertedText}>
        Equivalent: {convertedAmount} {selectedCurrency}
      </Text>

      {/* Payment Methods */}
      <Text style={styles.methodHeader}>Select Payment Method</Text>
      <View style={styles.methodsContainer}>
        {paymentMethods.map((method, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.methodButton, { backgroundColor: method.color }]}
            onPress={() => openForm(method.name)}
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
                <TextInput placeholder="Amount" value={formData.amount} onChangeText={v => handleChange("amount", v)} style={styles.modalInput} keyboardType="numeric" placeholderTextColor="#888" />
                <TextInput placeholder="Transaction Code" value={formData.code} onChangeText={v => handleChange("code", v)} style={styles.modalInput} keyboardType="numeric" placeholderTextColor="#888" />
              </>
            )}

            {/* Visa / MasterCard Form */}
            {(activeMethod === "Visa" || activeMethod === "MasterCard") && (
              <>
                <TextInput placeholder="Full Name" value={formData.fullName} onChangeText={v => handleChange("fullName", v)} style={styles.modalInput} placeholderTextColor="#888" />
                <TextInput placeholder="Card Number" value={formData.cardNumber} onChangeText={v => handleChange("cardNumber", v)} style={styles.modalInput} keyboardType="numeric" placeholderTextColor="#888" />
                <TextInput placeholder="Expiry Date (MM/YY)" value={formData.expiry} onChangeText={v => handleChange("expiry", v)} style={styles.modalInput} placeholderTextColor="#888" />
                <TextInput placeholder="CVV" value={formData.cvv} onChangeText={v => handleChange("cvv", v)} style={styles.modalInput} keyboardType="numeric" placeholderTextColor="#888" />
                <TextInput placeholder="Amount" value={formData.amount} onChangeText={v => handleChange("amount", v)} style={styles.modalInput} keyboardType="numeric" placeholderTextColor="#888" />
              </>
            )}

            {/* BTC / USDT Form */}
            {(activeMethod === "BTC" || activeMethod === "USDT") && (
              <>
                <TextInput placeholder="Wallet Address" value={formData.walletAddress} onChangeText={v => handleChange("walletAddress", v)} style={styles.modalInput} placeholderTextColor="#888" />
                <TextInput placeholder="Amount" value={formData.amount} onChangeText={v => handleChange("amount", v)} style={styles.modalInput} keyboardType="numeric" placeholderTextColor="#888" />
                <TextInput placeholder="Transaction Note (Optional)" value={formData.note} onChangeText={v => handleChange("note", v)} style={styles.modalInput} placeholderTextColor="#888" />
              </>
            )}

            {/* Modal buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: "#FF6B6B" }]} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: "#6a5acd" }]} onPress={submitForm}>
                <Text style={styles.modalButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </Modal>

{paymentModalVisible && paymentLink && (
  <Modal visible={paymentModalVisible} animationType="slide">
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <WebView
        source={{ uri: paymentLink }}
       onNavigationStateChange={async (state: WebViewNavigation) => {
  const url = state.url;
  if (!url) return;

  // Prevent multiple triggers
  if (loading) return;

  // When success
  if (url.includes("status=successful") || url.includes("success")) {
    setLoading(true);
    setPaymentModalVisible(false);

    try {
      const uid = currentUser?.uid;
      if (!uid) throw new Error("User not logged in");

      const userRef = doc(db, "users", uid);
      const depositRef = collection(db, "deposits");

      const amount = Number(formData.amount);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists()) throw "User not found";

        const oldBalance = snap.data().walletBalance || 0;

        // create deposit record
        tx.set(doc(depositRef), {
          userId: uid,
          amount,
          currency: selectedCurrency,
          method: activeMethod,
          status: "successful",
          createdAt: serverTimestamp(),
          type: "deposit",
        });

        // update wallet
        tx.update(userRef, {
          walletBalance: oldBalance + amount,
        });
      });

      Alert.alert("Deposit Successful!", "Your wallet balance has been updated.");
    } catch (err) {
      Alert.alert("Error", String(err));
    }

    setLoading(false);
  }

  // When failed or cancelled
  if (url.includes("cancel") || url.includes("failed")) {
    setPaymentModalVisible(false);
    Alert.alert("Payment Cancelled");
  }
}}
      />
    </View>
  </Modal>
)}

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
