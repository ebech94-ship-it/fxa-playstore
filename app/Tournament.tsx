// TournamentScreen.tsx
import { Ionicons } from "@expo/vector-icons";

import { useLocalSearchParams } from "expo-router";
import type { User } from "firebase/auth";
import CountryFlag from "react-native-country-flag";


import { getAuth } from "firebase/auth";
import { useApp } from "./AppContext"; // <-- add this at the top


import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Alert, FlatList,
  KeyboardAvoidingView,
  LayoutAnimation, Modal, Platform, Pressable, ScrollView, StyleSheet,
  Text, TouchableOpacity, UIManager, View
} from "react-native";
import { db } from "../firebaseConfig";

// enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}


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

const [tournamentCounts, setTournamentCounts] = useState<Record<string, number>>({});
const [tournamentRebuys, setTournamentRebuys] = useState<Record<string, number>>({});


  const [viewTab, setViewTab] = useState("info"); // "info" | "leaderboard"
  
type LoadingState = {
  register?: boolean;
  rebuy?: boolean;
  rebuyDone?: boolean;
};

const [loadingActions, setLoadingActions] = useState<
  Record<string, LoadingState>
>({});
const [participantMap] = useState<Record<string, any>>({});
// If you already have a context like useApp() that provides tournamentAccounts:
const { balances, joinedMap,  profile } = useApp(); // or replace with your actual context



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
// ---------- TIMER ----------
useEffect(() => {
  const interval = setInterval(() => {
    setNow(Date.now());
  }, 1000);

  return () => clearInterval(interval);
}, []);


// ---------- TOURNAMENTS + DEEPLINK AUTO SELECT ----------
useEffect(() => {
  const q = query(
    collection(db, "tournaments"),
    orderBy("createdAt", "desc")
  );

  const unsub = onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Tournament, "id">),
    })) as Tournament[];

    setTournaments(list);

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    // ✅ FIX: remove selectedTournament dependency issue
    if (tournamentId) {
      const match = list.find((t) => t.id === tournamentId);

      if (match) {
        setSelectedTournament((prev) => {
          // prevent unnecessary state updates
          if (prev?.id === match.id) return prev;
          return match;
        });

        setViewTab("info");
      }
    }
  });

  return () => unsub();
}, [tournamentId]); // ✅ ONLY tournamentId



// ---------- SELECTED TOURNAMENT LIVE ENGINE (STATS + LEADERBOARD MERGED) ----------
useEffect(() => {
  if (!tournaments.length) return;

  const unsubs: (() => void)[] = [];

  tournaments.forEach((t) => {
    const ref = collection(
      db,
      "tournaments",
      t.id,
      "participants"
    );

    const unsub = onSnapshot(ref, (snap) => {
      let rebuyTotal = 0;

      snap.docs.forEach((d) => {
        rebuyTotal += d.data()?.rebuys?.length ?? 0;
      });

      setTournamentCounts(prev => ({
        ...prev,
        [t.id]: snap.size,
      }));

      setTournamentRebuys(prev => ({
        ...prev,
        [t.id]: rebuyTotal,
      }));
    });

    unsubs.push(unsub);
  });

  return () => unsubs.forEach(u => u());
}, [tournaments]);

// ---------- GLOBAL LEADERBOARD ----------
useEffect(() => {
  if (!selectedTournament?.id) {
    setLeaderboard([]);
    return;
  }

  const ref = collection(
    db,
    "tournaments",
    selectedTournament.id,
    "participants"
  );

  const unsub = onSnapshot(ref, (snap) => {
    const rows = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as any),
    }));

    

    setLeaderboard(rows);
  });

  return () => unsub();
}, [selectedTournament?.id]);

