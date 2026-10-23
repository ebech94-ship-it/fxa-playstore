import { AntDesign, Ionicons } from "@expo/vector-icons";
import type { UserProfile } from "../app/AppContext";

import AsyncStorage from "@react-native-async-storage/async-storage";

import * as Linking from "expo-linking";
import PasswordInput from "../components/PasswordInput";

import * as Google from "expo-auth-session/providers/google";

import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { DocumentData, QuerySnapshot } from "firebase/firestore";
import { useApp } from "../app/AppContext";

import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  linkWithCredential,


  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPhoneNumber
} from "firebase/auth";



import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";


import {
  ActivityIndicator,

  Animated, ImageBackground, Keyboard, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View,
} from "react-native";

import { auth, db, } from "../firebaseConfig";

import { makeRedirectUri } from "expo-auth-session";

WebBrowser.maybeCompleteAuthSession();

// ✅ Validate 5-digit numeric password
// ✅ Firebase requires minimum 6 characters
const isValidPassword = (pwd: string) => pwd.length >= 6;
// ✅ Production flag
const ENABLE_PHONE_FALLBACK = true;

const COINS_API_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

async function callCoinsBackend(
  endpoint: string,
  payload: {
    referredBy?: string | null;
    displayName?: string;
    phone?: string | null;
  } = {}
) {
  const user = auth.currentUser;

  if (!user) throw new Error("User is not signed in.");
  if (!COINS_API_URL) throw new Error("Coins backend URL is missing.");

  const token = await user.getIdToken(true);

  const response = await fetch(
    `${COINS_API_URL}/api/coin-functions/${endpoint}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || `Backend error: ${response.status}`);
  }

  return result;
}


export default function Welcome() {
  const router = useRouter();
console.log("WEB CLIENT ID:", process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);


  const slideAnim = useState(new Animated.Value(400))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];
const [accepted, setAccepted] = useState(false);

const [countryCode, setCountryCode] = useState("CM");
const [callingCode, setCallingCode] = useState("237");
const [showPicker, setShowPicker] = useState(false);


  // 👤 form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(""); // <-- fixed duplicate
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
 

  // 🔗 Google → Email linking
const [showSetPassword, setShowSetPassword] = useState(false);
const [linkPassword, setLinkPassword] = useState("");
const [linkConfirmPassword, setLinkConfirmPassword] = useState("");
const [pendingGoogleUser, setPendingGoogleUser] = useState<any>(null);

const { setActiveAccount, setProfile } = useApp();


const normalizePhone = (phone:string) => {
  let number = phone.replace(/\s+/g,"");

  if (!number.startsWith("+")) {
    number = `+${callingCode}${number}`;
  }

  return number;
};

// Web: use proxy
// Mobile: use scheme
const redirectUri = makeRedirectUri();

console.log("REDIRECT URI:", redirectUri);

const [request, response, promptAsync] =
Google.useIdTokenAuthRequest({
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  redirectUri,
});



  const [showSignupEmail, setShowSignupEmail] = useState(false);
  const [showSignupPhone, setShowSignupPhone] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
const [inviteRef, setInviteRef] = useState<string | null>(null);
 
const [loading, setLoading] = useState(false);
const [otpLoading, setOtpLoading] = useState(false);
const [verifyLoading, setVerifyLoading] = useState(false);

  const [confirmationResult, setConfirmationResult] = useState<any>(null);  // ✅ add this
const [referrerName, setReferrerName] = useState<string | null>(null);

const [otp, setOtp] = useState("");
const [otpFailed, setOtpFailed] = useState(false);

const googleHandledRef = useRef(false);
   // 🔑 WEB + MOBILE OTP
const recaptchaRef = useRef<any>(null);

const COUNTRIES = [
  // 🇨🇲 Central & West Africa
  { code: "CM", name: "Cameroon", callingCode: "237" },
  { code: "NG", name: "Nigeria", callingCode: "234" },
  { code: "GH", name: "Ghana", callingCode: "233" },
  { code: "CI", name: "Côte d’Ivoire", callingCode: "225" },
  { code: "SN", name: "Senegal", callingCode: "221" },
  { code: "ML", name: "Mali", callingCode: "223" },

  // 🇰🇪 East Africa
  { code: "KE", name: "Kenya", callingCode: "254" },
  { code: "UG", name: "Uganda", callingCode: "256" },
  { code: "TZ", name: "Tanzania", callingCode: "255" },

  // 🇿🇦 Southern Africa
  { code: "ZA", name: "South Africa", callingCode: "27" },
  { code: "ZW", name: "Zimbabwe", callingCode: "263" },

  // 🌍 North Africa
  { code: "EG", name: "Egypt", callingCode: "20" },
  { code: "MA", name: "Morocco", callingCode: "212" },

  // 🇺🇸 Americas
  { code: "US", name: "United States", callingCode: "1" },
  { code: "CA", name: "Canada", callingCode: "1" },
  { code: "BR", name: "Brazil", callingCode: "55" },
  { code: "MX", name: "Mexico", callingCode: "52" },

  // 🌏 Asia
  { code: "TH", name: "Thailand", callingCode: "66" },
  { code: "IN", name: "India", callingCode: "91" },
  { code: "PH", name: "Philippines", callingCode: "63" },
  { code: "ID", name: "Indonesia", callingCode: "62" },

  // 🇪🇺 Europe
  { code: "GB", name: "United Kingdom", callingCode: "44" },
  { code: "FR", name: "France", callingCode: "33" },
  { code: "DE", name: "Germany", callingCode: "49" },
];

const loadUserProfile = useCallback(async () => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return;

  const data = snap.data() as UserProfile;
  if (!data) return;

  const profile: UserProfile = {
    uid: data.uid,
    publicId: data.publicId,
    email: data.email,
    phone: data.phone,
    provider: data.provider,
    referredBy: data.referredBy,
    referralCount: data.referralCount ?? 0,
    referralPoints: data.referralPoints ?? 0,
    referralEarnings: data.referralEarnings ?? 0,
    profileCompleted: data.profileCompleted ?? false,
    verified: data.verified ?? false,
    verifiedAt: data.verifiedAt ?? null,
    accounts: data.accounts,
  };

  setProfile(profile);

  if (profile.publicId) {
    await AsyncStorage.setItem("publicId", profile.publicId);
  }
}, [setProfile]);


const sendOTP = async () => {
  if (!name.trim()) {
    alert("Please enter your full name");
    return;
  }

  if (!phone.trim()) {
    alert("Enter phone number");
    return;
  }

  if (!isValidPassword(password)) {
    alert("Password must be at least 6 characters");
    return;
  }

  if (password !== confirmPassword) {
    alert("Passwords do not match");
    return;
  }

  const cleanedPhone = phone.replace(/\s+/g, "");

  try {
    setOtpLoading(true);

    const result = await signInWithPhoneNumber(
      auth,
      `+${callingCode}${cleanedPhone}`,
      undefined
    );

    setConfirmationResult(result);
    setOtpFailed(false);
    alert("OTP sent to your phone");
  } catch (e) {
    console.error("OTP sending failed:", e);

    setOtpFailed(true);
    setConfirmationResult(null);

    alert("OTP failed, you can continue without verification");
  } finally {
    setOtpLoading(false);
  }
};

const verifyOTP = async () => {
  if (!confirmationResult || otp.length < 6) {
    alert("Enter valid OTP");
    return;
  }

  try {
    setVerifyLoading(true);

    await confirmationResult.confirm(otp);

    const user = auth.currentUser;

    if (!user) {
      throw new Error("Phone verification succeeded, but no user is signed in.");
    }

    await callCoinsBackend("onAuthUserCreate", {
      displayName: name.trim(),
      referredBy: inviteRef,
      phone: user.phoneNumber || normalizePhone(phone),
    });

    await loadUserProfile();

    await AsyncStorage.setItem("isLoggedIn", "true");
    router.replace("/tradinglayout");
  } catch (e: any) {
    console.log("OTP ERROR:", e.code);
    console.log("MESSAGE:", e.message);
    alert(`${e.code || "Error"}\n\n${e.message}`);
  } finally {
    setVerifyLoading(false);
  }
};


useEffect(() => {
  if (inviteRef) {
    AsyncStorage.setItem("inviteRef", inviteRef);
  }
}, [inviteRef]);

useEffect(() => {
  const handleDeepLink = async ({ url }: { url: string }) => {
  const { queryParams } = Linking.parse(url);

  if (!queryParams?.ref) return;

  const ref = queryParams.ref as string;

  await AsyncStorage.setItem("inviteRef", ref);
  setInviteRef(ref);

  await setDoc(doc(db, "meta/pendingRefs", ref), {
    inviteRef: ref,
    createdAt: serverTimestamp(),
  });
};
  

  // Subscribe to deep links
  const subscription = Linking.addEventListener("url", handleDeepLink);

  // Check if the app was opened from a link
  Linking.getInitialURL().then((url) => {
    if (url) handleDeepLink({ url });
  });

  return () => subscription.remove();
}, []);
useEffect(() => {
  if (!inviteRef) return;

  const fetchReferrer = async () => {
    const refSnap = await getDoc(doc(db, "users", inviteRef));
    if (refSnap.exists()) {
      setReferrerName(refSnap.data().displayName || "a friend");
    }
  };

  fetchReferrer();
}, [inviteRef]);

useEffect(() => {
  const loadRef = async () => {
    const ref = await AsyncStorage.getItem("inviteRef");

    if (ref) {
      setInviteRef(ref);
     // ✅ ADD THIS
    }
  };

  loadRef();
}, []);
  




// 🎯 Google login handler
useEffect(() => {
  if (!response || googleHandledRef.current) return;
  if (response.type !== "success") return;

  const { idToken, accessToken } = response.authentication ?? {};

  if (!idToken && !accessToken) {
    alert("Google authentication failed.");
    return;
  }

const run = async () => {
  try {
    setLoading(true);
    googleHandledRef.current = true;

    const credential = GoogleAuthProvider.credential(
      idToken ?? undefined,
      accessToken ?? undefined
    );

  const { user } = await signInWithCredential(auth, credential);

const hasPassword = user.providerData.some(
  (p) => p.providerId === "password"
);

if (!hasPassword) {
  setPendingGoogleUser(user);
  setShowSetPassword(true);
  setLoading(false);
  return;
}

const uid = user.uid;
const ref = inviteRef;// ✅ FIX HERE

    if (ref) {
      await setDoc(
        doc(db, "users", uid),
        {
          referredBy: ref,
        },
        { merge: true }
      );
    }

    await auth.currentUser?.getIdToken(true);

    await AsyncStorage.setItem("isLoggedIn", "true");

    router.replace("/tradinglayout");

  } catch (e) {
    googleHandledRef.current = false;
    alert((e as Error).message);
  } finally {
    setLoading(false);
  }
};

  run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [response, router, loadUserProfile]);


  // Animations
  const openForm = (setter: any) => {
    setShowSignupEmail(false);
    setShowSignupPhone(false);
    setShowLogin(false);
    setter(true);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const closeForm = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 400, duration: 400, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setShowSignupEmail(false);
      setShowSignupPhone(false);
      setShowLogin(false);
    });
  };

// 📧 Email Signup

const handleSignupEmail = async () => {
  if (!name.trim()) return alert("Enter your full name");
  if (!email.trim()) return alert("Enter your email");
  if (!isValidPassword(password)) {
    return alert("Password must be at least 6 characters");
  }
  if (password !== confirmPassword) {
    return alert("Passwords do not match");
  }

  setLoading(true);

  try {
    await createUserWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      password
    );

    await callCoinsBackend("onAuthUserCreate", {
      displayName: name.trim(),
      referredBy: inviteRef,
    });

    await loadUserProfile();

    await AsyncStorage.setItem("isLoggedIn", "true");
    router.replace("/tradinglayout");
  } catch (e) {
    console.error("Email signup failed:", e);
    alert((e as Error).message);
  } finally {
    setLoading(false);
  }
};

  // 🔑 Email Login (RETURNING USERS ONLY)
const handleLogin = async () => {

  if (!email || !password) {
    alert("Enter email, username, or phone and password");
    return;
  }

  try {
    setLoading(true);

    const identifier = email.trim().toLowerCase();
    let resolvedEmail: string | null = null;

    // 1️⃣ IF IT LOOKS LIKE AN EMAIL → USE DIRECTLY
    if (identifier.includes("@")) {
      resolvedEmail = identifier;
    } else {
      // 2️⃣ OTHERWISE → LOOK UP USER IN FIRESTORE
     let q;

if (identifier.includes("@")) {
  resolvedEmail = identifier;
} else {

let snap: QuerySnapshot<DocumentData>;

  // Try Public ID first
  snap = await getDocs(
    query(
      collection(db, "users"),
      where("publicId", "==", identifier.toUpperCase())
    )
  );

  // If not found, try phone
  if (snap.empty) {

   let phoneNumber = normalizePhone(identifier);

    snap = await getDocs(
      query(
        collection(db, "users"),
        where("phone", "==", phoneNumber)
      )
    );
  }

  if (snap.empty) {
    alert("User not found");
    return;
  }

  resolvedEmail = snap.docs[0].data().email;
}


    }
if (!resolvedEmail) {
  alert("Could not resolve email for this user");
  return;
}
    // 3️⃣ CHECK SIGN-IN METHODS
    const methods = await fetchSignInMethodsForEmail(auth, resolvedEmail);

    // 🚫 GOOGLE-ONLY ACCOUNT → BLOCK PASSWORD LOGIN
    if (methods.includes("google.com") && !methods.includes("password")) {
      alert(
        "This account uses Google. Please log in with Google first to set a password."
      );
      return;
    }

    // 4️⃣ LOGIN
    await signInWithEmailAndPassword(auth, resolvedEmail, password);

    await AsyncStorage.setItem("isLoggedIn", "true");
    router.replace("/tradinglayout");

  } catch {
    alert("Invalid credentials");
  } finally {
    setLoading(false);
  }
};


const handleLinkPassword = async () => {
  if (!isValidPassword(linkPassword)) {
    return alert("Password must be at least 6 characters. Example: 123456");
  }

  if (linkPassword !== linkConfirmPassword) {
    return alert("Passwords do not match");
  }

  try {
    setLoading(true);

    if (!pendingGoogleUser) {
      return alert("No Google user to link password to.");
    }

 const credential = EmailAuthProvider.credential(
  pendingGoogleUser.email,
  linkPassword.trim()
);

    await linkWithCredential(pendingGoogleUser, credential);

    alert("Password set successfully 🎉");

    setShowSetPassword(false);
    setPendingGoogleUser(null);

    await AsyncStorage.setItem("isLoggedIn", "true");
    router.replace("/tradinglayout");

  } catch (e) {
    alert((e as Error).message);
  } finally {
    setLoading(false);
  }
};




  return (
  
    <KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === "ios" ? "padding" : undefined}
>

  <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <ImageBackground
      source={require("../assets/images/background.png")}
      style={styles.bg}
      resizeMode="cover"
    >


     <ScrollView
  style={{ flex: 1 }}
  contentContainerStyle={{
    flexGrow: 1,
    paddingBottom: 50,
  }}
  keyboardShouldPersistTaps="handled"
  showsVerticalScrollIndicator={false}
>
        <View style={styles.overlay}>
  

          <Text style={styles.title}>Welcome to Forex Tournaments Arena</Text>
       {inviteRef && (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ color: "#21e6c1", textAlign: "center" }}>
      🎁 You were invited by {referrerName || "a friend"}!
    </Text>
  </View>
)}
          <Text style={styles.desc}>
          Learn and compete using virtual forex trading accounts.
           Users may optionally register for competitive tournaments using
            coins balances. 
          FX Arena does not provide real forex trading, brokerage,
           or investment services.
          </Text>

{/* AGREEMENT CHECKBOX */}
<View
  style={{
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    width: "90%",
  }}
>
  <TouchableOpacity
    onPress={() => setAccepted(!accepted)}
    style={{
      width: 24,
      height: 24,
      borderWidth: 2,
      borderColor: "#5A4BE7",
      borderRadius: 6,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
      backgroundColor: accepted ? "#5A4BE7" : "transparent",
    }}
  >
    {accepted && (
      <Ionicons name="checkmark" size={16} color="white" />
    )}
  </TouchableOpacity>

  <Text style={{ color: "white", flex: 1 }}>
    I agree to the{" "}
    <Text
      onPress={() => router.push("./terms")}
      style={{ color: "#5A4BE7", textDecorationLine: "underline" }}
    >
      Terms & Conditions
    </Text>{" "}
    and{" "}
    <Text
      onPress={() => router.push("./privacy")}
      style={{ color: "#5A4BE7", textDecorationLine: "underline" }}
    >
      Privacy Policy
    </Text>.
  </Text>
</View>



          {/* MAIN BUTTONS */}
{!showSignupEmail && !showSignupPhone && !showLogin && (
  <>
    {/* SIGN UP WITH EMAIL */}
    <TouchableOpacity
  style={[styles.button, { opacity: accepted && !loading ? 1 : 0.4 }]}
  onPress={() => accepted && !loading && openForm(setShowSignupEmail)}
  disabled={!accepted || loading}
>
  <Text style={styles.buttonText}>📧 Sign Up with Email</Text>
</TouchableOpacity>
   
     {/* SIGN UP WITH PHONE */}
    <TouchableOpacity
      style={[
        styles.button,
        { opacity: accepted ? 1 : 0.4 },
      ]}
      onPress={() => {
  if (!accepted) return;

  setOtpFailed(false);
  setConfirmationResult(null);
  setOtp("");
  setPhone("");
  openForm(setShowSignupPhone);
}}
    >
      <Text style={styles.buttonText}>📱 Sign Up with Phone</Text>
    </TouchableOpacity>

    {/* GOOGLE SIGN IN */}
  <TouchableOpacity
  style={[
    styles.button,
    {
      backgroundColor: "#777",
      opacity: 0.5,
    },
  ]}
  disabled={true}
>
  <AntDesign name="google" size={16} color="white" />
  <Text style={[styles.buttonText, { marginLeft: 8 }]}>
    Google Sign Up Temporarily Disabled
  </Text>
</TouchableOpacity>



    {/* LOGIN */}
   <TouchableOpacity
  style={[styles.button, { opacity: accepted && !loading ? 1 : 0.4 }]}
  onPress={() => accepted && !loading && openForm(setShowLogin)}
  disabled={!accepted || loading}
>
  <Text style={styles.buttonText}>
    {loading ? "Loading..." : "Log In"}
  </Text>
</TouchableOpacity>

  </>
)}
{/* PREVIEW MODE / EVALUATORS ONLY */}
<TouchableOpacity
  style={[
    styles.button,
    { backgroundColor: "#21e6c1" }, // nice greenish-blue
  ]}
  onPress={async () => {
  try {
    setLoading(true);

    const { signInAnonymously } = await import("firebase/auth");

    const result = await signInAnonymously(auth);

    setProfile({
      username: "Evaluator",
      displayName: "Google Play Reviewer",
      verified: false,
      preview: true,
      uid: result.user.uid,
    });

    setActiveAccount({ type: "demo" });

    await AsyncStorage.setItem("isLoggedIn", "preview");

    router.replace("/tradinglayout");

  } catch (e) {
    console.log("Evaluation login failed", e);
    alert("Evaluation mode unavailable");
  } finally {
    setLoading(false);
  }
}}
>
  <Text style={styles.buttonText}>👀 Evaluator's Access</Text>
  <Text style={{ color: "#5f79eeff", fontSize: 12, marginTop: 4 }}>
  No signup required! 
</Text>
</TouchableOpacity>

          {/* POPUP FORMS */}
          {showSetPassword && (
  <View style={styles.blockerOverlay}>
    <View style={styles.popup}>
      <Text style={styles.subtitle}>Set a Password</Text>

     <PasswordInput
  value={linkPassword}
  onChangeText={setLinkPassword}
 placeholder="Enter password (min 6 characters/digits)"

/>

<PasswordInput
  value={linkConfirmPassword}
  onChangeText={setLinkConfirmPassword}
 placeholder="Confirm password"

/>
    <TouchableOpacity
  style={[styles.button, { opacity: !loading ? 1 : 0.4 }]}
 onPress={() => !loading && handleLinkPassword()}
  disabled={loading}
>
  <Text style={styles.buttonText}>
    {loading ? "Saving..." : "Save password"}
  </Text>
</TouchableOpacity>

    </View>
  </View>
)}

          {(showSignupEmail || showSignupPhone || showLogin) && (
  <View style={styles.blockerOverlay} pointerEvents="box-none">
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.dimBackground} />
    </TouchableWithoutFeedback>

    <Animated.View
      style={[
        styles.popup,
        { transform: [{ translateX: slideAnim }], opacity: fadeAnim }
      ]}
    >

              {/* EMAIL SIGNUP */}
              {showSignupEmail && (
                <>
                  <Text style={styles.subtitle}>Sign Up with Email</Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#aaa"
                    value={name}
                    onChangeText={setName}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#aaa"
                    value={email}
                    onChangeText={setEmail}
                  />
      <PasswordInput
  value={password}
  onChangeText={setPassword}
  placeholder="Enter password (min 6 characters/digits)"

/>

<PasswordInput
  value={confirmPassword}
  onChangeText={setConfirmPassword}
 placeholder="Confirm password"

/>
<TouchableOpacity
  style={[styles.button, { opacity: accepted && !loading ? 1 : 0.4 }]}
  onPress={() => accepted && !loading && handleSignupEmail()}
  disabled={!accepted || loading}
>
   <Text style={styles.buttonText}>
    {loading ? "Submitting..." : "Submit"}
  </Text>
</TouchableOpacity>

                  <TouchableOpacity style={styles.link} onPress={closeForm}>
                    <Text style={styles.linkText}>Back</Text>
                  </TouchableOpacity>
                </>
              )}
{/* 📱 PHONE SIGNUP (OTP) */}
{showSignupPhone && (
  <>
    <Text style={styles.subtitle}>Sign Up with Phone</Text>

    {/* Name */}
    <TextInput
      style={styles.input}
      placeholder="Full Name"
      placeholderTextColor="#aaa"
      value={name}
      onChangeText={setName}
    />
{/* Phone Row */}
<View
  style={{
    flexDirection: "row",
    width: "100%",
    alignItems: "center",
  }}
>
  {/* COUNTRY CODE SMALL BOX */}
  <TouchableOpacity
    onPress={() => setShowPicker(true)}
    style={{
      height: 52,
      width: 95,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#5A4BE7",
      backgroundColor: "#1e1e1e",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 8,
    }}
  >
    <Text
      style={{
        color: "white",
        fontSize: 13,
        fontWeight: "bold",
      }}
    >
      +{callingCode}
    </Text>
    <Text
      style={{
        color: "#aaa",
        fontSize: 11,
      }}
    >
      {countryCode}
    </Text>
  </TouchableOpacity>

  {/* PHONE INPUT */}
  <TextInput
    style={[
      styles.input,
      {
        flex: 1,
        height: 52,
        fontSize: 18,
      },
    ]}
    placeholder="Phone number"
    placeholderTextColor="#ddd"
    keyboardType="phone-pad"
    value={phone}
    onChangeText={(text) => {
      const cleaned = text
        .replace(/\s+/g, "")
        .replace(/[-()]/g, "")
        .replace(/^\+/, "");

      setPhone(cleaned.replace(/[^0-9]/g, ""));
    }}
  />
</View>

<PasswordInput
  value={password}
  onChangeText={setPassword}
  placeholder="Enter password (min 6 characters)"
/>

<PasswordInput
  value={confirmPassword}
  onChangeText={setConfirmPassword}
  placeholder="Confirm password"
/>


{/* SEND OTP */}
<TouchableOpacity
  style={[
    styles.button,
    {
      marginTop: 10,
      opacity: otpLoading ? 0.5 : 1,
    },
  ]}
  onPress={sendOTP}
  disabled={otpLoading}
>
  <Text style={styles.buttonText}>
    {otpLoading ? "Sending OTP..." : "Send OTP"}
  </Text>
</TouchableOpacity>

  
{/* STEP 2 — OTP SECTION */}
{(confirmationResult || otpFailed) && (
  <>
    {confirmationResult && (
      <>
        <TextInput
          style={styles.input}
          placeholder="Enter 6-digit OTP"
          keyboardType="number-pad"
          value={otp}
          onChangeText={setOtp}
        />

        <TouchableOpacity
          style={[styles.button, { opacity: verifyLoading ? 0.5 : 1 }]}
          onPress={verifyOTP}
          disabled={verifyLoading}
        >
          <Text style={styles.buttonText}>
            {verifyLoading ? "Verifying..." : "Verify & Continue"}
          </Text>
        </TouchableOpacity>
      </>
    )}

    {/* 🔥 FALLBACK ALWAYS VISIBLE WHEN OTP FAILS */}
   {/* 🔥 FALLBACK (disabled for production) */}
{ENABLE_PHONE_FALLBACK && otpFailed && (
      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#0f4698ff", marginTop: 10 }]}
        

onPress={async () => {
  try {
    let user = auth.currentUser;

    if (!user) {
      const result = await createUserWithEmailAndPassword(
  auth,
  `${callingCode}${phone}@fxarena.phone`,
  password.trim()
);

      user = result.user;
    }

   
await callCoinsBackend("onAuthUserCreate", {
  displayName: name.trim(),
  referredBy: inviteRef,
  phone: normalizePhone(phone),
});

await loadUserProfile();

// Reset OTP UI
setOtpFailed(false);
setConfirmationResult(null);
setOtp("");
setPhone("");

await AsyncStorage.setItem("isLoggedIn", "true");

router.replace("/tradinglayout");

  } catch (e) {
    console.error("Phone fallback signup:", e);

    alert(
      e instanceof Error
        ? e.message
        : "Unable to continue. Please try again."
    );
  }
}}
      >
        <Text style={styles.buttonText}>Continue without OTP</Text>
      </TouchableOpacity>
    )}
  </>
)}

    <TouchableOpacity style={styles.link} onPress={closeForm}>
      <Text style={styles.linkText}>Back</Text>
    </TouchableOpacity>

    {/* 🌍 COUNTRY PICKER MODAL */}
    <Modal visible={showPicker} transparent animationType="slide">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            backgroundColor: "#111",
            margin: 20,
            borderRadius: 12,
            padding: 16,
            maxHeight: "70%",
          }}
        >
          <Text
            style={{
              color: "white",
              fontSize: 18,
              fontWeight: "bold",
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            Select Country
          </Text>

          <ScrollView>
            {COUNTRIES.map((c) => (
              <TouchableOpacity
                key={c.code}
                onPress={() => {
                  setCountryCode(c.code);
                  setCallingCode(c.callingCode);
                  setShowPicker(false);
                }}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: "#333",
                }}
              >
                <Text style={{ color: "white" }}>
                  {c.name} (+{c.callingCode})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            onPress={() => setShowPicker(false)}
            style={{ marginTop: 12, alignItems: "center" }}
          >
            <Text style={{ color: "#5A4BE7", fontWeight: "bold" }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </>
)}

              {/* LOGIN */}
              {showLogin && (
                <>
                  <Text style={styles.subtitle}>Log In</Text>

                  <TextInput
                    style={styles.input}
                 placeholder="Email"
                    placeholderTextColor="#aaa"
                    value={email}
                    onChangeText={setEmail}
                  />
                  <PasswordInput
  value={password}
  onChangeText={setPassword}
  placeholder="Enter password (min 6 characters/digits)"
/>
<TouchableOpacity
  style={[styles.button, { opacity: !loading ? 1 : 0.4 }]}
  onPress={() => !loading && handleLogin()}
  disabled={loading}
>
  <Text style={styles.buttonText}>
    {loading ? "Logging in..." : "Submit"}
  </Text>
</TouchableOpacity>

                  <TouchableOpacity style={styles.link} onPress={closeForm}>
                    <Text style={styles.linkText}>Back</Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
             </View> 
          )}

          {/* 🔄 loading overlay */}
          {loading && (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
{/* FINAL LEGAL FOOTER */}
{/* FINAL LEGAL FOOTER */}
<View style={{ width: "90%", marginTop: 30, alignItems: "center" }}>

  <Text
    style={{
      color: "#888",
      fontSize: 11,
      textAlign: "center",
      lineHeight: 16,
      marginBottom: 8,
    }}
  >
    FX Arena is an educational forex trading simulator. It does not provide
    real forex trading, brokerage, investment, financial advisory, or exchange
    services. All trading activities and tournament balances are virtual and
    exist solely for learning and competition.
  </Text>

  <Text
    style={{
      color: "#777",
      fontSize: 11,
      textAlign: "center",
      lineHeight: 16,
      marginBottom: 8,
    }}
  >
   Tournament registration is optional and uses virtual coins. Coins are used
for eligible tournament participation, and rewards are distributed according
to the applicable tournament rules and platform terms.
  </Text>

  <Text
    style={{
      color: "#777",
      fontSize: 11,
      textAlign: "center",
      lineHeight: 16,
      marginBottom: 12,
    }}
  >
    Trading involves risk. Performance achieved using virtual funds does not
    represent or guarantee real-world trading results.
  </Text>

  {/* Links Row */}
  <View style={{ flexDirection: "row", gap: 10 }}>
    <TouchableOpacity onPress={() => router.push("./terms")}>
      <Text style={{ color: "#bbb", textDecorationLine: "underline" }}>
        Terms & Conditions
      </Text>
    </TouchableOpacity>

    <Text style={{ color: "#bbb" }}>|</Text>

    <TouchableOpacity onPress={() => router.push("./privacy")}>
      <Text style={{ color: "#bbb", textDecorationLine: "underline" }}>
        Privacy Policy
      </Text>
    </TouchableOpacity>
  </View>
</View>
        </View>

      </ScrollView>
    </ImageBackground>
  </TouchableWithoutFeedback>
</KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: "100%", height: "100%" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    padding: 20,
  },
 title: {
  fontSize: 24,
  fontWeight: "bold",
  color: "white",
  marginTop: 60,
  marginBottom: 15,
  textAlign: "center",   // ✅ centers text horizontally
  alignSelf: "center",   // ✅ ensures the component itself is centered
},
  desc: {
    color: "white",
    textAlign: "center",
    width: "85%",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#5A4BE7",
    padding: 12,
    borderRadius: 10,
    marginVertical: 8,
     width: "100%",          // ✅ prevents overflow weirdness
  alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  buttonText: { color: "white", fontWeight: "bold" },
  popup: {
    position: "absolute",
    top: "22%",
    width: "85%",
    backgroundColor: "rgba(20,20,20,0.95)",
    padding: 20,
    borderRadius: 18,
  },
  subtitle: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
    marginBottom: 10,
    fontSize: 18,
  },
  input: {
    backgroundColor: "#1e1e1e",
    color: "white",
    padding: 12,
    borderRadius: 8,
    borderColor: "#5A4BE7",
    borderWidth: 1,
    marginVertical: 6,
  },
  link: { marginTop: 10, alignItems: "center" },
  linkText: { color: "#5A4BE7" },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  blockerOverlay: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  justifyContent: "center",
  alignItems: "center",
  zIndex: 999,
},

dimBackground: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.6)",
},
});