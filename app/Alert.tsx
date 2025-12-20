import { useRouter } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../firebaseConfig";

export default function AlertScreen() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const q = query(collection(db, "alerts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          ...raw,
          createdAt: raw.createdAt || { toDate: () => new Date() },
        };
      });
      setAlerts(data);
      setLoading(false);
    });

    return unsub;
  }, []);

  const markRead = async (id: string) => {
    await updateDoc(doc(db, "alerts", id), { read: true });
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read: true } : a))
    );
  };

  if (loading) return <ActivityIndicator size="large" color="#7cf" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <AlertCard
            item={item}
            router={router}
            expanded={expandedId === item.id}
            onToggle={() =>
              setExpandedId(expandedId === item.id ? null : item.id)
            }
            onRead={markRead}
          />
        )}
      />
    </View>
  );
}

const AlertCard = ({ item, router, expanded, onToggle, onRead }: any) => {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let anim: any;
    if (!item.read) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 1000,
            easing: Easing.ease,
            useNativeDriver: false,
          }),
          Animated.timing(glow, {
            toValue: 0,
            duration: 1000,
            easing: Easing.ease,
            useNativeDriver: false,
          }),
        ])
      );
      anim.start();
    }
    return () => anim?.stop?.();
  }, [item.read, glow]);

  const glowColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: ["#333", "#7cf"],
  });
const handlePress = () => {
  onRead(item.id);

  if (item.type === "tournament" && item.tournamentId) {
    router.push({
      pathname: "/Tournament",
      params: { tournamentId: item.tournamentId },
    });
    return; // 🛑 STOP here
  }

  // 📩 Only non-tournament alerts expand
  onToggle();
};


  const typeColor: any = {
    admin: "#7cf",
    deposit: "#22c55e",
    withdraw: "#ef4444",
    payout: "#facc15",
    tournament: "#42f5b0",
  };

  const typeLabel: any = {
    admin: "Admin Message",
    deposit: "Deposit",
    withdraw: "Withdrawal",
    payout: "Prize / Payout",
    tournament: "Tournament",
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: typeColor[item.type] || "#7cf" }]}>
          {typeLabel[item.type] || "Notification"}
        </Text>

        {!item.read && (
          <Animated.View
            style={[styles.dot, { backgroundColor: glowColor }]}
          />
        )}
      </View>

      <Text style={styles.msg} numberOfLines={expanded ? undefined : 2}>
        {item.message}
      </Text>

      <Text style={styles.date}>
        {item.createdAt?.toDate?.().toLocaleString?.() || "—"}
      </Text>

      {item.type !== "tournament" && (
        <Text style={styles.expandHint}>
          {expanded ? "Tap to collapse" : "Tap to read"}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", padding: 10 },

  card: {
    backgroundColor: "#1c1c1c",
    padding: 12,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: { fontSize: 17, fontWeight: "bold" },

  msg: { color: "#fff", marginTop: 6, fontSize: 15 },

  date: { color: "#aaa", marginTop: 6, fontSize: 12 },

  expandHint: {
    color: "#777",
    fontSize: 11,
    marginTop: 4,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowColor: "#7cf",
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
});
