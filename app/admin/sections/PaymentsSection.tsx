import React from "react";
import { View, Text, StyleSheet } from "react-native";

const PaymentsSection = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Payments</Text>
    </View>
  );
};

export default PaymentsSection;

const styles = StyleSheet.create({
  container: { padding: 10 },
  header: { color: "white", fontSize: 20, fontWeight: "bold" },
});
