import { db } from "@/lib/firebase"; // adjust path if needed
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from "react-native";



const SettingsSection = () => {
  // GLOW ANIMATION
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1700,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1700,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [glowAnim]);

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,180,255,0.5)", "rgba(160,0,255,0.5)"],
  });

  // SETTINGS STATE
  const [darkMode, setDarkMode] = useState(false);
  const [soundEffects, setSoundEffects] = useState(true);
  const [enablePayouts, setEnablePayouts] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  useEffect(() => {
  const loadSettings = async () => {
    const ref = doc(db, "settings", "app");
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data();
      setEnablePayouts(data.enablePayouts ?? true);
      setMaintenanceMode(data.maintenanceMode ?? false);
    }
  };

  loadSettings();
}, []);

const saveSettings = async () => {
  try {
    await setDoc(doc(db, "settings", "app"), {
      enablePayouts,
      maintenanceMode,
      updatedAt: serverTimestamp()
,
    });

    Alert.alert("Saved", "Settings updated successfully.");
 } catch (error) {
  console.error(error);
  Alert.alert("Error", "Failed to save settings.");
}

};

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View style={[styles.header, { shadowColor: glowColor }]}>
        <Text style={styles.headerText}>Admin Settings</Text>
      </Animated.View>

      {/* 🔧 General Settings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>General</Text>

        {/* DARK MODE */}
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Ionicons name="moon" size={20} color="#0cc" />
            <Text style={styles.rowLabel}>Enable Dark Mode</Text>
          </View>
          <Switch value={darkMode} onValueChange={setDarkMode} />
        </View>

        {/* SOUND EFFECTS */}
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Ionicons name="volume-high" size={20} color="#0cc" />
            <Text style={styles.rowLabel}>Sound Effects</Text>
          </View>
          <Switch value={soundEffects} onValueChange={setSoundEffects} />
        </View>
      </View>

      {/* 💸 Payments Controls */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payments</Text>

        {/* ALLOW PAYOUTS */}
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Ionicons name="card" size={20} color="#0cc" />
            <Text style={styles.rowLabel}>Enable Payout Requests</Text>
          </View>
          <Switch value={enablePayouts} onValueChange={setEnablePayouts} />
        </View>
      </View>

      {/* 🛠 Maintenance */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>System</Text>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Ionicons name="construct" size={20} color="#0cc" />
            <Text style={styles.rowLabel}>Maintenance Mode</Text>
          </View>
          <Switch value={maintenanceMode} onValueChange={setMaintenanceMode} />
        </View>

        {maintenanceMode && (
          <Text style={styles.warningText}>
            ⚠ The app will show a maintenance notice to all users.
          </Text>
        )}
      </View>

      {/* SAVE BUTTON */}
      <TouchableOpacity style={styles.saveButton} onPress={saveSettings}>

        <Text style={styles.saveText}>Save Settings</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default SettingsSection;

// 🌈 BEAUTIFUL & CLEAN STYLES
const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },

  header: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: "#121222",
    marginBottom: 15,
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  headerText: {
    color: "#0ff",
    fontSize: 22,
    textAlign: "center",
    fontWeight: "bold",
  },

  card: {
    backgroundColor: "#1a1a2d",
    padding: 15,
    borderRadius: 15,
    marginBottom: 18,
  },
  cardTitle: {
    color: "#0ff",
    fontSize: 18,
    fontWeight: "bold",
    borderBottomWidth: 1,
    borderBottomColor: "#0ff3",
    marginBottom: 10,
    paddingBottom: 5,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 12,
  },
  rowText: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowLabel: {
    color: "white",
    fontSize: 15,
  },

  warningText: {
    color: "#ff3",
    marginTop: 5,
    fontSize: 13,
  },

  saveButton: {
    backgroundColor: "#0ff",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  saveText: {
    fontWeight: "bold",
    color: "#000",
    fontSize: 16,
  },
});