// ---------- REGISTER USER TO TOURNAMENT ----------
const handleRegister = async (tournamentId: string) => {
  if (profile?.preview) {
    Alert.alert(
      "Preview Mode",
      "You are in preview mode. Registration will not affect real accounts."
    );
    return;
  }

  if (loadingActions[tournamentId]?.register) return;

  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    Alert.alert("Error", "You must be logged in.");
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

  setLoadingFor(tournamentId, "register", true);

  try {
    const token = await user.getIdToken();

    const response = await fetch(
      "https://forexapp2-backend.onrender.com/tournament/register",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tournamentId }),
      }
    );

    const text = await response.text();

console.log("REGISTER STATUS:", response.status);
console.log("REGISTER RESPONSE:", text);
    
    if (!response.ok) {
      throw new Error(text || "Registration failed");
    }

    Alert.alert("Success", "Successfully joined tournament!");

setTournamentCounts(prev => ({
  ...prev,
  [tournamentId]: (prev[tournamentId] ?? 0) + 1,
}));
    // 🔥 SIMPLE STATE UPDATE (CORRECT FOR YOUR STRUCTURE)
   // refresh UI count locally (optional optimistic update)

  } catch (error: any) {
    Alert.alert("Error", error.message || "Registration failed.");
  } finally {
    setLoadingFor(tournamentId, "register", false);
  }
};

