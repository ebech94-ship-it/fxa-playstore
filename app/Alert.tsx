import { useRouter } from "expo-router";
import {
  collection,
  doc,
 
  orderBy,
  query,
  setDoc,
  where,
  getDocs,
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
import { useApp } from "../app/AppContext";
import { db } from "../firebaseConfig";

export default function AlertScreen() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();

  const { authUser, setUnreadCount } = useApp(); // context

useEffect(() => {
  if (!authUser) return;

  const loadAlerts = async () => {
    // 1️⃣ get alerts
    const q = query(collection(db, "alerts"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    const alertData = snap.docs.map((d) => {
      const raw = d.data();
      return {
        id: d.id,
        ...raw,
        createdAt: raw.createdAt || { toDate: () => new Date() },
      };
    });

    // 2️⃣ get alerts this user has read
    const userQ = query(
      collection(db, "userAlerts"),
      where("userId", "==", authUser.uid)
    );

    const userSnap = await getDocs(userQ);

    const readIds = new Set<string>();

    userSnap.forEach((doc) => {
      const data: any = doc.data();
      if (data.read) {
        readIds.add(data.alertId);
      }
    });

    // 3️⃣ merge read status
    const merged = alertData.map((a) => ({
      ...a,
      read: readIds.has(a.id),
    }));

    setAlerts(merged);

    // 4️⃣ set unread count
    const unread = merged.filter((a) => !a.read).length;
    setUnreadCount(unread);

    setLoading(false);
  };

  loadAlerts();
}, [authUser, setUnreadCount]);

const markRead = async (id: string) => {
  if (!authUser) return;

  // 1️⃣ Add entry to userAlerts
 await setDoc(
  doc(db, "userAlerts", `${authUser.uid}_${id}`),
  {
    userId: authUser.uid,
    alertId: id,
    read: true,
    deleted: false,
  },
  { merge: true }
);

  // 2️⃣ Update local state immediately
  setAlerts((prev) =>
    prev.map((a) => (a.id === id ? { ...a, read: true } : a))
  );

  // 3️⃣ Adjust unread count instantly for UI
  setUnreadCount((prev) => Math.max(prev - 1, 0));
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No alerts yet</Text>
          </View>
        }
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
    return;
  }

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
    <View style={styles.card}>
     <TouchableOpacity onPress={handlePress}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: typeColor[item.type] || "#7cf" }]}>
            {typeLabel[item.type] || "Notification"}
          </Text>

          {!item.read && (
            <Animated.View style={[styles.dot, { backgroundColor: glowColor }]} />
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
            Tap to read
          </Text>
        )}
      </TouchableOpacity>
    </View>
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

  emptyContainer: {
    padding: 30,
    alignItems: "center",
  },

  emptyText: {
    color: "#777",
    fontSize: 16,
  },
});