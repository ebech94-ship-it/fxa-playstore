import { Stack } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function TermsScreen() {
  return (
    <>
      {/* For proper title in header */}
      <Stack.Screen
        options={{
          title: "Terms & Conditions",
          headerStyle: { backgroundColor: "#0a0a0a" },
          headerTintColor: "#fff",
        }}
      />

      <ScrollView style={styles.container}>
        <Text style={styles.title}>Terms & Conditions</Text>
        <Text style={styles.subtitle}>Last Updated: November 2025</Text>

        <Text style={styles.sectionTitle}>1. Purpose of the App</Text>
        <Text style={styles.paragraph}>
          Forex Tournaments Arena is an entertainment-oriented trading game
          using synthetic candle charts and tournament-styled trading mechanics.
          Trades placed within the App do not represent real financial market
          orders and all actions are for education, psychology conditioning, and
          recreational purposes.
        </Text>
<Text style={styles.paragraph}>
  Forex Tournaments Arena provides simulated trading and educational 
  tools only. No real financial trading or investment advice is provided.
</Text>

        <Text style={styles.sectionTitle}>2. Eligibility</Text>
        <Text style={styles.paragraph}>
          You must be at least 18 years old or the legal age in your region to
          use this App. You agree to use the App only for lawful purposes.
        </Text>

        <Text style={styles.sectionTitle}>3. Account Registration</Text>
        <Text style={styles.paragraph}>
          You must provide accurate information during sign-up and you are
          responsible for all activities under your account.
        </Text>

        <Text style={styles.sectionTitle}>4. Nature of Trading</Text>
        <Text style={styles.paragraph}>
          All trading within the App is simulated. No real currency is traded,
          and no financial advice is provided.
        </Text>

        <Text style={styles.sectionTitle}>5. Tournament Rules</Text>
        <Text style={styles.paragraph}>
          Tournaments have specific rules regarding time limits, score systems,
          and winnings. Violations may lead to disqualification.
        </Text>

        <Text style={styles.sectionTitle}>6. Use of Synthetic Charts</Text>
        <Text style={styles.paragraph}>
          The App uses synthetic charts designed for gameplay. These charts do
          not reflect real-world market movements.
          Price movements are simulated to ensure fair competition and equal conditions for all participants.
        </Text>

        <Text style={styles.sectionTitle}>7. Virtual Funds</Text>
        <Text style={styles.paragraph}>
          All displayed balances are virtual and cannot be exchanged for real
          money except verified tournament prizes.
        </Text>

        <Text style={styles.sectionTitle}>8. User Conduct</Text>
        <Text style={styles.paragraph}>
          You must not hack, manipulate, or exploit the system or engage in any
          fraudulent behavior.
        </Text>

        <Text style={styles.sectionTitle}>9. Legal Compliance</Text>
        <Text style={styles.paragraph}>
          The App is an educational game and does not offer real-money trading,
          gambling, or investment services.
        </Text>

        <Text style={styles.sectionTitle}>10. Privacy & Data</Text>
        <Text style={styles.paragraph}>
          User data is handled according to our Privacy Policy. No data is sold
          to third parties.
        </Text>

        <Text style={styles.sectionTitle}>11. Intellectual Property</Text>
        <Text style={styles.paragraph}>
          All designs, charts, visuals, and branding belong to Forex Tournaments
          Arena.
        </Text>

        <Text style={styles.sectionTitle}>12. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          The App is provided &quot;as-is&quot; without guarantees. We are not liable
          for losses, device issues, or system errors.
        </Text>

        <Text style={styles.sectionTitle}>13. Risk Disclosure</Text>
        <Text style={styles.paragraph}>
          While trading is simulated, it still carries psychological risk.
          Results do not reflect real financial performance.
        </Text>

        <Text style={styles.sectionTitle}>14. Changes to App</Text>
        <Text style={styles.paragraph}>
          We reserve the right to modify tournaments, rules, UI, charts, and
          features at any time.
        </Text>

        <Text style={styles.sectionTitle}>15. Account Termination</Text>
        <Text style={styles.paragraph}>
          Accounts may be suspended or terminated for violating these Terms.
        </Text>

        <Text style={styles.sectionTitle}>16. Contact</Text>
        <Text style={styles.paragraph}>
          For support, contact us via the App Help Center.
        </Text>

        <View style={{ height: 80 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#aaa",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginTop: 18,
  },
  paragraph: {
    marginTop: 6,
    fontSize: 14,
    color: "#ccc",
    lineHeight: 20,
  },
});
