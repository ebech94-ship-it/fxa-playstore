// AboutContactScreen.js
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

export default function AboutScreen() {
  const email = "ebech94@gmail.com"; // <-- replace with your email

  const handleEmailPress = () => {
    Linking.openURL(`mailto:${email}`);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>About FX Arena</Text>
      <Text style={styles.text}>
        FX Arena is developed by <Text style={styles.bold}>GodSpeed (GS) Technologies</Text>, powered by{" "}
        <Text style={styles.bold}>BECHEM Lab</Text>. Our mission is to provide a fun, educational, 
  and competitive trading experience through synthetic markets, helping traders strengthen 
  their market psychology—understanding when it’s the right time to buy and when to sell.
      </Text>

      <Text style={styles.title}>Contact</Text>
      <Text style={styles.text}>
        For support, inquiries, or feedback, reach us at:
      </Text>
      <TouchableOpacity onPress={handleEmailPress}>
        <Text style={styles.email}>{email}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#000C26',
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E2C13E',
    marginBottom: 10,
    marginTop: 20,
  },
  text: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 15,
    lineHeight: 22,
  },
  bold: {
    fontWeight: 'bold',
    color: '#00f0ff', // optional highlight color
  },
  email: {
    fontSize: 16,
    color: '#00f0ff',
    textDecorationLine: 'underline',
    marginTop: 5,
  },
});
