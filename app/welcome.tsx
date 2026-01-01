import { AntDesign, Ionicons } from "@expo/vector-icons";


import AsyncStorage from "@react-native-async-storage/async-storage";

import * as Google from "expo-auth-session/providers/google";
import * as Localization from "expo-localization";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  PhoneAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState, } from "react";


import {
  ActivityIndicator,
  Animated,
  ImageBackground,
  Keyboard,
  Modal,

  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { auth, db } from "../firebaseConfig";

WebBrowser.maybeCompleteAuthSession();

 // 📘 Create Firestore profile
export const createUserAccounts = async (
  uid: string,
  name: string,
  email: string
) => {
  const userRef = doc(db, "users", uid);
  const docSnap = await getDoc(userRef);
const countryCode =
  Localization.getLocales()?.[0]?.regionCode ?? null;

  // Only create once
  if (!docSnap.exists()) {
    // 🔗 Read referral
    const inviteRef = await AsyncStorage.getItem("inviteRef");

    // ✅ Determine valid referrer BEFORE writing
    let referredBy: string | null = null;

    if (inviteRef && inviteRef !== uid) {
      const refUserSnap = await getDoc(doc(db, "users", inviteRef));
      
      if (refUserSnap.exists()) {
        referredBy = inviteRef;
      }
    }
const publicUserId = await generateUserId();

    // ✅ Now create user
    await setDoc(userRef, {
  uid,
  userId: publicUserId,
  name,
   countryCode,
  email,
  provider: auth.currentUser?.providerData[0]?.providerId || "password",
  profileCompleted: true,
   referredBy: referredBy,
  createdAt: serverTimestamp(),
  accounts: {
    demo: { balance: 1000, type: "practice" },
    real: { balance: 0, type: "real" },
    tournament: { balance: 0, type: "tournament" },
  },
});


    // 🧹 Clear referral after use
    if (inviteRef) {
      await AsyncStorage.removeItem("inviteRef");
    }
  }
};
const generateUserId = async () => {
  const counterRef = doc(db, "meta", "userCounter");

  const newUserId = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);

    if (!snap.exists()) {
      throw "Counter does not exist";
    }

    const current = snap.data().count || 0;
    const next = current + 1;

    transaction.update(counterRef, { count: next });

    return `USR-${String(next).padStart(6, "0")}`;
  });

  return newUserId;
};



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
  const [showPassword, setShowPassword] = useState(false);

// 🔐 GOOGLE LOGIN SETUP
const [request, response, promptAsync] = Google.useAuthRequest({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  clientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID, // ✅ ADD THIS
  scopes: ["profile", "email"],
});


  const [showSignupEmail, setShowSignupEmail] = useState(false);
  const [showSignupPhone, setShowSignupPhone] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
const [inviteRef, setInviteRef] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

const [verificationId, setVerificationId] = useState<string | null>(null);
const [otp, setOtp] = useState("");
const [googleHandled, setGoogleHandled] = useState(false);
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


const sendOTP = async () => {
  if (!name.trim()) {
    alert("Please enter your full name");
    return;
  }

  const cleanedPhone = phone.replace(/\s+/g, "");

  const minLength = 7;
  const maxLength = 14;

  if (cleanedPhone.length < minLength || cleanedPhone.length > maxLength) {
    alert("Please enter a valid phone number");
    return;
  }

  try {
    setLoading(true);

    const provider = new PhoneAuthProvider(auth);
    const fullPhoneNumber = `+${callingCode}${cleanedPhone}`;

    console.log("Sending OTP to:", fullPhoneNumber);

    const id = await provider.verifyPhoneNumber(fullPhoneNumber);

    setVerificationId(id);
    alert("OTP sent to your phone");
  } catch (e) {
    console.error(e);
    alert((e as Error).message || "Failed to send OTP");
  } finally {
    setLoading(false);
  }
};



