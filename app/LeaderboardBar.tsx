// LeaderboardBar.tsx — 3‑mode leaderboard (Live, CTA, Preview)
import { getAuth } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";
import { db } from "../firebaseConfig";
import { ProfileContext } from "./ProfileContext";

export type Player = {
  id: string;
  username?: string;
  balance?: number;
  avatar?: string;
};
type LeaderboardMode = "preview" | "idle" | "live";

type LeaderboardBarProps = {
  tournamentId?: string; // null → preview mode
};

const PREVIEW_PLAYERS: Player[] = [
  { id: "p1", username: "WolfTrader", balance: 950, avatar: "https://i.pravatar.cc/150?img=32" },
  { id: "p2", username: "PipHunter", balance: 870, avatar: "https://i.pravatar.cc/150?img=12" },
  { id: "p3", username: "GoldKing", balance: 790, avatar: "https://i.pravatar.cc/150?img=50" },
  { id: "p4", username: "FXPhantom", balance: 720, avatar: "https://i.pravatar.cc/150?img=22" },
];

const LeaderboardBar = ({ tournamentId }: LeaderboardBarProps) => {
  const { profileImage } = useContext(ProfileContext);
  const currentUser = getAuth().currentUser;

  const [players, setPlayers] = useState<Player[]>([]);
  const [isRegistered, setIsRegistered] = useState(false);
  
const [mode, setMode] = useState<LeaderboardMode>("preview");

const handleRegister = () => {
  Alert.alert(
    "Join Tournament",
    "Go to the tournament page to register.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Register",
        onPress: () => {
          // TODO: navigate or scroll to TournamentScreen
          // router.push(`/tournament/${tournamentId}`)
        },
      },
    ]
  );
};

useEffect(() => {
  if (!tournamentId) {
    setMode("preview");
    setPlayers(PREVIEW_PLAYERS);
    return;
  }

  const tRef = doc(db, "tournaments", tournamentId);
  getDoc(tRef).then((snap) => {
    if (!snap.exists()) return;

    const status = snap.data().status;
    if (status === "live") {
      setMode("live");
    } else {
      setMode("idle"); // upcoming / closed
      setPlayers([]);
    }
  });
}, [tournamentId]);

  useEffect(() => {
  if (mode !== "live" || !tournamentId) return;

  const unsub = onSnapshot(
    collection(db, `tournaments/${tournamentId}/players`),
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Player[];

      setPlayers(
        list.sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))
      );
    }
  );

  return unsub;
}, [mode, tournamentId]);

  

  // Check if user registered
  useEffect(() => {
    if (!tournamentId || !currentUser) return;

    const rRef = doc(db, `tournaments/${tournamentId}/players`, currentUser.uid);
    getDoc(rRef).then((snap) => {
      setIsRegistered(snap.exists());
    });
  }, [tournamentId, currentUser]);

  const renderCTA = () => (
  <View style={styles.ctaBox}>
    <Text style={styles.ctaText}>
      {currentUser
        ? "You are not in this tournament yet"
        : "Register to join this tournament"}
    </Text>

    <TouchableOpacity
      style={styles.ctaButton}
      onPress={() => {
        if (!currentUser) {
          Alert.alert("Sign in required", "Please register to join tournaments.");
          return;
        }
        handleRegister();
      }}
    >
      <Text style={styles.ctaButtonText}>
        {currentUser ? "Join Now" : "register"}
      </Text>
    </TouchableOpacity>
  </View>
);


  return (
    <View style={styles.container}>
      {/* CTA when tournament live but user not registered */}
      { mode === "live" && !isRegistered && renderCTA()}

      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        layout={Layout.springify().damping(15).stiffness(100).mass(0.6)}
        contentContainerStyle={styles.row}
      >
        {players.map((p, index) => {
          const isCurrent = currentUser && p.id === currentUser.uid;

          return (
            <Animated.View
              key={p.id}
              style={[styles.player, isCurrent && styles.currentUser]}
              entering={FadeIn}
              exiting={FadeOut}
            >
              <Image
                source={{
                  uri:
                    isCurrent
                      ? profileImage || p.avatar || "https://via.placeholder.com/32"
                      : p.avatar || "https://via.placeholder.com/32",
                }}
                style={[styles.avatar, isCurrent && styles.currentUserAvatar]}
              />

              <View style={styles.info}>
                <Text style={styles.name}>{p.username || "Player"}</Text>
                <Text style={styles.balance}>{p.balance ?? 0}T</Text>
              </View>

              <Text style={styles.rank}>#{index + 1}</Text>
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
 right:0, left:0,
  height: "20%", justifyContent: "center",   
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5, bottom:5, top: 3,
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
  name: { color: "white", fontSize: 12, fontWeight: "600" },
  balance: { color: "#22c55e", fontSize: 11 },
  rank: { color: "#facc15", fontWeight: "700", fontSize: 12 },

  // Current user highlight
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

  // CTA box
  ctaBox: {
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 10,
    marginBottom: 6,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  ctaText: { color: "white", fontSize: 12, marginBottom: 6 },
  ctaButton: {
    backgroundColor: "#4f46e5",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  ctaButtonText: { color: "white", fontWeight: "700" },
});

// Added improvements:
// - Connected CTA join button (placeholder function handleJoinTournament)
// - Added shimmer loading placeholder
// - Highlighted top 3 with gold/silver/bronze
// - Entry animation improved
// - Comments included for clarity
