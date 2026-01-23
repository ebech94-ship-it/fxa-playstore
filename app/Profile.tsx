import { Ionicons } from "@expo/vector-icons";

import { useApp } from "@/app/AppContext";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { deleteUser, getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../firebaseConfig";

/* ---------------- TYPES ---------------- */
type ProfileErrors = {
  displayName?: string;
  username?: string;
  email?: string;
  phone?: string;
  country?: string;
  dateOfBirth?: string;
 
  confirmLegal?: string;
};
type ProfileForm = {
  displayName: string;
  username: string;
  email: string;
  phone: string;
  country: string;
  dateOfBirth: string;

  avatarUrl: string;
  useHeikinAshi: boolean;
  compressWicks: boolean;
};

type ProfileProps = {
  useHeikinAshi: boolean;
  setUseHeikinAshi: (v: boolean) => void;
  compressWicks: boolean;
  setCompressWicks: (v: boolean) => void;
};

/* ---------------- COMPONENT ---------------- */
export default function ProfileScreen({
  useHeikinAshi,
  setUseHeikinAshi,
  compressWicks,
  setCompressWicks,
}: ProfileProps) {
  const auth = getAuth();
  const user = auth.currentUser;
  const router = useRouter();

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmLegal, setConfirmLegal] = useState(false);
  const [errors, setErrors] = useState<ProfileErrors>({});

  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
const [sendingSupport, setSendingSupport] = useState(false);

const [userThread, setUserThread] = useState<any | null>(null);
const [messages, setMessages] = useState<any[]>([]);


const [deposits, setDeposits] = useState<any[]>([]);
const [withdrawals, setWithdrawals] = useState<any[]>([]);

const [profileLocked, setProfileLocked] = useState(false);


  const [form, setForm] = useState<ProfileForm>({

    displayName: "",
    username: "",
    email: "",
    phone: "",
    country: "",
    dateOfBirth: "",
    
    avatarUrl: "",
    useHeikinAshi,
    compressWicks,
  });

  const [saving, setSaving] = useState(false);


const { profile: appProfile,  setProfile, setProfileSubmitted, profile, profileLoaded, balances } = useApp();


useEffect(() => {
  if (!appProfile || submitted) return;

  setForm((p) => ({
    ...p,
    displayName: appProfile.displayName ?? "",
    username: appProfile.username ?? "",
    
    phone: appProfile.phone ?? "",
    country: appProfile.country ?? "",
    dateOfBirth: appProfile.dateOfBirth ?? "",
    avatarUrl: appProfile.avatarUrl ?? "",
  }));
}, [appProfile, submitted]);



useEffect(() => {
  if (!user) return;

  const q = query(
    collection(db, "supportThreads"),
    where("userId", "==", user.uid)
  );

  const unsub = onSnapshot(q, (snap) => {
    if (!snap.empty) {
      const doc = snap.docs[0];
      setUserThread({ id: doc.id, ...doc.data() });
    }
  });

  return () => unsub();
}, [user]);


useEffect(() => {
  if (!user) return;

  const q = query(
    collection(db, "users", user.uid, "deposits"),
    orderBy("createdAt", "desc")
  );

  const unsub = onSnapshot(q, (snap) => {
    const list: any[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    setDeposits(list);
  });

  return () => unsub();
}, [user]);

useEffect(() => {
  if (!user) return;

  const q = query(
    collection(db, "users", user.uid, "withdrawals"),
    orderBy("createdAt", "desc")
  );

  const unsub = onSnapshot(q, (snap) => {
    const list: any[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    setWithdrawals(list);
  });

  return () => unsub();
}, [user]);



useEffect(() => {
  if (!userThread) return;

  const q = query(
    collection(db, "supportThreads", userThread.id, "messages"),
    orderBy("createdAt", "asc")
  );

  const unsub = onSnapshot(q, (snap) => {
    const list: any[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    setMessages(list);
  });

  return () => unsub();
}, [userThread]);

// ---------- Updated Avatar Picker ----------
const pickAvatar = async () => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    const uri = result.assets[0].uri;

    // ✅ Instant local preview
    setForm((p) => ({ ...p, avatarUrl: uri }));

    setAvatarUploading(true);

    // 🔥 Upload to Cloudinary
    const uploadedUrl = await uploadAvatarToCloudinary(uri);

    // ✅ Replace preview with real URL
    setForm((p) => ({ ...p, avatarUrl: uploadedUrl }));
  } catch (error) {
    console.error(error);
    Alert.alert("Upload failed", "Could not upload avatar");
  } finally {
    setAvatarUploading(false);
  }
};



const validateProfile = () => {
  const newErrors: ProfileErrors = {};

  if (!form.displayName)
    newErrors.displayName = "Full Name is required";

  if (!form.username)
    newErrors.username = "Username is required";

  if (!form.phone)
    newErrors.phone = "Phone number is required";

  if (!form.country)
    newErrors.country = "Country is required";

  if (!form.dateOfBirth) {
    newErrors.dateOfBirth = "Date of Birth is required";
  } else if (!/^\d{2}-\d{2}-\d{4}$/.test(form.dateOfBirth)) {
    newErrors.dateOfBirth = "Use format DD-MM-YYYY";
  }

  if (!confirmLegal)
    newErrors.confirmLegal = "You must confirm the legal statement";

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};


const uploadAvatarToCloudinary = async (uri: string) => {
  const data = new FormData();

  data.append("file", {
    uri,
    type: "image/jpeg",
    name: "avatar.jpg",
  } as any);

  data.append("upload_preset", "avatar_upload");

  const res = await fetch(
    "https://api.cloudinary.com/v1_1/devp5mty0/image/upload",
    {
      method: "POST",
      body: data,
    }
  );

  const json = await res.json();

  if (!json.secure_url) {
    console.log("Cloudinary error:", json);
    throw new Error("Cloudinary upload failed");
  }

  return json.secure_url;
};

// Save profile
const saveProfile = async () => {
  if (!user) return;

  setSubmitted(true);
  setErrors({});
  if (!validateProfile()) {
    Alert.alert("Form Incomplete", "Please correct the highlighted fields.");
    return;
  }

  setSaving(true);
  try {
    let avatarUrl = form.avatarUrl;
    

    const payload = {
  
  displayName: form.displayName,
  username: form.username,
  phone: form.phone,
  country: form.country,
  dateOfBirth: form.dateOfBirth,
  avatarUrl,
  profileCompleted: true,
  verified: true, // ✅ AUTO VERIFIED (SERVER TRUTH)
};


    await updateDoc(doc(db, "users", user.uid), payload);

// 🔥 UPDATE APP CONTEXT IMMEDIATELY
setProfile((prev) => ({
  ...(prev ?? {}),
  displayName: form.displayName,
  username: form.username,
 
  phone: form.phone,
  country: form.country,
  dateOfBirth: form.dateOfBirth,
  avatarUrl: avatarUrl,
   verified: true,
  profileCompleted: true,
}));


Alert.alert("Success", "Profile updated successfully!");

    setActiveSection(null);

    setProfileLocked(true);
    setProfileSubmitted(true);


// optional: small delay to feel "settled"



} catch (err) {
  console.error("Save error:", err);

  let message = "Network or server error. Please try again.";

  if (err instanceof Error) {
    if (err.message.includes("permission")) {
      message = "You do not have permission to update this profile.";
    }
  }

  Alert.alert("Save Failed", message);

  } finally {
    setSaving(false);
  }
};
useEffect(() => {
  if (profile?.profileCompleted === true) {
    setProfileLocked(true);
  }
}, [profile?.profileCompleted]);

  
// Toggle Dark Mode
const toggleDarkMode = () => {
  setDarkMode(!darkMode);
};
// Delete Account
const handleDeleteAccount = async () => {
  Alert.alert(
    "Delete Account?",
    "This action is permanent. All your data will be erased.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const user = auth.currentUser;

            if (!user) return;

            // Delete Firestore user data
            await deleteDoc(doc(db, "users", user.uid));

            // Delete account
            await deleteUser(user);

            router.replace("/splash");
          } catch (err) {
            console.log("Delete account error:", err);
          }
        },
      },
    ]
  );
};
  // Add below your existing hooks, before return()
