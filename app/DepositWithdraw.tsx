import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
//import { getAuth } from "firebase/auth";

import { WebView } from "react-native-webview";

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
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
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
      min: 1500,
      max: 500000,
    },
    withdraw: { 
      min: 600,
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
const TEXT = {
  en: {
    fullName: "Full Name",
    amount: "Enter amount",
    phone: "Enter your Mobile Money number (237...)",
    minDeposit: "Min deposit",
    maxDeposit: "Max deposit",
    minWithdraw: "Min withdrawal",
    submit: "Submit",
    cancel: "Cancel",
    confirm: "Confirm",
    invalidAmount: "Enter a valid amount.",
    belowMin: "Amount is below minimum allowed",
    youGet: "You will get ≈",
    youReceive: "You will receive ≈",
    deposit: "Deposit",
withdraw: "Withdraw",
selectMethod: "Select Method",
 form: "Form",
 invalidAmountTitle: "Invalid Amount",
phoneRequired: "Phone Required",
authError: "Auth Error",
requestSent: "Request Sent",
comingSoon: "Coming Soon",
notAvailable: "not available yet"
  },

  fr: {
    fullName: "Nom complet",
    amount: "Entrez le montant",
    phone: "Entrez votre numéro Mobile Money (237...)",
    minDeposit: "Dépôt minimum",
    maxDeposit: "Dépôt maximum",
    minWithdraw: "Retrait minimum",
    submit: "Soumettre",
    cancel: "Annuler",
    confirm: "Confirmer",
    invalidAmount: "Entrez un montant valide.",
    belowMin: "Le montant est inférieur au minimum autorisé",
    youGet: "Vous recevrez ≈",
    youReceive: "Vous recevrez ≈",
    deposit: "Dépôt",
withdraw: "Retrait",
  selectMethod: "Choisir une méthode", 
form: "Formulaire",
invalidAmountTitle: "Montant invalide",
phoneRequired: "Téléphone requis",
authError: "Erreur d'authentification",
requestSent: "Demande envoyée",
comingSoon: "Bientôt disponible",
notAvailable: "sera bientôt disponible"

},
};

type Currency = "USD" | "XAF";


export default function DepositWithdraw() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
const [rates, setRates] = useState<Record<Currency, number>>({
  USD: 1,
  XAF: 600,
});
const [paymentUrl, setPaymentUrl] = useState("");
const [paymentVisible, setPaymentVisible] = useState(false);
const [paymentLoading, setPaymentLoading] = useState(false);

const [withdrawalSuccessVisible, setWithdrawalSuccessVisible] = useState(false);
const [withdrawalReference, setWithdrawalReference] = useState("");
const [withdrawProcessing, setWithdrawProcessing] = useState(false);

  const [isDeposit, setIsDeposit] = useState(true);
  const [activeMethod, setActiveMethod] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
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

const convert = (amount: number, from: Currency, to: Currency) => {
  const usd = amount / rates[from];
  return usd * rates[to];
};

 const handleChange = (key: string, value: string) => {
  setFormData((prev) => ({
    ...prev,
    [key]: value,
  }));
};
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setCurrentUser);
    return () => unsub();
    
  }, []);

  useEffect(() => {
  setActiveMethod("");
}, [isDeposit]);

useEffect(() => {
  if (profile?.displayName) {
    setFormData((prev) => ({
      ...prev,
     fullName: profile?.displayName || currentUser?.email?.split("@")[0] || "",
    }));
  }
}, [profile, currentUser?.email]);

