// LeaderboardBar.tsx — Fixed & clean version

import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import ViewShot from "react-native-view-shot";

import {
  BackHandler, FlatList, Image, Modal, Pressable, Share, StyleSheet, Text,
  TouchableOpacity, View, useWindowDimensions
} from "react-native";
import CountryFlag from "react-native-country-flag";
import Animated, { FadeOut, Layout, SlideInRight } from "react-native-reanimated";
import { AccountType, useApp } from "./AppContext";


export type Participant = {
  id: string;  username?: string;  balance?: number;
  avatar?: string;  countryCode?: string;
  performance?: number;  rankingScore?: number;
startingBalance?: number;
};

export type LeaderboardBarProps = {
  activeAccount: AccountType;
  username?: string;
  countryCode?: string;
  tournamentBalance?: number;
  demoBalance?: number; // NEW
};


type ParticipantRowProps = {
  username: string;
  countryCode: string;
};

const ParticipantRow = ({ username, countryCode }: ParticipantRowProps) => (
  <View style={{ flexDirection: "row", alignItems: "center" }}>
    <CountryFlag isoCode={countryCode} size={14} />
    <Text style={{ marginLeft: 6, color: "#fff", fontWeight: "600",fontSize: 12 }}>{username}</Text>
  </View>
);

// Fallback preview players
const PREVIEW_PARTICIPANTS: Participant[] = [
  { id: "p1", username: "WolfTrader", balance: 950, avatar: "https://i.pravatar.cc/150?img=32", countryCode: "US" },
  { id: "p2", username: "PipHunter", balance: 870, avatar: "https://i.pravatar.cc/150?img=12", countryCode: "GB" },
  { id: "p3", username: "GoldKing", balance: 790, avatar: "https://i.pravatar.cc/150?img=50", countryCode: "FR" },
  { id: "p4", username: "FXPhantom", balance: 720, avatar: "https://i.pravatar.cc/150?img=22", countryCode: "CM" },
];
const COUNTRY_ALIASES: Record<string, string> = {
  // 🇨🇲 Africa (core)
  cameroon: "CM",
  nigeria: "NG",
  ghana: "GH",
  kenya: "KE",
  uganda: "UG",
  tanzania: "TZ",
  rwanda: "RW",
  southafrica: "ZA",
  "south africa": "ZA",
  egypt: "EG",
  morocco: "MA",

  // 🇪🇺 Europe
  france: "FR",
  germany: "DE",
  italy: "IT",
  spain: "ES",
  portugal: "PT",
  netherlands: "NL",
  belgium: "BE",
  switzerland: "CH",
  sweden: "SE",
  norway: "NO",
  finland: "FI",
  poland: "PL",
  ukraine: "UA",
  russia: "RU",

  // 🇬🇧 UK / US
  "united kingdom": "GB",
  uk: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",

  "united states": "US",
  usa: "US",
  america: "US",

  // 🇧🇷 Latin America
  brazil: "BR",
  argentina: "AR",
  chile: "CL",
  colombia: "CO",
  peru: "PE",
  mexico: "MX",

  // 🇨🇦 🇦🇺
  canada: "CA",
  australia: "AU",
  newzealand: "NZ",
  "new zealand": "NZ",
  // 🇮🇳 Asia (HIGH priority)
  india: "IN",
  pakistan: "PK",
  bangladesh: "BD",
    nepal: "NP",
  china: "CN",
  hongkong: "HK",
  singapore: "SG",
  malaysia: "MY",
  indonesia: "ID",
  philippines: "PH",
  thailand: "TH",
  vietnam: "VN",

  japan: "JP",
  southkorea: "KR",
  "south korea": "KR",
  korea: "KR",

  // 🇸🇦 Middle East (traders!)
  uae: "AE",
  "united arab emirates": "AE",
  saudiarabia: "SA",
  "saudi arabia": "SA",
  qatar: "QA",
  kuwait: "KW",
  israel: "IL",
  turkey: "TR",
};


const toISO2 = (country?: string) => {
  if (!country) return "CM";

  const normalized = country.trim().toLowerCase();

  return COUNTRY_ALIASES[normalized] ?? "CM";
};



