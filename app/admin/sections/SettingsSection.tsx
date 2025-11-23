import React from "react";
import { View, Text, StyleSheet } from "react-native";

const SettingsSection = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Admin Settings</Text>
    </View>
  );
};

export default SettingsSection;

const styles = StyleSheet.create({
  container: { padding: 10 },
  header: { color: "white", fontSize: 20, fontWeight: "bold" },
});