useEffect(() => {
  const loadRates = async () => {
    try {
      const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
if (!API_BASE) {
  console.log("API URL missing");
  return;
}
      const res = await fetch(`${API_BASE}/api/currency`);
      const data = await res.json();

      if (
  data?.rates &&
  typeof data.rates.USD === "number" &&
  typeof data.rates.XAF === "number"
) {
 setRates({
    USD: data.rates.USD,
    XAF: data.rates.XAF,
  });
}
    } catch (err) {
  console.log("Currency load failed, using fallback", err);
}
  };

  loadRates();
}, []);

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
  const openPayment = async (url: string) => {
  if (!url) {
    Alert.alert("Error", "No payment link received");
    return;
  }

  try {
    const canUseWebView =
      url.startsWith("http://") || url.startsWith("https://");

    if (canUseWebView) {
      setPaymentUrl(url);
      setPaymentVisible(true);
      return;
    }

    // fallback for non-http links
    await Linking.openURL(url);
  } catch (err) {
    console.log("Payment open failed, forcing fallback", err);
    Linking.openURL(url);
  }
};
/* -------------------- Mobile Money Deposit -------------------- */
const handleDeposit = async () => {
  try {
    const numericAmount = Number(formData.amount);

    if (!numericAmount || numericAmount <= 0) {
     Alert.alert(t.invalidAmountTitle, t.invalidAmount);
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
setPaymentLoading(true);
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
  setPaymentLoading(false);

  Alert.alert(
    "Error",
    data.error || "Failed to create payment link"
  );

  return;
}
if (data.paymentUrl) {
  setPaymentLoading(false);
  setConfirmVisible(false);
  setModalVisible(false);

  openPayment(data.paymentUrl); // 🔥 THIS IS REQUIRED
} else {
  setPaymentLoading(false);
  Alert.alert( "Error",   "No payment link received."  );
}
  } catch (err) {
    console.error("Deposit error:", err);
      setPaymentLoading(false);
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
    setWithdrawProcessing(true);
      Alert.alert("Auth Error", "User not logged in.");
      return;
    }

    const token = await auth.currentUser.getIdToken(true);
    const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (!API_BASE) {
    setWithdrawProcessing(false);
  Alert.alert("Config Error", "API URL not set");
  return;
}

    // 🔥 FIXED PAYLOAD (MATCHES BACKEND / ACCOUNTPE SPEC)
  const payload = {
  country_code: "CM",
  beneficiary_name: formData.fullName,
  mobile_no: formData.phone,
  amount: numericAmount,

  // Send the selected operator
  payment_method: activeMethod,

  bank_code: "",
  account_number: "",
  remarks: "Tournament withdrawal",
};

    console.log("🔴 WITHDRAWAL REQUEST:", {
      API_BASE,
      ...payload,
      email: auth.currentUser?.email,
    });
console.log("Sending payout payload:");
console.log(payload);
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
  Alert.alert(
    "Error",
    data.error || data.message || "Failed to create withdrawal"
  );
  return;
}
setModalVisible(false);

setWithdrawalReference(
  data.transactionId ||
  `WD-${Date.now()}`
);

