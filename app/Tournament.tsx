// TournamentScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { User } from "firebase/auth";

import { getAuth } from "firebase/auth";

import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
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
  entryFee?: number;
  rebuyFee?: number;
  prizePool?: number;
  prize?: number;
  participantsList?: any[];
  [key: string]: any;
};

interface LeaderboardUser {
  id: string;
  username?: string;
  balance?: number;
  email?: string;
  [key: string]: any;
}

const getPrizeForRank = (
  rank: number,
  tournament: Tournament | null
): number | null => {
  if (!tournament?.payoutStructure) return null;

  const entry = tournament.payoutStructure.find(
    (p: any) => p.rank === rank
  );

  return entry ? Number(entry.amount) : null;
};

export default function TournamentScreen({ currentUser }: TournamentScreenProps) {
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [now, setNow] = useState(new Date().getTime());
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  // live players list for the currently selected tournament (used for counts / participant preview)
const [players, setPlayers] = useState<any[]>([]);
// 🔥 Live participant counts for each tournament
const myPlayer = selectedTournament
  ? players.find((p) => p.id === currentUser?.uid)
  : null;


const [tournamentCounts, setTournamentCounts] = useState<Record<string, number>>({});
const [tournamentRebuys, setTournamentRebuys] = useState<Record<string, number>>({});

  const [viewTab, setViewTab] = useState("info"); // "info" | "leaderboard"
  const [adminModal, setAdminModal] = useState(false);
  const modalFee = Number(selectedTournament?.entryFee ?? 0);
  const [joinedMap, setJoinedMap] = useState<Record<string, boolean>>({});
const modalStatus = (() => {
  if (!selectedTournament) return "Upcoming";
  if (now < selectedTournament.startTime) return "Upcoming";
  if (now <= selectedTournament.endTime) return "Ongoing";
  return "Past";
})();


const modalRebuyFee = selectedTournament?.rebuyFee ?? modalFee;
const startingBalance = Number(selectedTournament?.startingBalance ?? 0);

const currentBalance =
  typeof myPlayer?.balance === "number"
    ? myPlayer.balance
    : startingBalance;

const canRebuy =
  modalStatus === "Ongoing" &&
  !!selectedTournament &&
  !!joinedMap[selectedTournament.id] &&
  currentBalance <= startingBalance * 0.5;



  const [adminCode, setAdminCode] = useState("");
 type LoadingState = {
  register?: boolean;
  rebuy?: boolean;
};

const [loadingActions, setLoadingActions] = useState<
  Record<string, LoadingState>
>({});

  const router = useRouter();

  const setLoadingFor = (
  tournamentId: string,
  action: "register" | "rebuy",
  value: boolean
) => {
  setLoadingActions((prev) => ({
    ...prev,
    [tournamentId]: {
      ...prev[tournamentId],
      [action]: value,
    },
  }));
};


  // tick every second for countdowns
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date().getTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ✅ TOURNAMENTS LISTENER (for all tournaments list)
  useEffect(() => {
    const q = query(collection(db, "tournaments"), orderBy("createdAt", "desc"));
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


 useEffect(() => {
  if (!currentUser || tournaments.length === 0) return;

  const unsubs: (() => void)[] = [];

  tournaments.forEach((t) => {
    const ref = doc(db, "tournaments", t.id, "players", currentUser.uid);

    const unsub = onSnapshot(ref, (snap) => {
      setJoinedMap((prev) => ({
        ...prev,
        [t.id]: snap.exists(),
      }));
    });

    unsubs.push(unsub);
  });

  return () => {
    unsubs.forEach((u) => u());
  };
}, [tournaments, currentUser]);



useEffect(() => {
  if (tournaments.length === 0) return;

  const unsubscribers: (() => void)[] = [];

  tournaments.forEach((t) => {
    const ref = collection(db, "tournaments", t.id, "players");

    const unsub = onSnapshot(ref, (snap) => {
     let rebuyTotal = 0;

snap.docs.forEach((d) => {
  const data = d.data();
  const count = Array.isArray(data.rebuys) ? data.rebuys.length : 0;
  rebuyTotal += count;
});

      setTournamentCounts((prev) => ({
        ...prev,
        [t.id]: snap.size, // participant count
      }));

      setTournamentRebuys((prev) => ({
        ...prev,
        [t.id]: rebuyTotal, // total rebuys
      }));
    });

    unsubscribers.push(unsub);
  });

  return () => unsubscribers.forEach((u) => u());
}, [tournaments]);


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
  
  useEffect(() => {
  if (!tournamentId || tournaments.length === 0) return;

  const found = tournaments.find((t) => t.id === tournamentId);
  if (found) {
    setSelectedTournament(found);
    setViewTab("info");
  }
}, [tournamentId, tournaments]);
useEffect(() => {
  if (!selectedTournament?.id) return;

  const ref = collection(
    db,
    "tournaments",
    selectedTournament.id,
    "players"
  );

  const unsub = onSnapshot(ref, (snap) => {
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    setPlayers(list);
  });

  return () => unsub();
}, [selectedTournament?.id]);



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
  // 🚫 DOUBLE TAP GUARD
if (loadingActions[tournamentId]?.register) return;

  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    Alert.alert("Error", "You must be logged in to register.");
    return;
  }

  const tour = tournaments.find((t) => t.id === tournamentId);
  if (!tour) {
    Alert.alert("Error", "Tournament not found.");
    return;
  }

  const entryFee = Number(tour.entryFee ?? 0);
  if (isNaN(entryFee) || entryFee < 0) {
    Alert.alert("Error", "Invalid tournament entry fee.");
    return;
  }

 setLoadingFor(tournamentId, "register", true);

  try {
    const userDocRef = doc(db, "users", user.uid);

    // ✅ MUST MATCH FIRESTORE RULES
    const participantRef = doc(
      db,
      "tournaments",
      tournamentId,
      "players",
      user.uid
    );

    await runTransaction(db, async (transaction) => {
  const userSnap = await transaction.get(userDocRef);
  const participantSnap = await transaction.get(participantRef);

  if (participantSnap.exists()) {
    throw new Error("ALREADY_REGISTERED");
  }

  if (!userSnap.exists()) {
    throw new Error("USER_NOT_FOUND");
  }

  const username = userSnap.data()?.username ?? "Unknown";

  const rawWallet = userSnap.data()?.walletBalance;
  const walletBalance = Number(rawWallet ?? 0);

  if (isNaN(walletBalance)) {
    throw new Error("INVALID_WALLET");
  }

  if (entryFee > 0 && walletBalance < entryFee) {
    throw new Error("INSUFFICIENT_FUNDS");
  }

  const startingBalance = Number(tour.startingBalance);
  const finalStartingBalance = isNaN(startingBalance) ? 1000 : startingBalance;

  // ✅ CREATE PARTICIPANT
  transaction.set(participantRef, {
    uid: user.uid,
    username,
    balance: finalStartingBalance,
    joinedAt: serverTimestamp(),
    rebuys: [],
  });

  // ✅ SINGLE USER UPDATE (VERY IMPORTANT)
  transaction.set(
  userDocRef,
  {
    walletBalance: entryFee > 0 ? walletBalance - entryFee : walletBalance,
    accounts: {
      tournament: {
        balance: finalStartingBalance,
        initialBalance: finalStartingBalance,
        activeTournament: tournamentId,
      },
    },
  },
  { merge: true }
);

});

 // ✅✅✅ CLOSE runTransaction HERE

Alert.alert("Success", "You have successfully registered!");
// ✅ FORCE UI UPDATE IMMEDIATELY
setJoinedMap((prev) => ({
  ...prev,
  [tournamentId]: true,
}));

 } catch (err: any) {
  console.error("REGISTRATION ERROR:", err);

  if (err?.message === "ALREADY_REGISTERED") {
    Alert.alert("Already Registered", "You are already registered.");

  } else if (err?.message === "USER_NOT_FOUND") {
    Alert.alert("Error", "User account not found.");

  } else if (err?.message === "INSUFFICIENT_FUNDS") {
    Alert.alert("Insufficient Funds", "Not enough balance.");

  } else if (err?.message === "INVALID_WALLET") {
    Alert.alert(
      "Account Error",
      "Your wallet data is invalid. Please contact support."
    );

  } else {
    Alert.alert("Error", "Registration failed. Try again.");
  }
} finally {
  setLoadingFor(tournamentId, "register", false);
}
  
};

// ----------- REBUY ACTION (CLEAN + CORRECT + SAFE) -----------
const handleRebuy = async (tournamentId: string) => {
  // 🚫 DOUBLE TAP GUARD
  if (loadingActions[tournamentId]?.rebuy) return;

  if (!currentUser?.uid) {
    Alert.alert("Error", "You must be logged in.");
    return;
  }

  const tour = tournaments.find((t) => t.id === tournamentId);
  if (!tour) {
    Alert.alert("Error", "Tournament not found.");
    return;
  }

  const now = Date.now();
  if (now > tour.endTime) {
    Alert.alert("Rebuy Closed", "This tournament has already ended.");
    return;
  }

  const rebuyCost = Number(tour.rebuyFee ?? tour.entryFee ?? 0);

  // 🔥 TURN LOADING ON (ONLY ONCE)
  setLoadingFor(tournamentId, "rebuy", true);

  try {
    const playerRef = doc(
      db,
      `tournaments/${tournamentId}/players`,
      currentUser.uid
    );

    const playerSnap = await getDoc(playerRef);

    if (!playerSnap.exists()) {
      Alert.alert("Not Registered", "Register before performing a rebuy.");
      return;
    }

    const wallet = await getUserWalletBalance(currentUser.uid);

    if (wallet < rebuyCost) {
      Alert.alert(
        "Insufficient Funds",
        `Wallet: ${wallet} — Required: ${rebuyCost}`
      );
      return;
    }

    // 🌐 CALL BACKEND (TREASURY LOGIC)
    const response = await fetch(
      "https://forexapp2-backend.onrender.com/tournament-rebuy",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.uid,
          tournamentId,
          amount: rebuyCost,
        }),
      }
    );

    const result = await response.json().catch(() => null);

    if (!response.ok || result?.success === false) {
      Alert.alert(
        "Rebuy Failed",
        result?.message || "Server rejected the rebuy."
      );
      return;
    }

    // 🔁 ADD TO PLAYER BALANCE + TRACK REBUY
