import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { auth } from "../../../firebaseConfig";

interface TournamentCoffer {
  id: string;
  name: string;
  entryFee: number;
  rebuyFee: number;

  registrationCount: number;
  registrationTotal: number;

  rebuyCount: number;
  rebuyTotal: number;

  totalGenerated: number;
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
        "https://forexapp2-backend.onrender.com/admin/tournament/coffers",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();
      setCoffers(data.tournaments || []);
    } catch (error) {
      console.log("Coffers fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoffers();
  }, []);

  const skeletonRows = Array.from({ length: 5 }).map((_, i) => (
    <View key={i} style={[styles.tableRow, { opacity: 0.3 }]}>
      {Array.from({ length: 8 }).map((__, idx) => (
       <Text key={idx} style={[styles.cell, { backgroundColor: "#333", height: 14 }]} />
      ))}
    </View>
  ));

  return (
    <ScrollView horizontal>
      <View>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.heading}>🏆 Tournament Ledger</Text>

          {/* HEADER */}
          <View style={styles.tableHeader}>
            {[
              "Tournament",
              "Entry",
              "Reg #",
              "Reg Total",
              "Rebuy Fee",
              "Rebuy #",
              "Rebuy Total",
              "Total",
            ].map((h, i) => (
              <Text key={i} style={styles.headerCell}>
                {h}
              </Text>
            ))}
          </View>

          {/* BODY */}
          {loading
            ? skeletonRows
            : coffers.map((t, idx) => (
                <View key={t.id} style={styles.tableRow}>
                  <Text style={styles.cell}>{t.name}</Text>
                  <Text style={styles.cell}>{t.entryFee}</Text>
                  <Text style={styles.cell}>{t.registrationCount}</Text>
                  <Text style={styles.cell}>{t.registrationTotal}</Text>
                  <Text style={styles.cell}>{t.rebuyFee}</Text>
                  <Text style={styles.cell}>{t.rebuyCount}</Text>
                  <Text style={styles.cell}>{t.rebuyTotal}</Text>
                  <Text style={[styles.cell, styles.total]}>
                    {t.totalGenerated}
                  </Text>
                </View>
              ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#0e0e1a",
  },

  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#00ffcc",
    marginBottom: 16,
    textAlign: "center",
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1a1a40",
    paddingVertical: 10,
  },

  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#222",
  },

  headerCell: {
    color: "#fff",
    fontWeight: "700",
    width: 110,
    textAlign: "center",
  },

  cell: {
    color: "#fff",
    width: 110,
    textAlign: "center",
  },

  total: {
    color: "#00ffcc",
    fontWeight: "700",
  },
});