const handleLogout = async () => {
  try {
    const auth = getAuth();
    await auth.signOut();

    Alert.alert("Logged Out", "You have been signed out successfully.");

    // Redirect to Welcome screen
    router.replace("./Welcome"); // or "/Login" depending on your file name
  } catch (err) {
    console.error("Logout error:", err);
    Alert.alert("Error", "Failed to log out.");
  }
};


// handleSupportSend
const handleSupportSend = async () => {
  if (!supportMessage) {
    Alert.alert("Incomplete", "Please enter a message.");
    return;
  }

  if (!user) {
    Alert.alert("Error", "You must be logged in.");
    return;
  }

  setSendingSupport(true);

  try {
    let threadId = userThread?.id;

    // 🟡 CREATE THREAD ONLY ONCE
    if (!threadId) {
      const threadRef = await addDoc(collection(db, "supportThreads"), {
        userId: user.uid,
        userName: supportName,
        userEmail: supportEmail,
        status: "open",
        lastMessage: supportMessage,
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
      });

      threadId = threadRef.id;
    } else {
      // 🔁 UPDATE THREAD META
      await updateDoc(doc(db, "supportThreads", threadId), {
        lastMessage: supportMessage,
        lastMessageAt: serverTimestamp(),
        status: "open",
      });
    }

    // 📨 ADD MESSAGE
    await addDoc(
      collection(db, "supportThreads", threadId, "messages"),
      {
        sender: "user",
        text: supportMessage,
        createdAt: serverTimestamp(),
        read: false,
      }
    );

    setSupportMessage("");
  } catch (error: any) {
    console.error("Support send error:", error);
    Alert.alert("Error", "Failed to send message.");
  } finally {
    setSendingSupport(false);
  }
};
useEffect(() => {
  if (user && !supportEmail) {
    setSupportEmail(user.email || "");
  }
}, [user, supportEmail]);
const getStatusStyle = (status: string) => ({
  color: status === "completed" ? "#21e6c1" : "#e94560",
  fontWeight: "bold" as const,
  fontSize: 13,
});
if (!profileLoaded) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#16213e",
      }}
    >
      <ActivityIndicator size="large" color="#21e6c1" />
    </View>
  );
}

  return (
    <View style={styles.modalContainer}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>User Menu</Text>
        </View>
 {/* ---------- Avatar & Date Picker Section ---------- */}
<View style={{ alignItems: 'center', marginBottom: 16 }}>
  {avatarUploading ? (
    <View
      style={{
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#0f3460',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <ActivityIndicator size="large" color="#21e6c1" />
    </View>
  ) : form.avatarUrl ? (
    <Image
      source={{ uri: form.avatarUrl }}
      style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 8 }}
      accessible
      accessibilityLabel="User avatar"
    />
  ) : (
    <View
      style={{
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#0f3460",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
      }}
      accessible
      accessibilityLabel="Default avatar placeholder"
    >
      <Ionicons name="person" size={40} color="white" />
    </View>
  )}

  <TouchableOpacity
    onPress={pickAvatar}
    accessible
    accessibilityLabel="Change Avatar"
    accessibilityHint="Opens gallery to select a new profile picture"
  >
    <Text style={{ color: "#21e6c1" }}>Change Avatar</Text>
  </TouchableOpacity>
</View>

        {/* Menu Options */}
        {!activeSection && (
          <View style={styles.menuList}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setActiveSection("profile")}
            >
              <Ionicons name="person-outline" size={20} color="white" />
              <Text style={styles.menuText}>Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setActiveSection("balance")}
            >
              <Ionicons name="wallet-outline" size={20} color="white" />
              <Text style={styles.menuText}>Account Balance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setActiveSection("support")}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={20}
                color="white"
              />
              <Text style={styles.menuText}>Support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setActiveSection("settings")}
            >
              <Ionicons name="settings-outline" size={20} color="white" />
              <Text style={styles.menuText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
      <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>

          </View>
        )}

        {/* Profile Section */}
        {activeSection === "profile" && (
          <ScrollView style={styles.section}>
            <Text style={styles.sectionTitle}>Profile</Text>
            {user?.uid && (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ color: "#aaa", fontSize: 12 }}>
       FX Arena ID
    </Text>
    <Text
      style={{
        color: "#21e6c1",
        fontSize: 16,
        fontWeight: "bold",
      }}
    >
       {profile?.publicId ?? "Not assigned"}

    </Text>
  </View>
)}
         <TextInput
  style={[
    styles.input,
    profileLocked && { opacity: 0.6 },
  ]}
  editable={!profileLocked}
  placeholder="Full Name"
  placeholderTextColor="#ccc"
  value={form.displayName}
  onChangeText={(t) =>
    setForm((p: ProfileForm) => ({ ...p, displayName: t }))
  }