const LeaderboardBar = ({
  
  tournamentBalance, demoBalance
}: LeaderboardBarProps) => {

const {  authUser,  profile,  activeAccount,  tournaments,  tournamentAccounts,} = useApp();
 

const activeTourney =
  activeAccount.type === "tournament"
    ? tournaments.find((t) => t.tournamentId === activeAccount.tournamentId)
    : null;
const tournamentId = activeTourney?.tournamentId;

const liveTournamentBalance =
  activeAccount.type === "tournament"
    ? (
        tournamentAccounts.find(
          t => t.tournamentId === activeAccount.tournamentId
        )?.balance ?? 0
      )
    : 0;
  const currentUser = authUser;
const { width, height } = useWindowDimensions();
const isLandscape = width > height;
  
 const [showFull, setShowFull] = useState(false); 
 


const [mode, setMode] = useState<"real" | "demo" | "tournament">("real");


const [showSharePreview, setShowSharePreview] = useState(false);
const [liveParticipants, setLiveParticipants] = useState<Participant[]>([]);
const [loadingLive, setLoadingLive] = useState(false);


const shareLeaderboard = async () => {
  try {
    if (!cardRef.current) return;

    // 1. capture image

const uri = await cardRef.current.capture();

const inviteLink = `https://forexarena.vercel.app/?ref=${profile?.publicId}`;
await Share.share({
  url: uri,
  message: `🔥 Try FX Arena Trading Tournaments Platforms' Challenges; Earn Big Daily!

Join here:
${inviteLink}`,
});

  } catch (e) {
    console.log(e);
  }
};

const cardRef = useRef<any>(null);
const copyInviteLink = async () => {
  const link = `https://forexarena.vercel.app/?ref=${profile?.publicId}`;
  await Share.share({ message: link });
};

const participants = useMemo(() => {
  if (mode === "real") return PREVIEW_PARTICIPANTS;
  return liveParticipants;
}, [mode, liveParticipants]);

// ✅ Override current user's balance with AppContext first
const displayParticipants = useMemo(() => {
  return participants.map((p) => {
    const isCurrent = currentUser && p.id === currentUser.uid;

    if (!isCurrent) return p;

   return {
      ...p,
      balance: p.balance ?? 0, // still Firestore source of truth
    };
  });
}, [participants, currentUser]);

const sortedParticipants = [...displayParticipants].sort(
  (a, b) => (b.balance ?? 0) - (a.balance ?? 0)
);

const rankIndex = sortedParticipants.findIndex(
  (p) => p.id === currentUser?.uid
);

const rank = rankIndex >= 0 ? rankIndex + 1 : 1;
const startingTournamentBalance = activeTourney?.startingBalance ?? 0;


useEffect(() => {
  console.log("Leaderboard active account:", activeAccount);
}, [activeAccount]);

useEffect(() => {
  if (activeAccount.type === "demo") setMode("demo");
  else if (activeAccount.type === "tournament") setMode("tournament");
  else setMode("real");
}, [activeAccount.type]);

useEffect(() => {
  
  setShowFull(false);
  setLiveParticipants([]);
}, [mode, tournamentId]);

 useEffect (() => {
  const backAction = () => {
    if (showFull) {
      setShowFull(false);  // close modal
      return true;         // prevent default
    }
    return false;          // default behavior
  };

  const backHandler = BackHandler.addEventListener(
    "hardwareBackPress",
    backAction
  );

  return () => backHandler.remove();

}, [showFull]);

useEffect(() => {
  setLiveParticipants([]);
  setLoadingLive(true);

  let unsub: (() => void) | undefined;

  // 🟡 DEMO LEADERBOARD
  if (mode === "demo") {
    const q = query(
      collection(db, "demoBalances"),
      orderBy("balance", "desc")
    );

    unsub = onSnapshot(q, (snap) => {
     const data = snap.docs.map((d) => {
  const docData = d.data() as Omit<Participant, "id">;

  return {
    id: d.id,
    ...docData,
  };
});

      setLiveParticipants(data);
      setLoadingLive(false);
    });
  }

  // 🟣 TOURNAMENT LEADERBOARD
  else if (mode === "tournament" && tournamentId) {
    const q = query(
      collection(db, "tournaments", tournamentId, "participants"),
        orderBy("balance", "desc")
    );

    unsub = onSnapshot(q, (snap) => {
  const data = snap.docs.map((d) => {
  const dta = d.data() as any;

  return {
    id: d.id,
    ...dta,
    balance: dta.balance ?? 0,
  };
});



requestAnimationFrame(() => {
  setLiveParticipants(data);
});

  setLoadingLive(false);
});
  }

  // 🔵 REAL ACCOUNT (DEFAULT) 
  else {
    setLiveParticipants([]); // or static leaderboard later
    setLoadingLive(false);
  }
  return () => unsub?.();
}, [
  mode,
  tournamentId,
  startingTournamentBalance,
 
])


const chunkSize = isLandscape ? 1 : 2; // 1 row in landscape, 2 rows in portrait

const chunkedParticipants = useMemo(() => {
  const chunks: Participant[][] = [];

  for (let i = 0; i < sortedParticipants.length; i += chunkSize) {
    chunks.push(sortedParticipants.slice(i, i + chunkSize));
  }

  return chunks;
}, [sortedParticipants, chunkSize]);

const topTraders = useMemo(() => {
  return sortedParticipants.slice(0, 5);
}, [sortedParticipants]);


return (
 <View
  style={[
    styles.container,
    { height: isLandscape ? 70 : height * 0.2 }]}>
    {/* Wrapper for relative positioning of floating button */}
    <View style={{ position: "relative" }}>
    {loadingLive && (
  <Text style={{ color: "#fff", fontSize: 10, textAlign: "center" }}>
    Loading leaderboard...
  </Text>
)}
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        layout={Layout.springify().damping(15).stiffness(100).mass(0.6)}
        contentContainerStyle={styles.row}
      >
      

    {chunkedParticipants.map((pair, columnIndex) => (
  <View key={columnIndex} style={{ marginRight: 10 }}>
    {pair.map((p, rowIndex) => {
     const index = columnIndex * chunkSize + rowIndex;
      const isCurrent = currentUser && p.id === currentUser.uid;

      let topColor;
      if (index === 0) topColor = "#FFD700";
      else if (index === 1) topColor = "#C0C0C0";
      else if (index === 2) topColor = "#CD7F32";

      return (
  <Animated.View
  key={p.id}
  entering={SlideInRight.springify()
    .damping(18)
    .stiffness(160)}
  exiting={FadeOut}
  layout={Layout.springify()}
  style={[
    styles.player,
    { width: 120 },
    isCurrent && styles.currentUser,
    topColor && { borderColor: topColor, borderWidth: 2 },
    { marginBottom: 6 },
  ]}
>
          <Image
            source={{
              uri: isCurrent
                ? profile?.avatarUrl || p.avatar || "https://placehold.co/32x32"
                : p.avatar || "https://placehold.co/32x32",
            }}
            style={[styles.avatar, isCurrent && styles.currentUserAvatar]}
          />

          <View style={styles.info}>
            <ParticipantRow
              username={
                isCurrent
                  ? profile?.username || p.username || "You"
                  : p.username || "Player"
              }
              countryCode={
                isCurrent ? toISO2(profile?.country) : p.countryCode || "CM"
              }
            />
           <Text style={styles.balance}>
  {`$${((activeAccount.type === "tournament" && isCurrent
      ? liveTournamentBalance
      : p.balance ?? 0
    ).toFixed(1))}`}
</Text>
          </View>

          <Text
            style={[
              styles.rank,
              topColor ? { color: topColor } : {},
            ]}
          >
            #{index + 1}
          </Text>
        </Animated.View>
      );
    })}
  </View>
))}
      </Animated.ScrollView>

      {/* Floating See All button */}
      <Pressable
        onPress={() => setShowFull(true)}
      style={{
  position: "absolute",
  right: 6,
  top: 35,   // centers it vertically
  height: 50,   // slim horizontal button
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: 10,
  backgroundColor: "#174355",
  borderRadius: 10,
  shadowColor: "#000",
  shadowOpacity: 0.25,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 2 },
  zIndex: 65,
}}
      >
        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}> All</Text>
      </Pressable>
    </View>

    {/* Full leaderboard modal */}
    {showFull && (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showFull}
        onRequestClose={() => setShowFull(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor:"rgba(15,23,39,0.95)",
            padding: 10,
            justifyContent: "center",
          }}
        >
          <Pressable
  onPress={() => setShowFull(false)}
  style={{
    position: "absolute",
    top: 30,        // some distance from top
    right: 30,      // some distance from right edge
    padding: 8,     // bigger touch area
    borderRadius: 8,
    backgroundColor: "rgba(22, 156, 189, 1)", // subtle background for visibility
    zIndex: 10,
  }}
>
  <Text style={{ color: "#f87171", fontSize: 20, fontWeight: "700" }}>✖</Text>
</Pressable>
<TouchableOpacity
  onPress={() => setShowSharePreview(true)}
  style={{
    backgroundColor: "#5A4BE7",
    padding: 30,
    borderRadius: 8,
    marginBottom: 10,
    alignSelf: "center",top:8,
  }}
>
  <Text style={{ color: "white", fontWeight: "bold" }}>
    Take Screenshot & Share
  </Text>
</TouchableOpacity>
<TouchableOpacity
  onPress={copyInviteLink}
  style={{
    backgroundColor: "#1f2937",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    alignSelf: "center",
  }}
>
  <Text style={{ color: "white", fontWeight: "bold" }}>
    Share/Invite 
  </Text>s
</TouchableOpacity>
         <FlatList
data={sortedParticipants}                 // only the players for current page
  keyExtractor={(p) => p.id}
  numColumns={3}                           // keep grid-like layout
  columnWrapperStyle={{ justifyContent: "space-between", marginBottom: 10 }}
  
  onEndReachedThreshold={0.5}             // trigger when near bottom
  renderItem={({ item, index }) => (
    <View style={[styles.player, { width: 120, marginBottom: 6 }]}>
      <Image
        source={{ uri: item.avatar || "https://via.placeholder.com/32" }}
        style={styles.avatar}
      />
      <View style={styles.info}>
        <ParticipantRow
          username={item.username || "Player"}
          countryCode={item.countryCode || "CM"}
        />
       <Text style={styles.balance}>
  {`$${((item.balance ?? 0).toFixed(1))}`}
</Text>
      </View>
      <Text style={styles.rank}>#{index + 1}</Text>
    </View>
  )}
/>
        </View>
      </Modal>
    )}

    {showSharePreview && (
  <Modal visible transparent animationType="fade">
    <View style={{
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center"
    }}>

      {/* SHARE CARD */}
      <ViewShot
  ref={cardRef}
  options={{ format: "png", quality: 1 }}
  style={{
    backgroundColor: "#0f1727",
    padding: 20,
    borderRadius: 16,
    width: 300,
    alignItems: "center"
  }}
>
  {/* BRAND HEADER */}
<Text
  style={{
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 12,
  }}
>
  <Text style={{ color: "#FFCC00" }}>God</Text>
  <Text style={{ color: "#9CA3AF" }}>Speed</Text>
  <Text style={{ color: "#FFCC00" }}> Tech</Text>
</Text>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "bold" }}>
  {activeAccount.type === "tournament"
    ? `🏆 ${activeTourney?.name}`
    : "🌍 FX Arena Global Demo Leaderboard"}
