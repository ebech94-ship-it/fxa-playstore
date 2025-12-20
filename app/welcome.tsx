import { AntDesign, Ionicons } from "@expo/vector-icons";

import AsyncStorage from "@react-native-async-storage/async-storage";

import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Animated,
  ImageBackground,
  Keyboard,
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

    // ✅ Now create user
    await setDoc(userRef, {
      uid,
      name,
      email,
      referredBy,
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

export default function Welcome() {
  const router = useRouter();

  const slideAnim = useState(new Animated.Value(400))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];
const [accepted, setAccepted] = useState(false);


  // 👤 form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(""); // <-- fixed duplicate
  const [phonePassword, setPhonePassword] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // 🔐 Google login
  // 🔐 Google login (clean, correct, single setup)
// Your client IDs
// 🔐 GOOGLE LOGIN SETUP


const [request, response, promptAsync] = Google.useAuthRequest({
  androidClientId:
    "895363795197-g1dkogsl8uu0k5en3ks24uitcs5khfnn.apps.googleusercontent.com",

  webClientId:
    "895363795197-qmuod36rndhkmef0kb0kv3qhjcjn4d2c.apps.googleusercontent.com",

  scopes: ["profile", "email"],
  responseType: "id_token",
});


  const [showSignupEmail, setShowSignupEmail] = useState(false);
  const [showSignupPhone, setShowSignupPhone] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
const [inviteRef, setInviteRef] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

useEffect(() => {
  AsyncStorage.getItem("inviteRef").then((ref) => {
    if (ref) setInviteRef(ref);
  });
}, []);
  // 🔁 Auto login if already authenticated
  useEffect(() => {
  const unsub = onAuthStateChanged(auth, async (user) => {
    const inviteRef = await AsyncStorage.getItem("inviteRef");

    if (user && !inviteRef) {
      await AsyncStorage.setItem("isLoggedIn", "true");
      router.replace("/tradinglayout");
    }
  });

  return unsub;
}, [router]);


  // 🎯 Google login handler
useEffect(() => {
  if (!response) return;

  const run = async () => {
    if (response.type === "success" && response.authentication?.idToken) {
      try {
        setLoading(true);

        const credential = GoogleAuthProvider.credential(
          response.authentication.idToken
        );

        const userCred = await signInWithCredential(auth, credential);

        await createUserAccounts(
          userCred.user.uid,
          userCred.user.displayName || "Google User",
          userCred.user.email || ""
        );

        await AsyncStorage.setItem("isLoggedIn", "true");
        router.replace("/tradinglayout");

      } catch (e) {
        alert((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
  };

  run();
}, [response, router]);


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
      await createUserAccounts(userCred.user.uid, name, email);
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
  try {
    setLoading(true);

    // 1. Sign in
    const res = await signInWithEmailAndPassword(auth, email, password);
    const uid = res.user.uid;

    // 2. Save login state
    await AsyncStorage.setItem("isLoggedIn", "true");

    // 3. Get user profile document
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    // 4. If no profile exists → force Profile Setup
    if (!snap.exists()) {
      router.replace("/tradinglayout");
      return;
    }

    const data = snap.data();

    // 5. If profile not completed → go to ProfileSetup
    if (!data.profileCompleted) {
      router.replace("/tradinglayout");
      return;
    }

    // 6. Otherwise user is verified → go to main trading page
    router.replace("/tradinglayout");

  } catch (e) {
    alert((e as Error).message);
  } finally {
    setLoading(false);
  }
};

  // 📱 Phone Signup
  const handleSignupPhone = async () => {
    if (phone.length < 8) return alert("Enter valid phone number");

    const fullNumber = "+237" + phone;

    try {
      setLoading(true);
      const uid = fullNumber;
      await createUserAccounts(uid, name, `${uid}@phoneuser.fx`);
      await AsyncStorage.setItem("isLoggedIn", "true");
      router.replace("/tradinglayout");

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

              {/* PHONE SIGNUP */}
              {showSignupPhone && (
                <>
                  <Text style={styles.subtitle}>Sign Up with Phone</Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#aaa"
                    value={name}
                    onChangeText={setName}
                  />

                  <TextInput
                    style={styles.input}
                    placeholder="country code + Phone number"
                    placeholderTextColor="#ddd"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    />

                  <TextInput
                    style={styles.input}
                    placeholder="Enter 5-digit Password"
                    placeholderTextColor="#aaa"
                    secureTextEntry={!showPassword}
                    value={phonePassword}
                    onChangeText={setPhonePassword}
                  />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                       <Ionicons
              name={showPassword ? "eye-off" : "eye"}
                  size={22}  color="#fff"
                    style={{ paddingHorizontal: 6 }}
                         />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.button} onPress={handleSignupPhone}>
                    <Text style={styles.buttonText}>Submit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.link} onPress={closeForm}>
                    <Text style={styles.linkText}>Back</Text>
                  </TouchableOpacity>
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