/>
{submitted && errors.displayName && (
  <Text style={styles.errorText}>{errors.displayName}</Text>
)}

<TextInput
  style={styles.input}
  placeholder="Username"
  placeholderTextColor="#ccc"
  value={form.username}
  onChangeText={(t) =>
    setForm((p: any) => ({ ...p, username: t }))
  }
/>
{submitted && errors.username && (
  <Text style={styles.errorText}>{errors.username}</Text>
)}

<TextInput
  style={[styles.input, { opacity: 0.6 }]}
  editable={false}
  placeholder="Email"
  placeholderTextColor="#ccc"
  value={user?.email ?? ""}
 />


<TextInput
  style={styles.input}
  placeholder="Phone"
  placeholderTextColor="#ccc"
  value={form.phone}
  onChangeText={(t) =>
    setForm((p: any) => ({ ...p, phone: t }))
  }
/>
{submitted && errors.phone && (
  <Text style={styles.errorText}>{errors.phone}</Text>
)}

<TextInput
  style={[
    styles.input,
    profileLocked && { opacity: 0.6 },
  ]}
  editable={!profileLocked}
  placeholder="Country"
  placeholderTextColor="#ccc"
  value={form.country}
  onChangeText={(t) =>
    setForm((p: any) => ({ ...p, country: t }))
  }
