// LeaderboardBar.tsx — Fixed & clean version
import { useEffect, useState } from "react";

import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

import { Image, StyleSheet, Text, View } from "react-native";
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
};


type PlayerRowProps = {
  username: string;
  countryCode: string;
};

const PlayerRow = ({ username, countryCode }: PlayerRowProps) => (
  <View style={{ flexDirection: "row", alignItems: "center" }}>
    <CountryFlag isoCode={countryCode} size={18} />
    <Text style={{ marginLeft: 6, color: "#fff", fontWeight: "600" }}>{username}</Text>
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
  tournamentBalance
}: LeaderboardBarProps) => {


  const { authUser, profile, tournaments } = useApp();

const activeTourney =
  activeAccount.type === "tournament"
    ? tournaments.find((t) => t.tournamentId === activeAccount.tournamentId)
    : null;

  const currentUser = authUser;

  
  const [livePlayers, setLivePlayers] = useState<Player[]>([]);

const [loadingLive, setLoadingLive] = useState(false);



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


const players: Player[] = isTournamentLive
  ? livePlayers
  : PREVIEW_PLAYERS;



  return (
    <View style={styles.container}>
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

  {players.map((p, index) => {

          const isCurrent = currentUser && p.id === currentUser.uid;

          // Highlight top 3
          let topColor;
          if (index === 0) topColor = "#FFD700"; // Gold
          else if (index === 1) topColor = "#C0C0C0"; // Silver
          else if (index === 2) topColor = "#CD7F32"; // Bronze

          return (
            <Animated.View
              key={p.id}
              style={[
                styles.player,
                isCurrent && styles.currentUser,
                topColor && { borderColor: topColor, borderWidth: 2 }
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
                  username={isCurrent ? profile?.username || p.username || "You"
                 : p.username || "Player"}
                  countryCode={
  isCurrent ? toISO2(profile?.country) : p.countryCode || "CM"}                />
                <Text style={styles.balance}>
  {activeAccount.type === "tournament" && isCurrent
    ? isCurrent ? tournamentBalance ?? p.balance ?? 0 : p.balance ?? 0

    : p.balance ?? 0}T
</Text>

              </View>

              <Text style={[styles.rank, topColor ? { color: topColor } : {}]}>#{index + 1}</Text>
            </Animated.View>
          );
        })}
      </Animated.ScrollView>
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
    height: "20%",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    bottom: 5,
    top: 3,
  },
  player: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 6,
  },
  info: { marginRight: 6 },
  balance: { color: "#22c55e", fontSize: 11 },
  rank: { color: "#facc15", fontWeight: "700", fontSize: 12 },
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
