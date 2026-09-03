// TournamentScreen.tsx
import { Ionicons } from "@expo/vector-icons";


import type { User } from "firebase/auth";
import CountryFlag from "react-native-country-flag";


import { getAuth } from "firebase/auth";
import { useApp } from "./AppContext"; // <-- add this at the top


import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Alert, FlatList,
  KeyboardAvoidingView,
  Modal, Platform, Pressable, ScrollView, StyleSheet,
  Text, TouchableOpacity, UIManager, View
} from "react-native";
import { db } from "../firebaseConfig";

// enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
 
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
  collectedFunds?:number;
  prizeModel?: "sponsored" | "dynamic";
  prize?: number;
  payoutStructure?: {
  rank: number;
  amount?: number;
  percentage?: number;
}[];
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
    (p) => Number(p.rank) === Number(rank)
  );

  if (!entry) return null;


  // Dynamic tournament
  if (tournament.prizeModel === "dynamic") {
    const pool = tournament.collectedFunds ?? 0;

    return pool * ((entry.percentage ?? 0) / 100);
  }


  // Sponsored tournament
  return entry.amount ?? 0;
};
const formatNum = (value?: number, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return "0.00";
  return Number(value).toFixed(decimals);
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

const USD_TO_XAF = 600;

const toXAF = (usd?: number) => {
  if (!usd || isNaN(usd)) return 0;
  return usd * USD_TO_XAF;
};

const formatXAF = (value: number) => {
  return value.toLocaleString("en-US");
};

export default function TournamentScreen({ currentUser }: TournamentScreenProps) {
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
const [showTournamentPopup, setShowTournamentPopup] = useState(false);

  const [now, setNow] = useState(new Date().getTime());
 
  
  // live players list for the currently selected tournament (used for counts / participant preview)

const [tournamentCounts, setTournamentCounts] = useState<Record<string, number>>({});
const [tournamentRebuyCounts, setTournamentRebuyCounts] = useState<Record<string, number>>({});
  const [viewTab, setViewTab] = useState("info"); // "info" | "leaderboard"
  
const [leaderboardPage, setLeaderboardPage] = useState(0);
const [showFAQ, setShowFAQ] = useState(false);
const [openFAQ, setOpenFAQ] = useState<number | null>(null);

type LoadingState = {
  register?: boolean;
  rebuy?: boolean;
  rebuyDone?: boolean;
};

const [loadingActions, setLoadingActions] = useState<
  Record<string, LoadingState>
>({});


// If you already have a context like useApp() that provides tournamentAccounts:
const { balances, joinedMap, leaderboardParticipants, tournaments,  profile, setOpenAccountSwitcher,
  setSwitcherHintTournamentId, participantBalances,  } = useApp();                               // or replace with your actual context

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
  const totalRebuys = snap.docs.reduce(
    (sum, d) => sum + (d.data().rebuyCount ?? 0),
    0
  );

  setTournamentCounts(prev => ({
    ...prev,
    [t.id]: snap.size,
  }));

  setTournamentRebuyCounts(prev => ({
    ...prev,
    [t.id]: totalRebuys,
  }));
});

    unsubs.push(unsub);
  });

  return () => unsubs.forEach(u => u());
}, [tournaments]);

// ---------- GLOBAL LEADERBOARD ----------
const leaderboard = useMemo(() => {
  if (!selectedTournament) return [];

  const tournamentId =
    selectedTournament.tournamentId ??
    selectedTournament.id;

  return leaderboardParticipants[tournamentId] ?? [];
}, [
  leaderboardParticipants,
  selectedTournament?.tournamentId,
  selectedTournament?.id,
]);

// ---------- REGISTER USER TO TOURNAMENT ----------
const handleRegister = async (tournamentId: string) => {


  if (loadingActions[tournamentId]?.register) return;

  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    Alert.alert("Error", "You must be logged in.");
    return;
  }

  const tour = tournaments.find((t) => t.id === tournamentId);
  if (!tour?.endTime) {
  Alert.alert("Error", "Tournament timing missing.");
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
Alert.alert(
  "Registration Successful 🎉",
  `You have successfully registered for "${tour.name}".\n\nWe 
have opened your Account Switcher so you can switch to your
   Tournament Account to join the conpetition. Close this section completely!`
);

setTournamentCounts(prev => ({
  ...prev,
  [tournamentId]: (prev[tournamentId] ?? 0) + 1,
}));

setSwitcherHintTournamentId(tournamentId);
setOpenAccountSwitcher(true);

  } catch (error: any) {
    Alert.alert("Error", error.message || "Registration failed.");
  } finally {
    setLoadingFor(tournamentId, "register", false);
  }
};


