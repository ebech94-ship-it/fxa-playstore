import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";

import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc, writeBatch,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Alert, Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../../firebaseConfig";

interface Player {
  id: string;
  username: string;
  balance: number;
}


interface Tournament {
  id: string;
  name: string;
  startingBalance: number;
  prizePool: number;
  payoutStructure?: {
  rank: number;
  amount: number;
}[];
   entryFee: number;
   rebuyFee?: number;
  durationMinutes: number;
  description: string;
  status: "Upcoming" | "Live" | "Completed";
  // participants is optional in doc but we'll load counts from subcollection
  participantsCount?: number;
    rules?: string;
  onRegisterInfo?: string;
}

const STATUS_ORDER = {
  Live: 0,
  Upcoming: 1,
  Completed: 2,
};



const capitalize = (s: any) => {
  if (!s || typeof s !== "string") return "Upcoming";
  const low = s.toLowerCase();
  if (low === "live") return "Live";
  if (low === "completed") return "Completed";
  return "Upcoming";
};

const TournamentsSection = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [search, setSearch] = useState("");
const [payouts, setPayouts] = useState<{ rank: number; amount: number }[]>([
  { rank: 1, amount: 0 },
]);

  const [modalVisible, setModalVisible] = useState(false);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);

  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [isEditing, setIsEditing] = useState(false);
const [deleting, setDeleting] = useState(false);


  // Data
  const [players, setPlayers] = useState<Player[]>([]);
const [loadingPlayers, setLoadingPlayers] = useState(true);

  // FORM FIELDS
  const [formName, setFormName] = useState("");
  const [formSB, setFormSB] = useState("");
  const [formPrize, setFormPrize] = useState("");
  const [formEntryFee, setFormEntryFee] = useState(""); // new
const [formRebuyFee, setFormRebuyFee] = useState("");

const [saving, setSaving] = useState(false);

  const [formDuration, setFormDuration] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formStatus, setFormStatus] = useState<"Upcoming" | "Live" | "Completed">("Upcoming");
const [formRules, setFormRules] = useState("");
const [formOnRegisterInfo, setFormOnRegisterInfo] = useState("");
const [templateDesc, setTemplateDesc] = useState("");
const [templateRules, setTemplateRules] = useState("");
const [templateOnRegister, setTemplateOnRegister] = useState("");


  // Glow animation -> animate borderColor (lighter than animating shadowColor)
  const glowAnim = useRef(new Animated.Value(0)).current;

const saveTemplate = async () => {
  try {
    await AsyncStorage.setItem(
      "tournamentTemplate",
      JSON.stringify({
        desc: templateDesc,
        rules: templateRules,
        onRegister: templateOnRegister,
      })
    );
  } catch (e) {
    console.warn("Failed to save template", e);
  }
};

