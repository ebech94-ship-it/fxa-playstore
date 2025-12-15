// TradePanel.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

type TradePanelProps = {
  balance: number;
  amount: number;
  setAmount: (n: number) => void;
  expiration: string;
  setExpiration: (e: string) => void;
  onBuy: () => void;
  onSell: () => void;
  tradesCount: number;
  openBankModal: () => void;
};



export default function TradePanel({
  balance,
  amount,
  setAmount,
  expiration,
  setExpiration,
  onBuy,
  onSell,
  tradesCount,
  openBankModal, // function to open bank/balances
}: TradePanelProps) {
  const [profitPercent, setProfitPercent] = useState(0);

  // Simulated profit % (replace with real calculation)
  useEffect(() => {
    const interval = setInterval(() => {
      setProfitPercent(Math.floor(Math.random() * 100));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAmountChange = (value: string) => {
    const num = parseInt(value) || 0;
    if (num >= 0 && num <= 5000) setAmount(num);
  };

  const expirations = ["15s", "30s", "1m", "5m", "15m"];

  return (
    <View style={styles.panel}>
      {/* Bank + Balance */}
      <TouchableOpacity style={styles.bankRow} onPress={openBankModal}>
        <Ionicons name="wallet-outline" size={28} color="#fff" />
        <Text style={styles.balanceText}>${balance.toFixed(2)}</Text>
      </TouchableOpacity>

      {/* Profit % */}
      <View style={styles.profitBox}>
        <Text style={styles.profitText}>Profit: {profitPercent}%</Text>
      </View>

      {/* Trade Size */}
      <View style={styles.inputRow}>
        <Text style={styles.label}>Trade Size</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={String(amount)}
          onChangeText={handleAmountChange}
          placeholder="<10,000"
          placeholderTextColor="#777"
        />
      </View>

      {/* Expiration */}
      <View style={styles.inputRow}>
        <Text style={styles.label}>Expiration</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {expirations.map((exp) => (
            <TouchableOpacity
              key={exp}
              style={[styles.expButton, expiration === exp && styles.expButtonActive]}
              onPress={() => setExpiration(exp)}
            >
              <Text style={styles.expButtonText}>{exp}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Trade limit */}
      <Text style={styles.tradeLimit}>Trades Open: {tradesCount}/20</Text>

      {/* Buy / Sell Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.tradeButton, { backgroundColor: "#28a745", bottom :10, }]} // green
          onPress={onBuy}
          disabled={tradesCount >= 20}
        >
          <Text style={styles.tradeButtonText}>▲ Buy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tradeButton, { backgroundColor: "#dc3545" }]} // red
          onPress={onSell}
          disabled={tradesCount >= 20}
        >
          <Text style={styles.tradeButtonText}>▼ Sell</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: 230,
    backgroundColor: "rgba(20,20,20,0.9)",
    padding: 15,
    borderTopLeftRadius: 15,
    borderBottomLeftRadius: 15,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  bankRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  balanceText: {
    color: "#fff",
    fontSize: 16,
    marginLeft: 8,
    fontWeight: "bold",
  },
  profitBox: {
    backgroundColor: "rgba(255,255,0,0.1)",
    borderColor: "gold",
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 15,
    alignItems: "center",
  },
  profitText: {
    color: "darkgoldenrod",
    fontWeight: "bold",
    fontSize: 16,
  },
  inputRow: {
    marginBottom: 12,
  },
  label: {
    color: "#ccc",
    marginBottom: 4,
    fontSize: 14,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "#666",
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    color: "#fff",
    fontSize: 14,
  },
  expButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 6,
    marginRight: 6,
  },
  expButtonActive: {
    backgroundColor: "#FFD700",
  },
  expButtonText: {
    color: "#fff",
    fontSize: 14,
  },
  tradeLimit: {
    color: "#aaa",
    marginVertical: 8,
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  tradeButton: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 5,
    borderRadius: 8,
    alignItems: "center",
  },
  tradeButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
