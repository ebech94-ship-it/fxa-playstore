import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
//import { getAuth } from "firebase/auth";

import { WebView } from "react-native-webview";

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useApp } from "./AppContext";

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
import { db } from "../firebaseConfig";

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
      min: 3000,
      max: 500000,
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
const { mode } = useLocalSearchParams();
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
const [withdrawTimeout, setWithdrawTimeout] =
  useState<ReturnType<typeof setTimeout> | null>(null);
const [withdrawProcessing, setWithdrawProcessing] = useState(false);
const [depositSuccessVisible, setDepositSuccessVisible] = useState(false);

  const [isDeposit, setIsDeposit] = useState(mode !== "withdraw");
  const [activeMethod, setActiveMethod] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
const {
  appSettings,
  profile,
  setOpenAccountSwitcher,
  setSwitcherHintTournamentId,
} = useApp();

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
const [feeSettings, setFeeSettings] = useState({
  minimumWithdrawalUSD: 5,
  minimumFeeXAF: 600,
  percentageThresholdXAF: 30000,
  percentageFee: 0.02,
});
  const isMobileMoney =
  activeMethod === "MTN" || activeMethod === "Orange";


const methodLimits = LIMITS.mobile;
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
  const loadFeeSettings = async () => {
    try {
      const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
      if (!API_BASE) return;

      const res = await fetch(`${API_BASE}/api/fees`);
      const data = await res.json();

      if (data?.withdrawal) {
        setFeeSettings(data.withdrawal);
      }
    } catch (err) {
      console.log("Using default fee settings", err);
    }
  };

  loadFeeSettings();
}, []);
useEffect(() => {
  if (!currentUser) return;

  const q = query(
  collection(db, "transactions"),
  orderBy("createdAt", "desc"),
  limit(8)
);

  const unsub = onSnapshot(q, (snap) => {
   const rows = snap.docs
  .filter(doc => doc.data().uid === currentUser.uid)
  .map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

    setTransactions(rows);
  });

  return unsub;
}, [currentUser]);

useEffect(() => {
  if (mode === "deposit") {
    setIsDeposit(true);
    setActiveMethod("MTN");
    setModalVisible(true);
  }

  if (mode === "withdraw") {
    setIsDeposit(false);
    setActiveMethod("MTN");
    setModalVisible(true);
  }
}, [mode]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setCurrentUser);
    return () => unsub();
    
  }, []);