// ----------- REBUY ACTION (SECURE BACKEND VERSION) -----------
const handleRebuy = async (tournamentId: string) => {
  if (loadingActions[tournamentId]?.rebuy) return;

   // 🔥 ADD THIS PRE-CHECK HERE
  const tour = tournaments.find(t => t.id === tournamentId);
  
  const myAccount = participantMap[currentUser?.uid || ""];

  if (tour && myAccount) {
    const currentBalance = myAccount.balance ?? 0;
    const initialBalance = tour.startingBalance ?? 0;

    if (currentBalance >= initialBalance * 0.5) {
      Alert.alert(
        "Rebuy Locked",
        "You can only rebuy when your balance drops below 50%."
      );
      return;
    }
  }
  setLoadingActions(prev => ({
    ...prev,
    [tournamentId]: {
      ...prev[tournamentId],
      rebuy: true,
      rebuyDone: false,
    },
  }));

  try {
    const auth = getAuth();
const user = auth.currentUser;
console.log("AUTH USER", user?.uid);
console.log("PROP USER", currentUser?.uid);
if (!user) {
  throw new Error("You must be logged in.");
}

   const token = await user.getIdToken(true);

    console.log("🔥 REBUY REQUEST START");

    const response = await fetch(
      "https://forexapp2-backend.onrender.com/tournament/rebuy",
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

    const text = await response.text();

    console.log("🔥 REBUY STATUS:", response.status);
    console.log("🔥 REBUY RESPONSE:", text);

    let result: any = {};

    try {
      result = JSON.parse(text);
    } catch {}

    if (!response.ok) {
      throw new Error(
        result?.error ||
        result?.message ||
        text ||
        "Rebuy failed"
      );
    }

    if (!response.ok) {
  const errorMsg =
    result?.error === "REBUY_NOT_ALLOWED"
      ? "Rebuy not allowed yet (balance must drop below 50%)."
      : result?.error === "Insufficient balance"
      ? "Not enough wallet balance."
      : result?.error || "Rebuy failed";

  throw new Error(errorMsg);
}

Alert.alert("Success", "Rebuy successful!");

   

    setLoadingActions(prev => ({
      ...prev,
      [tournamentId]: {
        ...prev[tournamentId],
        rebuy: false,
        rebuyDone: true,
      },
    }));
  } catch (error: any) {
    console.log("🔥 REBUY ERROR:", error);

    Alert.alert(
      "Rebuy Failed",
      error?.message || "Unknown error"
    );

    setLoadingActions(prev => ({
      ...prev,
      [tournamentId]: {
        ...prev[tournamentId],
        rebuy: false,
        rebuyDone: false,
      },
    }));
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

  const totalSeconds = Math.floor(ms / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0)
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;

  if (hours > 0)
    return `${hours}h ${minutes}m ${seconds}s`;

  if (minutes > 0)
    return `${minutes}m ${seconds}s`;

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

}; 
const sortedLeaderboard = useMemo(() => {
  const copy = [...leaderboard];

  copy.sort(
    (a: any, b: any) =>
      (b.performance ?? 0) - (a.performance ?? 0)
  );

  return copy;
}, [leaderboard]);
  
  // TOURNAMENT CARD
const TournamentCard = ({ item }: { item: any }) => {
  const status: TournamentStatus = getTournamentStatus(
    item.startTime,
    item.endTime,
    now
  );

  const isActiveTournament = status === "ongoing";

  const progress =
    status === "upcoming"
      ? 0
      : status === "finished"
      ? 1
      : Math.min(
          1,
          (Date.now() - item.startTime) /
            (item.endTime - item.startTime)
        );

  const durationText = formatDuration(item.endTime - item.startTime);

  const tagStyle =
    status === "upcoming"
      ? styles.tagUpcoming
      : status === "ongoing"
      ? styles.tagOngoing
      : styles.tagPast;

  const rebuyFee = item.rebuyFee ?? item.entryFee ?? 0;

const allowRebuy =
  status === "ongoing" &&
  joinedMap[item.id];

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      style={[
        styles.card,
        status === "ongoing" && styles.cardGlow,
      ]}
      onPress={() => {
        setSelectedTournament(item);
        setViewTab("info");
      }}
    >
      {/* TITLE */}
      <Text
        style={[
          styles.cardBigTitle,
          {
            color: isActiveTournament
              ? "#22c55e"
              : "rgba(236, 220, 220, 1)",
          },
        ]}
      >
        {item.name}
      </Text>

      {/* DURATION */}
      <Text style={styles.metaText}>
        Duration: {durationText}
      </Text>

      {/* STATUS */}
      <View style={[styles.tag, tagStyle]}>
        <Text style={styles.tagText}>
          {status === "upcoming"
            ? "Upcoming"
            : status === "ongoing"
            ? "Ongoing"
            : "Past"}
        </Text>
      </View>

      {/* PROGRESS */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress * 100}%` },
          ]}
        />
      </View>

      {/* PRIZE INFO */}
      <View style={styles.cardPrizeRow}>
        <Text style={styles.cardPrizeText}>
          🏆 Prize Pool: {item.prizePool ?? 0} $
        </Text>

        <Text style={styles.cardPrizeText}>
          🏅 Winners: {item.payoutStructure?.length ?? 0}
        </Text>

        <Text style={styles.cardFeeText}>
          🎟 Entry Fee: {item.entryFee ?? 0} $
        </Text>

        <Text style={styles.cardFeeText}>
          ♻️ Rebuy: {rebuyFee} $
        </Text>

        <Text style={styles.cardFeeText}>
          💵 Start: {item.startingBalance ?? 0} $
        </Text>
      </View>

      {/* LIVE STATS */}
      <View style={styles.cardStatsRow}>
  
  <View style={styles.timeColumn}>
    <Text style={styles.cardDetail}>
      {status === "upcoming"
        ? `⏳ Starts in ${formatCountdown(item.startTime - now)}`
        : status === "ongoing"
        ? `⏰ Ends in ${formatCountdown(item.endTime - now)}`
        : "🏁 Finished"}
    </Text>

    <Text style={styles.cardDate}>
      📅 {formatFullDate(
        status === "upcoming"
          ? item.startTime
          : item.endTime
      )}
    </Text>
  </View>

  <View style={styles.statsColumn}>
    <Text style={styles.cardDetail}>
      👥 {tournamentCounts[item.id] ?? 0} Joined
    </Text>

    <Text style={styles.cardDetail}>
      ♻️ {tournamentRebuys[item.id] ?? 0} Rebuys
    </Text>
  </View>
 </View>
      {/* ACTIONS */}
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
            loadingActions[item.id]?.register ||
            joinedMap[item.id]
          }
          onPress={() => handleRegister(item.id)}
        >
          <Text style={styles.actionText}>
           {joinedMap[item.id]
  ? "You're In"
  : status === "finished"
  ? "Closed"
  : loadingActions[item.id]?.register
  ? "Processing..."
  : (item.entryFee ?? 0) === 0
  ? "Register (Free)"
  : `Register • ${item.entryFee} $`}
          </Text>
        </TouchableOpacity>

<TouchableOpacity
  activeOpacity={0.6}
  style={[
    styles.actionBtnAlt,
    (!allowRebuy || loadingActions[item.id]?.rebuy) && styles.disabledBtn,
    loadingActions[item.id]?.rebuy && { opacity: 0.4 }
  ]}
 disabled={!!loadingActions[item.id]?.rebuy}

    onPress={() => {
  console.log("🔥 REBUY BUTTON PRESSED");
  handleRebuy(item.id);
}}
        >
        <Text style={styles.actionTextAlt}>
  {loadingActions[item.id]?.rebuy
    ? "⏳ Processing..."
    : loadingActions[item.id]?.rebuyDone
    ? "✅ Rebuy Done"
    : `♻️ Rebuy • ${rebuyFee} $`}
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

  const rank = idx + 1;
  const user = list[idx];

  const prize =
    selectedTournament ? getPrizeForRank(rank, selectedTournament) : null;

  return (
    <View style={styles.pinnedRow}>
      
      {/* Rank */}
      <Text style={styles.tableColSmall}>
        {rank <= 3 ? ["🥇","🥈","🥉"][rank-1] : rank}
      </Text>

      {/* Participant */}
      <View style={styles.tableColName}>
       <NameWithFlag
  username={user.username || user.email || "Player"}
  countryCode={user.countryCode}
/>
      </View>

      {/* Balance */}
     <Text style={styles.tableColBalance} numberOfLines={1}>
  {user.balance ?? 0}T
</Text>

      {/* Tier */}
      <Text style={styles.tableColTier}>
        {getTierForRank(rank)}
      </Text>

      {/* Prize */}
      <Text style={styles.tableColPrize}>
        {prize ? `${prize} $` : "-"}
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
        <Text style={[styles.tableColName, styles.headerText]}>
          Participant
        </Text>
        <Text style={[styles.tableColBalance, styles.headerText]}>
          Balance
        </Text>
        <Text style={[styles.tableColTier, styles.headerText]}>
          Level
        </Text>
        <Text style={[styles.tableColPrize, styles.headerText]}>
          Prize
        </Text>
      </View>

      {list.map((row, i) => (
        <View
          key={row.id}
          style={[
            styles.tableRow,
            row.id === currentUser?.uid &&
              styles.currentRowHighlight,
          ]}
        >
          <Text style={styles.tableColSmall}>
            {i === 0
              ? "🥇"
              : i === 1
              ? "🥈"
              : i === 2
              ? "🥉"
              : i + 1}
          </Text>

          <View style={styles.tableColName}>
            <NameWithFlag
              username={row.username || "Player"}
              countryCode={row.countryCode}
            />
          </View>

          <Text style={styles.tableColBalance}>
            {row.balance ?? 0}T
          </Text>

          <Text style={styles.tableColTier}>
            {getTierForRank(i + 1)}
          </Text>

          <Text style={styles.tableColPrize}>
            {selectedTournament
              ? (() => {
                  const prize = getPrizeForRank(
                    i + 1,
                    selectedTournament
                  );
                  return prize ? `${prize} $` : "-";
                })()
              : "-"}
          </Text>
        </View>
      ))}
    </View>
  );
};

  return (
    <View style={styles.container}>
    <Text style={styles.pageTitle}>🏆 Forex Tournaments</Text>

<View
  style={{
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 999,
    marginTop: 8,
    marginBottom: 14,
  }}
>
  <Ionicons
    name="wallet-outline"
    size={25}
    color="#22c55e"
    style={{ marginRight: 6 }}
  />

  <Text
    style={{
      color: "#94a3b8",
      fontSize: 15,
      marginRight: 4,
    }}
  >
    Wallet:
  </Text>

 <Text>
  <Text
    style={{
      color: "#3b82f6",
      fontWeight: "800",
      fontSize: 14,
      letterSpacing: 1,
    }}
  >
    USD{" "}
  </Text>

  <Text
    style={{
      color: "#fbbf24",
      fontWeight: "900",
      fontSize: 20,
      textShadowColor: "rgba(251,191,36,0.7)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    }}
  >
    {(balances?.real ?? 0).toLocaleString()}
  </Text>
</Text>
</View>
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
   

      {/* tournament modal */}
    <Modal
  visible={!!selectedTournament}
  animationType="slide"
  transparent
  onRequestClose={() => setSelectedTournament(null)}
>
  <Pressable
    style={styles.modalOverlay}
    onPress={() => setSelectedTournament(null)} // tap outside closes modal
  >
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"} // avoid keyboard overlapping inputs
    >
      <Pressable
        style={styles.modalContent}
        onPress={(e) => e.stopPropagation()} // prevent taps inside modal from closing
      >
        {/* Close button */}
        <Pressable
          style={styles.closeButton}
          onPress={() => setSelectedTournament(null)}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }} // easier to tap
        >
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>

        {selectedTournament && (
     <View style={{ flex: 1, minHeight: 0 }}>   
            <Text style={styles.modalTitle}>
              {selectedTournament.title || selectedTournament.name || "Tournament"}
            </Text>

            <View style={styles.modalMetaRow}>
              <Text style={styles.modalPrize}>
                🏆 Prize Pool: {selectedTournament.prizePool ?? 0} $
              </Text>
             <Text style={styles.modalInfo}>
  ⏰ {
    now < selectedTournament.startTime
      ? `Starts in ${formatCountdown(selectedTournament.startTime - now)}`
      : now <= selectedTournament.endTime
      ? `Ends in ${formatCountdown(selectedTournament.endTime - now)}`
      : "Finished"
  }
</Text>
            </View>

            <Text style={styles.modalInfo}>
  👥 {tournamentCounts[selectedTournament.id] ?? 0} participants
</Text>

            <Text style={styles.modalInfo}>
              ♻️ Rebuys: {tournamentRebuys[selectedTournament.id] ?? 0}
            </Text>

            {/* Tab switch */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, viewTab === "info" && styles.tabActive]}
                onPress={() => setViewTab("info")}
              >
                <Text style={viewTab === "info" ? styles.tabTextActive : styles.tabText}>
                  Info
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, viewTab === "leaderboard" && styles.tabActive]}
                onPress={() => setViewTab("leaderboard")}
              >
                <Text style={viewTab === "leaderboard" ? styles.tabTextActive : styles.tabText}>
                  Leaderboard
                </Text>
              </TouchableOpacity>
            </View>
{/* Scrollable content */}
{viewTab === "info" ? (
 <ScrollView
  style={{ flex: 1 }}
  contentContainerStyle={{
    paddingBottom: 140,
    paddingTop: 10,
  }}
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
  nestedScrollEnabled={true}   // 🔥 KEY FIX (Android + nested layouts)
>
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
        `You get a starting demo balance of ${selectedTournament.startingBalance ?? 0} $ and leaderboard entry.`}
    </Text>

    {selectedTournament.payoutStructure?.length ? (
      <View>
        <Text style={styles.sectionTitle}>🏆 RANKINGS</Text>
        {/* Header row */}
    <View style={[styles.rankHeaderRow]}>
      <Text style={[styles.rankHeaderCol, { flex: 1 }]}>Position</Text>
      <Text style={[styles.rankHeaderCol, { flex: 2 }]}>Level</Text> {/* instead of "Tier", use Level */}
      <Text style={[styles.rankHeaderCol, { flex: 1, textAlign: 'right' }]}>Prize</Text>
    </View>
        {selectedTournament.payoutStructure.map((p: any) => (
          <View
            key={p.rank}
            style={{
              flexDirection: "row",
              marginTop: 8,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: "#cbd5e1", flex: 1 }}>
              {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : `#${p.rank}`}
            </Text>
            <Text
              style={{
                color: "#facc15",
                fontWeight: "800",
                flex: 1,
                textAlign: "center",
              }}
            >
              {getTierForRank(p.rank)}
            </Text>
            <Text
              style={{
                color: "#22c55e",
                fontWeight: "900",
                flex: 1,
                textAlign: "right",
              }}
            >
              {p.amount} $
            </Text>
          </View>
        ))}
      </View>
    ) : null}
  </ScrollView>
) : (
  // Leaderboard tab: single table with all users
  <ScrollView
    style={{ flex: 1 }}
    contentContainerStyle={{ paddingBottom:120 }}
    showsVerticalScrollIndicator={false}
  >
    <View style={{ flexGrow: 1 }}>
      <LeaderboardTable list={sortedLeaderboard} />
    </View>
  </ScrollView>
)}
          </View>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  </Pressable>
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
modalContent: {
  backgroundColor: "#0e0f26",
  borderRadius: 18,
  width: "92%",
  height: "90%",

  paddingHorizontal: 16,
  alignSelf: "center",

  overflow: "hidden", // 🔥 critical fix for scroll containment
},
  closeButton: {
  alignSelf: "flex-end",
  padding: 10,
  marginRight: 4
},
  modalTitle: { fontSize: 20, fontWeight: "900", color: "#fff", marginBottom: 6, },
  modalMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  modalPrize: { color: "#47f11dff", fontWeight: "800" },
  modalInfo: { color: "#cbd5e1" },
 tabRow: {
  flexDirection: "row",
  marginTop: 12,
  zIndex: 10, // keeps tabs above scroll glitches
},
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
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#2b2b3a",paddingBottom: 8,  marginTop: 10, alignItems: "center", },
 