setWithdrawProcessing(false);
setWithdrawalSuccessVisible(true);
 } catch (err) {
  setWithdrawProcessing(false);

  console.error("Withdrawal error:", err);

  Alert.alert(
    "Connection Problem",
    "Please check your internet connection and try again."
  );
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
   const grossXAF = convert(amount, "USD", "XAF");
const netXAF = grossXAF * 0.99;

const normalizedAmount = isMobileMoney
  ? netXAF
  : amount;

if (normalizedAmount < methodLimits.withdraw.min) {
  Alert.alert(
    "Minimum Withdrawal",
    `Minimum withdrawal is ${methodLimits.withdraw.min.toLocaleString()} ${methodLimits.currency}`
  );
  return;
}
  }

  // 📱 Phone validation
  if (isDeposit && isMobileMoney) {
   const cleanPhone = formData.phone.replace(/\s/g, "");

if (!/^(237)?6\d{8}$/.test(cleanPhone)) {
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
 if (loading) return;
  try {
    setLoading(true);
setConfirmVisible(false);
   
    if (isDeposit) {
      await handleDeposit();
    } else {
      await handleWithdrawal();
    }
setFormData({
  fullName: profile?.displayName || "",
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
    setConfirmVisible(false);
    setModalVisible(false);

  } catch {
    Alert.alert("Error", "Something went wrong.");
  } finally {
    setLoading(false);
  }
};

const minWithdrawDisplay = isMobileMoney
  ? convert(methodLimits.withdraw.min, "XAF", "USD")
  : methodLimits.withdraw.min;
  const t = TEXT[lang];
const FEE_RATE = 0.01;

// FRONTEND MIRROR OF BACKEND LOGIC
const amount = Number(formData.amount || 0);

const grossXAF = Math.round(convert(amount, "USD", "XAF"));
const feeXAF = Math.round(grossXAF * FEE_RATE);
const netXAF = grossXAF - feeXAF;
const getConvertedAmount = (amount: number) => {
  if (isDeposit) return convert(amount, "XAF", "USD");
  return convert(amount, "USD", "XAF");
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
    
    <LinearGradient colors={["#000000", "#0f172a"]} style={styles.headerContainer}>
  <Text style={styles.headerText}>
    FX ARENA
  </Text>

  <Text style={styles.subHeaderText}>
    {isDeposit ? "Deposit Funds" : "Withdraw Earnings"}
  </Text>

  <Text style={styles.brandText}>
    Powered by GodSpeed TECH ⚡
  </Text>
</LinearGradient>

      <View style={styles.toggleRow}>
  <TouchableOpacity
    style={[styles.toggleBtn, isDeposit && styles.toggleActive]}
    onPress={() => setIsDeposit(true)}
  >
    <Text style={styles.toggleText}>Deposit</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[styles.toggleBtn, !isDeposit && styles.toggleActive]}
    onPress={() => setIsDeposit(false)}
  >
    <Text style={styles.toggleText}>Withdraw</Text>
  </TouchableOpacity>
</View>

      <Text style={styles.methodHeader}>{t.selectMethod}</Text>
      <View style={styles.methodsContainer}>
        {paymentMethods.map((m, i) => (
          <TouchableOpacity
            key={i}
            style={[
  styles.methodCard,
  { borderColor: m.color, opacity: m.enabled ? 1 : 0.4 }
]}
            onPress={() => {
              if (!m.enabled) {
                Alert.alert(  t.comingSoon,  `${m.name} ${t.notAvailable}`);
                return;
              }
              openForm(m.name);
            }}
          >
            <Image source={m.icon} style={styles.methodIcon} />
            <Text style={styles.methodTitle}>{m.name}</Text>

<Text style={styles.methodSub}>
  {m.enabled ? "Available" : "Coming Soon"}
</Text>
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
           <Text style={styles.modalTitle}>
  {activeMethod} {isDeposit ? "Deposit" : "Withdrawal"}
</Text>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 10 }}>
  <TouchableOpacity onPress={() => setLang("en")}>
    <Text style={{ color: lang === "en" ? "#FACC15" : "#888", marginRight: 10 }}>EN</Text>
  </TouchableOpacity>
  <TouchableOpacity onPress={() => setLang("fr")}>
    <Text style={{ color: lang === "fr" ? "#FACC15" : "#888" }}>FR</Text>
  </TouchableOpacity>
</View>
<TextInput
  placeholder={t.fullName}
  value={formData.fullName}
  onChangeText={(v) => handleChange("fullName", v)}
  style={styles.modalInput}
  placeholderTextColor="#888"
/>
<View style={styles.amountInputContainer}>
  <TextInput
    placeholder={t.amount}
    value={formData.amount}
    onChangeText={(v) => handleChange("amount", v)}
    keyboardType="numeric"
    style={styles.amountInput}
    placeholderTextColor="#888"
  />

  <Text style={styles.currencyBadge}>
    {isDeposit ? "XAF" : "USD"}
  </Text>
</View>
{!isDeposit && Number(formData.amount) > 0 && (
  <View style={styles.amountBox}>
    <Text style={styles.amountLabel}>
      Withdrawal Preview
    </Text>

    <Text style={styles.amountValue}>
      Gross:
      {" "}
      {grossXAF.toLocaleString()} XAF
    </Text>

    <Text style={styles.amountValue}>
      Fee (1%):
      {" "}
      -{feeXAF.toLocaleString()} XAF
    </Text>

    <Text style={styles.amountValue}>
      You will receive:
      {" "}
      {netXAF.toLocaleString()} XAF
    </Text>
  </View>
)}

{/* DEPOSIT PREVIEW */}
{isDeposit && Number(formData.amount) > 0 && (
  <View style={styles.amountBox}>
    <Text style={styles.amountLabel}>
      Deposit Preview
    </Text>

   <Text style={styles.amountValue}>
  You are paying:
</Text>

<Text style={styles.amountValue}>
  {Number(formData.amount).toLocaleString()} XAF
</Text>

<Text
  style={{
    color: "#00ff99",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 8,
  }}
>
  You will receive ≈{" "}
  {getConvertedAmount(Number(formData.amount)).toFixed(2)} USD
</Text>
  </View>
)}
{/* Inline validation error */}
{formData.amount !== "" &&
(isDeposit
  ? Number(formData.amount) < methodLimits.deposit.min
  : netXAF < methodLimits.withdraw.min) && (
   <Text style={styles.amountError}>
  {t.belowMin}
</Text>
)}
<Text style={styles.amountHint}>
  {isDeposit ? (
    <>
      {t.minDeposit}:{" "}
      <Text style={styles.amountHighlight}>
        {methodLimits.deposit.min.toLocaleString()} {methodLimits.currency}
      </Text>{" "}
      • {t.maxDeposit}:{" "}
      <Text style={styles.amountHighlight}>
        {methodLimits.deposit.max.toLocaleString()} {methodLimits.currency}
      </Text>
    </>
  ) : (
    <>
  {t.minWithdraw}:{" "}
<Text style={styles.amountHighlight}>
  {isMobileMoney
    ? `$${minWithdrawDisplay.toFixed(2)} (≈ ${methodLimits.withdraw.min.toLocaleString()} XAF)`
    : `$${methodLimits.withdraw.min.toFixed(2)} USD`}
</Text>
    </>
  )}
</Text>

{(activeMethod === "MTN" || activeMethod === "Orange") && (
 <TextInput
  placeholder={t.phone}
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
                <Text style={styles.modalButtonText}>{t.cancel}</Text>
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
  <>
    <ActivityIndicator color="#fff" />
    <Text
      style={[
        styles.modalButtonText,
        { marginLeft: 8 }
      ]}
    >
      Sending withdrawal request...
    </Text>
  </>
) : (
  <Text style={styles.modalButtonText}>
    Confirm
  </Text>
)}
              </TouchableOpacity>
            </View>
            </ScrollView>
       </KeyboardAvoidingView>
      </Modal>
      <Modal visible={confirmVisible} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <View style={styles.modalContainer}>
     <Text style={styles.modalTitle}>
  Confirm {isDeposit ? "Deposit" : "Withdrawal"}
</Text>

      <Text style={{ color: "#fff", marginBottom: 10 }}>
        Type: {isDeposit ? "Deposit" : "Withdraw"}
      </Text>

<Text style={{ color: "#fff", marginBottom: 10 }}>
Amount: {Number(formData.amount).toFixed(2)}
{" "}
{isDeposit ? "XAF" : "USD"}
</Text>

{!isDeposit && (
  <>
    <Text style={{ color: "#00ffff", marginBottom: 10 }}>
      Gross: {grossXAF.toLocaleString()} XAF
    </Text>

    <Text style={{ color: "#FB7185", marginBottom: 10 }}>
      Fee (1%): -{feeXAF.toLocaleString()} XAF
    </Text>

    <Text style={{ color: "#00ff99", marginBottom: 10 }}>
      You receive: {netXAF.toLocaleString()} XAF
    </Text>
  </>
)}

{isDeposit && (
  <Text style={{ color: "#00ff99", marginBottom: 10 }}>
  You receive ≈{" "}
  {getConvertedAmount(Number(formData.amount || 0)).toFixed(2)} USD
</Text>
)}

      <Text style={{ color: "#fff", marginBottom: 10 }}>
        Method: {activeMethod}
      </Text>
{isDeposit ? (
  <Text
    style={{
      color: "#9CA3AF",
      fontSize: 12,
      marginBottom: 12,
      lineHeight: 18,
    }}
  >
    After confirmation a secure payment page will open.
    Complete the Mobile Money payment to fund your account.
  </Text>
) : (
  <Text
    style={{
      color: "#9CA3AF",
      fontSize: 12,
      marginBottom: 12,
      lineHeight: 18,
    }}
  >
    Your withdrawal will be submitted for processing.
    Mobile Money transfers are usually completed within a few minutes.
  </Text>
)}

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
          <Text style={styles.modalButtonText}>{t.cancel}</Text>
        </TouchableOpacity>

        <TouchableOpacity
  style={[styles.modalButton, { backgroundColor: "#6a5acd" }]}
  onPress={confirmAndSend}
  disabled={loading}
>
          <Text style={styles.modalButtonText}>{t.confirm}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>
<Modal
  visible={paymentVisible}
  animationType="slide"
>
  <View style={{ flex: 1, backgroundColor: "#000" }}>

    <View
      style={{
        padding: 15,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#111827",
      }}
    >
      <Text
        style={{
          color: "#fff",
          fontWeight: "bold",
          fontSize: 16,
        }}
      >
        Complete the Mobile Money payment below.
      </Text>

      <TouchableOpacity
        onPress={() => setPaymentVisible(false)}
      >
        <Text
          style={{
            color: "#F87171",
            fontSize: 16,
          }}
        >
          Close
        </Text>
      </TouchableOpacity>
    </View>

    <WebView
  source={{ uri: paymentUrl }}
  startInLoadingState
  javaScriptEnabled
  domStorageEnabled
  originWhitelist={["*"]}
  onError={(e) => {
    console.log("WebView error:", e.nativeEvent);

    // 🔥 fallback if WebView crashes
    setPaymentVisible(false);
    Linking.openURL(paymentUrl);
  }}
  onShouldStartLoadWithRequest={(request) => {
    console.log("NAV:", request.url);
    return true;
  }}
  onHttpError={() => {
  console.log("WebView HTTP Error");

  setPaymentVisible(false);

  Alert.alert(
    "Opening Browser",
    "Secure payment page could not load inside the app."
  );

 
  Linking.openURL(paymentUrl).catch(() => {
    Alert.alert(
      "Payment Error",
      "Unable to open the payment page. Please try again."
    );
  });
}}
/>
  </View>
</Modal>
{paymentLoading && (
  <Modal transparent visible>
    <View
      style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.8)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <ActivityIndicator
        size="large"
        color="#FACC15"
      />

      <Text
        style={{
          color: "#fff",
          marginTop: 15,
        }}
      >
        Creating payment session...
      </Text>
    </View>
  </Modal>
)}
<Modal
  visible={withdrawProcessing}
  transparent
  animationType="fade"
>
  <View
    style={{
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.85)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    }}
  >
    <ActivityIndicator
      size="large"
      color="#FACC15"
    />

    <Text
      style={{
        color: "#fff",
        fontSize: 22,
        fontWeight: "bold",
        marginTop: 20,
      }}
    >
      Processing Withdrawal...
    </Text>

    <Text
      style={{
        color: "#9CA3AF",
        textAlign: "center",
        marginTop: 10,
      }}
    >
      Please wait.
      {"\n"}
      Do not close the application.
      {"\n"}
      We are contacting the payment provider.
    </Text>
  </View>
</Modal>
<Modal
  visible={withdrawalSuccessVisible}
  transparent
  animationType="fade"
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContainer}>

      <Text
        style={{
          color: "#00ff99",
          fontSize: 22,
          fontWeight: "bold",
          textAlign: "center",
          marginBottom: 15,
        }}
      >
        Withdrawal Submitted ✅
      </Text>

      <Text
        style={{
          color: "#fff",
          textAlign: "center",
          marginBottom: 10,
        }}
      >
        Your withdrawal request has been received.
      </Text>

      <Text
        style={{
          color: "#9CA3AF",
          textAlign: "center",
          marginBottom: 10,
        }}
      >
        Status: Pending Provider Confirmation
      </Text>

      <Text
        style={{
          color: "#FACC15",
          textAlign: "center",
          marginBottom: 15,
        }}
      >
        Ref: {withdrawalReference}
      </Text>

      <Text
        style={{
          color: "#9CA3AF",
          textAlign: "center",
          marginBottom: 20,
        }}
      >
        Mobile Money withdrawals are usually processed
        within a few minutes, but may take longer during
        high activity periods.
      </Text>

      <TouchableOpacity
        style={styles.confirmButton}
        onPress={() => setWithdrawalSuccessVisible(false)}
      >
        <Text style={styles.confirmButtonText}>
          Done
        </Text>
      </TouchableOpacity>

    </View>
  </View>
</Modal>
    </ScrollView>
  );
}

