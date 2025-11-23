import React from "react";
import { View, Text, StyleSheet } from "react-native";

const PayoutsSection = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Payouts</Text>
    </View>
  );
};

export default PayoutsSection;

const styles = StyleSheet.create({
  container: { padding: 10 },
  header: { color: "white", fontSize: 20, fontWeight: "bold" },
});
