import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
//import { getAuth } from "firebase/auth";
import * as Clipboard from "expo-clipboard";
import { useApp } from "./AppContext";
/*import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";*/
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
    operator: "",  
  });

  const isMobileMoney =
  activeMethod === "MTN" || activeMethod === "Orange";

const methodLimits = isMobileMoney ? LIMITS.mobile : LIMITS.card;
const [lang, setLang] = useState<"en" | "fr">("en");

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

  //* -------------------- Withdrawal -------------------- */
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
    const token = await auth.currentUser?.getIdToken();
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
 // 🔹 Log API_BASE
      console.log("API_BASE =", API_BASE);
const res = await fetch(`${API_BASE}/transactions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    type: "withdrawal",          // or "deposit" depending on the action
    amount: numericAmount,
    momoNumber: formData.phone,
    operator: formData.operator,
    userId: currentUser!.uid,
    fullName: currentUser!.displayName,
  }),
});

    // 🔹 Log HTTP status
console.log("Response status:", res.status);

// 🔹 Safely parse JSON
const data = await res.json().catch(() => ({}));
console.log("Backend response:", data);

if (!res.ok) {
  Alert.alert("Error", data.error || "Failed");
  return;
}
    Alert.alert("Withdrawal Requested", "Waiting for admin approval.");
  } catch (err) {
    console.log(err);
    Alert.alert("Error", "Could not submit withdrawal request.");
  }
};

/* -------------------- Manual Deposit -------------------- */
const handleManualDeposit = async () => {
  try {
    const numericAmount = Number(formData.amount);
     // 🔹 Log API_BASE
    
   

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
const token = await auth.currentUser?.getIdToken();
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
 
    console.log("API_BASE =", API_BASE);
const res = await fetch(`${API_BASE}/transactions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    type: "deposit",
    amount: numericAmount,
    momoNumber: formData.phone,
   operator: formData.operator,  
    userId: currentUser!.uid,
    fullName: currentUser!.displayName,
  }),
});

    // 🔹 Log HTTP status
console.log("Response status:", res.status);

// 🔹 Safely parse JSON
const data = await res.json().catch(() => ({}));
console.log("Backend response:", data);

if (!res.ok) {
  Alert.alert("Error", data.error || "Failed");
  return;
}

    Alert.alert(
      "Deposit Submitted",
      "Send money to our MoMo number. Admin will confirm shortly."
    );
  } catch (err) {
    console.log(err);
    Alert.alert("Error", "Could not submit deposit request.");
  }
};
  /* -------------------- Submit -------------------- */
  const submitForm = async () => {
  console.log("Submit button pressed", formData);
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
  await handleManualDeposit();
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
      operator: "",  
    });
  } catch {
    Alert.alert("Error", "Something went wrong.");
  } finally {
    setLoading(false);
  }
};
const copyToClipboard = async (value: string) => {
  await Clipboard.setStringAsync(value);
  Alert.alert("Copied", "Copied successfully");
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
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 10 }}>
  <TouchableOpacity onPress={() => setLang("en")}>
    <Text style={{ color: lang === "en" ? "#FACC15" : "#888", marginRight: 10 }}>EN</Text>
  </TouchableOpacity>
  <TouchableOpacity onPress={() => setLang("fr")}>
    <Text style={{ color: lang === "fr" ? "#FACC15" : "#888" }}>FR</Text>
  </TouchableOpacity>
