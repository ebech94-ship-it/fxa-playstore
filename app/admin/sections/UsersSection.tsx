// app/admin/sections/UsersSection.tsx
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { app } from "../../../firebaseConfig";

const db = getFirestore(app);
const BACKEND_URL = "https://forexapp2-backend.onrender.com";

interface AdminUser {
  id: string;
  email: string;
  balance: number;
  frozen: boolean;
   deleted?: boolean; 
  joinedTournaments?: any[];
  createdAt?: any;
}

const UsersSection = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [editBalance, setEditBalance] = useState("");
  const [balanceMode, setBalanceMode] = useState<"add" | "subtract">("add");
  const [loadingAction, setLoadingAction] = useState(false);

  // -------------------------------
  // GLOW ANIMATION HEADER
  // -------------------------------
  const glowAnim = useRef(new Animated.Value(0)).current;

  const startGlow = useCallback(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return loop;
  }, [glowAnim]);

  useEffect(() => {
    const loop = startGlow();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,150,255,0.35)", "rgba(255,0,150,0.4)"],
  });

  // -------------------------------
  // FETCH USERS REAL-TIME
  // -------------------------------
  useEffect(() => {
  const q = query(collection(db, "users"), orderBy("createdAt", "desc"));

  const unsub = onSnapshot(q, (snap) => {
    const list: AdminUser[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();

      // ✅ FILTER SOFT-DELETED USERS
      if (data.deleted) return;

      list.push({
        id: docSnap.id,
        email: data.email || "No email",
        balance: data.balance || 0,
        frozen: data.frozen || false,
        joinedTournaments: data.joinedTournaments || [],
        createdAt: data.createdAt,
        deleted: data.deleted,
      });
    });

    setUsers(list);
    setFilteredUsers(list);
  });

  return unsub;
}, []);


  // -------------------------------
  // SEARCH BAR
  // -------------------------------
  const handleSearch = (text: string) => {
    setSearch(text);
    if (!text.trim()) return setFilteredUsers(users);

    const f = users.filter((u) =>
      u.email.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredUsers(f);
  };

  // -------------------------------
  // OPEN USER MODAL
  // -------------------------------
  const openUser = (user: AdminUser) => {
    setSelected(user);
    setModalVisible(true);
    setEditBalance("");
  };

  // -------------------------------
  // FREEZE / UNFREEZE
  // -------------------------------
 const toggleFreeze = async () => {
  if (!selected) return;

  setLoadingAction(true);

  try {
    const res = await fetch(`${BACKEND_URL}/admin/toggle-freeze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selected.id,
        freeze: !selected.frozen,
      }),
    });

    if (!res.ok) throw new Error("Action failed");
  } catch (e: any) {
    Alert.alert("Error", e.message ||"Could not update user status");
  }

  setLoadingAction(false);
};


  // -------------------------------
  // UPDATE BALANCE (+ OR -)
  // -------------------------------
 const handleBalanceUpdate = async () => {
  if (!selected) return;

  if (selected.frozen)
    return Alert.alert("Blocked", "User is frozen");

  const amount = parseFloat(editBalance);
  if (isNaN(amount) || amount <= 0) return;

  setLoadingAction(true);

  try {
    const res = await fetch(`${BACKEND_URL}/admin/adjust-balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selected.id,
        amount,
        mode: balanceMode, // "add" | "subtract"
      }),
    });

    if (!res.ok) throw new Error("Server rejected request");

    Alert.alert("Success", "Balance updated");
    setModalVisible(false);
  } catch (e: any) {
    Alert.alert("Failed", e.message || "Error");
  }

  setLoadingAction(false);
  setEditBalance("");
};


  // -------------------------------
  // RESET PASSWORD (YOUR BACKEND)
  // -------------------------------
  const resetPassword = async () => {
    if (!selected) return;

    setLoadingAction(true);

    try {
      await fetch(`${BACKEND_URL}/admin/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: selected.email }),
      });
    } catch (e) {
      console.log("RESET ERR:", e);
    }

    setLoadingAction(false);
  };

  // -------------------------------
  // DELETE USER
  // -------------------------------
  const deleteUserAccount = async () => {
  if (!selected) return;

  if (selected.balance > 0)
    return Alert.alert("Blocked", "User still has funds");

  if (selected.joinedTournaments?.length)
    return Alert.alert("Blocked", "User is in tournaments");

  setLoadingAction(true);

  try {
    const res = await fetch(`${BACKEND_URL}/admin/delete-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selected.id }),
    });

    if (!res.ok) throw new Error("Delete failed");

    setModalVisible(false);
  } catch {
    Alert.alert("Error", "Could not delete user");
  }

  setLoadingAction(false);
};

  // -------------------------------
  // RENDER EACH USER
  // -------------------------------
  const renderUser = ({ item }: { item: AdminUser }) => (
    <TouchableOpacity style={styles.userCard} onPress={() => openUser(item)}>
      <Text style={styles.userEmail}>{item.email}</Text>
      <Text style={styles.userBalance}>${item.balance.toFixed(2)}</Text>
      <Text style={[styles.status, item.frozen ? styles.frozen : styles.active]}>
        {item.frozen ? "Frozen" : "Active"}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={20}
        color="#aaa"
        style={{ marginLeft: "auto" }}
      />
    </TouchableOpacity>
  );

  // -------------------------------
  // JSX RETURN
  // -------------------------------
  return (
    <View style={styles.container}>
      {/* HEADER WITH GLOW */}
      <Animated.View style={[styles.header, { backgroundColor: glowColor }]}>
        <Text style={styles.headerText}>User Administration</Text>
      </Animated.View>

      {/* SEARCH BAR */}
      <TextInput
        style={styles.search}
        placeholder="Search user by email..."
        placeholderTextColor="#888"
        value={search}
        onChangeText={handleSearch}
      />

      {/* USERS LIST */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={{ paddingBottom: 150 }}
      />

      {/* USER MODAL */}
      <Modal transparent visible={modalVisible} animationType="slide">
        <View style={styles.modalBackground}>
          <View style={styles.modalBox}>
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>{selected.email}</Text>

                {/* BALANCE EDIT */}
                <Text style={styles.sectionTitle}>Balance</Text>
                <View style={styles.row}>
                  <TouchableOpacity
                    style={[
                      styles.modeBtn,
                      balanceMode === "add" && styles.modeActive,
                    ]}
                    onPress={() => setBalanceMode("add")}
                  >
                    <Text style={styles.modeText}>Add</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modeBtn,
                      balanceMode === "subtract" && styles.modeActive,
                    ]}
                    onPress={() => setBalanceMode("subtract")}
                  >
                    <Text style={styles.modeText}>Subtract</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Amount"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                  value={editBalance}
                  onChangeText={setEditBalance}
                />

               <TouchableOpacity
  onPress={handleBalanceUpdate}
  disabled={loadingAction}
  style={[
    styles.actionBtn,
    loadingAction && { opacity: 0.6 },
  ]}
