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

const NotificationsSection = () => {
  const [message, setMessage] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [editModal, setEditModal] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [selectedId, setSelectedId] = useState("");

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

    await addDoc(collection(db, "alerts"), {
  title: "📢 Admin  Message",
  message,
  type: "admin",
  read: false,
  createdAt: serverTimestamp(),
});


    setMessage("");
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
      <Text style={styles.header}>Notifications</Text>

      {/* ➕ Create Notification Box */}
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

        <TouchableOpacity style={styles.sendBtn} onPress={sendNotification}>
          <Text style={styles.sendText}>Send Notification</Text>
        </TouchableOpacity>
      </View>

      {/* 🔔 Scrollable Notification List */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={{ paddingBottom: 30 }}>
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
                  Alert.alert(
                    "Delete Notification",
                    "Are you sure?",
                    [
                      { text: "Cancel" },
                      { text: "Delete", style: "destructive", onPress: () => deleteNotification(note.id) },
                    ]
                  )
                }
              >
                <Text style={styles.btnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
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
    </View>
  );
};

export default NotificationsSection;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: "#0d0d0f",
  },

  header: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    letterSpacing: 0.5,
  },

  sendBox: {
    backgroundColor: "#1b1b20",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderColor: "#333",
    borderWidth: 1,
  },

  label: {
    color: "#b9b9c5",
    marginBottom: 10,
    fontSize: 14,
  },

  input: {
    backgroundColor: "#131317",
    color: "white",
    padding: 12,
    borderRadius: 10,
    fontSize: 14,
    minHeight: 60,
    marginBottom: 10,
  },

  sendBtn: {
    backgroundColor: "#4e2cff",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  sendText: {
    color: "white",
    fontWeight: "bold",
  },

  scrollArea: {
    flex: 1,
  },

  card: {
    backgroundColor: "#1a1a1f",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderColor: "#333",
    borderWidth: 1,
  },

  msg: {
    color: "white",
    fontSize: 14,
    marginBottom: 10,
  },

  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },

  editBtn: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },

  deleteBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },

  btnText: {
    color: "white",
    fontWeight: "600",
  },

  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },

  modalBox: {
    backgroundColor: "#1e1e24",
    padding: 20,
    borderRadius: 12,
    borderColor: "#444",
    borderWidth: 1,
  },

  modalHeader: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },

  modalInput: {
    backgroundColor: "#131317",
    color: "white",
    padding: 12,
    borderRadius: 10,
    minHeight: 80,
    fontSize: 14,
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 15,
    gap: 10,
  },

  modalBtnCancel: {
    backgroundColor: "#555",
    padding: 10,
    borderRadius: 8,
  },

  modalBtnSave: {
    backgroundColor: "#4e2cff",
    padding: 10,
    borderRadius: 8,
  },

  modalTxt: {
    color: "white",
    fontWeight: "600",
  },
});
