import React from "react";
import { View, Text, StyleSheet } from "react-native";

const NotificationsSection = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Notifications</Text>
    </View>
  );
};

export default NotificationsSection;

const styles = StyleSheet.create({
  container: { padding: 10 },
  header: { color: "white", fontSize: 20, fontWeight: "bold" },
});
