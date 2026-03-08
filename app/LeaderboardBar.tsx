// LeaderboardBar.tsx — Fixed & clean version
import { useEffect, useState } from "react";

import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

import {
  BackHandler,
  FlatList, Image, Modal, Pressable, StyleSheet, Text, View,
  useWindowDimensions
} from "react-native";
import CountryFlag from "react-native-country-flag";
import Animated, { FadeOut, Layout, SlideInRight } from "react-native-reanimated";
import { AccountType, useApp } from "./AppContext";



export type Player = {
  id: string;
  username?: string;
  balance?: number;
  avatar?: string;
  countryCode?: string;
};

export type LeaderboardBarProps = {
  activeAccount: AccountType;
  username?: string;
  countryCode?: string;
  tournamentBalance?: number;
  demoBalance?: number; // NEW
};


type PlayerRowProps = {
  username: string;
  countryCode: string;
};

const PlayerRow = ({ username, countryCode }: PlayerRowProps) => (
  <View style={{ flexDirection: "row", alignItems: "center" }}>
    <CountryFlag isoCode={countryCode} size={14} />
    <Text style={{ marginLeft: 6, color: "#fff", fontWeight: "600",fontSize: 12 }}>{username}</Text>
  </View>
);

// Fallback preview players
const PREVIEW_PLAYERS: Player[] = [
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
  activeAccount,
  tournamentBalance, demoBalance
}: LeaderboardBarProps) => {


  const { authUser, profile, tournaments } = useApp();

const activeTourney =
  activeAccount.type === "tournament"
    ? tournaments.find((t) => t.tournamentId === activeAccount.tournamentId)
    : null;

  const currentUser = authUser;
const { width, height } = useWindowDimensions();
const isLandscape = width > height;
  
 const [showFull, setShowFull] = useState(false); 
  const [livePlayers, setLivePlayers] = useState<Player[]>([]);

const [loadingLive, setLoadingLive] = useState(false);
const PAGE_SIZE = 50;
const [page, setPage] = useState(1);
const [pagedPlayers, setPagedPlayers] = useState<Player[]>([]);





useEffect(() => {
  if (activeAccount.type !== "demo") return;

  setLoadingLive(true);

  const q = query(
    collection(db, "demoBalances"),
    orderBy("balance", "desc")
  );

  const unsub = onSnapshot(q, (snap) => {
    const players: Player[] = snap.docs.map((d) => {
      const data = d.data() as Omit<Player, "id">;
      return {
        id: d.id,
        ...data,
      };
    });
    setLivePlayers(players);
    setLoadingLive(false);
  });

  return () => unsub();
}, [activeAccount.type]);

useEffect(() => {
  if (activeAccount.type !== "tournament" || !activeAccount.tournamentId) {
    setLivePlayers([]);
    setLoadingLive(false);
    return;
  }

  setLoadingLive(true);

  const q = query(
    collection(
      db,
      "tournaments",
      activeAccount.tournamentId,
      "players"
    ),
    orderBy("balance", "desc")
  );

  const unsub = onSnapshot(q, (snap) => {
  const players: Player[] = snap.docs.map((d) => {
    const data = d.data() as Omit<Player, "id">;
    return {
      id: d.id,
      ...data,
    };
  });

    setLivePlayers(players);
    setLoadingLive(false);
  });

  return () => unsub();
}, [activeAccount]);






const isTournamentLive =
  activeAccount.type === "tournament" && !!activeTourney?.tournamentId;


const players: Player[] = activeAccount.type === "demo"
  ? livePlayers          // Fetch from demoAccounts collection
  : isTournamentLive
  ? livePlayers          // Tournament live leaderboard
  : PREVIEW_PLAYERS;     // Fallback

// ✅ Override current user's balance for instant demo updates
const displayPlayers = players.map((p) => {
  const isCurrent = currentUser && p.id === currentUser.uid;

  // If this is the demo account of the current user, force the local demoBalance
  if (activeAccount.type === "demo" && isCurrent) {
    return { ...p, balance: demoBalance ?? p.balance };
  }

  return p;
});
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
  setPagedPlayers(displayPlayers.slice(0, page * PAGE_SIZE));
}, [displayPlayers, page]);

