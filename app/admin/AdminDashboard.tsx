import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";

import TournamentsSection from "./sections/TournamentsSection";
import UsersSection from "./sections/UsersSection";
import PaymentsSection from "./sections/PaymentsSection";
import PayoutsSection from "./sections/PayoutsSection";
import NotificationsSection from "./sections/NotificationsSection";
import SettingsSection from "./sections/SettingsSection";

const AdminDashboard = () => {
  const [active, setActive] = useState("Tournaments");

  const renderSection = () => {
    switch (active) {
      case "Tournaments": return <TournamentsSection />;
      case "Users": return <UsersSection />;
      case "Payments": return <PaymentsSection />;
      case "Payouts": return <PayoutsSection />;
      case "Notifications": return <NotificationsSection />;
      case "Settings": return <SettingsSection />;
      default: return <TournamentsSection />;
    }
  };

  return (
    <View style={styles.container}>
      
      {/* Sidebar */}
      <View style={styles.sidebar}>
        {["Tournaments", "Users", "Payments", "Payouts", "Notifications", "Settings"].map((sec) => (
          <TouchableOpacity
            key={sec}
            style={[styles.sidebarItem, active === sec && styles.sidebarActive]}
            onPress={() => setActive(sec)}
          >
            <Text style={styles.sidebarText}>{sec}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main Content */}
      <ScrollView style={styles.content}>
        {renderSection()}
      </ScrollView>

    </View>
  );
};

export default AdminDashboard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#000",
  },
  sidebar: {
    width: 120,
    backgroundColor: "#111",
    paddingVertical: 20,
    borderRightColor: "#222",
    borderRightWidth: 1,
  },
  sidebarItem: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    marginBottom: 5,
  },
  sidebarActive: {
    backgroundColor: "#333",
    borderLeftColor: "#4A90E2",
    borderLeftWidth: 3,
  },
  sidebarText: {
    color: "white",
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 15,
  },
});
