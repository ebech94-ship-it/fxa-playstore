import React from "react";
import { View, Text, StyleSheet } from "react-native";

const TournamentsSection = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Tournaments Management</Text>
    </View>
  );
};

export default TournamentsSection;

const styles = StyleSheet.create({
  container: { padding: 10 },
  header: { color: "white", fontSize: 20, fontWeight: "bold" },
});