/>
{submitted && errors.country && (
  <Text style={styles.errorText}>{errors.country}</Text>
)}

<TextInput
  style={[
    styles.input,
    profileLocked && { opacity: 0.6 },
  ]}
  editable={!profileLocked}
  placeholder="Date of Birth (DD-MM-YYYY)"
  placeholderTextColor="#ccc"
  keyboardType="numeric"
  value={form.dateOfBirth}
  onChangeText={(text) => {
    const cleaned = text.replace(/[^0-9-]/g, "");
    setForm((p: ProfileForm) => ({ ...p, dateOfBirth: cleaned }));
  }}
/>

<Text style={{ color: "#aaa", fontSize: 12, marginBottom: 6 }}>
  Format: DD-MM-YYYY (e.g. 25-08-2001)
</Text>

{submitted && errors.dateOfBirth && (
  <Text style={styles.errorText}>{errors.dateOfBirth}</Text>
)}

<View style={{ flexDirection: "row", alignItems: "center", marginTop: 20 }}>
  <TouchableOpacity
    onPress={() => setConfirmLegal(!confirmLegal)}
    style={{
      width: 22,
      height: 22,
      borderWidth: 2,
      borderColor: "#21e6c1",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
      backgroundColor: confirmLegal ? "#21e6c1" : "transparent",
    }}
  >
    {confirmLegal && (
      <Text style={{ color: "#16213e", fontWeight: "bold" }}>✓</Text>
    )}
  </TouchableOpacity>

  <Text style={{ color: "white", flex: 1 }}>
    I confirm that all information provided is accurate, legal, and true.
  </Text>
</View>

{errors.confirmLegal && (
  <Text style={{ color: "red", marginTop: 4 }}>
    {errors.confirmLegal}
  </Text>
)}

<TouchableOpacity
  onPress={saveProfile}
  disabled={!confirmLegal || saving}
  style={[
    styles.sendButton,
    {
      backgroundColor: !confirmLegal ? "#084b92ff" : "#21e6c1",
      opacity: !confirmLegal ? 0.5 : 1,
    },
  ]}
>
  {saving ? (
    <ActivityIndicator color="#16213e" />
  ) : (
    <Text style={styles.sendText}>Save Profile</Text>
  )}
</TouchableOpacity>

<TouchableOpacity
  style={styles.backButton}
  onPress={() => setActiveSection(null)}
>
  <Text style={styles.backText}>Back</Text>