</View>
{isDeposit && (
  <View style={styles.depositInstructions}>
    <Text style={styles.instructionTitle}>
      {lang === "en" ? "⚠️ IMPORTANT – READ BEFORE DEPOSIT" : "⚠️ IMPORTANT – LIRE AVANT DE DÉPOSER"}
    </Text>

    {/* STEP LIST */}
    {lang === "en" ? (
      <>
        <Text style={styles.instructionText}>1. Copy the company number below.</Text>
        <Text style={styles.instructionText}>2. Copy your User ID.</Text>
        <Text style={styles.instructionText}>3. Return and normaly send the amount you want to have in your real
         account using MTN or Orange Money. Respect the limits.</Text>
        <Text style={styles.instructionText}>4. Use your User ID as reference when you deposit so we identify you.</Text>
        <Text style={styles.instructionText}>5. After sending is successfull, come back and fill this form below with the exact amount you deposited,
        to update the administration and your accout real account will then be updated accordingly within 5 mins.</Text>
        <Text style={{ color: "#FACC15", marginVertical: 6 }}>
          ⚠️ Do NOT fill this form before sending money.
        </Text>
      </>
    ) : (
      <>
        <Text style={styles.instructionText}>1. Copiez le numéro de l&apos;entreprise ci-dessous.</Text>
        <Text style={styles.instructionText}>2. Copiez votre ID utilisateur.</Text>
      <Text style={styles.instructionText}>
  3. Revenez et envoyez normalement le montant que vous souhaitez avoir sur votre compte
   réel en utilisant MTN ou Orange Money, en respectant les limites.</Text>
<Text style={styles.instructionText}>
  4. Utilisez votre ID utilisateur comme référence lors du dépôt afin que nous
   puissions vous identifier.</Text>
<Text style={styles.instructionText}>
5. Après avoir effectué le transfert avec succès, revenez remplir le formulaire ci-dessous avec le montant exact que vous avez déposé,
afin l&apos;informer l&apos;administration. Votre compte réel sera ensuite mis à jour en conséquence dans un délai de 5 minutes.
</Text>
        <Text style={{ color: "#FACC15", marginVertical: 6 }}>
          ⚠️ Ne remplissez pas ce formulaire avant d&apos;envoyer l&apos;largent.
        </Text>
      </>
    )}

    <View style={{ marginTop: 10 }} />

    <Text style={styles.numberText}>GodSpeed Technologies</Text>

    {/* MTN */}
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={styles.numberText}>MTN: 682783789</Text>
      <TouchableOpacity onPress={() => copyToClipboard("682783789")}>
        <Text style={{ color: "#00ffff" }}>{lang === "en" ? "Copy" : "Copier"}</Text>
      </TouchableOpacity>
    </View>

    {/* Orange */}
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={styles.numberText}>Orange: 69XXXXXXX</Text>
      <TouchableOpacity onPress={() => copyToClipboard("69XXXXXXX")}>
        <Text style={{ color: "#00ffff" }}>{lang === "en" ? "Copy" : "Copier"}</Text>
      </TouchableOpacity>
    </View>

    {/* Support Number */}
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 5 }}>
      <Text style={styles.numberText}>{lang === "en" ? "Support: 673864413" : "Support : 673864413"}</Text>
      <TouchableOpacity onPress={() => copyToClipboard("673864413")}>
        <Text style={{ color: "#00ffff" }}>{lang === "en" ? "Copy" : "Copier"}</Text>
      </TouchableOpacity>
    </View>

    <View style={{ marginTop: 10 }} />

    {/* User ID */}
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={styles.userIdText}>
        {lang === "en" ? `Your ID: ${currentUser?.uid}` : `Votre ID : ${currentUser?.uid}`}
      </Text>
      <TouchableOpacity onPress={() => copyToClipboard(currentUser?.uid || "")}>
        <Text style={{ color: "#ffaa00" }}>{lang === "en" ? "Copy" : "Copier"}</Text>
      </TouchableOpacity>
    </View>
  </View>
)}
            <TextInput
              placeholder="Full Name"
              value={formData.fullName}
              onChangeText={(v) => handleChange("fullName", v)}
              style={styles.modalInput}
              placeholderTextColor="#888"
            />

            <TextInput
 placeholder={isDeposit ? "Exact Amount Sent!" : "Amount to Withdraw"}
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
    placeholder={
      isDeposit
        ? "Use the same MoMo number you sent the money from (237...)"
        : "Enter your MoMo number to receive the money, then wait 5mins(237...)"
    }
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
