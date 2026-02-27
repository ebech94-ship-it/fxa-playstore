// TournamentScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { User } from "firebase/auth";
import CountryFlag from "react-native-country-flag";
import { verifyAdminAccess } from "../lib/adminAccess";

import { getAuth } from "firebase/auth";
import { useApp } from "./AppContext"; // <-- add this at the top


import {
  collection, doc, getDoc, limit, onSnapshot, orderBy, query
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert, FlatList, LayoutAnimation, Modal, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, UIManager, View,
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
type TournamentStatus = "upcoming" | "ongoing" | "finished";

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
   payoutStructure?: { rank: number; amount: number }[];
  participantsList?: any[];
  [key: string]: any;
};

interface LeaderboardUser {
  id: string;
  username?: string;
   countryCode?: string; 
  balance?: number;
  email?: string;
  [key: string]: any;
}
const getTournamentStatus = (
  startTime: number,
  endTime: number,
  now: number
): TournamentStatus => {
  if (now < startTime) return "upcoming";
  if (now <= endTime) return "ongoing";
  return "finished";
};
// ---------- Rank Tiers ----------
const RANK_TIERS = [
  { name: "🏆 Grand Champion", max: 3 },
  { name: "🔥 Elite Trader", max: 5 },
  { name: "⭐ Star Performer", max: 7 },
  { name: "🚀 Rising Trader", max: 10 },
  { name: "🌱 Active Trader", max: 15 },
  { name: "👤 Participant", max: 20 },
  { name: "💪 Novice", max: Infinity },
];

function getTierForRank(rank: number) {
  const tier = RANK_TIERS.find((t) => rank <= t.max);
  return tier ? tier.name : "💪 Novice"; // fallback
}

const getPrizeForRank = (
  rank: number,
  tournament: Tournament | null
): number | null => {
  if (!tournament?.payoutStructure) return null;

  const entry = tournament.payoutStructure.find(
   (p: any) => Number(p.rank) === Number(rank)

  );

  return entry ? Number(entry.amount) : null;
};


const NameWithFlag = ({
  username,
  countryCode,
}: {
  username: string;
  countryCode?: string;
}) => {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {countryCode ? (
        <CountryFlag isoCode={countryCode} size={16} />
      ) : null}
      <Text numberOfLines={1} style={{ color: "#fff" }}>
        {username}
      </Text>
    </View>
  );
};



