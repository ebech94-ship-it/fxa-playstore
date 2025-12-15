import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { deleteUser, getAuth } from "firebase/auth";




import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useEffect, useState } from "react";


import DateTimePicker from '@react-native-community/datetimepicker';
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
import { db, storage } from "../firebaseConfig";





// ⬇️ DEFINE THE TYPE HERE (very important)
type ProfileErrors = {
  displayName?: string;
  username?: string;
  email?: string;
  phone?: string;
  country?: string;
  dateOfBirth?: string;
  loginCode?: string;
  confirmLegal?: string;
};
export default function Profile() {
  const auth = getAuth();
  const user = auth.currentUser;

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
// State

const [showDatePicker, setShowDatePicker] = useState(false);
const [avatarUploading, setAvatarUploading] = useState(false);
const [submitted, setSubmitted] = useState(false);

const [supportName, setSupportName] = useState("");
const [supportEmail, setSupportEmail] = useState("");
const [supportMessage, setSupportMessage] = useState("");
const router = useRouter();
const [confirmLegal, setConfirmLegal] = useState(false);

const [errors, setErrors] = useState<ProfileErrors>({});

type UserProfile = {
  avatarUrl: string;
email: string;
  displayName?: string;
  username?: string;
  phone?: string;
  country?: string;
  dateOfBirth?: string;
  loginCode?: string;
  profileVerified?: boolean;
  // Add any extra fields you use
  [key: string]: any;
};


  // Profile data
 const [profile, setProfile] = useState<UserProfile>({
  displayName: "",
  username: "",
  email: "",
  phone: "",
  country: "",
  dateOfBirth: "",
  loginCode: "",
  avatarUrl: "",
  });

  const [saving, setSaving] = useState(false);
  
  // Load user profile from Firestore
useEffect(() => {
  if (!user) return;

  const userRef = doc(db, "users", user.uid);

  const unsubscribe = onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();

      // Update entire profile (including avatar)
      setProfile((prev) => ({ ...prev, ...data }));
    }
  });

  return () => unsubscribe();
}, [user]); // ✅ ESLint happy, no unused vars



// ---------- Date Picker Handler ----------
const handleDateChange = (event: any, selectedDate?: Date) => {
  setShowDatePicker(false);
  if (selectedDate) {
    const formatted = `${selectedDate.getDate().toString().padStart(2,'0')}-${(selectedDate.getMonth()+1).toString().padStart(2,'0')}-${selectedDate.getFullYear()}`;
    setProfile((p) => ({ ...p, dateOfBirth: formatted }));
  }
};

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

    // Preview locally
    setProfile((p) => ({ ...p, avatarUrl: uri }));

    // Upload with loader
    setAvatarUploading(true);
    const uploadedUrl = await uploadAvatarAsync(uri, user!.uid);
    setProfile((p) => ({ ...p, avatarUrl: uploadedUrl }));
  } catch (err) {
    console.error(err);
    Alert.alert("Error", "Could not upload avatar.");
  } finally {
    setAvatarUploading(false);
  }
};

const validateProfile = () => {
  const newErrors: ProfileErrors = {};

  if (!profile.displayName) newErrors.displayName = "Full Name is required";
  if (!profile.username) newErrors.username = "Username is required";
  if (!profile.phone) newErrors.phone = "Phone number is required";
  if (!profile.country) newErrors.country = "Country is required";
  if (!profile.dateOfBirth) newErrors.dateOfBirth = "Date of Birth is required";
  if (!confirmLegal) newErrors.confirmLegal = "You must confirm the legal statement";

  setErrors(newErrors);

  return Object.keys(newErrors).length === 0;
};