/* -------------------- Styles -------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1e1e2f", padding: 20 },

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
headerContainer: {
  padding: 20,
  borderRadius: 16,
  marginBottom: 20,
},

subHeaderText: {
  color: "#9ca3af",
  textAlign: "center",
  marginTop: 5,
},

brandText: {
  color: "#facc15",
  textAlign: "center",
  marginTop: 5,
  fontSize: 12,
},

toggleRow: {
  flexDirection: "row",
  justifyContent: "center",
  marginBottom: 20,
  gap: 10,
},

toggleBtn: {
  padding: 10,
  borderRadius: 10,
  backgroundColor: "#111827",
  width: "40%",
  alignItems: "center",
},

toggleActive: {
  backgroundColor: "#facc15",
},

toggleText: {
  color: "#fff",
  fontWeight: "700",
},

methodCard: {
  flexDirection: "column",
  padding: 15,
  borderRadius: 15,
  borderWidth: 1,
  marginBottom: 10,
  width: "48%",
  alignItems: "center",
  backgroundColor: "#0b0f19",
},

methodTitle: {
  color: "#fff",
  fontWeight: "bold",
  marginTop: 5,
},

methodSub: {
  color: "#9ca3af",
  fontSize: 11,
},

amountBox: {
  backgroundColor: "#111827",
  padding: 12,
  borderRadius: 10,
  marginBottom: 15,
},

amountLabel: {
  color: "#facc15",
  fontWeight: "bold",
  marginBottom: 5,
},

amountValue: {
  color: "#fff",
  fontSize: 12,
},
amountInputContainer: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#1C1C2E",
  borderRadius: 10,
  paddingHorizontal: 12,
  marginBottom: 15,
},

amountInput: {
  flex: 1,
  color: "#fff",
  paddingVertical: 12,
},

currencyBadge: {
  color: "#FACC15",
  fontWeight: "900",
  fontSize: 16,
  marginLeft: 10,
},

});