>
  <Text style={styles.btnText}>
    {loadingAction
      ? "Processing..."
      : balanceMode === "add"
      ? "Add Funds"
      : "Subtract Funds"}
  </Text>
</TouchableOpacity>


                {/* FREEZE */}
                <TouchableOpacity
  onPress={toggleFreeze}
  disabled={loadingAction}
  style={[
    styles.actionBtn,
    { backgroundColor: selected.frozen ? "#c62828" : "#0066cc" },
    loadingAction && { opacity: 0.6 },
  ]}
>
  <Text style={styles.btnText}>
    {loadingAction
      ? "Updating..."
      : selected.frozen
      ? "Unfreeze User"
      : "Freeze User"}
  </Text>
</TouchableOpacity>


                {/* RESET PASSWORD */}
                <TouchableOpacity
  onPress={resetPassword}
  disabled={loadingAction}
  style={[
    styles.actionBtn,
    { backgroundColor: "#8800cc" },
    loadingAction && { opacity: 0.6 },
  ]}
>
  <Text style={styles.btnText}>
    {loadingAction ? "Sending..." : "Reset Password"}
  </Text>
</TouchableOpacity>


                {/* DELETE USER */}
                <TouchableOpacity
  onPress={deleteUserAccount}
  disabled={loadingAction}
  style={[
    styles.actionBtn,
    { backgroundColor: "#cc0000" },
    loadingAction && { opacity: 0.6 },
  ]}
>
  <Text style={styles.btnText}>
    {loadingAction ? "Deleting..." : "Disable Account"}
  </Text>
</TouchableOpacity>


                {/* CLOSE */}
               <TouchableOpacity
  onPress={() => !loadingAction && setModalVisible(false)}
  style={[styles.closeBtn, loadingAction && { opacity: 0.6 }]}
                >

                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

// -------------------------------
// STYLES
// -------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },

  header: {
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  headerText: { color: "white", fontSize: 22, fontWeight: "bold" },

  search: {
    backgroundColor: "#222",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    color: "white",
  },

  userCard: {
    backgroundColor: "#111",
    padding: 15,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  userEmail: { color: "white", fontSize: 16, flex: 1 },
  userBalance: { color: "#00eaff", fontWeight: "bold", marginRight: 10 },
  status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  frozen: { backgroundColor: "#aa0033", color: "white" },
  active: { backgroundColor: "#0044aa", color: "white" },

  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 20,
    maxHeight: "85%",
  },

  modalTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },

  sectionTitle: {
    color: "#ccc",
    marginTop: 10,
    marginBottom: 6,
    fontSize: 15,
  },

  modeBtn: {
    flex: 1,
    padding: 10,
    backgroundColor: "#222",
    marginRight: 10,
    borderRadius: 8,
  },
  modeActive: { backgroundColor: "#0077ff" },
  modeText: { color: "white", textAlign: "center" },

  row: { flexDirection: "row", marginBottom: 10 },

  input: {
    backgroundColor: "#222",
    color: "white",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },

  actionBtn: {
    backgroundColor: "#0055ff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  btnText: { color: "white", textAlign: "center", fontWeight: "bold" },

  closeBtn: {
    marginTop: 10,
    padding: 12,
    backgroundColor: "#333",
    borderRadius: 10,
  },
  closeText: { color: "white", textAlign: "center" },
});

export default UsersSection;