const loadTemplate = async () => {
  try {
    const raw = await AsyncStorage.getItem("tournamentTemplate");
    if (raw) {
      const t = JSON.parse(raw);
      setTemplateDesc(t.desc || "");
      setTemplateRules(t.rules || "");
      setTemplateOnRegister(t.onRegister || "");
    }
  } catch (e) {
    console.warn("Failed to load template", e);
  }
};
useEffect(() => {
  loadTemplate();
}, []);

  useEffect(() => {
    const loopAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: false, // color interpolation requires false
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: false,
        }),
      ])
    );

    loopAnimation.start();
    return () => loopAnimation.stop();
  }, [glowAnim]);

  const glowBorderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(120,0,255,0.2)", "rgba(0,200,255,0.2)"],
  });

  // Real-time Firestore fetch for tournaments
  useEffect(() => {
    // We listen to full tournaments collection and then compute participants counts separately.
    const q = query(
  collection(db, "tournaments"),
  orderBy("createdAt", "desc")
);
 // we'll sort locally
    const unsub = onSnapshot(q, async (snap) => {
      const list: Tournament[] = [];
      for (const d of snap.docs) {
        const data = d.data() as any;
        list.push({
          id: d.id,
          name: data.name ?? "Untitled",
          startingBalance: Number(data.startingBalance ?? 0),
          prizePool: Number(data.prizePool ?? 0),
           payoutStructure: data.payoutStructure ?? [], 
          entryFee: Number(data.entryFee ?? 0),
      rebuyFee: Number(data.rebuyFee ?? data.entryFee ?? 0),
          durationMinutes: Number(data.durationMinutes ?? 0),
          description: data.description ?? "",
          status: capitalize(data.status) as "Upcoming" | "Live" | "Completed",
          participantsCount: undefined, // will be filled below (or later lazy)
          rules: data.rules,
          onRegisterInfo: data.onRegisterInfo,

        });
      }

      // Option A: For UI responsiveness we can fetch participant counts in parallel but don't block rendering.
      setTournaments((prev) => {
        // merge with existing participant counts where possible to avoid blanking
        const prevMap = new Map(prev.map((t) => [t.id, t]));
        const merged = list.map((t) => {
          const prevT = prevMap.get(t.id);
          return {
            ...t,
            participantsCount: prevT?.participantsCount ?? undefined,
          } as Tournament;
        });

        // Local sorting: Live -> Upcoming -> Completed, then alphabetical
        merged.sort((a, b) => {
          const sa = STATUS_ORDER[a.status] ?? 99;
          const sb = STATUS_ORDER[b.status] ?? 99;
          if (sa !== sb) return sa - sb;
          return a.name.localeCompare(b.name);
        });
 
        return merged;
      });
 
      // Kick off participant counts fetch but don't block UI.
      // This will populate participantsCount for tournaments as results come in.
      list.forEach((t) => fetchParticipantCount(t.id));
    });

    return () => unsub();
    
  }, []);

  // Fetch participant count for a tournament and patch into tournaments state
  const fetchParticipantCount = async (tournamentId: string) => {
    try {
      const q = query(collection(db, "tournaments", tournamentId, "players"));
      const snap = await getDocs(q);
      const cnt = snap.size;
      setTournaments((prev) => prev.map((t) => (t.id === tournamentId ? { ...t, participantsCount: cnt } : t)));
    } catch (err) {
      // silent fail - we don't want the UI to crash on count fetch fail
      console.warn("Failed to fetch participant count:", err);
    }
  };

  // loadParticipants returns unsubscribe and we manage it in an effect
  const loadPlayers = (tournamentId: string) => {
    setLoadingPlayers(true);
    setPlayers([]); // clear previous to avoid stale flash

    const q = query(collection(db, "tournaments", tournamentId, "players"), orderBy("balance", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
           username: data.username ?? "Player",

            balance: Number(data.balance ?? 0),
          } as Player;
        });
        setPlayers(list);
        setLoadingPlayers(false);
      },
      (error) => {
        console.warn("participants onSnapshot error:", error);
        setLoadingPlayers(false);
      }
    );

    return unsub;
  };

  // Effect to subscribe/unsubscribe to participants when leaderboardVisible changes
  useEffect(() => {
    let unsub: (() => void) | undefined;
    if (leaderboardVisible && selectedTournament) {
      unsub = loadPlayers(selectedTournament.id);
    }
    return () => {
      if (unsub) unsub();
      // small cleanup: clear participants so old data doesn't flash when reopened
      if (!leaderboardVisible) {
        setPlayers([]);
        setLoadingPlayers(true);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderboardVisible, selectedTournament?.id]);

  // OPEN CREATE / EDIT MODAL
  const openModal = (t?: Tournament) => {
    if (t) {
      setIsEditing(true);
      setSelectedTournament(t);

      setFormName(t.name);
      setFormSB(String(t.startingBalance ?? 0));
      setFormPrize(String(t.prizePool ?? 0));
      setPayouts(t.payoutStructure || [{ rank: 1, amount: 0 }]);
     setFormEntryFee(String(t.entryFee ?? 0));

      setFormDuration(String(t.durationMinutes ?? 0));
      setFormDesc(t.description ?? "");
      setFormStatus(capitalize(t.status) as "Upcoming" | "Live" | "Completed");
      setFormRules(t.rules || "");
      setFormOnRegisterInfo(t.onRegisterInfo || "");

    } else {
      setIsEditing(false);
      setSelectedTournament(null);

      setFormName("");
      setFormSB("1000");
      setFormPrize("500");
      setFormEntryFee("0");
      setFormRebuyFee("");
      setFormDuration("60");
      setFormStatus("Upcoming");     
  // PREFILL FROM LAST USED TEMPLATE
  setFormDesc(templateDesc);
  setFormRules(templateRules);
  setFormOnRegisterInfo(templateOnRegister);
    }

    // ensure stale participants are cleared to avoid showing wrong leaderboard
    setPlayers([]);
    setLoadingPlayers(true);

    setModalVisible(true);
  
  };
// ✅ CORRECT: helper near save function
const fail = (title: string, message?: string) => {
  setSaving(false);
  Alert.alert(title, message);
};
// SAVE (CREATE OR UPDATE)
const saveTournament = async () => {
  if (saving) return;
  setSaving(true);

  if (!formName.trim())
    return fail("Name required");

  const sbNum = Number(formSB);
  const prizeNum = Number(formPrize);
  const entryFeeNum = Number(formEntryFee);
  const durationNum = Number(formDuration);

  if (isNaN(sbNum) || sbNum < 0)
    return fail(
      "Invalid Starting Balance",
      "Starting balance must be a non-negative number"
    );

  if (isNaN(prizeNum) || prizeNum < 0)
    return fail(
      "Invalid Prize Pool",
      "Prize Pool must be a non-negative number"
    );

  if (isNaN(entryFeeNum) || entryFeeNum < 0)
    return fail(
      "Invalid Entry Fee",
      "Entry Fee must be a non-negative number"
    );

  if (!Number.isInteger(entryFeeNum))
    return fail(
      "Invalid Entry Fee",
      "Entry Fee must be an integer"
    );

  if (isNaN(durationNum) || durationNum <= 0)
    return fail(
      "Invalid Duration",
      "Duration must be a positive number"
    );

  // ✅ Validate payout distribution
  const payoutTotal = payouts.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );

  if (Math.abs(payoutTotal - prizeNum) > 0.0001) {
    return fail(
      "Invalid Prize Distribution",
      `Total payouts (${payoutTotal}) must equal prize pool (${prizeNum}).`
    );
  }

  // Convert duration into timestamps
  const startTime = Date.now();
  const endTime = startTime + durationNum * 60 * 1000;

  // Unified tournament data
  const data = {
    name: formName.trim(),
    description: formDesc || "",
    startingBalance: sbNum,
    prizePool: prizeNum,
    payoutStructure: payouts,
    entryFee: entryFeeNum,
    rebuyFee: Number(formRebuyFee) || entryFeeNum,
    durationMinutes: durationNum,
    startTime,
    endTime,
    status: formStatus || "Upcoming",
    rules: formRules || "",
    onRegisterInfo: formOnRegisterInfo || "",
  };
try {
  let tournamentId = selectedTournament?.id;

  // -----------------------------
  // 1️⃣ CRITICAL: SAVE TOURNAMENT
  // -----------------------------
  if (isEditing && selectedTournament) {
    await updateDoc(
      doc(db, "tournaments", selectedTournament.id),
      {
        ...data,
        updatedAt: serverTimestamp(),
      }
    );
  } else {
    const newDoc = await addDoc(collection(db, "tournaments"), {
      ...data,
      createdAt: serverTimestamp(),
    });
    tournamentId = newDoc.id;
  }

  // ✅ SUCCESS MESSAGE (ONLY BASED ON TOURNAMENT SAVE)
  Alert.alert(
    "Success",
    isEditing
      ? "Tournament updated successfully!"
      : "Tournament created successfully!",
    [
      {
        text: "OK",
        onPress: () => {
          setModalVisible(false);
          setSelectedTournament(null);
        },
      },
    ]
  );

  // -----------------------------
  // 2️⃣ NON-CRITICAL: ALERT LOGGING
  // -----------------------------
  try {
    await addDoc(collection(db, "alerts"), {
      title: isEditing ? "Tournament Updated" : "New Tournament Available!",
      message: isEditing
        ? `The tournament "${data.name}" has been updated successfully!`
        : `Join the new tournament "${data.name}" now.`,
      createdAt: serverTimestamp(),
      read: false,
      type: isEditing ? "tournament-update" : "tournament",
      tournamentId,
    });
  } catch (e) {
    console.warn("Alert logging failed (safe):", e);
  }

} catch (err) {
  console.warn("saveTournament error:", err);
  return fail("Error saving tournament");
}



  // --------------------------------
  // 2️⃣ TEMPLATE SAVE (NON-CRITICAL)
  // --------------------------------
  try {
    setTemplateDesc(data.description || "");
    setTemplateRules(data.rules || "");
    setTemplateOnRegister(data.onRegisterInfo || "");
    await saveTemplate();
  } catch (e) {
    console.warn("Template save failed but tournament is safe", e);
  }
setSaving(false);
};


  // DELETE tournament and its participants subcollection documents (batch)
  const deleteTournament = async (id: string) => {
  if (deleting) return;
  setDeleting(true);

  try {
    const playersRef = collection(db, "tournaments", id, "players");
    const snap = await getDocs(playersRef);

    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    await deleteDoc(doc(db, "tournaments", id));

    Alert.alert("Deleted successfully");
  } catch (err) {
    console.warn("deleteTournament error:", err);
    Alert.alert("Error deleting tournament");
  } finally {
    setDeleting(false);
  }
};


  // FILTER
  const filtered = tournaments.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <Animated.View style={[styles.headerCard, { borderColor: glowBorderColor }]}>
        <Text style={styles.headerText}>🔥 Tournaments Management</Text>
      </Animated.View>

      {/* Search & Create */}
      <View style={styles.topRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search tournaments..."
          placeholderTextColor="#666"
          style={styles.searchInput}
        />

        <TouchableOpacity style={styles.createButton} onPress={() => openModal()}>
          <Text style={styles.createButtonText}>+ Create</Text>
        </TouchableOpacity>
      </View>

     {/* LIST */}
<ScrollView showsVerticalScrollIndicator={false}>
  {filtered.map((t) => (
    <View key={t.id} style={styles.card}>
      {/* PRESSABLE AREA (OPEN LEADERBOARD) */}
      <Pressable
        onPress={() => {
          setSelectedTournament(t);
          setLeaderboardVisible(true);
        }}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t.name}</Text>
          <Text style={[styles.status, styles[`status_${t.status}`]]}>
            {t.status}
          </Text>
        </View>

        <Text style={styles.cardDesc}>{t.description}</Text>

        <View style={styles.rowBetween}>
          <Text style={styles.meta}>💰 Prize: {t.prizePool}</Text>
          <Text style={styles.meta}>
            👥 Players: {t.participantsCount ?? 0}
          </Text>
        </View>
      </Pressable>

      {/* ACTION BUTTONS */}
      <View style={styles.cardButtons}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => openModal(t)}
        >
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            Alert.alert(
              "Confirm delete",
              "Delete tournament and all participants?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => deleteTournament(t.id),
                },
              ]
            );
          }}
        >
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  ))}

  {filtered.length === 0 && (
    <Text style={styles.noResults}>No tournaments found.</Text>
  )}