useEffect(() => {
  if (!modalVisible && !mode) {
    setActiveMethod("");
  }
}, [modalVisible, mode]);

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
  uid: auth.currentUser.uid,
  publicId: profile?.publicId || "",
  username: profile?.username || "",
  name: formData.fullName,
  email: auth.currentUser?.email,
  momoNumber: formData.phone,
  operator: activeMethod,
  amount: numericAmount,
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
/* -------------------- Mobile Money Withdrawal -------------------- */
const handleWithdrawal = async () => {

  console.log("========== WITHDRAWAL START ==========");

  const numericAmount = Number(formData.amount);

  console.log("FORM DATA:", formData);

  console.log("CURRENT USER:", {
    uid: auth.currentUser?.uid,
    email: auth.currentUser?.email,
    phone: auth.currentUser?.phoneNumber,
  });

  console.log("PROFILE:", profile);

  console.log("APP SETTINGS:", {
    enablePayouts: appSettings.enablePayouts,
    maintenanceMode: appSettings.maintenanceMode,
  });


  if (!numericAmount || numericAmount <= 0) {
    console.log("❌ INVALID AMOUNT");
    Alert.alert("Invalid Amount", "Enter a valid amount.");
    return;
  }


  if (!formData.phone) {
    console.log("❌ NO PHONE NUMBER");
    Alert.alert("Phone Required", "Enter withdrawal phone number.");
    return;
  }


  if (!appSettings.enablePayouts) {
    console.log("❌ PAYOUT DISABLED");
    Alert.alert(
      "Payouts Disabled",
      "Payout requests are temporarily disabled."
    );
    return;
  }


  if (appSettings.maintenanceMode) {
    console.log("❌ MAINTENANCE MODE");
    Alert.alert(
      "Maintenance Mode",
      "Withdrawals unavailable."
    );
    return;
  }


  try {

    if (!auth.currentUser) {
      console.log("❌ NO AUTH USER");
      Alert.alert("Auth Error", "User not logged in.");
      return;
    }


    const token = await auth.currentUser.getIdToken(true);

    console.log("🔥 FIREBASE TOKEN GENERATED:", !!token);


    const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;


    console.log("API BASE:", API_BASE);


    const payload = {
  uid: auth.currentUser.uid,
  publicId: profile?.publicId || "",
  username: profile?.username || "",
  email: auth.currentUser?.email || "",

  country_code: "CM",
  beneficiary_name: profile?.displayName || formData.fullName || "Unknown",
  mobile_no: formData.phone,
  amount: numericAmount,
  payment_method: activeMethod,

      bank_code: "",

      account_number: "",

      remarks: "Tournament withdrawal",

    };


    console.log("========== PAYOUT PAYLOAD ==========");
    console.log(JSON.stringify(payload, null, 2));


    const res = await fetch(
      `${API_BASE}/api/payout`,
      {
        method:"POST",

        headers:{
          "Content-Type":"application/json",

          Authorization:`Bearer ${token}`,
        },

        body:JSON.stringify(payload),
      }
    );


    console.log(
      "BACKEND STATUS:",
      res.status
    );


    const data =
      await res.json()
      .catch(()=>({}));


    console.log(
      "BACKEND RESPONSE:",
      JSON.stringify(data,null,2)
    );


    if(!res.ok){

      console.log("❌ PAYOUT FAILED");
setWithdrawProcessing(false);

if (withdrawTimeout) {
  clearTimeout(withdrawTimeout);
}
      Alert.alert(
        "Error",
        data.error ||
        data.message ||
        "Withdrawal failed"
      );

      return;
    }

    console.log("✅ PAYOUT SUCCESS");
if (withdrawTimeout) {
  clearTimeout(withdrawTimeout);
}
setWithdrawProcessing(false);

    setModalVisible(false);


    setWithdrawalReference(
      data.transactionId ||
      `WD-${Date.now()}`
    ); 

    setWithdrawalSuccessVisible(true);


  } catch(err){

    console.error(
      "🔥 WITHDRAWAL EXCEPTION:",
      err
    );

setWithdrawProcessing(false);

if (withdrawTimeout) {
  clearTimeout(withdrawTimeout);
}
    Alert.alert(
      "Connection Problem",
      "Please check your internet connection."
    );
  }


  console.log("========== WITHDRAWAL END ==========");
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

const normalizedAmount = isMobileMoney
  ? grossXAF
  : amount;

if (normalizedAmount < methodLimits.withdraw.min) {
  Alert.alert(
    "Minimum Withdrawal",
    `Minimum withdrawal is ${methodLimits.withdraw.min.toLocaleString()} ${methodLimits.currency}`
  );
  return;
}
if (normalizedAmount > methodLimits.withdraw.max) {
  Alert.alert(
    "Maximum Withdrawal",
    `Maximum withdrawal is ${methodLimits.withdraw.max.toLocaleString()} ${methodLimits.currency}`
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

   if (!isDeposit) {
  setWithdrawProcessing(true);

  const timer = setTimeout(() => {
    setWithdrawProcessing(false);

    Alert.alert(
      "Withdrawal Still Processing",
      "Your request has been sent but the payment provider has not responded yet.\n\nPlease check your transaction history in a few minutes.\n\nDo NOT submit another withdrawal."
    );
  }, 30000); // 30 seconds

  setWithdrawTimeout(timer);
}

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

const minWithdrawDisplay = feeSettings.minimumWithdrawalUSD;

  const t = TEXT[lang];


// FRONTEND DISPLAY ONLY (MATCH BACKEND FEE LOGIC)
const amount = Number(formData.amount || 0);
// -------------------- Deposit Preview --------------------
const depositProviderFee = Math.round(amount * 0.025 * 100) / 100;
const depositTotalPay = amount + depositProviderFee;

const grossXAF = Math.round(convert(amount, "USD", "XAF"));

const feeXAF =
  grossXAF <= feeSettings.percentageThresholdXAF
    ? feeSettings.minimumFeeXAF
    : Math.round(grossXAF * feeSettings.percentageFee);

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
        Preview Account
      </Text>

      <Text
  style={{
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 20,
  }}
>
  Deposits and withdrawals are currently unavailable for preview accounts.

  {"\n\n"}

  This preview account allows you to explore the application's features without making deposits or withdrawals.

  {"\n\n"}

  Live payment features become available only after registering a personal account and completing verification where required.
</Text>

      <TouchableOpacity
        style={styles.confirmButton}
        onPress={() => router.back()}
      >
        <Text style={styles.confirmButtonText}> Back </Text>
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
      <Text
  style={{
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 12,
    fontSize: 12,
  }}
>
  Supported payment methods may vary by country and account eligibility.
</Text>
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

<View style={styles.historyCard}>

<Text style={styles.historyTitle}>
Recent Transactions
</Text>


<ScrollView
horizontal
showsHorizontalScrollIndicator={false}
>

<View style={{minWidth:650}}>


<View style={styles.tableHeader}>

<Text style={[styles.col,{width:100}]}>
Type
</Text>

<Text style={[styles.col,{width:100}]}>
Method
</Text>

<Text style={[styles.col,{width:100}]}>
Amount
</Text>

<Text style={[styles.col,{width:140}]}>
Status
</Text>

<Text style={[styles.col,{width:140}]}>
Time
</Text>

</View>


{transactions.length === 0 ? (

<Text style={styles.emptyHistory}>
No transactions yet.
</Text>

) : (

transactions.map(tx=>(

<View
key={tx.id}
style={styles.tableRow}
>


<Text style={[styles.col,{width:100}]}>
{tx.type?.toUpperCase()}
</Text>


<Text style={[styles.col,{width:100}]}>
{tx.method}
</Text>


<Text style={[styles.col,{width:100}]}>
{tx.amount}
</Text>


<Text style={[
styles.col,
{
width:140,
color:
tx.status==="SUCCESS"
?"#22c55e"
:
tx.status==="PENDING"
?"#facc15"
:"#ef4444"
}
]}>
{tx.status}
</Text>


<Text style={[styles.col,{width:140,fontSize:10}]}>
{tx.createdAt?.toDate
?
tx.createdAt.toDate()
.toLocaleString([],{
day:"2-digit",
month:"2-digit",
hour:"2-digit",
minute:"2-digit"
})
:"--"}
</Text>


</View>

))

)}

</View>

</ScrollView>

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
         <Text style={{
  fontSize: 22,
  fontWeight: "900",
  textAlign: "center",
  marginBottom: 8,
}}>
  <Text style={{color:"#FFCC00"}}>God</Text>
  <Text style={{color:"#9CA3AF"}}>Speed</Text>
  <Text style={{color:"#FFCC00"}}> Tech ⚡</Text>
</Text>

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
     Amount Deducted:
      {" "}
      {grossXAF.toLocaleString()} XAF
    </Text>

    <Text style={styles.amountValue}>
  Fee:
  {" "}
  -{feeXAF.toLocaleString()} XAF
</Text>

   <Text
  style={{
    color: "#00ff99",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 8,
  }}
>
  You Will Receive: {netXAF.toLocaleString()} XAF
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
  Deposit Amount: {amount.toLocaleString()} XAF
</Text>

<Text style={styles.amountValue}>
  Payment Provider Fee (2.5%): {depositProviderFee.toLocaleString()} XAF
</Text>

<Text
  style={{
    color: "#FACC15",
    fontWeight: "bold",
    marginTop: 4,
  }}
>
  Total You Pay: {depositTotalPay.toLocaleString()} XAF
</Text>

<Text
  style={{
    color: "#00ff99",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 8,
  }}
>
  Wallet Credit: {amount.toLocaleString()} XAF
</Text>

<Text
  style={{
    color: "#9CA3AF",
    marginTop: 6,
    fontSize: 12,
  }}
>
  ≈ {getConvertedAmount(amount).toFixed(2)} USD
</Text>
  </View>
)}
{/* Inline validation error */}
{formData.amount !== "" &&
(isDeposit
  ? Number(formData.amount) < methodLimits.deposit.min
  : grossXAF < methodLimits.withdraw.min) && (
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
  USD{minWithdrawDisplay.toFixed(2)}
  {" "}
  (≈ {methodLimits.withdraw.min.toLocaleString()} XAF)
</Text>

{" • "}

<Text style={styles.amountHighlight}>
  Max: {methodLimits.withdraw.max.toLocaleString()} XAF
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
  {isDeposit
    ? "Creating payment session..."
    : "Sending withdrawal request..."}
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
      Withdrawal Amount: {grossXAF.toLocaleString()} XAF
    </Text>

    <Text style={{ color: "#FB7185", marginBottom: 10 }}>
  Fee:
  -{feeXAF.toLocaleString()} XAF
</Text>

    <Text style={{ color: "#00ff99", marginBottom: 10 }}>
      You receive: {netXAF.toLocaleString()} XAF
    </Text>
  </>
)}

{isDeposit && (
  <>
    <Text style={{ color: "#fff", marginBottom: 6 }}>
      Deposit Amount: {amount.toLocaleString()} XAF
    </Text>

    <Text style={{ color: "#FB7185", marginBottom: 6 }}>
      Payment Provider Fee (2.5%): {depositProviderFee.toLocaleString()} XAF
    </Text>

    <Text style={{ color: "#FACC15", marginBottom: 6 }}>
      Total to Pay: {depositTotalPay.toLocaleString()} XAF
    </Text>

    <Text style={{ color: "#00ff99", marginBottom: 10 }}>
      Wallet Credit: {amount.toLocaleString()} XAF
    </Text>
  </>
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
    After confirmation, a secure payment page will open. 
    Complete your Mobile Money payment to fund your account.
    
Once your payment has been completed, you can close this window 
and check your wallet balance or transaction history. 
Your balance will update automatically after the payment
 provider confirms your transaction.
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
         <Text style={styles.modalButtonText}>
  {isDeposit ? "Confirm Deposit" : "Confirm Withdrawal"}
</Text>
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
       onPress={() => {
  setPaymentVisible(false);
  setDepositSuccessVisible(true);
  setConfirmVisible(false);
  setModalVisible(false);
}}
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

 onNavigationStateChange={(navState) => {
   console.log("Payment URL:", navState.url);

   if (
     navState.url.includes("success") ||
     navState.url.includes("completed") ||
     navState.url.includes("callback")
   ) {
     setPaymentVisible(false);
     setDepositSuccessVisible(true);
   }
 }}
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
    textAlign: "left",
    marginBottom: 20,
    lineHeight: 20,
  }}
>
  What happens next?
  {"\n\n"}

  ✓ Funds have been deducted from your account
  {"\n"}

  ✓ Payment provider is processing your Mobile Money transfer
  {"\n"}

  ✓ You will receive confirmation when completed
  {"\n\n"}

  You can safely close this page and wait for a while, then check your account.
</Text>

     <TouchableOpacity
  style={styles.confirmButton}
  onPress={() => {
    setWithdrawalSuccessVisible(false);

    setSwitcherHintTournamentId(null);
    setOpenAccountSwitcher(true);
  }}
>
  <Text style={styles.confirmButtonText}>
    CLOSE
  </Text>
</TouchableOpacity>

    </View>
  </View>
</Modal>
<Modal
 visible={depositSuccessVisible}
 transparent
 animationType="fade"
>

<View style={styles.modalOverlay}>

<View style={styles.modalContainer}>

<Text
style={{
color:"#00ff99",
fontSize:22,
fontWeight:"bold",
textAlign:"center",
marginBottom:15
}}
>
Deposit Submitted ✅
</Text>


<Text
style={{
color:"#fff",
textAlign:"center",
lineHeight:20,
marginBottom:15
}}
>
Your payment request has been received.
</Text>


<Text
  style={{
    color:"#9CA3AF",
    textAlign:"center",
    lineHeight:20,
    marginBottom:20
  }}
>
✓ Your payment has been submitted successfully.
{"\n"}
✓ The payment provider is now confirming your transaction.
{"\n"}
✓ Your wallet balance will increase automatically once the payment is confirmed.
{"\n"}
✓ You can now close  and leave this entire section, 
then check your wallet after about 5 minutes time.
</Text>


<TouchableOpacity
style={styles.confirmButton}
onPress={() => {
  setDepositSuccessVisible(false);

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

  setActiveMethod("");
  setPaymentUrl("");

 setSwitcherHintTournamentId(null);
setOpenAccountSwitcher(true);
}}
>

<Text style={styles.confirmButtonText}>
CLOSE
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
historyCard:{
backgroundColor:"#0B1220",
marginTop:18,
borderRadius:14,
padding:12,
},

historyTitle:{
color:"#fff",
fontSize:16,
fontWeight:"700",
marginBottom:10,
},

tableHeader:{
flexDirection:"row",
borderBottomWidth:1,
borderBottomColor:"#333",
paddingBottom:6,
marginBottom:4,
},

tableRow:{
flexDirection:"row",
paddingVertical:8,
borderBottomWidth:0.5,
borderBottomColor:"#222",
},

col:{

fontSize:11,
color:"#ddd",
textAlign:"center",
},

emptyHistory:{
color:"#777",
textAlign:"center",
paddingVertical:15,
},

});