// ----------- REBUY ACTION (FINAL CLEAN VERSION) -----------
const handleRebuy = async (tournamentId: string) => {
  console.log("🔥 REBUY BUTTON PRESSED", tournamentId);

  if (loadingActions[tournamentId]?.rebuy) return;

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
if (tour.endTime == null) {
  Alert.alert("Error", "Tournament timing missing.");
  return;
}
  if (Date.now() > tour.endTime) {
    Alert.alert("Closed", "This tournament has already ended.");
    return;
  }

  setLoadingActions((prev) => ({
    ...prev,
    [tournamentId]: {
      ...prev[tournamentId],
      rebuy: true,
      rebuyDone: false,
    },
  }));

  try {
    const token = await user.getIdToken(true);

    const response = await fetch(
      "https://forexapp2-backend.onrender.com/tournament/rebuy",
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

    let result: any = {};
    try {
      result = JSON.parse(text);
    } catch {}

    if (!response.ok) {
      throw new Error(result?.error || "Rebuy failed");
    }

    Alert.alert("Success 🎉", "Rebuy successful!");
    setLoadingActions((prev) => ({
      ...prev,
      [tournamentId]: {
        ...prev[tournamentId],
        rebuy: false,
        rebuyDone: true,
      },
    }));
  } catch (err) {
    console.error("REBUY ERROR:", err);

    Alert.alert(
      "Rebuy Failed",
      err instanceof Error ? err.message : "Unknown error"
    );

    setLoadingActions((prev) => ({
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

  copy.sort((a: any, b: any) => {

 const startBalance = selectedTournament?.startingBalance ?? 0;

const aScore =
  (a.balance ?? 0) -
  startBalance -
  (a.rebuyInjectedTotal ?? 0);

const bScore =
  (b.balance ?? 0) -
  startBalance -
  (b.rebuyInjectedTotal ?? 0);
    return bScore - aScore;
  });

  return copy;
}, [leaderboard, selectedTournament?.startingBalance]);
// ---------- CHECK IF LEADERBOARD ROW BELONGS TO CURRENT USER ----------
const isCurrentUserRow = (participant: any) => {
  if (!participant) return false;

  const authUser = getAuth().currentUser;

  const uid = String(
    currentUser?.uid ?? authUser?.uid ?? ""
  );

  const email = String(
    currentUser?.email ?? authUser?.email ?? ""
  ).toLowerCase();

  if (!uid && !email) return false;

  return (
    String(participant.id ?? "") === uid ||
    String(participant.uid ?? "") === uid ||
    String(participant.userId ?? "") === uid ||
    String(participant.participantId ?? "") === uid ||
    String(participant.email ?? "").toLowerCase() === email
  );
};

const currentUserPosition = useMemo(() => {
  if (!selectedTournament || !sortedLeaderboard.length) {
    return null;
  }

  // Find EXACTLY the same user that the table highlights
  const userIndex = sortedLeaderboard.findIndex(
    (participant: any) => isCurrentUserRow(participant)
  );

  // User is not registered / not in leaderboard
  if (userIndex === -1) {
    return null;
  }

  // This is the SAME participant object used by the table
  const user = sortedLeaderboard[userIndex];

  const position = userIndex + 1;

  const balance = Number(user.balance ?? 0);

  const startingBalance = Number(
    selectedTournament.startingBalance ?? 0
  );

  const rebuyInjectedTotal = Number(
    user.rebuyInjectedTotal ?? 0
  );

  const performance =
    balance -
    startingBalance -
    rebuyInjectedTotal;

  const prize = getPrizeForRank(
    position,
    selectedTournament
  );

  return {
    position,
    user,
    balance,
    performance,
    prize,
    tier: getTierForRank(position),
  };
}, [
  selectedTournament,
  sortedLeaderboard,
  currentUser?.uid,
  currentUser?.email,
]);


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

const tournamentState =
 tournaments.find(t => t.tournamentId === item.tournamentId);
const userBalance =
  participantBalances[item.id] ??
  tournamentState?.balance ??
  0;

const startBalance =
  tournamentState?.startingBalance ??
  item.startingBalance ??
  0;

const canRebuyByBalance =
  userBalance < startBalance * 0.5;

const allowRebuy =
  status === "ongoing" &&
  !!joinedMap[item.id] &&
  canRebuyByBalance;

  
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
  setShowTournamentPopup(true);
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
     {/* PRIZE / FEES WITH DIVIDER CONVERSION */}
<View style={styles.cardPrizeRow}>

  {/* PRIZE POOL */}
  <View style={styles.moneyRow}>
    <Text style={styles.leftPrizePoolText}>

{
 item.prizeModel === "dynamic"

 ? `🏆 Prize Pool: ${formatNum(
      item.collectedFunds ?? 0
    )} $`

 : `🏆 Prize Pool: ${formatNum(
      item.prizePool ?? 0
    )} $`
}

</Text>
<View
  style={[
    styles.prizeTypeBadge,
    item.prizeModel === "dynamic"
      ? styles.dynamicBadge
      : styles.guaranteedBadge,
  ]}
>
  <Text
    numberOfLines={1}
    style={styles.prizeTypeText}
  >
    {item.prizeModel === "dynamic"
      ? "🔥 Growing Prize Pool"
      : "🎁 Sponsored Prize Pool"}
  </Text>
</View>

    <View style={styles.dividerLine} />

    <Text style={styles.rightMoneyText}>
    ≈ {
  formatXAF(
    toXAF(
      item.prizeModel === "dynamic"
        ? item.collectedFunds ?? 0
        : item.prizePool ?? 0
    )
  )
} XAF
    </Text>
  </View>

  {/* ENTRY FEE */}
  <View style={styles.moneyRow}>
    <Text style={styles.leftMoneyText}>
      🎟 Entry Fee: {item.entryFee ?? 0} $
    </Text>

    <View style={styles.dividerLine} />

    <Text style={styles.rightMoneyText}>
      ≈ {formatXAF(toXAF(item.entryFee))} XAF
    </Text>
  </View>

  {/* REBUY FEE */}
  <View style={styles.moneyRow}>
    <Text style={styles.leftMoneyText}>
      ♻️ Rebuy Fee: {rebuyFee} $
    </Text>

    <View style={styles.dividerLine} />

    <Text style={styles.rightMoneyText}>
      ≈ {formatXAF(toXAF(rebuyFee))} XAF
    </Text>
  </View>

  {/* STARTING BALANCE */}
  <View style={styles.moneyRow}>
    <Text style={styles.leftMoneyText}>
      💵 Start Balance: {item.startingBalance ?? 0} $
    </Text>

    <View style={styles.dividerLine} />

    <Text style={styles.rightMoneyText}>
      ≈ {formatXAF(toXAF(item.startingBalance))} XAF
    </Text>
  </View>

</View>

    {/* LIVE STATS */}
<View style={styles.cardStatsRow}>

  {/* DATE / COUNTDOWN */}
  <View style={styles.timeColumn}>
    <Text
      style={styles.cardDetail}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {status === "upcoming"
        ? `⏳ Starts in ${formatCountdown(item.startTime - now)}`
        : status === "ongoing"
        ? `⏰ Ends in ${formatCountdown(item.endTime - now)}`
        : "🏁 Finished"}
    </Text>

    <Text
      style={styles.cardDate}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      📅 {formatFullDate(
        status === "upcoming"
          ? item.startTime
          : item.endTime
      )}
    </Text>
  </View>

  {/* JOINED / REBUYS */}
  <View style={styles.statsColumn}>
    <Text style={styles.cardDetail} numberOfLines={1}>
      👥 {tournamentCounts[item.id] ?? 0} Joined
    </Text>

    <Text style={styles.cardDetail} numberOfLines={1}>
      ♻️ {tournamentRebuyCounts[item.id] ?? 0} Rebuys
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
 {status === "finished"
  ? "Closed"
  : joinedMap[item.id]
  ? "You're In"
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
   (status === "finished" || !allowRebuy 
   || loadingActions[item.id]?.rebuy) && styles.disabledBtn,
    loadingActions[item.id]?.rebuy && { opacity: 0.4 }
  ]}
disabled={
  status === "finished" ||
  !allowRebuy ||
  !!loadingActions[item.id]?.rebuy
}

    onPress={() => {
  console.log("🔥 REBUY BUTTON PRESSED");
  handleRebuy(item.id);
}}
        >
      <Text style={styles.actionTextAlt}>
  {status === "finished"
    ? "Closed"
    : loadingActions[item.id]?.rebuy
    ? "⏳ Processing..."
    : `♻️ Rebuy • ${rebuyFee} $`}
</Text>
        </TouchableOpacity>
      </View>
      {status !== "finished" &&
 joinedMap[item.id] &&
 !allowRebuy && (
  <Text
    style={{
      color: "#94a3b8",
      fontSize: 11,
      marginTop: 5,
      textAlign: "center",
    }}
  >
    Rebuy available when current balance{"\n"} falls below 50% of startingBalance!
  </Text>
)}
    </TouchableOpacity>
  );
};

const sortedTournaments = useMemo(() => {
  return [...tournaments].sort((a, b) => {
    const aStart = a.startTime ?? 0;
    const aEnd = a.endTime ?? 0;
    const bStart = b.startTime ?? 0;
    const bEnd = b.endTime ?? 0;

    const statusA = getTournamentStatus(aStart, aEnd, now);
    const statusB = getTournamentStatus(bStart, bEnd, now);

    // 1. ONGOING FIRST
    if (statusA === "ongoing" && statusB !== "ongoing") return -1;
    if (statusB === "ongoing" && statusA !== "ongoing") return 1;

    // 2. UPCOMING BEFORE FINISHED
    if (statusA === "upcoming" && statusB === "finished") return -1;
    if (statusB === "upcoming" && statusA === "finished") return 1;

    // 3. ONGOING: tournament ending soonest first
    if (statusA === "ongoing" && statusB === "ongoing") {
      return aEnd - bEnd;
    }

    // 4. UPCOMING: tournament starting soonest first
    if (statusA === "upcoming" && statusB === "upcoming") {
      return aStart - bStart;
    }

    // 5. FINISHED: newest finished tournament first
    if (statusA === "finished" && statusB === "finished") {
      return bEnd - aEnd;
    }

    return 0;
  });
}, [tournaments, now]);
  // find current user row and create pinned row to top of leaderboard modal

// ---------- YOUR POSITION PANEL ----------
 const renderPinnedUserRow = () => {
  if (!selectedTournament || !sortedLeaderboard.length) {
    return null;
  }

  // Use the exact same matching logic as the highlighted leaderboard row
  const userIndex = sortedLeaderboard.findIndex(
    (participant: any) => isCurrentUserRow(participant)
  );

  // Current user is not in this tournament
  if (userIndex === -1) {
    return null;
  }

  const user = sortedLeaderboard[userIndex];
  const position = userIndex + 1;

  const balance = Number(user.balance ?? 0);

  const startingBalance = Number(
    selectedTournament.startingBalance ?? 0
  );

  const rebuyInjectedTotal = Number(
    user.rebuyInjectedTotal ?? 0
  );

  const performance =
    balance -
    startingBalance -
    rebuyInjectedTotal;

  const prize = getPrizeForRank(
    position,
    selectedTournament
  );

  const tier = getTierForRank(position);

  return (
    <View style={styles.yourPositionCard}>

      {/* HEADER */}
      <View style={styles.yourPositionHeader}>
        <Text style={styles.yourPositionTitle}>
          📍 Your Position
        </Text>

        <Text style={styles.yourPositionRank}>
          #{position}
        </Text>
      </View>

      {/* USER DETAILS */}
      <View style={styles.yourPositionTopRow}>

        <View style={styles.yourPositionRankCell}>
          <Text style={styles.yourPositionRankNumber}>
            {position === 1
              ? "🥇"
              : position === 2
              ? "🥈"
              : position === 3
              ? "🥉"
              : `#${position}`}
          </Text>
        </View>

        <View style={styles.yourPositionParticipant}>
          <NameWithFlag
            username={
              user.username ||
              user.email ||
              "Player"
            }
            countryCode={user.countryCode}
          />

          <Text style={styles.youLabel}>
            YOU
          </Text>
        </View>

        <View style={styles.yourPositionBalance}>
          <Text style={styles.yourPositionLabel}>
            Balance
          </Text>

          <Text style={styles.yourPositionBalanceValue}>
            {formatNum(balance)}T
          </Text>
        </View>

      </View>

      {/* STATS */}
      <View style={styles.yourPositionStatsRow}>

        <View style={styles.yourPositionStatCell}>
          <Text style={styles.yourPositionStatLabel}>
            Performance
          </Text>

          <Text
            style={[
              styles.yourPositionStatValue,
              {
                color:
                  performance >= 0
                    ? "#22c55e"
                    : "#ef4444",
              },
            ]}
          >
            {performance >= 0 ? "+" : ""}
            {formatNum(performance)}$
          </Text>
        </View>

        <View style={styles.yourPositionStatCell}>
          <Text style={styles.yourPositionStatLabel}>
            Level
          </Text>

          <Text
            style={[
              styles.yourPositionStatValue,
              { color: "#facc15" },
            ]}
            numberOfLines={2}
          >
            {tier}
          </Text>
        </View>

        <View style={styles.yourPositionStatCell}>
          <Text style={styles.yourPositionStatLabel}>
            Prize
          </Text>

          <Text
            style={[
              styles.yourPositionStatValue,
              { color: "#22c55e" },
            ]}
          >
            {prize !== null
              ? `${formatNum(prize)} $`
              : "-"}
          </Text>
        </View>

      </View>
    </View>
  );
};




  // table header for leaderboard
  
  return (
    <View style={styles.container}>
    <Text style={styles.pageTitle}>🏆 Forex Tournaments</Text>
   {/* FAQ button */}
<Pressable
  style={styles.faqFloatingButton}
  onPress={() => setShowFAQ(prev => !prev)}
>
  <Text style={styles.faqFloatingText}>
    ❓
  </Text>
</Pressable>
<View
  style={{
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",

    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",

    paddingHorizontal: 12,
    paddingVertical: 2,

    borderRadius: 999,
    marginTop: 0,
    marginBottom: 2,

    maxWidth: "90%",
  }}
>
  <Ionicons
    name="wallet-outline"
    size={16}
    color="#22c55e"
    style={{ marginRight: 6 }}
  />

  <Text
    style={{
      color: "#94a3b8",
       fontSize: 11,
    flexShrink: 1,
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
     fontSize: 11,
flexShrink: 1,
      letterSpacing: 1,
    }}
  >
    USD{" "}
  </Text>

  <Text
    numberOfLines={1}
  adjustsFontSizeToFit
  style={{
      color: "#fbbf24",
      fontWeight: "900",
      fontSize: 15,
flexShrink: 1,
      textShadowColor: "rgba(251,191,36,0.7)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    }}
  >
    {formatNum(balances?.real)}
  </Text>
</Text>
</View>
    <FlatList
  data={sortedTournaments}
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
  visible={showTournamentPopup}
  animationType="slide"
  transparent
  onRequestClose={() => {
    setShowTournamentPopup(false);
    setSelectedTournament(null);
  }}
>
  <Pressable
    style={styles.modalOverlay}
    onPress={() => {
      setShowTournamentPopup(false);
      setSelectedTournament(null);
    }}
  >
   <KeyboardAvoidingView
  style={{
    flex: 1,
    width: "100%",
  }}
  behavior={Platform.OS === "ios" ? "padding" : "height"}
>
<View
  style={{
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 20,
  }}
>

    <View style={styles.modalContent}>
   
        {/* Close button */}
        <Pressable
          style={styles.closeButton}
          onPress={() => {
            setShowTournamentPopup(false);
            setSelectedTournament(null);
          }}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>

  
    
{selectedTournament && (
<View
  style={{
     width: "100%",
     flex:1,
      minHeight:0,
  }}
>

  {/* HEADER */}
  <View
    style={{
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: "#22263d",
    }}
  >
    <Text style={styles.modalTitle}>
      {selectedTournament.title ||
        selectedTournament.name ||
        "Tournament"}
    </Text>

    <Text style={styles.modalPrize}>

🏆 Prize Pool: {
 selectedTournament.prizeModel === "dynamic"
 ? formatNum(selectedTournament.collectedFunds ?? 0)
 : formatNum(selectedTournament.prizePool ?? 0)
} $

</Text>

    <Text style={styles.modalInfo}>
      {now < selectedTournament.startTime
        ? `⏳ Starts in ${formatCountdown(
            selectedTournament.startTime - now
          )}`
        : now <= selectedTournament.endTime
        ? `⏰ Ends in ${formatCountdown(
            selectedTournament.endTime - now
          )}`
        : "🏁 Finished"}
    </Text>

    <Text style={styles.modalInfo}>
      👥 {tournamentCounts[selectedTournament.id] ?? 0} Participants
    </Text>

    <Text style={styles.modalInfo}>
      ♻️ {tournamentRebuyCounts[selectedTournament.id] ?? 0} Rebuys
    </Text>
  </View>

  {/* TABS */}
<View style={styles.tabRow}>
  <TouchableOpacity
    style={[
      styles.tabBtn,
      viewTab === "info" && styles.tabActive,
    ]}
    onPress={() => setViewTab("info")}
  >
    <Text
      style={
        viewTab === "info"
          ? styles.tabTextActive
          : styles.tabText
      }
    >
      Information
    </Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[
      styles.tabBtn,
      viewTab === "leaderboard" && styles.tabActive,
    ]}
    onPress={() => setViewTab("leaderboard")}
  >
    <Text
      style={
        viewTab === "leaderboard"
          ? styles.tabTextActive
          : styles.tabText
      }
    >
      Leaderboard
    </Text>
  </TouchableOpacity>
</View>



{/* ONLY THE CONTENT BELOW SCROLLS */}
<View
  style={{
    flex: 1,
    width: "100%",
    minHeight: 0,
    overflow: "hidden",
  }}
>

  {viewTab === "info" ? (
  <ScrollView
    style={{ flex: 1, width: "100%" }}
    contentContainerStyle={{
      paddingVertical: 12,
      paddingHorizontal: 4,
      paddingBottom: 40,
      flexGrow: 1
    }}
    showsVerticalScrollIndicator={true}
    nestedScrollEnabled={false}
  >

        <Text style={styles.sectionTitle}>
          📖 Information
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {selectedTournament.description ||
              "Each participant receives a starting balance. Grow it to finish at the top of the leaderboard and win the prize pool."}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          📜 Rules
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {selectedTournament.rules ||
              "1. Fair play only.\n\n2. No bots.\n\n3. Highest balance wins.\n\n4. Admin decisions are final."}
          </Text>
          
        </View>
<Text style={styles.sectionTitle}>
  📈 How Winners Are Ranked
</Text>

<View style={styles.infoBox}>
  <Text style={styles.infoText}>
    • Every trader starts with the same tournament balance.

    {"\n\n"}• Rankings are based on <Text style={{ fontWeight: "700", color: "#22c55e" }}>Trading Performance</Text>, not simply account balance.

    {"\n\n"}• Trading Performance = Current Balance − Starting Balance − Rebuy Capital Received.

    {"\n\n"}• Rebuys help you continue trading but do not improve your ranking.

    {"\n\n"}• The trader with the highest Trading Performance finishes #1.
  </Text>
</View>
        <Text style={styles.sectionTitle}>
          🎁 Registration Benefits
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {selectedTournament.onRegisterInfo ||
              `Receive ${selectedTournament.startingBalance ?? 0}$ virtual trading capital and join the live rankings.`}
          </Text>
        </View>

        {!!selectedTournament.payoutStructure?.length && (
          <>
            <Text style={styles.sectionTitle}>
              🏆 Prize Distribution
            </Text>

            <View style={styles.rankHeaderRow}>
              <Text
                style={[ styles.rankCell,
                  styles.rankHeaderCol,
                  { flex: 1 },
                ]}
              >
                Rank
              </Text>

              <Text
                style={[styles.rankLevel,
                  styles.rankHeaderCol,
                  { flex: 2 },
                ]}
                
              >
              
                Level
              </Text>

              <Text
                style={[
                 styles.rankPrize,
                  styles.rankHeaderCol,
                  { flex: 1 },
                ]}
              >
                Prize
              </Text>
            </View>

            {selectedTournament.payoutStructure.map(
              (p: any) => (
                <View
                  key={p.rank}
                  style={styles.rankRow}
                >
                  <Text
                    style={[
                      styles.rankCell,
                      { flex: 1 },
                    ]}
                  >
                    {p.rank === 1
                      ? "🥇"
                      : p.rank === 2
                      ? "🥈"
                      : p.rank === 3
                      ? "🥉"
                      : `#${p.rank}`}
                  </Text>

                  <Text
                    style={[
                      styles.rankLevel,
                      { flex: 2 },
                    ]}
                  >
                    {getTierForRank(p.rank)}
                  </Text>

                  <Text
                    style={[
                      styles.rankPrize,
                      { flex: 1 },
                    ]}
                  >
                   {selectedTournament.prizeModel === "dynamic"
  ? `${formatNum(
      (selectedTournament.collectedFunds ?? 0) *
      ((p.percentage ?? 0) / 100)
    )} $`
  : `${formatNum(p.amount ?? 0)} $`
}
                  </Text>
                </View>
              )
            )}
          </>
        )}
<View style={{ height: 32 }} />

   </ScrollView>



   ) : (

<ScrollView
  style={{
    flex: 1,
    width: "100%",
  }}
  contentContainerStyle={{
    paddingBottom: 30,
  }}
  showsVerticalScrollIndicator={true}
  nestedScrollEnabled={true}
>
{/* YOUR POSITION — DIRECTLY ABOVE TABLE HEADER */}
{selectedTournament && (
 <View style={{ width: "100%" }}>
   {renderPinnedUserRow()}
    </View>
   )}
{(() => {

    const PAGE_SIZE = 10;

    const totalPages = Math.max(
      1,
      Math.ceil(sortedLeaderboard.length / PAGE_SIZE)
    );

    const safePage = Math.min(
      leaderboardPage,
      totalPages - 1
    );

    const pageStart = safePage * PAGE_SIZE;

    const pageUsers = sortedLeaderboard.slice(
      pageStart,
      pageStart + PAGE_SIZE
    );

    return (
      <>
        {/* LEADERBOARD HEADER */}

{/* LEADERBOARD HEADER */}
<View style={styles.mobileLeaderboardHeader}>

          <Text style={styles.mobileRankHeader}>
            #
          </Text>

          <Text style={styles.mobileParticipantHeader}>
            Participant
          </Text>

          <Text style={styles.mobileBalanceHeader}>
            Balance
          </Text>

        </View>


        {/* 10 USERS PER PAGE */}
        {pageUsers.map((item, pageIndex) => {

          const globalIndex =
            pageStart + pageIndex;

          const rank =
            globalIndex + 1;

          const prize = selectedTournament
            ? getPrizeForRank(
                rank,
                selectedTournament
              )
            : null;

          const performance =
            (item.balance ?? 0) -
            (selectedTournament?.startingBalance ?? 0) -
            (item.rebuyInjectedTotal ?? 0);

          return (

            <Pressable
              key={item.id}
              onPress={() => {}}
              android_ripple={{
                color: "rgba(255,255,255,0.06)"
              }}
              style={[
                styles.mobileLeaderboardRow,

               isCurrentUserRow(item) &&
  styles.currentRowHighlight,
              ]}
            >

              {/* ROW 1 */}
              <View
                style={styles.mobileLeaderboardTopRow}
              >

                <Text
                  style={styles.mobileRankCell}
                >
                  {rank === 1
                    ? "🥇"
                    : rank === 2
                    ? "🥈"
                    : rank === 3
                    ? "🥉"
                    : rank}
                </Text>


                <View
                  style={
                    styles.mobileParticipantCell
                  }
                >
                  <NameWithFlag
                    username={
                      item.username ||
                      item.email ||
                      "Player"
                    }
                    countryCode={
                      item.countryCode
                    }
                  />
                </View>


                <Text
                  style={styles.mobileBalanceCell}
                >
                  {formatNum(item.balance)}T
                </Text>

              </View>


              {/* ROW 2 */}
              <View
                style={styles.mobileLeaderboardStatsRow}
              >

                {/* PERFORMANCE */}
                <View
                  style={styles.mobileStatCell}
                >
                  <Text
                    style={
                      styles.mobileStatLabel
                    }
                  >
                    Performance
                  </Text>

                  <Text
                    style={[
                      styles.mobileStatValue,
                      {
                        color:
                          performance >= 0
                            ? "#22c55e"
                            : "#ef4444",
                      },
                    ]}
                  >
                    {performance >= 0
                      ? "+"
                      : ""}
                    {formatNum(
                      performance
                    )}$
                  </Text>
                </View>


                {/* TIER */}
                <View
                  style={styles.mobileStatCell}
                >
                  <Text
                    style={
                      styles.mobileStatLabel
                    }
                  >
                    Level
                  </Text>

                  <Text
                    style={[
                      styles.mobileStatValue,
                      {
                        color: "#facc15"
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {getTierForRank(rank)}
                  </Text>
                </View>


                {/* PRIZE */}
                <View
                  style={styles.mobileStatCell}
                >
                  <Text
                    style={
                      styles.mobileStatLabel
                    }
                  >
                    Prize
                  </Text>

                  <Text
                    style={[
                      styles.mobileStatValue,
                      {
                        color: "#22c55e"
                      },
                    ]}
                  >
                    {prize !== null
                      ? `${formatNum(
                          prize
                        )} $`
                      : "-"}
                  </Text>
                </View>

              </View>

            </Pressable>
          );
        })}

        {/* PAGE NAVIGATION */}
        <View
          style={styles.leaderboardPagination}
        >

          <Pressable
            disabled={safePage === 0}
            onPress={() =>
              setLeaderboardPage(
                Math.max(0, safePage - 1)
              )
            }
            style={[
              styles.leaderboardPageButton,
              safePage === 0 &&
                styles.leaderboardPageButtonDisabled,
            ]}
          >
            <Text
              style={
                styles.leaderboardPageArrow
              }
            >
              ‹
            </Text>
          </Pressable>


          <Text
            style={
              styles.leaderboardPageText
            }
          >
            {safePage + 1}/{totalPages}
          </Text>


          <Pressable
            disabled={
              safePage >= totalPages - 1
            }
            onPress={() =>
              setLeaderboardPage(
                Math.min(
                  totalPages - 1,
                  safePage + 1
                )
              )
            }
            style={[
              styles.leaderboardPageButton,
              safePage >= totalPages - 1 &&
                styles.leaderboardPageButtonDisabled,
            ]}
          >
            <Text
              style={
                styles.leaderboardPageArrow
              }
            >
              ›
            </Text>
          </Pressable>

        </View>

      </>
    );

  })()}


</ScrollView>

    )}


  </View>

</View>
)}

           </View>
           
    </View>

  </KeyboardAvoidingView>
</Pressable>
</Modal>

{showFAQ && (
  <View style={styles.faqOverlay}>

    <View style={styles.faqContainer}>

      {/* FAQ HEADER */}
      <View style={styles.faqHeader}>
        <Text style={styles.faqTitle}>
          Frequently Asked Questions
        </Text>

        {/* FAQ CLOSE X */}
        <Pressable
          style={styles.faqCloseButton}
          onPress={() => {
            setShowFAQ(false);
            setOpenFAQ(null);
          }}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10,
          }}
        >
          <Ionicons
            name="close"
            size={22}
            color="#fff"
          />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 10,
        }}
      >
{/* FAQ 1 */}
<Pressable
  style={styles.faqQuestionRow}
  onPress={() =>
    setOpenFAQ(openFAQ === 0 ? null : 0)
  }
>
  <Text style={styles.faqQuestion}>
    🏆 What is an FX ARENA Tournament?
  </Text>

  <Ionicons
    name={
      openFAQ === 0
        ? "chevron-up"
        : "chevron-down"
    }
    size={18}
    color="#94a3b8"
  />
</Pressable>

{openFAQ === 0 && (
  <View style={styles.faqAnswerBox}>
    <Text style={styles.faqAnswer}>
      An FX ARENA Tournament is a competitive forex
      trading simulation where participants trade with
      virtual funds under the same tournament conditions.
      Traders compete on a live leaderboard, and their
      Trading Performance determines their ranking.
      {"\n\n"}
      It is designed to make forex learning more practical,
      engaging, and competitive without using real trading
      capital.
    </Text>
  </View>
)}
        {/* FAQ 1 */}
        <Pressable
          style={styles.faqQuestionRow}
          onPress={() =>
            setOpenFAQ(openFAQ === 0 ? null : 0)
          }
        >
          <Text style={styles.faqQuestion}>
            🏆 How do I receive my prize if I win?
          </Text>

          <Ionicons
            name={
              openFAQ === 0
                ? "chevron-up"
                : "chevron-down"
            }
            size={18}
            color="#94a3b8"
          />
        </Pressable>

        {openFAQ === 0 && (
          <View style={styles.faqAnswerBox}>
            <Text style={styles.faqAnswer}>
              Your prize will be credited to your FX ARENA
              wallet within 24 hours after the tournament ends
              and the results are confirmed.
            </Text>
          </View>
        )}

        {/* FAQ 2 */}
        <Pressable
          style={styles.faqQuestionRow}
          onPress={() =>
            setOpenFAQ(openFAQ === 1 ? null : 1)
          }
        >
          <Text style={styles.faqQuestion}>
            💰 Where can I find my prize?
          </Text>

          <Ionicons
            name={
              openFAQ === 1
                ? "chevron-up"
                : "chevron-down"
            }
            size={18}
            color="#94a3b8"
          />
        </Pressable>

        {openFAQ === 1 && (
          <View style={styles.faqAnswerBox}>
            <Text style={styles.faqAnswer}>
              Your winnings will automatically appear in your
              FX ARENA wallet.
            </Text>
          </View>
        )}

        {/* FAQ 3 */}
        <Pressable
          style={styles.faqQuestionRow}
          onPress={() =>
            setOpenFAQ(openFAQ === 2 ? null : 2)
          }
        >
          <Text style={styles.faqQuestion}>
            ⏱️ When are results finalized?
          </Text>

          <Ionicons
            name={
              openFAQ === 2
                ? "chevron-up"
                : "chevron-down"
            }
            size={18}
            color="#94a3b8"
          />
        </Pressable>

        {openFAQ === 2 && (
          <View style={styles.faqAnswerBox}>
            <Text style={styles.faqAnswer}>
              Results are finalized after the tournament
              officially ends and the leaderboard is verified.
            </Text>
          </View>
        )}

        {/* FAQ 4 */}
        <Pressable
          style={styles.faqQuestionRow}
          onPress={() =>
            setOpenFAQ(openFAQ === 3 ? null : 3)
          }
        >
          <Text style={styles.faqQuestion}>
            🏆 How is the winner determined?
          </Text>

          <Ionicons
            name={
              openFAQ === 3
                ? "chevron-up"
                : "chevron-down"
            }
            size={18}
            color="#94a3b8"
          />
        </Pressable>

        {openFAQ === 3 && (
          <View style={styles.faqAnswerBox}>
            <Text style={styles.faqAnswer}>
              Winners are ranked according to their final
              Trading Performance.
            </Text>
          </View>
        )}

        {/* FAQ 5 */}
        <Pressable
          style={styles.faqQuestionRow}
          onPress={() =>
            setOpenFAQ(openFAQ === 4 ? null : 4)
          }
        >
          <Text style={styles.faqQuestion}>
            📊 Can I see my position during the tournament?
          </Text>

          <Ionicons
            name={
              openFAQ === 4
                ? "chevron-up"
                : "chevron-down"
            }
            size={18}
            color="#94a3b8"
          />
        </Pressable>

        {openFAQ === 4 && (
          <View style={styles.faqAnswerBox}>
            <Text style={styles.faqAnswer}>
              Yes. Your current position and performance are
              displayed on the live leaderboard in the leaderboard tab section.
            </Text>
          </View>
        )}

        {/* FAQ 6 */}
        <Pressable
          style={styles.faqQuestionRow}
          onPress={() =>
            setOpenFAQ(openFAQ === 5 ? null : 5)
          }
        >
          <Text style={styles.faqQuestion}>
            ♻️ What is a Rebuy?
          </Text>

          <Ionicons
            name={
              openFAQ === 5
                ? "chevron-up"
                : "chevron-down"
            }
            size={18}
            color="#94a3b8"
          />
        </Pressable>

        {openFAQ === 5 && (
          <View style={styles.faqAnswerBox}>
            <Text style={styles.faqAnswer}>
              A Rebuy allows you to continue trading after your
              tournament balance falls below the permitted level.
              The rebuy follows the tournament's applicable
              rebuy fee and rules.
            </Text>
          </View>
        )}

      </ScrollView>
    </View>
  </View>
)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07081a", padding: 12 },
  pageTitle: { fontSize: 16, fontWeight: "800", color: "#ff7ab6", 
  textAlign: "center",  marginTop: 2,  marginBottom: 2, },
  // card
  card: { backgroundColor: "#12122a",  padding: 10,  marginVertical: 8,  borderRadius: 14,  shadowColor: "#000",
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
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", 
  justifyContent: "center", alignItems: "center" },
modalContent: {
  width: "96%",
  height: "85%",
  maxWidth: 650,
  backgroundColor: "#12122a",
  borderRadius: 18,
  padding: 12,
  overflow:"hidden",
},

 closeButton:{
  position:"absolute",
  top:12,
  right:12,

  width:42,
  height:42,

  borderRadius:21,

  backgroundColor:"#1b2142",

  justifyContent:"center",
  alignItems:"center",

  zIndex:100,
},
  modalTitle:{
  color:"#fff",
  fontSize:17,
  fontWeight:"900",

  paddingRight:45,

  marginBottom:10,
},
  modalMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  modalPrize: { color: "#47f11dff", fontWeight: "800" },
  modalInfo: { color: "#cbd5e1" },

 tabRow: {
  flexDirection: "row",
  width: "100%",
  marginVertical: 10,
},

tabBtn: {
  flex: 1,
  minHeight: 48,
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: 12,
  borderRadius: 10,
  marginHorizontal: 4,
},

tabActive: {
  backgroundColor: "#1e3a5f",
},


tabTextActive: {
  color: "#ffffff",
  fontSize: 15,
  fontWeight: "800",
},


  rankRow:{
    flexDirection:"row",
    alignItems:"center",

    paddingVertical:10,

    borderBottomWidth:1,

    borderBottomColor:"#232844",
},

rankCell:{
    color:"#fff",
    fontWeight:"700",
    textAlign:"center",
},

rankLevel:{
    color:"#facc15",
    fontWeight:"800",
    textAlign:"center",
},

rankPrize:{
    color:"#22c55e",
    fontWeight:"900",
    textAlign:"center",
},
  tabText: { color: "#9ca3af", fontWeight: "700" },
 
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#ff7ab6", marginTop: 12 },
  infoText: { color: "#d1d5db", marginTop: 8 },
 infoBox: {
  backgroundColor: "#12142e",
  padding: 12,
  borderRadius: 12,
  marginTop: 8,
  borderWidth: 1,
  borderColor: "#2b2b3a",
},
prizeTypeBadge:{
  alignSelf:"flex-start",
  marginTop:3,
  paddingHorizontal:7,
  paddingVertical:2,
  borderRadius:20,
},

prizeTypeText:{
  color:"#cbd5e1",
  fontSize:10,
  fontWeight:"700",
},

dynamicBadge:{
  backgroundColor:"rgba(34,197,94,0.15)",
},

guaranteedBadge:{
  backgroundColor:"rgba(250,204,21,0.15)",
},
  buttonRow: { flexDirection: "row", marginTop: 12, gap: 8 },
  registerBtn: { flex: 1, backgroundColor: "#0b74ff", padding: 12, borderRadius: 10, alignItems: "center", marginRight: 6 },
  rebuyBtn: { flex: 1, backgroundColor: "#059669", padding: 12, borderRadius: 10, alignItems: "center", marginLeft: 6 },
  btnText: { color: "#fff", fontWeight: "900" },
  btnTextAlt: { color: "#fff", fontWeight: "700" },
  // leaderboard table
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, 
  borderBottomColor: "#2b2b3a",paddingBottom: 8,  marginTop: 10,   width: "100%",
  alignItems: "center", },
 
tableRow: {   flexDirection: "row",  alignItems: "center",
  justifyContent: "space-between",  width: "100%", 
  paddingVertical: 8,  borderBottomWidth: 1, 
   borderBottomColor: "#12121a",
},


  tableCol: { flex: 1, color: "#fff" },
  pinnedRow: { backgroundColor: "#12142e", padding: 10, borderRadius: 10, borderTopWidth: 1,
 
 borderColor: "#2b2b3a", marginBottom: 8, flexDirection: "row", alignItems: "center" },
  
  pinnedCol: { color: "#fff", fontWeight: "900" },
currentRowHighlight: {
  backgroundColor: "rgba(34,197,94,0.10)",
  borderLeftWidth: 3,
  borderLeftColor: "#22c55e",
},
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
  cardBigTitle: { fontSize: 18, fontWeight: "900", color: "rgba(236, 220, 220, 1)", marginBottom: 4,},
metaText: {color: "#aaa", fontSize: 11, marginTop: 4,},

cardPrizeRow: { marginTop: 8, marginBottom: 6,},

cardPrizeText: { color: "#facc15", fontWeight: "bold", fontSize: 16,},

cardFeeText: { color: "#60a5fa", fontWeight: "bold", fontSize: 15,},


startingBalanceText: { color: "#22c55e", fontWeight: "700", fontSize: 14, marginTop: 4 },
tableColName: {  width: 120,  flexShrink:1,  color: "#fff",},
tableColSmall: {width: 40,    flexShrink:1, color: "#fff", fontWeight: "700" },
tableColBalance: {  width: 95,  flexShrink:1,   color: "#38bdf8",  fontWeight: "700",},
tableColPerformance: {  width: 125,  flexShrink:1,   color: "#22c55e", fontWeight: "700", },

tableColTier: {  width: 145,  flexShrink:1,  color: "#facc15",  fontWeight: "700",},

tableColPrize: {  width: 95,   flexShrink:1, color: "#22c55e",  fontWeight: "800",},

rankHeaderRow: {
  flexDirection: 'row',
  marginTop: 8,
  paddingBottom: 4,
  borderBottomWidth: 1,
  borderBottomColor: '#2b2b3a',
  alignItems: 'center',
  justifyContent: 'flex-start',
},

rankHeaderCol: {
  color: '#cbd5e1',
  fontWeight: '900',

  flex: 1, // make column flexible by default
},
cardStatsRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  marginTop: 8,
},

timeColumn: {
  flex: 1,
  minWidth: 0,
  marginRight: 8,
},

statsColumn: {
  flexShrink: 0,
  alignItems: "flex-end",
},

cardDate: {
  color: "#9ca3af",
  fontSize: 12,
  marginTop: 2,
},
leftPrizePoolText: {
  color: "#fde047",
  fontWeight: "900",
  fontSize: 12,

  textShadowColor: "#facc15",
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 14,

  flex: 1,
},
moneyRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: 6,
},