const verifyOTP = async () => {
  if (!verificationId || otp.length < 6) {
    alert("Enter valid OTP");
    return;
  }

  try {
    setLoading(true);

    const credential = PhoneAuthProvider.credential(
      verificationId,
      otp
    );

    const userCred = await signInWithCredential(auth, credential);

    await createUserAccounts(
      userCred.user.uid,
      name || "Phone User",
      `${userCred.user.uid}@phone.fx`
    );

    await AsyncStorage.setItem("isLoggedIn", "true");
    router.replace("/tradinglayout");

  } catch {
    alert("Invalid OTP");
  } finally {
    setLoading(false);
  }
};


useEffect(() => {
  AsyncStorage.getItem("inviteRef").then((ref) => {
    if (ref) setInviteRef(ref);
  });
}, []);
  




  // 🎯 Google login handler
useEffect(() => {
  if (!response || googleHandled) return;
  if (response.type !== "success") return;

  const { idToken, accessToken } = response.authentication ?? {};

  if (!idToken && !accessToken) {
    alert("Google authentication failed.");
    return;
  }

  const run = async () => {
    try {
      setLoading(true);

      // ✅ FIX: pass BOTH tokens
      const credential = GoogleAuthProvider.credential(
        idToken ?? undefined,
        accessToken ?? undefined
      );

      const userCred = await signInWithCredential(auth, credential);

      await createUserAccounts(
        userCred.user.uid,
        userCred.user.displayName || "Google User",
        userCred.user.email || ""
      );

      await AsyncStorage.setItem("isLoggedIn", "true");
      setGoogleHandled(true);

      // ✅ NOW navigation will work
      router.replace("/tradinglayout");
    } catch (e) {
      setGoogleHandled(false);
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  run();
}, [response, googleHandled, router]);



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
    try {
      if (password !== confirmPassword) return alert("Passwords do not match");

      setLoading(true);
      const userCred = await createUserWithEmailAndPassword(auth, email, password);

await createUserAccounts(
  userCred.user.uid,
  name,
  email,
  
);

await AsyncStorage.setItem("isLoggedIn", "true");
router.replace("/tradinglayout");


    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 🔑 Email Login
  // 🔑 Email Login (RETURNING USERS ONLY)
const handleLogin = async () => {
  if (!email || !password) {
    alert("Enter email and password");
    return;
  }

  try {
    setLoading(true);

    await signInWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      password
    );

    await AsyncStorage.setItem("isLoggedIn", "true");
    router.replace("/tradinglayout");

  } catch {
    alert("Invalid email or password");
  } finally {
    setLoading(false);
  }
};




  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <ImageBackground
        source={require("../assets/images/background.png")}
        style={styles.bg}
        resizeMode="cover"
      >
   
        <View style={styles.overlay}>
          <Text style={styles.title}>Welcome to Forex Tournaments Arena</Text>
          {inviteRef && (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ color: "#21e6c1", textAlign: "center" }}>
      🎁 You were invited by a friend
    </Text>
  </View>
)}
          <Text style={styles.desc}>
            Join live Forex Tournaments, compete for real cash rewards by growing your virtual account balance!
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
      style={[
        styles.button,
        { opacity: accepted ? 1 : 0.4 }, // fade when disabled
      ]}
      onPress={() => accepted && openForm(setShowSignupEmail)}
      disabled={!accepted}
    >
      <Text style={styles.buttonText}>📧 Sign Up with Email</Text>
    </TouchableOpacity>

    {/* SIGN UP WITH PHONE */}
    <TouchableOpacity
      style={[
        styles.button,
        { opacity: accepted ? 1 : 0.4 },
      ]}
      onPress={() => accepted && openForm(setShowSignupPhone)}
      disabled={!accepted}
    >
      <Text style={styles.buttonText}>📱 Sign Up with Phone</Text>
    </TouchableOpacity>

    {/* GOOGLE SIGN IN */}
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: "#DB4437", opacity: accepted ? 1 : 0.4 },
      ]}
      onPress={() => accepted && request && promptAsync()}
      disabled={!accepted || !request}
    >
      {!request ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <AntDesign name="google" size={16} color="white" />
          <Text style={[styles.buttonText, { marginLeft: 8 }]}>
            Continue with Google
          </Text>
        </>
      )}
    </TouchableOpacity>

    {/* LOGIN */}
    <TouchableOpacity
      style={[
        styles.button,
        { opacity: accepted ? 1 : 0.4 },
      ]}
      onPress={() => accepted && openForm(setShowLogin)}
      disabled={!accepted}
    >
      <Text style={styles.buttonText}>Log In</Text>
    </TouchableOpacity>
  </>
)}
          {/* POPUP FORMS */}
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
                   <TextInput
    style={[styles.input, { flex: 1 }]}
    placeholder="Password"
    placeholderTextColor="#aaa"
    secureTextEntry={!showPassword}
    value={password}
    onChangeText={setPassword}
  />

  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
    <Ionicons
      name={showPassword ? "eye-off" : "eye"}
      size={22}
      color="#fff"
      style={{ paddingHorizontal: 6 }}
    />
  </TouchableOpacity>
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="#aaa"
                    secureTextEntry={!showPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />

            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                   <Ionicons
            name={showPassword ? "eye-off" : "eye"}
                  size={22} color="#fff"
              style={{ paddingHorizontal: 6 }}
                   />
                 </TouchableOpacity>

                  <TouchableOpacity style={styles.button} onPress={handleSignupEmail}>
                    <Text style={styles.buttonText}>Submit</Text>
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
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {/* COUNTRY CODE BUTTON */}
      <TouchableOpacity
        onPress={() => setShowPicker(true)}
        style={{
          paddingVertical: 14,
          paddingHorizontal: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "#5A4BE7",
          marginRight: 8,
          minWidth: 80,
          alignItems: "center",
        }}
      >
       <Text style={{ color: "white", fontWeight: "bold" }}>
  {COUNTRIES.find(c => c.code === countryCode)?.name} +{callingCode}
        </Text>
      </TouchableOpacity>

      {/* PHONE INPUT */}
      <TextInput
        style={[styles.input, { flex: 1 }]}
        placeholder="Phone number"
        placeholderTextColor="#ddd"
        keyboardType="phone-pad"
        value={phone}
       onChangeText={(text) => {
  const cleaned = text
    .replace(/\s+/g, "")      // remove spaces
    .replace(/[-()]/g, "")    // remove dashes & brackets
    .replace(/^\+/, "");      // remove leading +

  setPhone(cleaned.replace(/[^0-9]/g, ""));
}}


      />
    </View>

    {/* STEP 1 — SEND OTP */}
    {!verificationId && (
      <TouchableOpacity style={styles.button} onPress={sendOTP}>
        <Text style={styles.buttonText}>Send OTP</Text>
      </TouchableOpacity>
    )}

    {/* STEP 2 — VERIFY OTP */}
    {verificationId && (
      <>
        <TextInput
          style={styles.input}
          placeholder="Enter 6-digit OTP"
          placeholderTextColor="#aaa"
          keyboardType="number-pad"
          value={otp}
          onChangeText={setOtp}
        />

        <TouchableOpacity style={styles.button} onPress={verifyOTP}>
          <Text style={styles.buttonText}>Verify & Continue</Text>
        </TouchableOpacity>
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
                  <TextInput
                    style={styles.input}
                    placeholder="enter you password"
                    placeholderTextColor="#aaa"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                      size={22} color="#fff"
                    style={{ paddingHorizontal: 6 }}
                      />
              </TouchableOpacity>
                  <TouchableOpacity style={styles.button} onPress={handleLogin}>
                    <Text style={styles.buttonText}>Submit</Text>
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
    This app offers trading simulations, and educational tournaments. It does NOT provide real trading,
     investment, brokerage, or financial advisory services. All results shown inside the app are virtual
      and participation is for training purposes and entertainment only.
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
    Trading carries risk. Performance in the app does not represent real
    market profitability.
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

      </ImageBackground>
    </TouchableWithoutFeedback>
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
    width: "90%",
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