import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

// Sections
import NotificationsSection from "./sections/NotificationsSection";
import PaymentsSection from "./sections/PaymentsSection";
import PayoutsSection from "./sections/PayoutsSection";
import SettingsSection from "./sections/SettingsSection";
import TournamentsSection from "./sections/TournamentsSection";
import UsersSection from "./sections/UsersSection";

const AdminDashboard = () => {
  const [active, setActive] = useState("Tournaments");
  const { width: screenWidth } = useWindowDimensions();
const [exiting, setExiting] = useState(false);

  // 🔥 Responsive sidebar width
  const SIDEBAR_WIDTH =
    screenWidth < 600 ? 120 :
    screenWidth < 900 ? 220 :
    280;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: "row",
      backgroundColor: "#000",
    },
    sidebar: {
      width: SIDEBAR_WIDTH,
      minWidth: SIDEBAR_WIDTH,
      maxWidth: SIDEBAR_WIDTH,
      backgroundColor: "#111",
      paddingVertical: 20,
      borderRightColor: "#222",
      borderRightWidth: 1,
    },
    sidebarItem: {
      paddingVertical: 16,
      paddingHorizontal: 16,
      marginBottom: 6,
    },
    sidebarActive: {
      backgroundColor: "#333",
      borderLeftColor: "#4A90E2",
      borderLeftWidth: 3,
    },
    sidebarText: {
      color: "white",
      fontSize: 15,
    },
    sidebarExit: {
      marginTop: 20,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#ff4d67",
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 8,
      marginHorizontal: 10,
    },
    sidebarExitText: {
      color: "#fff",
      marginLeft: 6,
      fontWeight: "600",
      fontSize: 14,
    },
    sidebarScroll: {
      paddingVertical: 20,
    },
    rightSide: {
      flex: 1,
      position: "relative",
    },
    content: {
      flex: 1,
      padding: 15,
    },
  });

  const renderSection = () => {
    switch (active) {
      case "Tournaments":
        return <TournamentsSection />;
      case "Users":
        return <UsersSection />;
      case "Payments":
        return <PaymentsSection />;
      case "Payouts":
        return <PayoutsSection />;
      case "Notifications":
        return <NotificationsSection />;
      case "Settings":
        return <SettingsSection />;
      default:
        return <TournamentsSection />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sidebar}>
        <ScrollView contentContainerStyle={styles.sidebarScroll}>
          {[
            "Tournaments",
            "Users",
            "Payments",
            "Payouts",
            "Notifications",
            "Settings",
          ].map((sec) => (
            <TouchableOpacity
              key={sec}
              style={[
                styles.sidebarItem,
                active === sec && styles.sidebarActive,
              ]}
              onPress={() => setActive(sec)}
            >
              <Text style={styles.sidebarText} numberOfLines={1}>
                {sec}
              </Text>
            </TouchableOpacity>
          ))}

          {/* 🔥 Exit Admin */}
          <TouchableOpacity
  disabled={exiting}
  style={[
    styles.sidebarExit,
    exiting && { opacity: 0.6 },
  ]}
  onPress={async () => {
    if (exiting) return;

    setExiting(true);
    try {
      await AsyncStorage.removeItem("isAdmin");

      router.dismissAll();
      router.replace("/tradinglayout");
    } catch {
      Alert.alert("Exit failed", "Please restart app");
      setExiting(false);
    }
  }}
>
  <Ionicons name="exit-outline" size={22} color="#fff" />
  <Text style={styles.sidebarExitText}>
    {exiting ? "Exiting..." : "Exit Admin"}
  </Text>
</TouchableOpacity>

        </ScrollView>
      </View>

      {/* Main Content */}
      <View style={styles.rightSide}>
        <ScrollView style={styles.content}>
          {renderSection()}
        </ScrollView>
      </View>
    </View>
  );
};

export default AdminDashboard;
