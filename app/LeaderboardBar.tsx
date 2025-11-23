import { getAuth } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import React, { useContext, useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";
import { db } from "../firebaseConfig";
import { ProfileContext } from "./ProfileContext";

export type Player = {
  id: string;
  username?: string;
  balance?: number;
  avatar?: string;
};

type LeaderboardBarProps = {
  players?: Player[]; // ✅ Optional prop from parent
};

const LeaderboardBar = ({ players: parentPlayers }: LeaderboardBarProps) => {
  const { profileImage } = useContext(ProfileContext);
  const currentUser = getAuth().currentUser;
  const [players, setPlayers] = useState<Player[]>([]);

  // ✅ Firestore real-time listener (only if parentPlayers not provided)
  useEffect(() => {
    if (parentPlayers && parentPlayers.length > 0) {
      // Parent provided players → skip Firestore listener
      setPlayers(parentPlayers);
      return;
    }

    const unsub = onSnapshot(collection(db, "players"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Player[];

      // Sort by balance descending
      const sorted = data.sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
      setPlayers(sorted);
    });

    return () => unsub();
  }, [parentPlayers]);

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        layout={Layout.springify().damping(15).stiffness(100).mass(0.6)}
        contentContainerStyle={styles.row}
      >
        {players.map((item, index) => {
          const isCurrentUser = currentUser && item.id === currentUser.uid;

          return (
            <Animated.View
              key={item.id}
              style={[styles.player, isCurrentUser && styles.currentUser]}
              entering={FadeIn}
              exiting={FadeOut}
            >
              <Image
  source={{
    uri:
      isCurrentUser
        ? profileImage || item.avatar || "https://via.placeholder.com/32"
        : item.avatar || "https://via.placeholder.com/32",
  }}
  style={[
    styles.avatar,
    isCurrentUser && styles.currentUserAvatar,
  ]}
/>
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.username || "Player"}
                </Text>
                <Text style={styles.balance}>{item.balance ?? 0}T</Text>
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
    backgroundColor: "#0b1220",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
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
  rank: { color: "#facc15", fontWeight: "bold", fontSize: 12 },

  // ✅ Highlight for current user
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
