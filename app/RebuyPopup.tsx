import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  cost: number;
  onRebuy: () => void;
  onDismiss: () => void;
};

export default function RebuyPopup({ cost, onRebuy, onDismiss }: Props) {
  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={["#0f172a", "#020617"]}
        style={styles.card}
      >
        <Text style={styles.title}>⚠️ Low Balance</Text>

        <Text style={styles.text}>
          Your tournament balance is running low.
        </Text>

        <View style={styles.row}>
          <TouchableOpacity onPress={onDismiss}>
            <Text style={styles.dismiss}>Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.rebuyBtn} onPress={onRebuy}>
            <Text style={styles.rebuyText}>
              Rebuy • ${cost}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}
const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 20,
    left: 12,
    right: 12,
    zIndex: 999,
  },
  card: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  title: {
    color: "#facc15",
    fontWeight: "900",
    fontSize: 15,
  },
  text: {
    color: "#cbd5e1",
    marginTop: 6,
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  dismiss: {
    color: "#94a3b8",
    fontWeight: "700",
  },
  rebuyBtn: {
    backgroundColor: "#22c55e",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  rebuyText: {
    color: "#fff",
    fontWeight: "900",
  },
});
