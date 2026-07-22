import { Text, View } from "react-native";

export default function Tutorial() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 30,
        backgroundColor: "#0B1220",
      }}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 28,
          fontWeight: "bold",
          marginBottom: 20,
        }}
      >
        👋 Welcome to FX ARENA
      </Text>

      <Text
        style={{
          color: "#ccc",
          fontSize: 18,
          textAlign: "center",
          lineHeight: 28,
          marginBottom: 40,
        }}
      >
        Don't worry. We'll guide you step by step.
      </Text>

      <Text
        style={{
          fontSize: 70,
        }}
      >
        👇
      </Text>

      <Text
        style={{
          color: "#FFD54F",
          fontSize: 20,
          fontWeight: "bold",
          marginTop: 15,
          textAlign: "center",
        }}
      >
        Follow the finger.
      </Text>
    </View>
  );
}