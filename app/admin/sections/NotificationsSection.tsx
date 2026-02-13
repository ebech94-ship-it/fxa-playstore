import { getAuth } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../../firebaseConfig";


const API_URL = "https://forexapp2-backend.onrender.com";

const NotificationsSection = () => {
  const [message, setMessage] = useState("");
  const [loadingNotification, setLoadingNotification] = useState(false);
const [loadingReply, setLoadingReply] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [editModal, setEditModal] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [selectedId, setSelectedId] = useState("");

const [supportThreads, setSupportThreads] = useState<any[]>([]);
const [activeThread, setActiveThread] = useState<any | null>(null);
const [replyText, setReplyText] = useState("");
const [activeTab, setActiveTab] = useState<"notifications" | "support">(
  "notifications"
);

  // 🔥 Real-time notifications
  useEffect(() => {
    const q = query(
      collection(db, "alerts"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setNotifications(list);
    });

    return () => unsub();
  }, []);

  // 🚀 Send notification
const sendNotification = async () => {
  if (!message.trim()) return;

  setLoadingNotification(true); // start loading

  try {
    const user = getAuth().currentUser;
    if (!user) {
      Alert.alert("Error", "Not logged in");
      return;
    }

    const token = await user.getIdToken(true);
    const res = await fetch(`${API_URL}/admin/send-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Failed");
    }

    setMessage("");
  } catch (err) {
    console.log("SEND ERROR:", err);
    Alert.alert("Error", "Failed to send notification");
  } finally {
    setLoadingNotification(false); // stop loading
  }
};
useEffect(() => {
  const q = query(
    collection(db, "supportThreads"),
    orderBy("createdAt", "desc")
  );

  const unsub = onSnapshot(q, (snap) => {
    const list: any[] = [];
    snap.forEach((doc) =>
      list.push({ id: doc.id, ...doc.data() })
    );
    setSupportThreads(list);
  });

  return () => unsub();
}, []);

const sendReply = async () => {
  if (!replyText.trim() || !activeThread) return;

  setLoadingReply(true);
  try {
    const user = getAuth().currentUser;
    if (!user) {
      Alert.alert("Error", "You are not logged in");
      return;
    }

    const token = await user.getIdToken(true);

    // 1️⃣ Send to backend
    const res = await fetch(`${API_URL}/admin/reply-support`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        threadId: activeThread.id,
        message: replyText,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Failed");
    }

    // 2️⃣ Persist reply in Firestore
    const threadRef = doc(db, "supportThreads", activeThread.id);

    await updateDoc(threadRef, {
      messages: [
        ...(activeThread.messages || []), // keep old messages
        {
          sender: "admin",
          message: replyText,
          createdAt: new Date(),
        },
      ],
      lastMessage: replyText,
      status: "open", // or "replied" if you want
    });

    // 3️⃣ Reset state
    setReplyText("");
    setActiveThread(null);

  } catch (err) {
    console.log("REPLY ERROR:", err);
    Alert.alert("Error", "Failed to send reply");
  } finally {
    setLoadingReply(false);
  }
};



  // 🗑 Delete notification
  const deleteNotification = async (id: string) => {
    await deleteDoc(doc(db, "alerts", id));
  };

  // ✏️ Open edit modal
  const openEdit = (id: string, oldMsg: string) => {
    setSelectedId(id);
    setEditMessage(oldMsg);
    setEditModal(true);
  };

  // 💾 Save edited message
  const updateNotification = async () => {
    if (!editMessage.trim()) return;
    await updateDoc(doc(db, "alerts", selectedId), {
      message: editMessage,
    });
    setEditModal(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
     <Text style={styles.header}>
  {activeTab === "notifications"  ? "Notifications"  : "Support Inbox"}
</Text>

{/* ===== TOGGLE ===== */}
<View style={styles.toggleWrap}>
  <TouchableOpacity
    style={[
      styles.toggleBtn,
      activeTab === "notifications" && styles.toggleActive,
    ]}
    onPress={() => setActiveTab("notifications")}
  >
    <Text
      style={[
        styles.toggleText,
        activeTab === "notifications" && styles.toggleTextActive,
      ]}
    >
      Notifications
    </Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[
      styles.toggleBtn,
      activeTab === "support" && styles.toggleActive,
    ]}
    onPress={() => setActiveTab("support")}
  >
    <Text
      style={[
        styles.toggleText,
        activeTab === "support" && styles.toggleTextActive,
      ]}
    >
      Support Inbox
    </Text>
  </TouchableOpacity>
</View>
      {/* ➕ Create Notification Box */}
      {activeTab === "notifications" && (
  <View style={styles.sendBox}>
    <Text style={styles.label}>Write Notification:</Text>

    <TextInput
      style={styles.input}
      placeholder="Type message to broadcast..."
      placeholderTextColor="#888"
      multiline
      value={message}
      onChangeText={setMessage}
    />

   <TouchableOpacity
  style={styles.sendBtn}
  onPress={sendNotification}
  disabled={loadingNotification}
>
  <Text style={styles.sendText}>
    {loadingNotification ? "Sending..." : "Send Notification"}
  </Text>
</TouchableOpacity>
  </View>
)}


      {/* 🔔 Scrollable Notification List */}
     <ScrollView
  style={styles.scrollArea}
  contentContainerStyle={{ paddingBottom: 30 }}
>
  {/* ===== NOTIFICATIONS ===== */}
  {activeTab === "notifications" && (
    <>
      {notifications.map((note) => (
        <View key={note.id} style={styles.card}>
          <Text style={styles.msg}>{note.message}</Text>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => openEdit(note.id, note.message)}
            >
              <Text style={styles.btnText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() =>
                Alert.alert("Delete Notification", "Are you sure?", [
                  { text: "Cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => deleteNotification(note.id),
                  },
                ])
              }
            >
              <Text style={styles.btnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </>
  )}

  {/* ===== SUPPORT (SAME CARD, SAME FEEL) ===== */}
  {activeTab === "support" && (
    <>
      {supportThreads.map((thread) => (
        <View
          key={thread.id}
          style={[
            styles.card,
            thread.status === "open" && {
              borderColor: "#4e2cff",
            },
          ]}
        >
          {/* Header line (replaces title, but same hierarchy) */}
          <Text style={styles.supportMeta}>
            {thread.userEmail}
          </Text>

          {/* Main message (same as notification msg) */}
          <Text style={styles.msg} numberOfLines={2}>
            {thread.lastMessage || "No message yet"}
          </Text>

          {/* Actions row — SAME POSITION, SAME WEIGHT */}
          <View style={styles.cardActions}>
            <Text style={styles.supportStatus}>
              {thread.status}
            </Text>

            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => setActiveThread(thread)}
            >
              <Text style={styles.btnText}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </>
  )}
</ScrollView>


      {/* ✏️ EDIT MODAL */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalHeader}>Edit Notification</Text>

            <TextInput
              style={styles.modalInput}
              multiline
              value={editMessage}
              onChangeText={setEditMessage}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setEditModal(false)}
              >
                <Text style={styles.modalTxt}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalBtnSave}
                onPress={updateNotification}
              >
                <Text style={styles.modalTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
{/* ================= REPLY MODAL ================= */}
<Modal visible={!!activeThread} transparent animationType="slide">
  <View style={styles.modalBg}>
    <View style={styles.modalBox}>
      <Text style={styles.modalHeader}>
        Reply to {activeThread?.userEmail}
      </Text>

      {/* ===== FULL THREAD VIEW ===== */}
      <ScrollView style={{ maxHeight: 200, marginBottom: 10 }}>
  {activeThread?.messages?.map(
    (msg: { sender: string; message: string; createdAt: Date }, index: number) => (
      <Text
        key={index}
        style={{ color: msg.sender === "admin" ? "#4e2cff" : "white", marginBottom: 4 }}
      >
        {msg.sender === "admin" ? "You: " : "User: "} {msg.message}
      </Text>
    )
  )}
</ScrollView>


      <TextInput
        style={styles.modalInput}
        placeholder="Type your reply..."
        placeholderTextColor="#888"
        multiline
        value={replyText}
        onChangeText={setReplyText}
      />

      <View style={styles.modalActions}>
        <TouchableOpacity
          style={styles.modalBtnCancel}
          onPress={() => setActiveThread(null)}
        >
          <Text style={styles.modalTxt}>Close</Text>
        </TouchableOpacity>

        <TouchableOpacity
  style={styles.modalBtnSave}
  onPress={sendReply}
  disabled={loadingReply}
>
  <Text style={styles.modalTxt}>
    {loadingReply ? "Sending..." : "Send"}
  </Text>
</TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

    </View>
  );
};

export default NotificationsSection;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: "#0d0d0f", },

  header: { color: "white",  fontSize: 24,  fontWeight: "bold", marginBottom: 20, letterSpacing: 0.5,
  },
  sendBox: { backgroundColor: "#1b1b20", padding: 15, borderRadius: 12, marginBottom: 20, borderColor: "#333", borderWidth: 1,},
  label: {color: "#b9b9c5",  marginBottom: 10,  fontSize: 14,},
 input: { backgroundColor: "#131317", color: "white", padding: 12, borderRadius: 10,
 fontSize: 14,  minHeight: 60, marginBottom: 10, },
  sendBtn: { backgroundColor: "#4e2cff",  padding: 12,  borderRadius: 10,  alignItems: "center",},
 sendText: { color: "white", fontWeight: "bold", },
scrollArea: { flex: 1, },
  card: { backgroundColor: "#1a1a1f", padding: 15, borderRadius: 12, marginBottom: 15, borderColor: "#333", borderWidth: 1,},
  msg: {color: "white", fontSize: 14, marginBottom: 10, },
  cardActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10,},
  editBtn: { backgroundColor: "#3b82f6",  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,},
  deleteBtn: { backgroundColor: "#ef4444", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,},
  btnText: { color: "white", fontWeight: "600", },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20,},
  modalBox: {  backgroundColor: "#1e1e24", padding: 20,  borderRadius: 12,  borderColor: "#444",  borderWidth: 1,},
  modalHeader: {  color: "white",  fontSize: 18,  fontWeight: "bold",  marginBottom: 10,},
  modalInput: { backgroundColor: "#131317", color: "white", padding: 12,  borderRadius: 10, minHeight: 80,  fontSize: 14,},
  modalActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 15, gap: 10,},
  modalBtnCancel: {  backgroundColor: "#555",  padding: 10,  borderRadius: 8,},
  modalBtnSave: { backgroundColor: "#4e2cff", padding: 10, borderRadius: 8,},
  modalTxt: { color: "white", fontWeight: "600",},
  /* ===== TOGGLE ===== */
toggleWrap: { flexDirection: "row", backgroundColor: "#1b1b20", borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: "#333",
},
toggleBtn: {  flex: 1,  paddingVertical: 10, alignItems: "center",},

toggleActive: { backgroundColor: "#4e2cff",  },

toggleText: { color: "#888",  fontWeight: "600",},

toggleTextActive: { color: "white",},
/* ===== SUPPORT ===== */
supportMeta: { color: "#b9b9c5",  fontSize: 13, marginBottom: 6,},

supportStatus: { color: "#888",fontSize: 12,marginRight: 10,},

});