export default function TournamentScreen({ currentUser }: TournamentScreenProps) {
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [now, setNow] = useState(new Date().getTime());
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  // live players list for the currently selected tournament (used for counts / participant preview)
const [players, setPlayers] = useState<any[]>([]);

const [tournamentCounts, setTournamentCounts] = useState<Record<string, number>>({});
const [tournamentRebuys, setTournamentRebuys] = useState<Record<string, number>>({});


  const [viewTab, setViewTab] = useState("info"); // "info" | "leaderboard"
  const [adminModal, setAdminModal] = useState(false);

  const [joinedMap, setJoinedMap] = useState<Record<string, boolean>>({});

  const [adminCode, setAdminCode] = useState("");
 type LoadingState = {
  register?: boolean;
  rebuy?: boolean;
};

const [loadingActions, setLoadingActions] = useState<
  Record<string, LoadingState>
>({});
// If you already have a context like useApp() that provides tournamentAccounts:
const { activeAccount,   isAdmin, adminLoaded, tournamentAccounts, profile } = useApp(); // or replace with your actual context

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

    // ✅ check once immediately
    getDoc(ref)
      .then((snap) => {
        setJoinedMap((prev) => ({
          ...prev,
          [t.id]: snap.exists(),
        }));
      })
      .catch((err) => console.error("Error fetching joined state:", err));

    // ✅ also listen for real-time changes
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

    const q = query(collection(db, "users"), orderBy("accounts.tournament.balance", "desc"), limit(30));
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
const q = query(playersRef, orderBy("balance", "desc")); // ✅ removed limit

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

useEffect(() => {
  if (!currentUser || !players.length || !selectedTournament) return;

  const joined = players.some(p => p.id === currentUser.uid);

  setJoinedMap(prev => ({
    ...prev,
    [selectedTournament.id]: joined,
  }));
}, [players, currentUser, selectedTournament]);


// ---------- REGISTER USER TO TOURNAMENT ----------
const handleRegister = async (tournamentId: string) => {
  // 🔒 PREVIEW MODE BLOCK
  if (profile?.preview) {
    Alert.alert(
      "Preview Mode",
      "You are in preview mode. Registration is temporary and will not affect real accounts."
    );
    // Do NOT return; allow registration to proceed
  }

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

  if (Date.now() > tour.endTime) {
    Alert.alert("Closed", "This tournament has already ended.");
    return;
  }

  const entryFee = Number(tour.entryFee ?? 0);
  if (isNaN(entryFee) || entryFee < 0) {
    Alert.alert("Error", "Invalid tournament entry fee.");
    return;
  }

  setLoadingFor(tournamentId, "register", true);

  try {
    const token = await user.getIdToken();

    const response = await fetch(
      "https://forexapp2-backend.onrender.com/tournament-register",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tournamentId,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Registration failed");
    }

    Alert.alert("Success", "Registered successfully!");
  } catch (error: any) {
    let message = "Registration failed.";

    if (error.message === "ALREADY_REGISTERED") {
      message = "You are already registered in this tournament.";
    } else if (error.message === "USER_NOT_FOUND") {
      message = "User profile not found.";
    } else if (error.message === "INSUFFICIENT_FUNDS") {
      message = "Insufficient balance to register.";
    } else if (error.message === "INVALID_WALLET") {
      message = "Wallet error. Contact support.";
    } else if (error.message) {
      message = error.message;
    }

    Alert.alert("Error", message);
  } finally {
    setLoadingFor(tournamentId, "register", false);
  }
};

// ----------- REBUY ACTION (CLEAN + BACKEND-MATCHED) -----------
// ----------- REBUY ACTION (SECURE BACKEND VERSION) -----------
const handleRebuy = async (tournamentId: string) => {
  // 🚫 DOUBLE TAP GUARD
  if (loadingActions[tournamentId]?.rebuy) return;

  if (!currentUser) {
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

  setLoadingFor(tournamentId, "rebuy", true);

  try {
    const token = await currentUser.getIdToken();

    const response = await fetch(
      "https://forexapp2-backend.onrender.com/tournament-rebuy",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // ✅ VERY IMPORTANT
        },
        body: JSON.stringify({
          tournamentId, // ✅ ONLY send tournamentId
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.message || "Server rejected the rebuy.");
    }

    Alert.alert("Rebuy Successful", "You have re-entered the tournament!");
  } catch (error: any) {
    Alert.alert("Rebuy Failed", error.message || "Could not complete rebuy.");
  } finally {
    setLoadingFor(tournamentId, "rebuy", false);
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
// New helper: formats milliseconds to human-readable like 2d 3h 15m
const formatCountdown = (ms: number) => {
  if (ms <= 0) return "0s";

  let seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / (3600 * 24));
  seconds %= 3600 * 24;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};
const formatFullDate = (ms: number) => {
  const date = new Date(ms);

  // Day with ordinal (1st, 2nd, 3rd, etc.)
  const day = date.getDate();
  const ordinal = day + 
    (day % 10 === 1 && day !== 11 ? "st" :
     day % 10 === 2 && day !== 12 ? "nd" :
     day % 10 === 3 && day !== 13 ? "rd" : "th");

  // Month full name
  const month = date.toLocaleString("en-US", { month: "long" });

  // Year
  const year = date.getFullYear();

  // Hours & minutes (24h format)
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${ordinal} ${month} ${year}, ${hours}:${minutes}`;

}; // Tournament card
 const TournamentCard = ({ item }: { item: Tournament }) => {
if (!item.startTime || !item.endTime) return null;

const status = getTournamentStatus(item.startTime, item.endTime, now);
 
  const duration = item.endTime - item.startTime;
  
const progress =
  status === "finished" || duration <= 0
    ? 1
    : Math.max(0, Math.min((now - item.startTime) / duration, 1));

 const durationText = formatDuration(duration);
  const rebuyFee = item.rebuyFee ?? item.entryFee ?? 0;

   // Step 4: Rebuy logic (fixed)
const tAccount = tournamentAccounts.find(t => t.tournamentId === item.id);

const currentBalance = tAccount?.balance ?? 0;
const initialBalance = tAccount?.initialBalance ?? item.startingBalance ?? 1000;

// only allow rebuy if:
// 1. user joined
// 2. tournament ongoing
// 3. current balance <= 50% of initial
// ✅ no external map required, cleaner logic

const allowRebuy =
  !!tAccount &&
  !!joinedMap[item.id] &&
  status === "ongoing" &&
  currentBalance < initialBalance / 2;
  // Step 5: Active tournament highlight
  const isActiveTournament =
  activeAccount.type === "tournament" && activeAccount.tournamentId === item.id;
  
  // color by status
  const tagStyle =
    status === "ongoing" ? styles.tagOngoing : status === "upcoming" ? styles.tagUpcoming : styles.tagPast;
 
  return (
    <TouchableOpacity
      activeOpacity={0.95}
      style={[styles.card, status === "ongoing" && styles.cardGlow]}
      onPress={() => {
        setSelectedTournament(item);
        setViewTab("info");
      }}
    >

      {/* STRONG BOLD TITLE */}
     <Text style={[styles.cardBigTitle, { color: isActiveTournament ? "#22c55e" : "rgba(236, 220, 220, 1)" }]}>
  {item.name}
</Text>


<Text style={styles.metaText}>Duration: {durationText}</Text>

      {/* STATUS TAG */}
      <View style={[styles.tag, tagStyle]}>
       <Text style={styles.tagText}>
  {status === "upcoming"
    ? "Upcoming"
    : status === "ongoing"
    ? "Ongoing"
    : "Past"}
</Text>

      </View>

      {/* PROGRESS BAR */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* PRIZE + ENTRY */}
      <View style={styles.cardPrizeRow}>
     <Text style={styles.cardPrizeText}>  🏆 Prize Pool: {item.prizePool ?? 0} $</Text>
          <Text style={styles.cardPrizeText}>🏆🏅 Top Ranked Winners:{item.payoutStructure?.length ?? 0}</Text>
            <Text style={styles.cardFeeText}>🎟 Entry Fee: {item.entryFee} $</Text>
        <Text style={styles.cardFeeText}>♻️ Rebuy: {item.rebuyFee ?? item.entryFee} $</Text>
<Text style={styles.cardFeeText}>💵 Starting Balance: {item.startingBalance ?? 0} $</Text> {/* ✅ new line */}
      </View>

      {/* LIVE STATS */}
      <View style={styles.cardStatsRow}>
      <Text style={styles.cardDetail}>
  {status === "upcoming"
    ? `⏳ Starts in ${formatCountdown(item.startTime - now)} (${formatFullDate(item.startTime)})`
    : status === "ongoing"
    ? `⏰ Ends in ${formatCountdown(item.endTime - now)} (${formatFullDate(item.endTime)})`
    : `🏁 Finished on ${formatFullDate(item.endTime)}`}
</Text>
        <Text style={styles.cardDetail}>👥 {tournamentCounts[item.id] ?? 0} Joined</Text>
        <Text style={styles.cardDetail}>♻️ {tournamentRebuys[item.id] ?? 0} Rebuys</Text>
   <Text style={styles.cardDetail}>🏅 Winners: {item.payoutStructure?.length ?? 0}</Text>
      </View>

      {/* ACTION BUTTONS */}
      <View style={styles.cardFooter}>
<TouchableOpacity
  style={[
    styles.actionBtn,
    (status === "finished" ||
      loadingActions[item.id]?.register ||
      joinedMap[item.id]) &&
      styles.disabledBtn,
  ]}
  disabled={
    status === "finished" ||
    !!loadingActions[item.id]?.register ||
    !!joinedMap[item.id]
  }
  onPress={() => handleRegister(item.id)}
>
  <Text style={styles.actionText}>
    {status === "finished"
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
    (status !== "ongoing" ||
 !joinedMap[item.id] ||
 !allowRebuy ||
 loadingActions[item.id]?.rebuy) &&
 styles.disabledBtn,
  ]}
  disabled={
  status !== "ongoing" ||
  !joinedMap[item.id] ||
  !allowRebuy ||
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
 
    return (
  <View style={styles.pinnedRow}>
    {/* "You" label */}
{/* Tier */}
<Text style={[styles.tableCol, styles.priceGreen, styles.pinnedCol]}>
  {(() => {
    const rank = list.findIndex((p) => p.id === currentUser?.uid) + 1;
    return getTierForRank(rank);
  })()}
</Text>

{/* Cash */}
<Text style={[styles.tableCol, { color: "#22c55e", fontWeight: "900" }]}>
  {(() => {
    if (!selectedTournament) return "-";
    const rank = list.findIndex((p) => p.id === currentUser?.uid) + 1;
    const prize = getPrizeForRank(rank, selectedTournament);
    return prize ? `${prize} $` : "-";
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
<Text style={[styles.tableCol, styles.headerText]}>Tier</Text>
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
            <View style={styles.tableCol}>
  <NameWithFlag
    username={row.username || row.email || "Player"}
    countryCode={row.countryCode}
  />
</View>

            <Text style={[styles.tableCol, styles.balanceLightBlue]}>{row.balance ?? 0}T</Text>
            
           {/* Tier */}
<Text style={[styles.tableCol, styles.priceGreen]}>
  {getTierForRank(i + 1)}
</Text>

{/* Cash Reward */}
<Text style={[styles.tableCol, { color: "#22c55e", fontWeight: "800" }]}>
  {(() => {
    if (!selectedTournament) return "-";
    const prize = getPrizeForRank(i + 1, selectedTournament);
    return prize ? `${prize} $` : "-";
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
  ListEmptyComponent={
    <Text
      style={{
        color: "#9ca3af",
        textAlign: "center",
        marginTop: 40,
      }}
    >
      No tournaments available yet.
    </Text>
  }
/>
      {/* admin button */}
{adminLoaded && isAdmin && (
  <View style={styles.adminSection}>
    <TouchableOpacity onPress={() => setAdminModal(true)}>
      <LinearGradient
        colors={["#7c3aed", "#0ea5e9"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.adminButton}
      >
        <Text style={styles.adminButtonText}>
          👑 Administrator Access
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  </View>
)}
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
              <TouchableOpacity
  style={styles.confirmBtn} onPress={() => verifyAdminAccess(   adminCode, router, () => setAdminModal(false), // success
      () => {} // failure (optional)
                     )
                    }
                      >

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
              <View>
                <Text style={styles.modalTitle}>
  {selectedTournament.title || selectedTournament.name || "Tournament"} </Text>
                           
                                <View style={styles.modalMetaRow}>
  <Text style={styles.modalPrize}>
  🏆 Prize Pool: {selectedTournament.prizePool ?? 0} $
</Text>
  <Text style={styles.modalInfo}>
    ⏰ {formatTime(selectedTournament.endTime - now)}
  </Text>
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

              <ScrollView  showsVerticalScrollIndicator={false}>
                  {viewTab === "info" ? (
                    <View>
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
  <View>
    {/*<Text style={styles.sectionTitle}>🏆 Prize Distribution</Text>*/}
<Text style={styles.sectionTitle}>🏆 RANKINGS </Text>
<View style={{
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: 8,
  borderBottomWidth: 1,
  borderBottomColor: "#2b2b3a",
  paddingBottom: 6
}}>
  <Text style={{ color: "#94a3b8", fontWeight: "900", flex: 1 }}>
    Position
  </Text>
  <Text style={{ color: "#94a3b8", fontWeight: "900", flex: 1, textAlign: "center" }}>
    Tier
  </Text>
  <Text style={{ color: "#94a3b8", fontWeight: "900", flex: 1, textAlign: "right" }}>
    Prize
  </Text>
</View>

    {selectedTournament.payoutStructure.map((p: any) => (
      <View
  key={p.rank}
  style={{
    flexDirection: "row",
    marginTop: 8,
    alignItems: "center"
  }}
>
  <Text style={{ color: "#cbd5e1", flex: 1 }}>
    {p.rank === 1 ? "🥇" :
     p.rank === 2 ? "🥈" :
     p.rank === 3 ? "🥉" :
     `#${p.rank}`}
  </Text>

  <Text style={{ color: "#facc15", fontWeight: "800", flex: 1, textAlign: "center" }}>
    {getTierForRank(p.rank)}
  </Text>

  <Text style={{ color: "#22c55e", fontWeight: "900", flex: 1, textAlign: "right" }}>
    {p.amount} $
  </Text>
</View>
        
    ))}
  </View>
) : null}

                    </View>
                  ) : (
                    <View>
                      <Text style={styles.sectionTitle}>🏆 Live Leaderboard</Text>
                      <LeaderboardTable list={leaderboard} />
                    </View>
                  )}
                </ScrollView>
              </View>
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
  modalPrize: { color: "#47f11dff", fontWeight: "800" },
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
  balanceLightBlue: { color: "#38bdf8" , fontWeight: "700" }, priceGreen: { color: "#facc15", fontWeight: "700" },

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