</Text>

      <Text style={{ color: "#fff", marginTop: 10 }}>
  {activeAccount.type === "tournament"
    ? `Tournament Rank #${rank}`
    : `Global Rank #${rank}`}
</Text>

<Text style={{ color: "#facc15", marginTop: 5 }}>
  ${displayParticipants.find(
    p => p.id === currentUser?.uid
  )?.balance ?? 0}
</Text>

<Text
  style={{
    color: "#fff",
    marginTop: 15,
    fontWeight: "bold",
  }}
>
  🏅 Top Traders
</Text>

{topTraders.slice(0,3).map((p, i) => (
  <Text
    key={p.id}
    style={{
      color: "#d1d5db",
      marginTop: 4,
      fontSize: 12,
      fontWeight: "bold",
    }}
  >
    {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} {p.username}
  </Text>
))}
<Text
  style={{
    color: "#60a5fa",
    marginTop: 10,
  }}
>
  👥 {displayParticipants.length} Traders Competing
</Text>

<Text
  style={{
    color: "#22c55e",
    marginTop: 15,
    textAlign: "center",
    fontWeight: "bold",
  }}
>
🔥 Don&apos;t trade alone. Battle traders and climb the leaderboard.!
</Text>

<Text
  style={{
    color: "#60a5fa",
    marginTop: 8,
    fontSize: 11,
    textAlign: "center",
  }}