const startingBalance = Number(tour.startingBalance);
const currentBalance = Number(playerSnap.data()?.balance ?? 0);
const newBalance =
  currentBalance + (isNaN(startingBalance) ? 1000 : startingBalance);

await updateDoc(playerRef, {
  balance: newBalance,
  rebuys: arrayUnion({
    at: Date.now(),
    amount: isNaN(startingBalance) ? 1000 : startingBalance,
    createdAt: serverTimestamp(),
  }),
});

await updateDoc(doc(db, "users", currentUser.uid), {
  "accounts.tournament.balance": newBalance,
});

    Alert.alert("Rebuy Successful", "You have re-entered the tournament!");
  } catch (error) {
    console.error("REBUY ERROR:", error);
    Alert.alert("Error", "Could not complete rebuy. Try again.");
  } finally {
    // ✅ SINGLE SOURCE OF TRUTH
    setLoadingFor(tournamentId, "rebuy", false);
  }
};



  const handleAccess = () => {
    const correctCode = "FOREXADMIN2025"; // change this anytime
    if (adminCode.trim() === correctCode) {
      setAdminModal(false);
      Alert.alert("✅ Access Granted", "Welcome Administrator!");
      router.push("/admin/AdminDashboard"); // navigate directly to your Admin Dashboard screen
    } else {
      Alert.alert("⛔ Access Denied", "Incorrect admin code.");
    }
  };

  const formatDuration = (ms: number) => {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  const week = Math.floor(day / 7);
  const month = Math.floor(day / 30);

  if (month >= 1) return `${month} month${month > 1 ? "s" : ""}`;
  if (week >= 1) return `${week} week${week > 1 ? "s" : ""}`;
  if (day >= 1) return `${day} day${day > 1 ? "s" : ""}`;
  if (hour >= 1) return `${hour} hour${hour > 1 ? "s" : ""}`;
  if (min >= 1) return `${min} minute${min > 1 ? "s" : ""}`;

  return `${sec} second${sec > 1 ? "s" : ""}`;
};

  // Tournament card
 const TournamentCard = ({ item }: { item: Tournament }) => {
  const status =
    now < item.startTime ? "Upcoming" : now <= item.endTime ? "Ongoing" : "Past";
  const timeLeft = status === "Past" ? 0 : item.endTime - now;
  const duration = item.endTime - item.startTime;
  
const progress =
  status === "Past" || duration <= 0
    ? 1
    : Math.max(0, Math.min((now - item.startTime) / duration, 1));

 const durationText = formatDuration(duration);
  const rebuyFee = item.rebuyFee ?? item.entryFee ?? 0;
  
  // color by status
  const tagStyle =
    status === "Ongoing" ? styles.tagOngoing : status === "Upcoming" ? styles.tagUpcoming : styles.tagPast;

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      style={[styles.card, status === "Ongoing" && styles.cardGlow]}
      onPress={() => {
        setSelectedTournament(item);
        setViewTab("info");
      }}
    >

      {/* STRONG BOLD TITLE */}
      <Text style={styles.cardBigTitle}>{item.name}</Text>

<Text style={styles.metaText}>Duration: {durationText}</Text>

      {/* STATUS TAG */}
      <View style={[styles.tag, tagStyle]}>
        <Text style={styles.tagText}>{status}</Text>
      </View>

      {/* PROGRESS BAR */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* PRIZE + ENTRY */}
      <View style={styles.cardPrizeRow}>
        <Text style={styles.cardPrizeText}>🏆 Prize Pool: {item.prizePool} $</Text>
        <Text style={styles.cardFeeText}>🎟 Entry Fee: {item.entryFee} $</Text>
        <Text style={styles.cardFeeText}>♻️ Rebuy: {item.rebuyFee ?? item.entryFee} $</Text>
<Text style={styles.cardFeeText}>💵 Starting Balance: {item.startingBalance ?? 0} $</Text> {/* ✅ new line */}
      </View>

      {/* LIVE STATS */}
      <View style={styles.cardStatsRow}>
      <Text style={styles.cardDetail}>⏰ Ends in {formatTime(timeLeft)}</Text>
        <Text style={styles.cardDetail}>👥 {tournamentCounts[item.id] ?? 0} Joined</Text>
        <Text style={styles.cardDetail}>♻️ {tournamentRebuys[item.id] ?? 0} Rebuys</Text>
   <Text style={styles.cardDetail}>🏅 Winners: {item.payoutStructure?.length ?? 0}</Text>
      </View>

      {/* ACTION BUTTONS */}
      <View style={styles.cardFooter}>
<TouchableOpacity
  style={[
    styles.actionBtn,
    (status === "Past" ||
      loadingActions[item.id]?.register ||
      joinedMap[item.id]) &&
      styles.disabledBtn,
  ]}
  disabled={
    status === "Past" ||
    !!loadingActions[item.id]?.register ||
    !!joinedMap[item.id]
  }
  onPress={() => handleRegister(item.id)}
>
  <Text style={styles.actionText}>
    {status === "Past"
      ? "Closed"
      : joinedMap[item.id]
      ? "You're In"
      : loadingActions[item.id]?.register
      ? "Processing..."
      : item.entryFee === 0
      ? "Register (Free)"
      : `Register (${item.entryFee} $)`}
  </Text>
</TouchableOpacity>

<TouchableOpacity
  style={[
    styles.actionBtnAlt,
    (status !== "Ongoing" ||
 !joinedMap[item.id] ||
 !canRebuy ||
 loadingActions[item.id]?.rebuy) &&
 styles.disabledBtn,
  ]}
  disabled={
  status !== "Ongoing" ||
  !joinedMap[item.id] ||
  !canRebuy ||
  !!loadingActions[item.id]?.rebuy
}
  onPress={() => handleRebuy(item.id)}
>
  <Text style={styles.actionTextAlt}>
    {loadingActions[item.id]?.rebuy
      ? "..."
      : rebuyFee === 0
      ? "Rebuy (Free)"
      : `Rebuy • ${rebuyFee} $`}
  </Text>
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
  {(() => {
    if (!selectedTournament) return "-";

    const rank = list.findIndex((p) => p.id === me.id) + 1;
    const prize = getPrizeForRank(rank, selectedTournament);

    return prize ? `$${prize}` : "-";
  })()}
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
  {(() => {
    if (!selectedTournament) return "-";

    const prize = getPrizeForRank(i + 1, selectedTournament);
    return prize ? `$${prize}` : "-";
  })()}
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
                <Text style={styles.modalTitle}>
  {selectedTournament.title || selectedTournament.name || "Tournament"} </Text>
                <View style={styles.modalMetaRow}>
                  <Text style={styles.modalPrize}>💰 {selectedTournament.prizePool}</Text>
                  <Text style={styles.modalInfo}>⏰ {formatTime(selectedTournament.endTime - now)}</Text>
                </View>
{/* participants */}
<Text style={styles.modalInfo}>
  👥 {players.length} participants
</Text>

{/* rebuy count */}
<Text style={styles.modalInfo}>
  ♻️ Rebuys: {tournamentRebuys[selectedTournament.id] ?? 0}
</Text>

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
                       {selectedTournament.onRegisterInfo || 
                `You get a starting demo balance of ${selectedTournament.startingBalance ?? 0} $ and leaderboard entry.`} {/* ✅ updated */}
                   </Text>
{selectedTournament.payoutStructure?.length ? (
  <>
    <Text style={styles.sectionTitle}>🏆 Prize Distribution</Text>

    {selectedTournament.payoutStructure.map((p: any) => (
      <View
        key={p.rank}
        style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}
      >
        <Text style={{ color: "#cbd5e1" }}>
          {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : `#${p.rank}`}
          {" "}Place
        </Text>
        <Text style={{ color: "#86efac", fontWeight: "800" }}>
          ${p.amount}
        </Text>
      </View>
    ))}
  </>
) : null}


