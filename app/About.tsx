// AboutContactScreen.js
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

export default function AboutScreen() {
  const email = "ebech@republic.beauty";
  const website = "https://www.republic.beauty"; // optional

  const handleEmailPress = () => {
    Linking.openURL(`mailto:${email}`);
  };

  const handleWebsitePress = async () => {
  const supported = await Linking.canOpenURL(website);

  if (supported) {
    await Linking.openURL(website);
  }
};

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>About FX Arena</Text>

      <Text style={styles.text}>
        FX Arena is developed and maintained by <Text style={styles.bold}>GodSpeed (GS) Technologies</Text>⭐⭐⭐⭐⭐.
      </Text>

      <Text style={styles.text}>
        FX Arena is a <Text style={styles.bold}>simulated trading and competition platform</Text> designed
        to help users practice trading skills, improve decision-making, and strengthen market psychology
        in a <Text style={styles.bold}>risk-free environment</Text>.
      </Text>

      <Text style={styles.text}>
        FX Arena is a  <Text style={styles.bold}>skill-based trading simulation platform</Text>. All market activity within the app is simulated using synthetic market 
        data for educational and competitive purposes.
        The app does not execute trades on live financial markets and should not be considered  <Text style={styles.bold}>a brokerage or investment service</Text>.
      </Text>

      <Text style={styles.text}>
        FX Arena is built for:
        {"\n"}• Beginners learning how to trade
        {"\n"}• Experienced traders testing strategies
        {"\n"}• Competitive traders participating in tournaments
      </Text>

      <Text style={styles.text}>
        Our mission is to provide fair, engaging and educational trading simulated experience that helps users
        build market knowledge, improve decision-making, and develop disciplined trading habits.
      </Text>

      <Text style={styles.title}>Contact & Support</Text>

      <TouchableOpacity onPress={handleEmailPress}>
        <Text style={styles.link}>{email}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleWebsitePress}>
        <Text style={styles.link}>{website}</Text>
      </TouchableOpacity>
      
      <Text style={styles.text}>
Version 1.0.0
</Text>
<Text style={styles.text}>
© 2026 GodSpeed (GS) Technologies. All rights reserved.
</Text>
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