const uploadAvatarAsync = async (localUri: string, userId: string) => {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const fileRef = ref(storage, `avatars/${userId}_${Date.now()}.jpg`);
  await uploadBytes(fileRef, blob);
  return await getDownloadURL(fileRef);
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
    let avatarUrl = profile.avatarUrl;

    // Only upload if it's a local file
    if (avatarUrl && avatarUrl.startsWith("file://")) {
      avatarUrl = await uploadAvatarAsync(avatarUrl, user.uid);
    }

    const userRef = doc(db, "users", user.uid);

    await updateDoc(userRef, {
      ...profile,
      avatarUrl, // save remote URL in Firestore
      updatedAt: serverTimestamp(),
      profileVerified: true,
    });

    // Update local state with remote URL
    setProfile((p) => ({ ...p, avatarUrl }));

    Alert.alert("Success", "Profile updated successfully!");
    setActiveSection(null);
  } catch (err) {
    console.error("Save error:", err);
    Alert.alert("Error", "Could not save profile.");
  } finally {
    setSaving(false);
  }
};


  
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
  if (!supportName || !supportEmail || !supportMessage) {
    Alert.alert("Incomplete", "Please fill in all fields before sending.");
    return;
  }

  try {
    await addDoc(collection(db, "supportMessages"), {
      name: supportName,
      email: supportEmail,
      message: supportMessage,
      timestamp: serverTimestamp(),
    });

    Alert.alert("Sent!", "Your message has been delivered successfully.");
    setSupportName("");
    setSupportEmail("");
    setSupportMessage("");
  } catch (error) {
    console.error("Error sending message:", error);
    Alert.alert("Error", "Failed to send message. Please try again.");
  }
};

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
  ) : profile.avatarUrl ? (
    <Image
      source={{ uri: profile.avatarUrl }}
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
           <TextInput
  style={styles.input}
  placeholder="Full Name"
  placeholderTextColor="#ccc"
  value={profile.displayName}
  onChangeText={(t) =>
    setProfile((p: any) => ({ ...p, displayName: t }))
  }
/>
{submitted && errors.displayName && (
  <Text style={styles.errorText}>{errors.displayName}</Text>
)}
            <TextInput
  style={styles.input}
  placeholder="Username"
  placeholderTextColor="#ccc"
  value={profile.username}
  onChangeText={(t) =>
    setProfile((p: any) => ({ ...p, username: t }))
  }
/>
{submitted && errors.username && (
  <Text style={styles.errorText}>{errors.username}</Text>
)}
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#ccc"  
                onChangeText={(text) => setProfile((p) => ({ ...p, email: text }))}
              value={profile.email}
            />
          <TextInput
  style={styles.input}
  placeholder="Phone"
  placeholderTextColor="#ccc"
  value={profile.phone}
  onChangeText={(t) =>
    setProfile((p: any) => ({ ...p, phone: t }))
  }
/>

{submitted && errors.phone && (
  <Text style={styles.errorText}>{errors.phone}</Text>
)}


            <TextInput
  style={styles.input}
  placeholder="Country"
  placeholderTextColor="#ccc"
  value={profile.country}
  onChangeText={(t) =>
    setProfile((p: any) => ({ ...p, country: t }))
  }
/>

{submitted && errors.country && (
  <Text style={styles.errorText}>{errors.country}</Text>
)}


    <TouchableOpacity
  onPress={() => setShowDatePicker(true)}
  style={styles.input}
  accessible
  accessibilityLabel="Select Date of Birth"
  accessibilityHint="Opens date picker to select your birth date"
>
  <Text style={{ color: profile.dateOfBirth ? 'white' : '#ccc' }}>
    {profile.dateOfBirth || "Date of Birth (DD-MM-YYYY)"}
  </Text>
</TouchableOpacity>

{submitted && errors.dateOfBirth && (
  <Text style={styles.errorText}>{errors.dateOfBirth}</Text>
)}

{showDatePicker && (
  <DateTimePicker
    value={
      profile.dateOfBirth
        ? new Date(profile.dateOfBirth.split('-').reverse().join('-'))
        : new Date()
    }
    mode="date"
    display="default"
    onChange={handleDateChange}
    maximumDate={new Date()}
  />
)}

<TextInput
  style={styles.input}
  placeholder="Login Code"
  placeholderTextColor="#ccc"
  secureTextEntry
  value={profile.loginCode}
  onChangeText={(t) =>
    setProfile((p: any) => ({ ...p, loginCode: t }))
  }
/>

{submitted && errors.loginCode && (
  <Text style={styles.errorText}>{errors.loginCode}</Text>
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
    {confirmLegal && <Text style={{ color: "#16213e", fontWeight: "bold" }}>✓</Text>}
  </TouchableOpacity>

  <Text style={{ color: "white", flex: 1 }}>
    I confirm that all information provided is accurate, legal, and true.
  </Text>
</View>

{errors.confirmLegal && (
  <Text style={{ color: "red", marginTop: 4 }}>{errors.confirmLegal}</Text>
)}

           <TouchableOpacity
  onPress={saveProfile}
  disabled={!confirmLegal || saving} 
  style={[
    styles.sendButton,
    {
      backgroundColor: !confirmLegal
        ? "#084b92ff" // disabled color
        : "#21e6c1", // active color
      opacity: !confirmLegal ? 0.5 : 1, // fade when disabled
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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Balance</Text>
            <Text style={styles.balance}>$ 0.00</Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setActiveSection(null)}
            >
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Support Section */}
       {activeSection === "support" && (
  <ScrollView style={styles.section}>
    <Text style={styles.sectionTitle}>Support</Text>

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

    <TouchableOpacity style={styles.sendButton} onPress={handleSupportSend}>
      <Text style={styles.sendText}>Send</Text>
    </TouchableOpacity>

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
  <ScrollView style={styles.section} contentContainerStyle={{ paddingBottom: 80 }}>
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

    {/* Delete Account */}
    <TouchableOpacity
  style={styles.deleteButton}
  onPress={() => setShowDeleteModal(true)}
>
  <Text style={styles.deleteText}>Delete Account</Text>
</TouchableOpacity>


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
  modalContainer: {
    flex: 1,
    backgroundColor: "#16213e",
    padding: 20,
  },
  header: {
    marginBottom: 15,
  },
  headerText: { fontSize: 22, fontWeight: "bold", color: "white" },
  menuList: { marginTop: 10 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#0f3460",
    marginBottom: 8,
    borderRadius: 10,
  },
  menuText: { marginLeft: 10, color: "white", fontSize: 16 },
  logoutButton: {
    marginTop: 20,
    backgroundColor: "crimson",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  logoutText: { color: "white", fontWeight: "bold" },
  section: { flex: 1, padding: 15 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#e94560",
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    color: "white",
    backgroundColor: "#0f3460",
  },
  balance: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#21e6c1",
    marginVertical: 20,
  },
  sendButton: {
    backgroundColor: "#21e6c1",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 15,
  },
  sendText: { color: "#16213e", fontWeight: "bold" },
  backButton: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#e94560",
    alignItems: "center",
  },
  backText: { color: "white", fontWeight: "bold" },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 10,
  },
  settingText: { color: "white", fontSize: 16 },
  deleteButton: {
  backgroundColor: "#ff3b30",
  padding: 12,
  borderRadius: 10,
  marginTop: 20,
},
deleteText: {
  color: "white",
  textAlign: "center",
  fontWeight: "bold",
},
errorText: {
  color: "red",
  fontSize: 12,
  marginBottom: 8,
  marginLeft: 4,
},

});