leftMoneyText: {
  color: "#60a5fa",
  fontWeight: "800",
  fontSize: 11,
  flex: 1,
},

rightMoneyText: {
  color: "#fbbf24",
  fontWeight: "900",
  fontSize: 12,
  textAlign: "right",
  flex: 1,
},

dividerLine: {
  width: 1,
  height: "70%",
  backgroundColor: "rgba(255,255,255,0.12)",
  marginHorizontal: 8,
},
mobileLeaderboardHeader: {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: "#2b2b3a",
},

mobileRankHeader: {
  width: 40,
  color: "#9ca3af",
  fontWeight: "900",
},

mobileParticipantHeader: {
  flex: 1,
  color: "#9ca3af",
  fontWeight: "900",
},

mobileBalanceHeader: {
  width: 90,
  textAlign: "right",
  color: "#9ca3af",
  fontWeight: "900",
},

mobileLeaderboardRow: {
  width: "100%",
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: "#2b2b3a",
},

mobileLeaderboardTopRow: {
  width: "100%",
  flexDirection: "row",
  alignItems: "center",
},

mobileRankCell: {
  width: 40,
  color: "#fff",
  fontWeight: "800",
  fontSize: 14,
},

mobileParticipantCell: {
  flex: 1,
  minWidth: 0,
  paddingRight: 8,
},