</TouchableOpacity>

          </ScrollView>
        )}

        {/* Balance Section */}
        {activeSection === "balance" && (
  <ScrollView style={styles.section}>
    <Text style={styles.sectionTitle}>Account Balance</Text>

    <Text style={styles.balance}>
  XAF {(balances?.real ?? 0).toLocaleString()}
</Text>

    {/* -------- DEPOSITS -------- */}
    <Text style={styles.subTitle}>Deposit History</Text>

    {deposits.length === 0 && (
      <Text style={styles.muted}>No deposits yet</Text>
    )}

    {deposits.map((d) => (
      <View key={d.id} style={styles.historyRow}>
        <Text style={styles.historyText}>
          +${d.amount} • {d.method}
        </Text>
       <Text style={getStatusStyle(d.status)}>

          {d.status}
        </Text>
      </View>
    ))}

    {/* -------- WITHDRAWALS -------- */}
    <Text style={styles.subTitle}>Withdrawal History</Text>

    {withdrawals.length === 0 && (
      <Text style={styles.muted}>No withdrawals yet</Text>
    )}

    {withdrawals.map((w) => (
      <View key={w.id} style={styles.historyRow}>
        <Text style={styles.historyText}>
          -${w.amount} • {w.method}
        </Text>
        <Text style={getStatusStyle(w.status)}>
          {w.status}
        </Text>
      </View>
    ))}

    <TouchableOpacity
      style={styles.backButton}
      onPress={() => setActiveSection(null)}
    >
      <Text style={styles.backText}>Back</Text>
    </TouchableOpacity>
  </ScrollView>
)}


        {/* Support Section */}
{activeSection === "support" && (
  <ScrollView style={styles.section}>
    <Text style={styles.sectionTitle}>Support</Text>

    {/* 🟢 CHAT MODE (thread exists) */}
    {userThread ? (
      <>
        {/* Messages */}
        {messages.map((m) => (
          <View
            key={m.id}
            style={{
              alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
              backgroundColor: m.sender === "user" ? "#21e6c1" : "#0f3460",
              padding: 10,
              borderRadius: 10,
              marginBottom: 8,
              maxWidth: "80%",
            }}
          >
            <Text
              style={{
                color: m.sender === "user" ? "#16213e" : "#fff",
              }}
            >
              {m.text}
            </Text>
          </View>
        ))}

        {/* Message input */}
        <TextInput
          style={[styles.input, { height: 80 }]}
          placeholder="Type your message..."
          placeholderTextColor="#ccc"
          value={supportMessage}
          onChangeText={setSupportMessage}
          multiline
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            { opacity: sendingSupport || !supportMessage ? 0.5 : 1 },
          ]}
          onPress={handleSupportSend}
          disabled={sendingSupport}
        >
          {sendingSupport ? (
            <ActivityIndicator color="#16213e" />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </TouchableOpacity>
      </>
    ) : (
      /* 🟡 FIRST MESSAGE MODE */
      <>
        <TextInput
          style={styles.input}
          placeholder="Your Name"
          placeholderTextColor="#ccc"
          value={supportName}
          onChangeText={setSupportName}
        />

        <TextInput
          style={styles.input}
          placeholder="Your Email"
          placeholderTextColor="#ccc"
          value={supportEmail}
          onChangeText={setSupportEmail}
        />

        <TextInput
          style={[styles.input, { height: 100 }]}
          placeholder="Message"
          placeholderTextColor="#ccc"
          value={supportMessage}
          onChangeText={setSupportMessage}
          multiline
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              opacity:
                sendingSupport ||
                !supportName ||
                !supportEmail ||
                !supportMessage
                  ? 0.5
                  : 1,
            },
          ]}
          onPress={handleSupportSend}
          disabled={sendingSupport}
        >
          {sendingSupport ? (
            <ActivityIndicator color="#16213e" />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </TouchableOpacity>
      </>
    )}

    {/* Back */}
    <TouchableOpacity
      style={styles.backButton}
      onPress={() => setActiveSection(null)}
    >
      <Text style={styles.backText}>Back</Text>
    </TouchableOpacity>
  </ScrollView>
)}