</ScrollView>

     {/* CREATE / EDIT MODAL */}
<Modal visible={modalVisible} transparent animationType="slide">
  <View style={styles.modalWrap}>

    <View style={styles.modalBox}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={10}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 30 }}
        >

          <Text style={styles.modalHeader}>
            {isEditing ? "Edit Tournament" : "Create Tournament"}
          </Text>

          <TextInput
            placeholder="Tournament Name"
            placeholderTextColor="#666"
            style={styles.input}
            value={formName}
            onChangeText={setFormName}
          />

          <TextInput
            placeholder="Starting Balance"
            placeholderTextColor="#666"
            style={styles.input}
            keyboardType="numeric"
            value={formSB}
            onChangeText={setFormSB}
          />

          <TextInput
            placeholder="Prize Pool"
            placeholderTextColor="#666"
            style={styles.input}
            keyboardType="numeric"
            value={formPrize}
            onChangeText={setFormPrize}
          />
<Text style={styles.formLabel}>Prize Distribution</Text>

{payouts.map((p, i) => (
  <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
    <TextInput
      style={[styles.input, { flex: 1 }]}
      keyboardType="numeric"
      placeholder="Rank"
      value={String(p.rank)}
      onChangeText={(v) => {
        const copy = [...payouts];
        copy[i].rank = Number(v);
        setPayouts(copy);
      }}
    />

    <TextInput
      style={[styles.input, { flex: 2 }]}
      keyboardType="numeric"
      placeholder="Amount"
      value={String(p.amount)}
      onChangeText={(v) => {
        const copy = [...payouts];
        copy[i].amount = Number(v);
        setPayouts(copy);
      }}
    />
  </View>
))}

