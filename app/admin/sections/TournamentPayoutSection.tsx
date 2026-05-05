// TournamentPayoutSection.tsx

import { getAuth } from "firebase/auth";
import {
  collection,

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
  paidOut?: boolean;
  payoutLocked?: boolean;
  payoutStructure?: { rank: number; amount: number }[];
}

interface Participant {
  id: string;
  username?: string;
  email?: string;
  balance: number;
  performance?: number;
}

export default function TournamentPayoutSection() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] =
    useState<Tournament | null>(null);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingPayout, setLoadingPayout] = useState(false);

const [processing, setProcessing] = useState(false);
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

  // 🔹 Load participants when tournament selected
  useEffect(() => {
    if (!selectedTournament) return;

    const q = query(
      collection(db, "tournaments", selectedTournament.id, "participants"),
      orderBy("performance", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      setParticipants(list);
    });

    return () => unsub();
  }, [selectedTournament]);

  // 🔥 BULK PAYOUT (NEW SYSTEM)
  const processFullPayout = async () => {
    if (!selectedTournament) return;

    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      return Alert.alert("Error", "Admin not authenticated");
    }

    setLoadingPayout(true);

    try {
      const token = await user.getIdToken();

      const res = await fetch(
        "https://forexapp2-backend.onrender.com/admin/process-tournament-payout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tournamentId: selectedTournament.id,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      Alert.alert("Success", "Tournament payout completed");

      // optional: refresh UI state instantly
      setSelectedTournament({
        ...selectedTournament,
        paidOut: true,
        payoutLocked: true,
      });

    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoadingPayout(false);
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

              <Text style={styles.smallText}>
                Status: {item.paidOut ? "✅ Paid" : "⏳ Pending"}
              </Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={{ flex: 1 }}>
          {/* BACK BUTTON */}
          <TouchableOpacity onPress={() => setSelectedTournament(null)}>
            <Text style={styles.backBtn}>⬅ Back</Text>
          </TouchableOpacity>

          {/* STATUS */}
          <Text style={styles.status}>
            Status:{" "}
            {selectedTournament.paidOut
              ? "✅ Completed"
              : selectedTournament.payoutLocked
              ? "⏳ Processing"
              : "🟡 Pending"}
          </Text>

         {/* BULK PAYOUT BUTTON (SAFE + ANTI DOUBLE EXECUTION) */}
{!selectedTournament?.paidOut && (
  <TouchableOpacity
    style={[
      styles.bulkBtn,
      (processing ||
        selectedTournament?.payoutLocked ||
        loadingPayout) && { opacity: 0.5 },
    ]}
    disabled={
      processing ||
      selectedTournament?.payoutLocked ||
      loadingPayout
    }
    onPress={async () => {
      if (processing) return;

      setProcessing(true);

      try {
        await processFullPayout();
      } finally {
        setProcessing(false);
      }
    }}
  >
    {processing || loadingPayout ? (
      <ActivityIndicator color="#fff" />
    ) : selectedTournament?.payoutLocked ? (
      <Text style={styles.bulkBtnText}>⏳ Processing...</Text>
    ) : selectedTournament?.paidOut ? (
      <Text style={styles.bulkBtnText}>🔒 Completed</Text>
    ) : (
      <Text style={styles.bulkBtnText}>
        🚀 Process Full Tournament Payout
      </Text>
    )}
  </TouchableOpacity>
)}

          {/* PARTICIPANTS LIST (READ ONLY) */}
          <FlatList
            data={participants}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const rank = index + 1;

              const payout =
                selectedTournament.payoutStructure?.find(
                  (p) => p.rank === rank
                );

              if (!payout) return null;

              return (
                <View style={styles.row}>
                  <Text style={styles.rank}>#{rank}</Text>
                  <Text style={styles.name}>
                    {item.username || item.email}
                  </Text>
                  <Text style={styles.amount}>
                    {payout.amount} $
                  </Text>
                </View>
              );
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#07081a",
    flex: 1,
  },

  title: {
    fontSize: 20,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 16,
  },

  tournamentCard: {
    backgroundColor: "#12122a",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },

  tournamentName: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },

  smallText: {
    color: "#9ca3af",
    fontSize: 12,
  },

  backBtn: {
    color: "#3b82f6",
    marginBottom: 10,
  },

  status: {
    color: "#9ca3af",
    marginBottom: 10,
  },

  bulkBtn: {
    backgroundColor: "#16a34a",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: "center",
  },

  bulkBtnText: {
    color: "#fff",
    fontWeight: "800",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: "#12122a",
    padding: 10,
    borderRadius: 10,
  },

  rank: {
    width: 40,
    color: "#facc15",
    fontWeight: "800",
  },

  name: {
    flex: 1,
    color: "#fff",
  },

  amount: {
    width: 80,
    color: "#22c55e",
    fontWeight: "800",
  },
});