mobileBalanceCell: {
  width: 90,
  textAlign: "right",
  color: "#38bdf8",
  fontWeight: "800",
},

mobileLeaderboardStatsRow: {
  width: "100%",
  flexDirection: "row",
  marginTop: 8,
},

mobileStatCell: {
  flex: 1,
  minWidth: 0,
  alignItems: "center",
  justifyContent: "center",
},

mobileStatLabel: {
  color: "#94a3b8",
  fontSize: 10,
  fontWeight: "700",
  marginBottom: 2,
  textAlign: "center",
},

mobileStatValue: {
  fontSize: 11,
  fontWeight: "900",
  textAlign: "center",
},

leaderboardPagination: {
  width: "100%",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: 14,
  paddingBottom: 10,
},

leaderboardPageButton: {
  width: 70,
  height: 44,
  borderRadius: 8,
  backgroundColor: "#353a4a",
  alignItems: "center",
  justifyContent: "center",
},

leaderboardPageButtonDisabled: {
  opacity: 0.35,
},

leaderboardPageArrow: {
  color: "#fff",
  fontSize: 30,
  lineHeight: 32,
},

leaderboardPageText: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "900",
},
faqFloatingButton: {
  position: "absolute",
  top: 5,
  right: 28,
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: "#1b2142",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 100,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.12)",
},