{/* REGISTER BUTTON */}
{/* REGISTER BUTTON */}
<View style={styles.buttonRow}>
  <TouchableOpacity
    style={[
      styles.registerBtn,
      (loadingActions[selectedTournament.id]?.register ||
        joinedMap[selectedTournament.id]) &&
        styles.disabledBtn,
    ]}
    onPress={() => handleRegister(selectedTournament.id)}
    disabled={
      loadingActions[selectedTournament.id]?.register ||
      joinedMap[selectedTournament.id]
    }
  >
    <Text style={styles.btnText}>
      {joinedMap[selectedTournament.id]
        ? "You're In"
        : loadingActions[selectedTournament.id]?.register
        ? "Processing..."
        : modalFee === 0
        ? "Register (Free)"
        : `Register • ${modalFee} $`}
    </Text>
  </TouchableOpacity>



  {/* REBUY BUTTON */}
  <TouchableOpacity
  style={[
    styles.rebuyBtn,
    (!canRebuy || loadingActions[selectedTournament.id]?.rebuy) &&
      styles.disabledBtn,
  ]}
  disabled={!canRebuy || !!loadingActions[selectedTournament.id]?.rebuy}
  onPress={() => handleRebuy(selectedTournament.id)}
>

    <Text style={styles.btnTextAlt}>
      {loadingActions[selectedTournament.id]?.rebuy
        ? "Processing..."
        : modalRebuyFee === 0
        ? "Rebuy (Free)"
        : `Rebuy • ${modalRebuyFee} $`}
    </Text>
  </TouchableOpacity>