<TouchableOpacity
  onPress={() => setPayouts([...payouts, { rank: payouts.length + 1, amount: 0 }])}
>
  <Text style={{ color: "#6A00FF", textAlign: "center", marginBottom: 10 }}>
    + Add Winner
  </Text>
</TouchableOpacity>

          <TextInput
            placeholder="Entry Fee"
            placeholderTextColor="#666"
            style={styles.input}
            keyboardType="numeric"
            value={formEntryFee}
            onChangeText={setFormEntryFee}
          />

          <TextInput
            style={styles.input}
            placeholder="Rebuy Fee"
            keyboardType="numeric"
            value={formRebuyFee}
            onChangeText={setFormRebuyFee}
            placeholderTextColor="#666"
          />

          <TextInput
            placeholder="Duration in minutes"
            placeholderTextColor="#666"
            style={styles.input}
            keyboardType="numeric"
            value={formDuration}
            onChangeText={setFormDuration}
          />

          {/* Tournament Status */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#fff", marginBottom: 6, fontSize: 14 }}>Status</Text>

            <View
              style={{
                backgroundColor: "#111827",
                borderColor: "#374151",
                borderWidth: 1,
                borderRadius: 8,
              }}
            >
              <Picker
                selectedValue={formStatus}
                dropdownIconColor="#fff"
                style={{ color: "#fff" }}
                onValueChange={(value: any) =>
                  setFormStatus(capitalize(value) as "Upcoming" | "Live" | "Completed")
                }
              >
                <Picker.Item label="Upcoming" value="Upcoming" />
                <Picker.Item label="Live" value="Live" />
                <Picker.Item label="Completed" value="Completed" />
              </Picker>
            </View>
          </View>

          <TextInput
            placeholder="Description"
            placeholderTextColor="#666"
            style={styles.inputLarge}
            multiline
            value={formDesc}
            onChangeText={setFormDesc}
          />

          <Text style={styles.formLabel}>Rules</Text>
          <TextInput
            style={styles.inputLarge}
             multiline
            value={formRules}
            onChangeText={setFormRules}
            placeholder="Enter tournament rules..."
            placeholderTextColor="#777"
          />

          <Text style={styles.formLabel}>On Register Info</Text>
            <TextInput
         style={styles.inputLarge}
           value={formOnRegisterInfo}
          onChangeText={setFormOnRegisterInfo}
         placeholder="What users receive after registering..."
          placeholderTextColor="#777"
           multiline
            />

          <TouchableOpacity
  style={[styles.saveButton, saving && { opacity: 0.6 }]}
  onPress={saveTournament}
  disabled={saving}
>
  <Text style={styles.saveText}>
    {saving ? "Saving..." : "Save"}
  </Text>
</TouchableOpacity>


          <TouchableOpacity onPress={() => setModalVisible(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>

  </View>
</Modal>

      {/* LEADERBOARD */}
      <Modal visible={leaderboardVisible} transparent animationType="fade">
        <View style={styles.modalWrap}>
          <View style={styles.modalLeaderboard}>
            <Text style={styles.modalHeader}>🏆 {selectedTournament?.name} Leaderboard</Text>

            <ScrollView>
              {loadingPlayers ? (
                <Text style={styles.noResults}>Loading...</Text>
              ) : players.length > 0 ? (
                players.map((p, i) => (
                  <View key={p.id} style={styles.leaderCard}>
                    <Text style={styles.rank}>{i + 1}</Text>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.pName}>{p.username}</Text>
                      <Text style={styles.pBalance}>{p.balance} USD</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noResults}>No participants yet.</Text>
              )}
            </ScrollView>

            <TouchableOpacity onPress={() => setLeaderboardVisible(false)}>
              <Text style={styles.closeLB}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default TournamentsSection;

// ---------------- STYLES ---------------- //

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 15 },

  headerCard: {
    backgroundColor: "#111",
    padding: 18,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  headerText: { color: "#fff", fontSize: 24, fontWeight: "bold", textAlign: "center" },
  topRow: { flexDirection: "row", marginBottom: 15, gap: 10 },
  searchInput: { flex: 1, backgroundColor: "#111", borderRadius: 10, paddingHorizontal: 12, color: "#fff" },
  createButton: { backgroundColor: "#6A00FF", paddingHorizontal: 15, justifyContent: "center", borderRadius: 10 },
  createButtonText: { color: "#fff", fontWeight: "bold" },
  card: { backgroundColor: "#111", padding: 15, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#222" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },

  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },

  cardDesc: { color: "#888", fontSize: 13, marginVertical: 8 },

  status: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, fontSize: 12, fontWeight: "600" },
  status_Upcoming: { backgroundColor: "#444", color: "#fff" },
  status_Live: { backgroundColor: "#0066FF", color: "#fff" },
  status_Completed: { backgroundColor: "#880000", color: "#fff" },

  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  meta: { color: "#bbb", fontSize: 12 },
  cardButtons: { flexDirection: "row", marginTop: 10, gap: 10 },
  editButton: { flex: 1, backgroundColor: "#333", paddingVertical: 8, borderRadius: 8, alignItems: "center" },

  editBtnText: { color: "#fff" },
  deleteButton: { flex: 1, backgroundColor: "#900", paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  deleteBtnText: { color: "#fff" },
  noResults: { color: "#666", textAlign: "center", marginVertical: 20 },
  modalWrap: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.85)",
  justifyContent: "center",
  padding: 20,
  pointerEvents: "auto",
},

modalBox: {
  backgroundColor: "#111",
  padding: 20,
  borderRadius: 15,
  borderColor: "#333",
  borderWidth: 1,
  height: "85%",        // ✅ FIX
},


  modalLeaderboard: { backgroundColor: "#111", padding: 20, borderRadius: 15, borderColor: "#333", borderWidth: 1,
    maxHeight: "85%",},
  formLabel: {color: "#fff", marginBottom: 6, fontSize: 14, fontWeight: "600"},

  modalHeader: { color: "#fff", fontSize: 20, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  input: { backgroundColor: "#222", color: "#fff", padding: 10, borderRadius: 10, marginBottom: 10 },
  inputLarge: { backgroundColor: "#222", color: "#fff", padding: 10, borderRadius: 10, height: 100, marginBottom: 10 },
  saveButton: { backgroundColor: "#6A00FF", padding: 12, borderRadius: 10, marginTop: 5, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "bold" },
  cancelText: { color: "#888", marginTop: 15, textAlign: "center" },
  leaderCard: { backgroundColor: "#222", padding: 14, borderRadius: 12, marginBottom: 10, flexDirection: "row", gap: 12 },
  rank: { width: 30, textAlign: "center", color: "#FFD700", fontSize: 18, fontWeight: "900" },
  pName: { color: "#fff", fontSize: 16 },
  pBalance: { color: "#6A00FF", fontSize: 14, fontWeight: "700" },
  closeLB: { color: "#999", textAlign: "center", marginTop: 15, fontSize: 16 },
});