faqFloatingText: {
  color: "#fff",
  fontSize: 17,
  fontWeight: "900",
},


faqButton: {
  backgroundColor: "#1f2937",
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 10,
},

faqButtonText: {
  color: "#fff",
  fontSize: 11,
  fontWeight: "900",
},


faqOverlay: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,

  justifyContent: "center",
  alignItems: "center",

  paddingHorizontal: 16,

  zIndex: 2000,
  elevation: 20,

  backgroundColor: "rgba(0,0,0,0.35)",
},



faqContainer: {
  width: "92%",
  maxWidth: 420,
  maxHeight: "75%",

  backgroundColor: "#0f172a",

  borderRadius: 18,

  paddingHorizontal: 14,
  paddingVertical: 14,

  borderWidth: 1,
  borderColor: "rgba(59,130,246,0.45)",

  shadowColor: "#000",
  shadowOpacity: 0.5,
  shadowRadius: 18,
  shadowOffset: {
    width: 0,
    height: 8,
  },

  elevation: 20,
},

faqHeader: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",

  paddingBottom: 10,
  marginBottom: 4,

  borderBottomWidth: 1,
  borderBottomColor: "rgba(255,255,255,0.08)",
},

faqTitle: {
  color: "#ff7ab6",
  fontSize: 15,
  fontWeight: "900",

  flex: 1,
  paddingRight: 10,
},

