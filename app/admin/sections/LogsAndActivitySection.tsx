import { getAuth } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";

type Log = { id: string; message: string; timestamp: number };
type Activity = { id: string; admin: string; action: string; timestamp: number };
type LogOrActivity = Log | Activity;

export default function LogsAndActivitySection() {
  const [tab, setTab] = useState<"logs" | "activity">("logs");
  const [logs, setLogs] = useState<Log[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  // fetchData wrapped in useCallback to fix useEffect dependency warning
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const endpoint =
        tab === "logs"
          ? "https://forexapp2-backend.onrender.com/admin/system-logs"
          : "https://forexapp2-backend.onrender.com/admin/activity-history";

      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (tab === "logs") setLogs(data);
      else setActivities(data);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // renderItem uses proper type and runtime check for union type
  const renderItem = ({ item, index }: { item: LogOrActivity; index: number }) => (
    <View style={styles.row}>
      <Text style={styles.index}>{index + 1}.</Text>
      <Text style={styles.message}>
        {"message" in item ? item.message : `${item.admin} → ${item.action}`}
      </Text>
      <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📜 System Logs & Admin Activity</Text>

      <View style={styles.tabs}>
        {["logs", "activity"].map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t as "logs" | "activity")}
            style={[styles.tabBtn, tab === t && styles.tabActive]}
          >
            <Text style={styles.tabText}>{t === "logs" ? "Audit Logs" : "Admin Activity"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" />
      ) : (
        <FlatList<LogOrActivity>
          data={tab === "logs" ? logs : activities}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07081a", padding: 16 },
  title: { fontSize: 20, fontWeight: "900", color: "#fff", marginBottom: 16 },
  tabs: { flexDirection: "row", marginBottom: 12 },
  tabBtn: { flex: 1, padding: 10, backgroundColor: "#111", alignItems: "center", borderRadius: 8, marginHorizontal: 4 },
  tabActive: { backgroundColor: "#3b82f6" },
  tabText: { color: "#fff", fontWeight: "700" },
  row: { flexDirection: "row", padding: 10, backgroundColor: "#12122a", marginBottom: 6, borderRadius: 8, alignItems: "center" },
  index: { width: 30, color: "#facc15", fontWeight: "800" },
  message: { flex: 1, color: "#fff" },
  timestamp: { color: "#9ca3af", fontSize: 12, marginLeft: 10 },
});