tableRow: {   flexDirection: "row",  alignItems: "center",
  justifyContent: "space-between",  width: "100%", 
  paddingVertical: 8,  borderBottomWidth: 1,  borderBottomColor: "#12121a",
},

tableColSmall: { flexShrink: 0, color: "#fff", fontWeight: "700" },
  tableCol: { flex: 1, color: "#fff" },
  pinnedRow: { backgroundColor: "#12142e", padding: 10, borderRadius: 10, borderTopWidth: 1,
 
 borderColor: "#2b2b3a", marginBottom: 8, flexDirection: "row", alignItems: "center" },
  
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


startingBalanceText: { color: "#22c55e", fontWeight: "700", fontSize: 14, marginTop: 4 },
tableColName: {  flex: 2.5,  color: "#fff",},

tableColBalance: {  flex: 1.5,  color: "#38bdf8",  fontWeight: "700",},

tableColTier: {  flex: 1.4,  color: "#facc15",  fontWeight: "700",},

tableColPrize: {  flex: 1.3,  color: "#22c55e",  fontWeight: "800",},
rankHeaderRow: {
  flexDirection: 'row',
  marginTop: 8,
  paddingBottom: 4,
  borderBottomWidth: 1,
  borderBottomColor: '#2b2b3a',
  alignItems: 'center',
  justifyContent: 'space-between',
},

rankHeaderCol: {
  color: '#cbd5e1',
  fontWeight: '900',
  textAlign: 'center',
  flex: 1, // make column flexible by default
},
cardStatsRow: {
  flexDirection: "row",
  marginTop: 8,
  gap: 20,
},

timeColumn: {
  flex: 2,
},

statsColumn: {
  flex: 1,
  alignItems: "flex-end",
},

cardDate: {
  color: "#9ca3af",
  fontSize: 12,
  marginTop: 2,
},

});
