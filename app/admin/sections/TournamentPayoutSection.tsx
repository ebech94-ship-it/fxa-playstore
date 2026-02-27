// TournamentPayoutSection.tsx

import { getAuth } from "firebase/auth";
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../../firebaseConfig";

interface Tournament {
  id: string;
  name?: string;
  endTime: number;
  payoutStructure?: { rank: number; amount: number }[];
}

interface Player {
  id: string;
  username?: string;
  email?: string;
  balance: number;
}

export default function TournamentPayoutSection() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] =
    useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [paidMap, setPaidMap] = useState<Record<string, boolean>>({});
  const [loadingPay, setLoadingPay] = useState<string | null>(null);

  // 🔹 Load finished tournaments
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "tournaments"), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((t) => Date.now() > t.endTime);

      setTournaments(list);
    });

    return () => unsub();
  }, []);

  // 🔹 Load players + payout status when tournament selected
  useEffect(() => {
    if (!selectedTournament) return;

    const q = query(
      collection(db, "tournaments", selectedTournament.id, "players"),
      orderBy("balance", "desc")
    );

    const unsub = onSnapshot(q, async (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      setPlayers(list);

      // check already paid users
      const payoutsSnap = await getDocs(
        collection(db, "tournaments", selectedTournament.id, "payouts")
      );

      const paid: Record<string, boolean> = {};
      payoutsSnap.docs.forEach((d) => {
        paid[d.id] = true;
      });

      setPaidMap(paid);
    });

    return () => unsub();
  }, [selectedTournament]);

  // 🔹 Pay winner
  const handlePay = async (
    userId: string,
    rank: number,
    amount: number
  ) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return Alert.alert("Error", "Admin not authenticated");

    setLoadingPay(userId);

    try {
      const token = await user.getIdToken();

      const response = await fetch(
        "https://forexapp2-backend.onrender.com/admin/pay-tournament-winner",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tournamentId: selectedTournament?.id,
            userId,
            amount,
            rank,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      Alert.alert("Success", "Winner paid successfully");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoadingPay(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏆 Tournament Payouts</Text>

      {!selectedTournament ? (
        <FlatList
          data={tournaments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.tournamentCard}
              onPress={() => setSelectedTournament(item)}
            >
              <Text style={styles.tournamentName}>
                {item.name || "Tournament"}
              </Text>
              <Text style={styles.smallText}>
                Ended: {new Date(item.endTime).toLocaleString()}
              </Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <>
          <TouchableOpacity
            onPress={() => setSelectedTournament(null)}
          >
            <Text style={styles.backBtn}>⬅ Back</Text>
          </TouchableOpacity>

          <FlatList
            data={players}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const rank = index + 1;
              const payout = selectedTournament.payoutStructure?.find(
                (p) => p.rank === rank
              );

              if (!payout) return null;

              const alreadyPaid = paidMap[item.id];

              return (
                <View style={styles.row}>
                  <Text style={styles.rank}>#{rank}</Text>
                  <Text style={styles.name}>
                    {item.username || item.email}
                  </Text>
                  <Text style={styles.amount}>
                    {payout.amount} $
                  </Text>

                  {alreadyPaid ? (
                    <Text style={styles.paid}>✅ Paid</Text>
                  ) : (
                    <TouchableOpacity
                      style={styles.payBtn}
                      disabled={loadingPay === item.id}
                      onPress={() =>
                        handlePay(item.id, rank, payout.amount)
                      }
                    >
                      {loadingPay === item.id ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.payText}>Pay</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#07081a", flex: 1 },
  title: { fontSize: 20, fontWeight: "900", color: "#fff", marginBottom: 16 },
  tournamentCard: {
    backgroundColor: "#12122a",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  tournamentName: { color: "#fff", fontWeight: "800", fontSize: 16 },
  smallText: { color: "#9ca3af", fontSize: 12 },
  backBtn: { color: "#3b82f6", marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: "#12122a",
    padding: 10,
    borderRadius: 10,
  },
  rank: { width: 40, color: "#facc15", fontWeight: "800" },
  name: { flex: 1, color: "#fff" },
  amount: { width: 80, color: "#22c55e", fontWeight: "800" },
  payBtn: {
    backgroundColor: "#16a34a",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  payText: { color: "#fff", fontWeight: "800" },
  paid: { color: "#22c55e", fontWeight: "900" },
});