>
  forexarena.vercel.app/?ref={profile?.publicId}
</Text>

<Text style={{ color: "#fff", marginTop: 10 }}>
  🔥 Join live trading battles, Earn daily.
</Text>
      </ViewShot>

      {/* BUTTONS */}
      <TouchableOpacity
        onPress={shareLeaderboard}
        style={{
          marginTop: 15,
          backgroundColor: "#5A4BE7",
          padding: 10,
          borderRadius: 8
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "bold" }}>
          Share Now
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setShowSharePreview(false)}
        style={{ marginTop: 10 }}
      >
        <Text style={{ color: "#f87171" }}>
          Cancel
        </Text>
      </TouchableOpacity>

    </View>
  </Modal>
)}
  </View>
);
};

export default LeaderboardBar;


const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0f1727ff",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    right: 0,
    left: 0,
   
    justifyContent: "center",
    marginTop: 10
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    bottom: 5,
    top: 1,
  },
  player: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 6,
paddingHorizontal: 6,
    paddingVertical: 4,
      
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
      minHeight: 44
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 6,
  },
  info: {
  flex: 1,           // 👈 this is the key
  marginRight: 4,
},
  balance: { color: "#22c55e", fontSize: 11, fontWeight: "700" },
  rank: { color: "#facc15", fontWeight: "700", fontSize: 12, top:7 },
  currentUser: {
    backgroundColor: "rgba(255,255,255,0.15)",
    shadowColor: "#22c55e",
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  currentUserAvatar: {
    borderWidth: 2,
    borderColor: "#22c55e",
  },
});