faqCloseButton: {
  width: 34,
  height: 34,

  borderRadius: 17,

  backgroundColor: "#1b2142",

  justifyContent: "center",
  alignItems: "center",

  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.12)",
},

faqQuestionRow: {
  minHeight: 48,

  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",

  paddingVertical: 10,
  paddingHorizontal: 10,

  marginTop: 7,

  backgroundColor: "#141b33",

  borderRadius: 10,

  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.06)",
},

faqQuestion: {
  color: "#fff",
  fontSize: 12,
  fontWeight: "800",

  flex: 1,
  paddingRight: 8,
},

faqAnswerBox: {
  backgroundColor: "#11182d",

  paddingHorizontal: 12,
  paddingVertical: 10,

  marginTop: 2,

  borderBottomLeftRadius: 10,
  borderBottomRightRadius: 10,

  borderLeftWidth: 1,
  borderRightWidth: 1,
  borderBottomWidth: 1,

  borderColor: "rgba(59,130,246,0.18)",
},

faqAnswer: {
  color: "#cbd5e1",
  fontSize: 11,
  lineHeight: 17,
},
pageHeader: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  marginBottom: 2,
},

pageFAQButton: {
  position: "absolute",
  right: 0,
  backgroundColor: "#0f172a",
  borderWidth: 1,
  borderColor: "rgba(251,191,36,0.35)",
  paddingHorizontal: 9,
  paddingVertical: 4,
  borderRadius: 999,
},