</View>

{(loadingActions[selectedTournament.id]?.register ||
  loadingActions[selectedTournament.id]?.rebuy) && (
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
  card: { backgroundColor: "#12122a",  padding: 14,  marginVertical: 8,  borderRadius: 14,  shadowColor: "#000",
  shadowOpacity: 0.6,  shadowRadius: 10,  elevation: 6,  borderWidth: 1,  borderColor: "rgba(255,255,255,0.03)",},
  cardGlow: {  shadowColor: "#32d3ff",  shadowOpacity: 0.9,  shadowRadius: 16,},
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  tag: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 },
  tagText: { color: "#fff", fontWeight: "700", fontSize: 12 }, tagOngoing: { backgroundColor: "#16a34a" },
  tagUpcoming: { backgroundColor: "#7c3aed" }, tagPast: { backgroundColor: "#b91c1c" },
progressBar: { height: 8, backgroundColor: "#0b1020", borderRadius: 6, overflow: "hidden", marginTop: 10 },
  progressFill: { height: "100%", backgroundColor: "#3b82f6" },
cardRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },cardDetail: { color: "#c7c7d9" },
cardFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, gap: 8 },

  actionBtn: {  flex: 1,  backgroundColor: "#0b74ff",  padding: 10,  borderRadius: 10,  alignItems: "center",
  marginRight: 8, },
  actionBtnAlt: {  backgroundColor: "#22c55e",  padding: 10,  borderRadius: 10,  alignItems: "center",  flex: 1, },
  actionText: { color: "#fff", fontWeight: "bold" }, actionTextAlt: { color: "#fff", fontWeight: "700" },
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
  balanceLightBlue: { color: "#7dd3fc", fontWeight: "700" }, priceGreen: { color: "#86efac", fontWeight: "700" },

  headerText: { color: "#cbd5e1", fontWeight: "900" },
  adminSection: { marginTop: 10, alignItems: "center", justifyContent: "center",  },

  adminButton: { paddingVertical: 14, paddingHorizontal: 30, borderRadius: 12, shadowColor: "#7c3aed", shadowOpacity: 0.8,
 shadowRadius: 15, elevation: 10, alignItems: "center", justifyContent: "center",},

  adminButtonText: { color: "#fff",  fontWeight: "900",  fontSize: 16,  textShadowColor: "#0ea5e9",  textShadowRadius: 8,
  },
  adminModalBox: {  backgroundColor: "#10122b",  padding: 20,  borderRadius: 16,  width: "85%",  alignSelf: "center",
  shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 10,},
  input: { backgroundColor: "#1c1f3a", color: "#fff", padding: 10, borderRadius: 8, marginVertical: 10, },

  modalBtnRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10,  },

  cancelBtn: { flex: 1, backgroundColor: "#6b7280", padding: 12, borderRadius: 10, alignItems: "center", marginRight: 8,
  },
confirmBtn: {  flex: 1,  backgroundColor: "#22c55e",  padding: 12,  borderRadius: 10,  alignItems: "center",  marginLeft: 8,
  },
  // small utilities
  pinnedText: { color: "#fff", fontWeight: "900" },
  cardBigTitle: { fontSize: 20, fontWeight: "900", color: "rgba(236, 220, 220, 1)", marginBottom: 6,},
metaText: {color: "#aaa", fontSize: 13, marginTop: 4,},

cardPrizeRow: { marginTop: 8, marginBottom: 6,},

cardPrizeText: { color: "#facc15", fontWeight: "bold", fontSize: 16,},

cardFeeText: { color: "#60a5fa", fontWeight: "bold", fontSize: 15,},

cardStatsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8,},
startingBalanceText: { color: "#22c55e", fontWeight: "700", fontSize: 14, marginTop: 4 },

});
