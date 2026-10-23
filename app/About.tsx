// AboutContactScreen.js
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";

export default function AboutScreen() {
  const email = "ebech@republic.beauty";

  const whatsappSupport =
    "https://wa.me/237673864413?text=Hello%20FX%20ARENA%20Support%2C%20I%20need%20help%20with%20the%20app.";

  const communityGroup =
    "https://chat.whatsapp.com/Ca8AFxiWdXtEm8GXE1THAY?s=cl&p=a&mlu=4&ilr=4";

  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(
        "Unable to open link",
        "Please try again or check your internet connection."
      );
    }
  };

  const handleEmailPress = () => {
    openLink(`mailto:${email}`);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>About FX ARENA</Text>

      <Text style={styles.text}>
        FX ARENA is developed and maintained by{" "}
        <Text style={styles.bold}>
          GodSpeed (GS) Technologies
        </Text>{" "}
        ⭐⭐⭐⭐⭐.
      </Text>

      <Text style={styles.text}>
        FX ARENA is a{" "}
        <Text style={styles.bold}>
          simulated trading and competition platform
        </Text>{" "}
        designed to help users practice trading skills, improve
        decision-making, and strengthen market psychology in a{" "}
        <Text style={styles.bold}>risk-free environment</Text>.
      </Text>

      <Text style={styles.text}>
        FX ARENA is a{" "}
        <Text style={styles.bold}>
          skill-based trading simulation platform
        </Text>
        . All market activity within the app is simulated using
        synthetic market data for educational and competitive purposes.
        The app does not execute trades on live financial markets and
        should not be considered a brokerage or investment service.
      </Text>

      <Text style={styles.text}>
        FX ARENA is built for:
        {"\n"}• Beginners learning how to trade
        {"\n"}• Experienced traders testing strategies
        {"\n"}• Competitive traders participating in tournaments
      </Text>

      <Text style={styles.text}>
        Our mission is to provide a fair, engaging, and educational
        trading simulation experience that helps users build market
        knowledge, improve decision-making, and develop disciplined
        trading habits.
      </Text>

      <Text style={styles.title}>Contact & Support</Text>

      <TouchableOpacity onPress={handleEmailPress}>
        <Text style={styles.link}>
          ✉ Email Support
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => openLink(whatsappSupport)}
      >
        <Text style={styles.link}>
          WhatsApp Support
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => openLink(communityGroup)}
      >
        <Text style={styles.link}>
          Join FX ARENA Community
        </Text>
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
    marginBottom: 10,
  },
});