pageFAQText: {
  color: "#fbbf24",
  fontSize: 11,
  fontWeight: "800",
},
yourPositionContainer: {
  marginTop: 0,
  marginBottom: 4,
  paddingTop: 0,
  borderTopWidth: 1,
  borderTopColor: "rgba(34,197,94,0.25)",
},

yourPositionTitle: {
  color: "#22c55e",
  fontSize: 13,
  fontWeight: "900",
  marginBottom: 7,
  textAlign: "left",
},
yourPositionFixedArea: {
  width: "100%",
  paddingTop: 8,
  paddingBottom: 2,
  backgroundColor: "#12122a",
  borderTopWidth: 1,
  borderTopColor: "rgba(34,197,94,0.25)",
},

yourPositionCard: {
  width: "100%",
  backgroundColor: "rgba(34,197,94,0.08)",
  borderWidth: 1,
  borderColor: "rgba(34,197,94,0.45)",
  borderRadius: 12,
  padding: 10,
},

yourPositionHeader: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
},

yourPositionRank: {
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: "800",
},

yourPositionTopRow: {
  width: "100%",
  flexDirection: "row",
  alignItems: "center",
},

yourPositionRankCell: {
  width: 40,
},

yourPositionRankNumber: {
  color: "#fff",
  fontSize: 14,
  fontWeight: "900",
},