const chunkSize = isLandscape ? 1 : 2; // 1 row in landscape, 2 rows in portrait

const chunkedPlayers: Player[][] = [];

for (let i = 0; i < displayPlayers.length; i += chunkSize) {
  chunkedPlayers.push(displayPlayers.slice(i, i + chunkSize));

}

return (
 <View
  style={[
    styles.container,
    { height: isLandscape ? 70 : height * 0.2 }]}>
    {/* Wrapper for relative positioning of floating button */}
    <View style={{ position: "relative" }}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        layout={Layout.springify().damping(15).stiffness(100).mass(0.6)}
        contentContainerStyle={styles.row}
      >
        {loadingLive && isTournamentLive && (
          <Text style={{ color: "#9ca3af", fontSize: 12, marginRight: 10 }}>
            Loading live leaderboard…
          </Text>
        )}

    {chunkedPlayers.map((pair, columnIndex) => (
  <View key={columnIndex} style={{ marginRight: 10 }}>
    {pair.map((p, rowIndex) => {
      const index = columnIndex * 2 + rowIndex;
      const isCurrent = currentUser && p.id === currentUser.uid;

      let topColor;
      if (index === 0) topColor = "#FFD700";
      else if (index === 1) topColor = "#C0C0C0";
      else if (index === 2) topColor = "#CD7F32";

      return (
        <Animated.View
          key={p.id}
          style={[
            styles.player,
             { width: 120 },
            isCurrent && styles.currentUser,
            topColor && { borderColor: topColor, borderWidth: 2 },
            { marginBottom: 6 } // space between the 2 rows
          ]}
          entering={SlideInRight.springify()}
          exiting={FadeOut}
          layout={Layout.springify()}
        >
          <Image
            source={{
              uri: isCurrent
                ? profile?.avatarUrl || p.avatar || "https://via.placeholder.com/32"
                : p.avatar || "https://via.placeholder.com/32",
            }}
            style={[styles.avatar, isCurrent && styles.currentUserAvatar]}
          />

          <View style={styles.info}>
            <PlayerRow
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
              {activeAccount.type === "tournament" && isCurrent
                ? tournamentBalance ?? p.balance ?? 0
                : p.balance ?? 0}
              T
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
  top: "35%",   // centers it vertically
  height: 32,   // slim horizontal button
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: 10,
  backgroundColor: "#174355",
  borderRadius: 10,
  shadowColor: "#000",
  shadowOpacity: 0.25,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 2 },
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
            padding: 5,
            justifyContent: "center",
          }}
        >
          <Pressable
  onPress={() => setShowFull(false)}
  style={{
    position: "absolute",
    top: 20,        // some distance from top
    right: 20,      // some distance from right edge
    padding: 8,     // bigger touch area
    borderRadius: 8,
    backgroundColor: "rgba(248,113,113,0.2)", // subtle background for visibility
    zIndex: 10,
  }}
>
  <Text style={{ color: "#f87171", fontSize: 16, fontWeight: "700" }}>✖</Text>
</Pressable>

         <FlatList
  data={pagedPlayers}                     // only the players for current page
  keyExtractor={(p) => p.id}
  numColumns={3}                           // keep grid-like layout
  columnWrapperStyle={{ justifyContent: "space-between", marginBottom: 10 }}
  onEndReached={() => setPage((prev) => prev + 1)}    // load next page
  onEndReachedThreshold={0.5}             // trigger when near bottom
  renderItem={({ item, index }) => (
    <View style={[styles.player, { width: 120, marginBottom: 6 }]}>
      <Image
        source={{ uri: item.avatar || "https://via.placeholder.com/32" }}
        style={styles.avatar}
      />
      <View style={styles.info}>
        <PlayerRow
          username={item.username || "Player"}
          countryCode={item.countryCode || "CM"}
        />
        <Text style={styles.balance}>{item.balance ?? 0}T</Text>
      </View>
      <Text style={styles.rank}>#{index + 1}</Text>
    </View>
  )}
/>
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
  balance: { color: "#22c55e", fontSize: 11 },
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
