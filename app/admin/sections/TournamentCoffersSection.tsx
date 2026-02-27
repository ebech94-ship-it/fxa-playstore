import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth } from "../../../firebaseConfig";

interface TournamentCoffer {
  tournamentId: string;
  tournamentName?: string;
  registration?: { count: number; totalAmount: number };
  rebuys?: { count: number; totalAmount: number };
  transferredToTreasury?: number; // track already transferred amount
}

export default function TournamentCoffersSection() {
  const [coffers, setCoffers] = useState<TournamentCoffer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCoffers = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();

      const res = await fetch(
        "https://forexapp2-backend.onrender.com/admin/tournamentCoffers",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setCoffers(data);
    } catch (error) {
      console.log("Coffers fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoffers();
  }, []);

  const handleTransfer = async (tournamentId: string, amount: number) => {
    if (amount <= 0) {
      Alert.alert("No funds to transfer", "This tournament has no funds available.");
      return;
    }

    const confirm = await new Promise<boolean>((resolve) =>
      Alert.alert(
        "Confirm Transfer",
        `Are you sure you want to transfer ${amount} FRS to treasury?`,
        [
          { text: "Cancel", onPress: () => resolve(false), style: "cancel" },
          { text: "Yes", onPress: () => resolve(true) },
        ]
      )
    );

    if (!confirm) return;

    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();

      const res = await fetch(
        `https://forexapp2-backend.onrender.com/admin/moveTournamentFundsToTreasury`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tournamentId, amount }),
        }
      );

      if (!res.ok) throw new Error("Failed to transfer");

      Alert.alert("Success", `Transferred ${amount} FRS to treasury.`);
      fetchCoffers(); // refresh the table
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Failed to transfer funds.");
    }
  };

  const skeletonRows = Array.from({ length: 5 }).map((_, i) => (
    <View key={i} style={[styles.tableRow, { opacity: 0.3 }]}>
      {Array.from({ length: 8 }).map((__, idx) => (
        <Text key={idx} style={[styles.tableCell, { backgroundColor: "#333", borderRadius: 4 }]}>
          {" "}
        </Text>
      ))}
    </View>
  ));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>🏆 Tournament Coffers Overview</Text>

      {/* Table Header */}
      <View style={styles.tableHeader}>
        {["#", "Tournament", "Reg Count", "Reg Funds", "Rebuy Count", "Rebuy Funds", "Total Funds", "Action"].map((h, i) => (
          <Text key={i} style={[styles.tableCell, i === 0 ? styles.colNumber : styles.colDefault]}>
            {h}
          </Text>
        ))}
      </View>

      {/* Table Rows */}
      {loading
        ? skeletonRows
        : coffers.map((t, idx) => {
            const regCount = t.registration?.count || 0;
            const regFunds = t.registration?.totalAmount || 0;
            const rebuyCount = t.rebuys?.count || 0;
            const rebuyFunds = t.rebuys?.totalAmount || 0;
            const totalFunds = regFunds + rebuyFunds;
            const remaining = totalFunds - (t.transferredToTreasury || 0);

            return (
              <View
                key={t.tournamentId}
                style={[styles.tableRow, idx % 2 === 0 ? styles.evenRow : styles.oddRow]}
              >
                <Text style={[styles.tableCell, styles.colNumber]}>{idx + 1}</Text>
                <Text style={[styles.tableCell, styles.colDefault]}>{t.tournamentName || t.tournamentId}</Text>
                <Text style={[styles.tableCell, styles.colDefault]}>{regCount}</Text>
                <Text style={[styles.tableCell, styles.colDefault]}>{regFunds} FRS</Text>
                <Text style={[styles.tableCell, styles.colDefault]}>{rebuyCount}</Text>
                <Text style={[styles.tableCell, styles.colDefault]}>{rebuyFunds} FRS</Text>
                <Text style={[styles.tableCell, styles.colDefault, styles.totalCell]}>{totalFunds} FRS</Text>
                
                {/* Transfer button */}
                <TouchableOpacity
                  style={styles.transferButton}
                  onPress={() => handleTransfer(t.tournamentId, remaining)}
                >
                  <Text style={styles.transferButtonText}>Transfer</Text>
                </TouchableOpacity>
              </View>
            );
          })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#0e0e1a", flexGrow: 1 },
  heading: { fontSize: 20, fontWeight: "700", color: "#00ffcc", marginBottom: 16, textAlign: "center" },
  tableHeader: { flexDirection: "row", backgroundColor: "#1a1a40", paddingVertical: 10, paddingHorizontal: 5, borderRadius: 8, marginBottom: 6 },
  tableRow: { flexDirection: "row", paddingVertical: 12, paddingHorizontal: 5, alignItems: "center" },
  tableCell: { color: "#fff", fontSize: 13, flex: 1, textAlign: "center" },
  colNumber: { flex: 0.5, fontWeight: "600" },
  colDefault: { flex: 1, textAlign: "center" },
  totalCell: { fontWeight: "700", color: "#00ffcc" },
  evenRow: { backgroundColor: "#111" },
  oddRow: { backgroundColor: "#1a1a2e" },

  // Glowing transfer button
  transferButton: {
    backgroundColor: "#00ffcc",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    shadowColor: "#00ffcc",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  transferButtonText: { color: "#0e0e1a", fontWeight: "700", fontSize: 12 },
});