yourPositionParticipant: {
  flex: 1,
  minWidth: 0,
  paddingRight: 8,
},

youLabel: {
  color: "#22c55e",
  fontSize: 9,
  fontWeight: "900",
  marginTop: 2,
},

yourPositionBalance: {
  width: 90,
  alignItems: "flex-end",
},

yourPositionLabel: {
  color: "#94a3b8",
  fontSize: 9,
  fontWeight: "700",
},

yourPositionBalanceValue: {
  color: "#38bdf8",
  fontSize: 12,
  fontWeight: "900",
  marginTop: 2,
},

yourPositionStatsRow: {
  width: "100%",
  flexDirection: "row",
  marginTop: 9,
  paddingTop: 8,
  borderTopWidth: 1,
  borderTopColor: "rgba(255,255,255,0.06)",
},

yourPositionStatCell: {
  flex: 1,
  minWidth: 0,
  alignItems: "center",
  justifyContent: "center",
},

yourPositionStatLabel: {
  color: "#94a3b8",
  fontSize: 9,
  fontWeight: "700",
  marginBottom: 2,
  textAlign: "center",
},

yourPositionStatValue: {
  fontSize: 10,
  fontWeight: "900",
  textAlign: "center",
},

yourPositionEmpty: {
  color: "#94a3b8",
  fontSize: 11,
  textAlign: "center",
  paddingVertical: 8,
},
currentUserPositionRow: {
  width: "100%",
  minHeight: 58,
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 10,
  paddingVertical: 8,
  marginBottom: 4,
  backgroundColor: "rgba(34,197,94,0.10)",
  borderWidth: 1,
  borderColor: "rgba(34,197,94,0.45)",
  borderRadius: 10,
},

currentUserRankBox: {
  width: 55,
  alignItems: "center",
  justifyContent: "center",
},

currentUserRankText: {
  fontSize: 16,
  fontWeight: "800",
  color: "#22c55e",
},

currentUserNameBox: {
  flex: 1,
  paddingHorizontal: 8,
},

currentUserName: {
  fontSize: 14,
  fontWeight: "700",
  color: "#ffffff",
},

currentUserLabel: {
  marginTop: 2,
  fontSize: 9,
  fontWeight: "700",
  color: "#22c55e",
},

currentUserBalanceBox: {
  width: 100,
  alignItems: "flex-end",
},

currentUserBalance: {
  fontSize: 13,
  fontWeight: "700",
  color: "#ffffff",
},

currentUserPerformance: {
  marginTop: 2,
  fontSize: 10,
  fontWeight: "700",
},
});
