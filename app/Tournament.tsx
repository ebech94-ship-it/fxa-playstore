// TournamentScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import type { User } from "firebase/auth";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { db } from "../firebaseConfig";

// enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Helper to format remaining time
const formatTime = (ms: number) => {
  if (ms <= 0) return "00:00:00:00";
  let seconds = Math.floor(ms / 1000);
  let days = Math.floor(seconds / (3600 * 24));
  seconds %= 3600 * 24;
  let hrs = Math.floor(seconds / 3600);
  seconds %= 3600;
  let mins = Math.floor(seconds / 60);
  seconds %= 60;
  return `${String(days).padStart(2, "0")}:${String(hrs).padStart(2, "0")}:${String(
    mins
  ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

type TournamentScreenProps = {
  currentUser: User | null;
};

type Tournament = {
  id: string;
  name?: string;
  title?: string;
  startTime: number;
  endTime: number;
  fee?: number;
  prizePool?: number;
  prize?: number;
  participantsList?: any[];
  status?: string;
  [key: string]: any;
};

interface LeaderboardUser {
  id: string;
  username?: string;
  balance?: number;
  email?: string;
  [key: string]: any;
}

export default function TournamentScreen({ currentUser }: TournamentScreenProps) {
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [now, setNow] = useState(new Date().getTime());
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [viewTab, setViewTab] = useState("info"); // "info" | "leaderboard"
  const [adminModal, setAdminModal] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [loadingAction, setLoadingAction] = useState(false); // new: show action spinner
  const router = useRouter();

  // username fallback
  const username = currentUser?.displayName || currentUser?.email || "Guest";

  // tick every second for countdowns
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date().getTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ✅ TOURNAMENTS LISTENER (for all tournaments list)
  useEffect(() => {
    const q = query(collection(db, "tournaments"), orderBy("startTime", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Tournament, "id">),
      })) as Tournament[];

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTournaments(list);
    });

    return () => unsub();
  }, []);

  // ✅ GLOBAL LEADERBOARD (only when no tournament is open)
  useEffect(() => {
    if (selectedTournament) return; // stop if modal is open

    const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(30));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setLeaderboard(list);
    });
    return () => unsub();
  }, [selectedTournament]);

  // ✅ TOURNAMENT LEADERBOARD (active tournament only)
  useEffect(() => {
    if (!selectedTournament?.id) return;

    const playersRef = collection(db, "tournaments", selectedTournament.id, "players");
    const q = query(playersRef, orderBy("balance", "desc"), limit(30));

    const unsub = onSnapshot(q, (snapshot) => {
      const playerList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      }));
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setLeaderboard(playerList);
    });

    return () => unsub();
  }, [selectedTournament]);

  // ---------- Helper: read user's wallet balance ----------
  const getUserWalletBalance = async (uid: string) => {
    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) return 0;
      const data = snap.data() as any;
      return typeof data.walletBalance === "number" ? data.walletBalance : Number(data.walletBalance || 0);
    } catch (err) {
      console.error("getUserWalletBalance error:", err);
      return 0;
    }
  };

  // ---------- REGISTER USER TO TOURNAMENT (calls backend to perform money ops + treasury) ----------
  const handleRegister = async (tournamentId: string) => {
    if (!currentUser?.uid || !username) {
      Alert.alert("Error", "You must be logged in to register.");
      return;
    }

    if (!tournaments || tournaments.length === 0) {
      Alert.alert("Error", "No tournaments available.");
      return;
    }

    const tour = tournaments.find((t) => t.id === tournamentId);
    const fee = Number(tour?.fee || 0);

    setLoadingAction(true);
    try {
      // 1) check if already registered
      const playerRef = doc(db, `tournaments/${tournamentId}/players`, currentUser.uid);
      const playerSnap = await getDoc(playerRef);
      if (playerSnap.exists()) {
        Alert.alert("Already registered", "You are already registered for this tournament.");
        setLoadingAction(false);
        return;
      }

      // 2) check user's wallet locally (quick UX check)
      const wallet = await getUserWalletBalance(currentUser.uid);
      if (wallet < fee) {
        Alert.alert("Insufficient Funds", `Your wallet has ${wallet} — you need ${fee} to register.`);
        setLoadingAction(false);
        return;
      }

      // 3) call backend endpoint that will:
      //    - deduct tournament fee from user (server-side)
      //    - record fee into treasury
      //    - return success/failure
      // Replace base URL with your backend host if different
      const res = await fetch("http://10.217.176.22:4000/tournament-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.uid,
          tournamentId,
          feeAmount: fee,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "Server error");
        console.error("tournament-register error:", text);
        Alert.alert("Registration failed", "Could not register. Try again later.");
        setLoadingAction(false);
        return;
      }

      const resp = await res.json().catch(() => ({ success: true }));
      if (resp.success === false) {
        Alert.alert("Registration failed", resp.message || "Server refused to register.");
        setLoadingAction(false);
        return;
      }

      // 4) create tournament player doc (ensure merge so server-side changes won't be lost)
      await setDoc(
        playerRef,
        {
          uid: currentUser.uid,
          username,
          balance: 10000, // initial tournament balance
          joinedAt: Date.now(),
          rebuys: [],
        },
        { merge: true }
      );

      Alert.alert("✅ Success", "You are registered for this tournament!");
    } catch (err) {
      console.error("Registration error:", err);
      Alert.alert("❌ Error", "Registration failed. Please try again.");
    } finally {
      setLoadingAction(false);
    }
  };

  // ---------- REBUY ACTION (calls backend to deduct and record) ----------
  const handleRebuy = async (tournamentId: string) => {
    if (!currentUser?.uid) {
      Alert.alert("Error", "You must be logged in.");
      return;
    }

    const tour = tournaments.find((t) => t.id === tournamentId);
    const rebuyCost = Number(tour?.fee || 0); // using tournament fee as rebuy cost (same as earlier)

    setLoadingAction(true);
    try {
      // 1) ensure user is registered in the tournament
      const playerRef = doc(db, `tournaments/${tournamentId}/players`, currentUser.uid);
      const playerSnap = await getDoc(playerRef);
      if (!playerSnap.exists()) {
        Alert.alert("Not registered", "You must register before performing a rebuy.");
        setLoadingAction(false);
        return;
      }

      // 2) check wallet client-side
      const wallet = await getUserWalletBalance(currentUser.uid);
      if (wallet < rebuyCost) {
        Alert.alert("Insufficient Funds", `Your wallet has ${wallet} — you need ${rebuyCost} to rebuy.`);
        setLoadingAction(false);
        return;
      }

      // 3) call backend to perform the deduction + treasury recording
      const res = await fetch("http://10.217.176.22:4000/tournament-rebuy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.uid,
          tournamentId,
          amount: rebuyCost,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "Server error");
        console.error("tournament-rebuy error:", text);
        Alert.alert("Rebuy failed", "Could not process rebuy. Try again later.");
        setLoadingAction(false);
        return;
      }

      const resp = await res.json().catch(() => ({ success: true }));
      if (resp.success === false) {
        Alert.alert("Rebuy failed", resp.message || "Server refused the rebuy.");
        setLoadingAction(false);
        return;
      }

      // 4) update player's rebuys array in tournament players subcollection
      await updateDoc(playerRef, {
        rebuys: arrayUnion({
          at: Date.now(),
          amount: rebuyCost,
        }),
      });

      Alert.alert("✅ Success", "Rebuy successful!");
    } catch (err) {
      console.error("Rebuy error:", err);
      Alert.alert("❌ Error", "Rebuy failed. Please try again.");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleAccess = () => {
    const correctCode = "FOREXADMIN2025"; // change this anytime
    if (adminCode.trim() === correctCode) {
      setAdminModal(false);
      Alert.alert("✅ Access Granted", "Welcome Administrator!");
      router.push("/AdminDashboard"); // navigate directly to your Admin Dashboard screen
    } else {
      Alert.alert("⛔ Access Denied", "Incorrect admin code.");
    }
  };

  // Tournament card
  const TournamentCard = ({ item }: { item: Tournament }) => {
    const status =
      now < item.startTime ? "Upcoming" : now <= item.endTime ? "Ongoing" : "Past";
    const timeLeft = status === "Past" ? 0 : item.endTime - now;
    const progress =
      status === "Past"
        ? 1
        : Math.max(0, Math.min((now - item.startTime) / (item.endTime - item.startTime), 1));

    // color by status
    const tagStyle =
      status === "Ongoing" ? styles.tagOngoing : status === "Upcoming" ? styles.tagUpcoming : styles.tagPast;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.card, status === "Ongoing" && styles.cardGlow]}
        onPress={() => {
          setSelectedTournament(item);
          setViewTab("info");
        }}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={[styles.tag, tagStyle]}>
            <Text style={styles.tagText}>{status}</Text>
          </View>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.cardRow}>
          <Text style={styles.cardDetail}>💰 {item.prizePool ?? "$0"}</Text>
          <Text style={styles.cardDetail}>🎟 {item.fee ?? "$0"}</Text>
        </View>

        <View style={styles.cardRow}>
          <Text style={styles.cardDetail}>⏰ {formatTime(timeLeft)}</Text>
          <Text style={styles.cardDetail}>👥 {item.participantsList?.length ?? 0}</Text>
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={[styles.actionBtn, status === "Past" && styles.disabledBtn]}
            disabled={status === "Past"}
            onPress={() => handleRegister(item.id)}
          >
            <Text style={styles.actionText}>
              {status === "Past" ? "Closed" : `Register • ${item.fee ?? "$0"}`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtnAlt, status === "Past" && styles.disabledBtn]}
            disabled={status === "Past"}
            onPress={() => handleRebuy(item.id)}
          >
            <Text style={styles.actionTextAlt}>Rebuy</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // find current user row and create pinned row to top of leaderboard modal
  const renderPinnedUserRow = (list: LeaderboardUser[]) => {
    if (!currentUser) return null;
    const idx = list.findIndex((p) => p.id === currentUser.uid);
    if (idx === -1) return null;
    const me = list[idx];
    return (
      <View style={styles.pinnedRow}>
        <Text style={[styles.tableColSmall, styles.pinnedCol]}>You</Text>
        <Text style={[styles.tableCol, styles.pinnedCol]} numberOfLines={1}>
          {me.username || "You"}
        </Text>
        <Text style={[styles.tableCol, styles.pinnedCol, styles.balanceLightBlue]}>
          {me.balance ?? 0}T
        </Text>
        <Text style={[styles.tableCol, styles.pinnedCol, styles.priceGreen]}>
          {typeof me.balance === "number" && typeof selectedTournament?.prizePool !== "undefined"
            ? `$${Math.max(0, Math.round((me.balance / Math.max(1, list.reduce((s, x) => s + (x.balance ?? 0), 0))) * (selectedTournament.prizePool ?? 0)))}`
            : ""}
        </Text>
      </View>
    );
  };

  // table header for leaderboard
  const LeaderboardTable = ({ list }: { list: LeaderboardUser[] }) => {
    return (
      <View>
        {renderPinnedUserRow(list)}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableColSmall, styles.headerText]}>#</Text>
          <Text style={[styles.tableCol, styles.headerText]}>Participant</Text>
          <Text style={[styles.tableCol, styles.headerText]}>Balance</Text>
          <Text style={[styles.tableCol, styles.headerText]}>Prize</Text>
        </View>
        {list.map((row, i) => (
          <View
            key={row.id}
            style={[
              styles.tableRow,
              row.id === currentUser?.uid ? styles.currentRowHighlight : null,
            ]}
          >
            <Text style={[styles.tableColSmall]}>{i + 1}</Text>
            <Text style={[styles.tableCol]} numberOfLines={1}>
              {row.username || row.email || "Player"}
            </Text>
            <Text style={[styles.tableCol, styles.balanceLightBlue]}>{row.balance ?? 0}T</Text>
            <Text style={[styles.tableCol, styles.priceGreen]}>
              {typeof row.balance === "number" && typeof selectedTournament?.prizePool !== "undefined"
                ? `$${Math.max(0, Math.round((row.balance / Math.max(1, list.reduce((s, x) => s + (x.balance ?? 0), 0))) * (selectedTournament.prizePool ?? 0)))}`
                : ""}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>💹 Forex Tournaments</Text>

      <FlatList
        data={tournaments}
        renderItem={({ item }) => <TournamentCard item={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      />

      {/* admin button */}
      <View style={styles.adminSection}>
        <TouchableOpacity onPress={() => setAdminModal(true)} activeOpacity={0.8}>
          <LinearGradient
            colors={["#7c3aed", "#0ea5e9"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.adminButton}
          >
            <Text style={styles.adminButtonText}>👑 Administrator Access</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* admin modal */}
      <Modal visible={adminModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.adminModalBox}>
            <Text style={styles.modalTitle}>Enter Admin Code</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter admin code"
              placeholderTextColor="#aaa"
              secureTextEntry
              value={adminCode}
              onChangeText={setAdminCode}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAdminModal(false)}>
                <Text style={styles.btnTextAlt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleAccess}>
                <Text style={styles.btnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* tournament modal */}
      <Modal visible={!!selectedTournament} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Pressable style={styles.closeButton} onPress={() => setSelectedTournament(null)}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>

            {selectedTournament && (
              <>
                <Text style={styles.modalTitle}>{selectedTournament.title}</Text>
                <View style={styles.modalMetaRow}>
                  <Text style={styles.modalPrize}>💰 {selectedTournament.prizePool}</Text>
                  <Text style={styles.modalInfo}>⏰ {formatTime(selectedTournament.endTime - now)}</Text>
                </View>

                {/* Tab switch */}
                <View style={styles.tabRow}>
                  <TouchableOpacity
                    style={[styles.tabBtn, viewTab === "info" && styles.tabActive]}
                    onPress={() => setViewTab("info")}
                  >
                    <Text style={viewTab === "info" ? styles.tabTextActive : styles.tabText}>Info</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tabBtn, viewTab === "leaderboard" && styles.tabActive]}
                    onPress={() => setViewTab("leaderboard")}
                  >
                    <Text style={viewTab === "leaderboard" ? styles.tabTextActive : styles.tabText}>Leaderboard</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ marginTop: 8 }}>
                  {viewTab === "info" ? (
                    <>
                      <Text style={styles.sectionTitle}>📖 Information</Text>
                      <Text style={styles.infoText}>
                        {selectedTournament.description ||
                          "Each participant receives a starting balance. Grow it, finish top to win the prize pool."}
                      </Text>

                      <Text style={styles.sectionTitle}>🧾 Rules</Text>
                      <Text style={styles.infoText}>
                        {selectedTournament.rules ||
                          "1) No malicious bots. 2) Trades placed count. 3) Fair-play enforced."}
                      </Text>

                      <Text style={styles.sectionTitle}>🎁 On Registration</Text>
                      <Text style={styles.infoText}>
                        {selectedTournament.onRegisterInfo || "You get a starting demo balance and leaderboard entry."}
                      </Text>

                      <View style={styles.buttonRow}>
                        <TouchableOpacity
                          style={styles.registerBtn}
                          onPress={() => handleRegister(selectedTournament.id)}
                        >
                          <Text style={styles.btnText}>Register • {selectedTournament.fee ?? "$0"}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.rebuyBtn}
                          onPress={() => handleRebuy(selectedTournament.id)}
                        >
                          <Text style={styles.btnTextAlt}>Rebuy</Text>
                        </TouchableOpacity>
                      </View>

                      {loadingAction && (
                        <View style={{ marginTop: 12, alignItems: "center" }}>
                          <ActivityIndicator size="small" color="#00ffff" />
                        </View>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={styles.sectionTitle}>🏆 Live Leaderboard</Text>
                      <LeaderboardTable list={leaderboard} />
                    </>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07081a", padding: 12 },
  pageTitle: { fontSize: 22, fontWeight: "800", color: "#ff7ab6", textAlign: "center", marginVertical: 10 },

  // card
  card: {
    backgroundColor: "#12122a",
    padding: 14,
    marginVertical: 8,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  cardGlow: {
    shadowColor: "#32d3ff",
    shadowOpacity: 0.9,
    shadowRadius: 16,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  tag: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 },
  tagText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  tagOngoing: { backgroundColor: "#16a34a" },
  tagUpcoming: { backgroundColor: "#7c3aed" },
  tagPast: { backgroundColor: "#b91c1c" },

  progressBar: { height: 8, backgroundColor: "#0b1020", borderRadius: 6, overflow: "hidden", marginTop: 10 },
  progressFill: { height: "100%", backgroundColor: "#3b82f6" },

  cardRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  cardDetail: { color: "#c7c7d9" },

  cardFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, gap: 8 },

  actionBtn: {
    flex: 1,
    backgroundColor: "#0b74ff",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    marginRight: 8,
  },
  actionBtnAlt: {
    backgroundColor: "#22c55e",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    flex: 1,
  },
  actionText: { color: "#fff", fontWeight: "bold" },
  actionTextAlt: { color: "#fff", fontWeight: "700" },

  disabledBtn: { opacity: 0.45 },

  // modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "#0e0f26", borderRadius: 18, width: "92%", maxHeight: "90%", padding: 14 },
  closeButton: { alignSelf: "flex-end", padding: 6 },
  modalTitle: { fontSize: 20, fontWeight: "900", color: "#fff" },
  modalMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  modalPrize: { color: "#fff", fontWeight: "800" },
  modalInfo: { color: "#cbd5e1" },

  tabRow: { flexDirection: "row", marginTop: 12 },
  tabBtn: { flex: 1, padding: 8, borderRadius: 10, alignItems: "center", marginRight: 6, backgroundColor: "#121227" },
  tabActive: { backgroundColor: "#1f2937" },
  tabText: { color: "#9ca3af", fontWeight: "700" },
  tabTextActive: { color: "#fff", fontWeight: "900" },

  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#ff7ab6", marginTop: 12 },
  infoText: { color: "#d1d5db", marginTop: 8 },

  buttonRow: { flexDirection: "row", marginTop: 12, gap: 8 },
  registerBtn: { flex: 1, backgroundColor: "#0b74ff", padding: 12, borderRadius: 10, alignItems: "center", marginRight: 6 },
  rebuyBtn: { flex: 1, backgroundColor: "#059669", padding: 12, borderRadius: 10, alignItems: "center", marginLeft: 6 },
  btnText: { color: "#fff", fontWeight: "900" },
  btnTextAlt: { color: "#fff", fontWeight: "700" },

  // leaderboard table
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#2b2b3a", paddingBottom: 6, marginTop: 10 },
  tableRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#12121a", alignItems: "center" },
  tableColSmall: { width: 32, color: "#fff", fontWeight: "700" },
  tableCol: { flex: 1, color: "#fff" },
  pinnedRow: { backgroundColor: "rgba(34,211,238,0.06)", padding: 10, borderRadius: 10, marginBottom: 8, flexDirection: "row", alignItems: "center" },
  pinnedCol: { color: "#fff", fontWeight: "900" },

  currentRowHighlight: { backgroundColor: "rgba(34,197,94,0.06)" },

  balanceLightBlue: { color: "#7dd3fc", fontWeight: "700" },
  priceGreen: { color: "#86efac", fontWeight: "700" },

  headerText: { color: "#cbd5e1", fontWeight: "900" },
  adminSection: {
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  adminButton: {
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  adminButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    textShadowColor: "#0ea5e9",
    textShadowRadius: 8,
  },

  adminModalBox: {
    backgroundColor: "#10122b",
    padding: 20,
    borderRadius: 16,
    width: "85%",
    alignSelf: "center",
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },

  input: {
    backgroundColor: "#1c1f3a",
    color: "#fff",
    padding: 10,
    borderRadius: 8,
    marginVertical: 10,
  },

  modalBtnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  cancelBtn: {
    flex: 1,
    backgroundColor: "#6b7280",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginRight: 8,
  },

  confirmBtn: {
    flex: 1,
    backgroundColor: "#22c55e",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginLeft: 8,
  },

  // small utilities
  pinnedText: { color: "#fff", fontWeight: "900" },
});
