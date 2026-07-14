import { useRouter } from "expo-router";
import {
    collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Easing, FlatList, StyleSheet, Text, TouchableOpacity,
  View,
} from "react-native";
import { useApp } from "../app/AppContext";
import { db } from "../firebaseConfig";

type Alert = {
  id: string;
  message?: string;
  deleted?: boolean;
  type?: string;
  tournamentId?: string;
  read?: boolean;
  createdAt?: any;
};

export default function AlertScreen() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();

  const { authUser, setUnreadCount } = useApp(); // context


const loadAlerts = useCallback(() => {
  if (!authUser) return;

  const q = query(
    collection(db, "alerts"),
    orderBy("createdAt", "desc")
  );

const unsub = onSnapshot(q, async (snap) => {
 
 const alertData: Alert[] = snap.docs.map((d) => ({
  id: d.id,
  ...(d.data() as Omit<Alert, "id">),
  createdAt: d.data().createdAt?.toDate?.() || new Date(),
}));

// 🔥 Load this user's deleted alerts
const deletedSnap = await getDocs(
  query(
    collection(db, "userAlerts"),
    where("userId", "==", authUser.uid),
    where("deleted", "==", true)
  )
);

const deletedIds = new Set(
  deletedSnap.docs.map((d) => d.data().alertId)
);

// Hide deleted alerts
const filtered = alertData.filter((a) => !deletedIds.has(a.id));

setAlerts(filtered);

const unread = filtered.filter((a) => !a.read).length;
setUnreadCount(unread);

setLoading(false);
});

  return unsub;
}, [authUser, setUnreadCount]);;

useEffect(() => {
  if (!authUser) return;

  const unsub = loadAlerts();
  return () => unsub?.();
}, [authUser, loadAlerts]);

useEffect(() => {
  if (!authUser) {
    setAlerts([]);
    setUnreadCount(0);
    setLoading(false);
    return;
  }

  loadAlerts();
}, [authUser, loadAlerts, setUnreadCount]);


const markRead = async (id: string) => {
  if (!authUser) return;

  await updateDoc(doc(db, "alerts", id), {
    read: true,
  });

  setAlerts((prev) =>
    prev.map((a) => (a.id === id ? { ...a, read: true } : a))
  );

  setUnreadCount((prev) => Math.max(prev - 1, 0));
};

const deleteAlert = async (id: string) => {
  if (!authUser) return;

  await setDoc(
    doc(db, "userAlerts", `${authUser.uid}_${id}`),
    {
      userId: authUser.uid,
      alertId: id,
      deleted: true,
      read: true,
    },
    { merge: true }
  );

  setAlerts((prev) => prev.filter((a) => a.id !== id));

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
  onDelete={deleteAlert}
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

const AlertCard = ({ item, router, expanded, onToggle, onRead, onDelete }: any) => {
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
    <View
  style={[
    styles.card,
    {
      backgroundColor:
        item.type === "tournament" ? "#331c4fff" : "#1c1c1c",
    },
  ]}
>
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
     <TouchableOpacity
  onPress={() => onDelete(item.id)}
  style={{ marginTop: 10 }}
>
  <Text style={{ color: "red", fontSize: 13 }}>
    Delete
  </Text>
</TouchableOpacity>
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