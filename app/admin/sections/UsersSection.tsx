import React from "react";
import { View, Text, StyleSheet } from "react-native";

const UsersSection = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Users Management</Text>
    </View>
  );
};

export default UsersSection;

const styles = StyleSheet.create({
  container: { padding: 10 },
  header: { color: "white", fontSize: 20, fontWeight: "bold" },
});
