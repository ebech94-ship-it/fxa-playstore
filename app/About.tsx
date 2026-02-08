// AboutContactScreen.js
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

export default function AboutScreen() {
  const email = "ebech94@gmail.com";
  const website = "https://www.fxarena.app"; // optional

  const handleEmailPress = () => {
    Linking.openURL(`mailto:${email}`);
  };

  const handleWebsitePress = () => {
    Linking.openURL(website);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>About FX Arena</Text>

      <Text style={styles.text}>
        FX Arena is developed by <Text style={styles.bold}>GodSpeed (GS) Technologies</Text>, powered by{" "}
        <Text style={styles.bold}>BECHEM Lab</Text>.
      </Text>

      <Text style={styles.text}>
        FX Arena is a <Text style={styles.bold}>simulated trading and competition platform</Text> designed
        to help users practice trading skills, improve decision-making, and strengthen market psychology
        in a <Text style={styles.bold}>risk-free environment</Text>.
      </Text>

      <Text style={styles.text}>
        The app uses <Text style={styles.bold}>synthetic markets only</Text>. No real financial markets are
        accessed, and <Text style={styles.bold}>no real-money trading</Text> is conducted within the app.
      </Text>

      <Text style={styles.text}>
        FX Arena is built for:
        {"\n"}• Beginners learning how to trade
        {"\n"}• Experienced traders testing strategies
        {"\n"}• Competitive traders participating in tournaments
      </Text>

      <Text style={styles.text}>
        Our mission is to provide a fun, educational, and competitive trading experience that helps users
        understand when to buy, when to sell, and how to manage emotions under pressure.
      </Text>

      <Text style={styles.title}>Contact & Support</Text>

      <TouchableOpacity onPress={handleEmailPress}>
        <Text style={styles.link}>{email}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleWebsitePress}>
        <Text style={styles.link}>{website}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#000C26",
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#E2C13E",
    marginBottom: 10,
    marginTop: 20,
  },
  text: {
    fontSize: 16,
    color: "#ffffff",
    marginBottom: 14,
    lineHeight: 22,
  },
  bold: {
    fontWeight: "bold",
    color: "#00f0ff",
  },
  link: {
    fontSize: 16,
    color: "#00f0ff",
    textDecorationLine: "underline",
    marginTop: 6,
  },
});