{/*  DELETE ACCOUNT MODAL */}
{showDeleteModal && (
  <View
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
      zIndex: 9999,
    }}
    pointerEvents="auto" // This blocks touches behind
  >
    <View
      style={{
        backgroundColor: "white",
        borderRadius: 16,
        width: "100%",
        overflow: "hidden",
      }}
      pointerEvents="box-none"
    >
      {/* RED HEADER */}
      <View
        style={{
          backgroundColor: "red",
          paddingVertical: 15,
          paddingHorizontal: 20,
        }}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: "white",
            textAlign: "center",
          }}
        >
          Delete Account?
        </Text>
      </View>

      {/* BODY TEXT */}
      <Text
        style={{
          fontSize: 15,
          opacity: 0.8,
          paddingHorizontal: 20,
          paddingTop: 15,
          paddingBottom: 5,
          textAlign: "center",
        }}
      >
        This action is permanent. Your profile, account data, and activity will
        be permanently removed and cannot be recovered.
      </Text>

      {/* BUTTONS */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingVertical: 20,
        }}
      >
        {/* CANCEL */}
        <TouchableOpacity
          onPress={() => setShowDeleteModal(false)}
          style={{
            padding: 12,
            backgroundColor: "#ccc",
            borderRadius: 10,
            width: "45%",
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "600" }}>Cancel</Text>
        </TouchableOpacity>

        {/* DELETE */}
        <TouchableOpacity
          onPress={handleDeleteAccount}

          style={{
            padding: 12,
            backgroundColor: "red",
            borderRadius: 10,
            width: "45%",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
)}


       {/* Settings Section */}
{activeSection === "settings" && (
  <ScrollView
    style={styles.section}
    contentContainerStyle={{ paddingBottom: 80 }}
  >
    <Text style={styles.sectionTitle}>Settings</Text>

    {/* Dark Mode */}
    <View style={styles.settingRow}>
      <Text style={styles.settingText}>Dark Mode</Text>
      <Switch value={darkMode} onValueChange={toggleDarkMode} />
    </View>

    {/* Sound Effects */}
    <View style={styles.settingRow}>
      <Text style={styles.settingText}>Sound Effects</Text>
      <Switch value={soundEnabled} onValueChange={setSoundEnabled} />
    </View>

    {/* 🔥 CHART SETTINGS (NEW) */}
    <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
      Chart Settings
    </Text>

    {/* Heikin-Ashi Toggle */}
    <View style={styles.settingRow}>
      <Text style={styles.settingText}>Heikin-Ashi Candles</Text>
      <Switch
        value={useHeikinAshi}
        onValueChange={setUseHeikinAshi}
      />
    </View>

    {/* Wick Compression Toggle */}
    <View style={styles.settingRow}>
      <Text style={styles.settingText}>Compact Wicks</Text>
      <Switch
        value={compressWicks}
        onValueChange={setCompressWicks}
      />
    </View>

    {/* Delete Account */}
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => setShowDeleteModal(true)}
    >
      <Text style={styles.deleteText}>Delete Account</Text>
    </TouchableOpacity>

    {/* Back */}
    <TouchableOpacity
      style={styles.backButton}
      onPress={() => setActiveSection(null)}
    >
      <Text style={styles.backText}>Back</Text>
    </TouchableOpacity>
  </ScrollView>
)}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1,   backgroundColor: "#16213e", padding: 20,  },
  header: {  marginBottom: 15,  },
  headerText: { fontSize: 22, fontWeight: "bold", color: "white" },
  menuList: { marginTop: 10 },
  menuItem: { flexDirection: "row", alignItems: "center", padding: 15, backgroundColor: "#0f3460", marginBottom: 8,
   borderRadius: 10,  },
  menuText: { marginLeft: 10, color: "white", fontSize: 16 },
  logoutButton: {  marginTop: 20,  backgroundColor: "crimson",  padding: 15,  borderRadius: 10,  alignItems: "center", },
  logoutText: { color: "white", fontWeight: "bold" },
  section: { flex: 1, padding: 15 },
  sectionTitle: {  fontSize: 20, fontWeight: "bold", color: "#e94560", marginBottom: 15, },
  input: { borderWidth: 1, borderColor: "#444", borderRadius: 8, padding: 10, marginBottom: 10, color: "white", backgroundColor: "#0f3460",
  },
  balance: { fontSize: 28,  fontWeight: "bold", color: "#21e6c1", marginVertical: 20, },
  sendButton: {  backgroundColor: "#21e6c1", padding: 12,  borderRadius: 10,  alignItems: "center",  marginBottom: 15, },
  sendText: { color: "#16213e", fontWeight: "bold" },
  backButton: { marginTop: 10,  padding: 12,  borderRadius: 10, backgroundColor: "#e94560",  alignItems: "center", },
  backText: { color: "white", fontWeight: "bold" },
  settingRow: { flexDirection: "row",  justifyContent: "space-between",  alignItems: "center",  marginVertical: 10, },
  settingText: { color: "white", fontSize: 16 },
  deleteButton: { backgroundColor: "#ff3b30", padding: 12, borderRadius: 10, marginTop: 20,},
deleteText: { color: "white", textAlign: "center", fontWeight: "bold",},
errorText: { color: "red", fontSize: 12, marginBottom: 8, marginLeft: 4,},
subTitle: { color: "#21e6c1",  fontSize: 16, fontWeight: "bold", marginTop: 20, marginBottom: 8,},
historyRow: { backgroundColor: "#0f3460",  padding: 10,  borderRadius: 8, marginBottom: 6, flexDirection: "row",
  justifyContent: "space-between",},
historyText: { color: "white", fontSize: 14,},

muted: { color: "#aaa", fontStyle: "italic",},

});
