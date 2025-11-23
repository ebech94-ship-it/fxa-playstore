import { Stack } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function PrivacyPolicyScreen() {
  return (
    <>
      {/* Header configuration for title */}
      <Stack.Screen
        options={{
          title: "Privacy Policy",
          headerStyle: { backgroundColor: "#0a0a0a" },
          headerTintColor: "#fff",
        }}
      />

      <ScrollView style={styles.container}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.subtitle}>Last Updated: November 2025</Text>

        <Text style={styles.sectionTitle}>1. Introduction</Text>
        <Text style={styles.paragraph}>
          Forex Tournaments Arena (“the App”, “we”, “our”) is committed to
          protecting your privacy. This Privacy Policy explains how we collect,
          store, use, and safeguard your information when you use our mobile
          application.
        </Text>

        <Text style={styles.sectionTitle}>2. Information We Collect</Text>
        <Text style={styles.paragraph}>
          We may collect the following information when you use the App:
        </Text>
        <Text style={styles.paragraph}>
          • Account details (name, email, profile image if uploaded){'\n'}
          • Device and app usage information{'\n'}
          • Tournament performance data (scores, win/loss records){'\n'}
          • Optional data you choose to provide (bio, avatar, etc.)
        </Text>

        <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          We use your information to:
        </Text>
        <Text style={styles.paragraph}>
          • Provide access to tournaments and gameplay features{'\n'}
          • Improve app functionality and performance{'\n'}
          • Personalize user experience{'\n'}
          • Ensure compliance with rules and maintain fair gameplay{'\n'}
          • Communicate important updates and notifications
        </Text>

        <Text style={styles.sectionTitle}>4. Data Storage & Security</Text>
        <Text style={styles.paragraph}>
          All data is stored securely using encrypted and industry-standard
          methods. We take reasonable steps to prevent unauthorized access,
          misuse, loss, or alteration of your data.
        </Text>

        <Text style={styles.sectionTitle}>5. Sharing Your Information</Text>
        <Text style={styles.paragraph}>
          We do NOT sell, rent, or trade your personal data to third parties.
          Data may only be shared in these limited cases:
        </Text>
        <Text style={styles.paragraph}>
          • When required by law{'\n'}
          • To protect the rights and safety of users{'\n'}
          • To enforce Terms & Conditions{'\n'}
          • With service providers strictly necessary for app functionality
        </Text>

        <Text style={styles.sectionTitle}>6. Use of Synthetic Charts</Text>
        <Text style={styles.paragraph}>
          The candles and charts in this App are synthetic and do not reflect
          real market data. No personal data is linked to real financial
          activity.
        </Text>

        <Text style={styles.sectionTitle}>7. User Rights</Text>
        <Text style={styles.paragraph}>
          You may request to:
        </Text>
        <Text style={styles.paragraph}>
          • Delete your account{'\n'}
          • Correct inaccurate information{'\n'}
          • Request a summary of your stored data
        </Text>

        <Text style={styles.sectionTitle}>8. Cookies & Tracking</Text>
        <Text style={styles.paragraph}>
          The App may use simple analytics and device identifiers to improve
          performance. No invasive tracking is used.
        </Text>

        <Text style={styles.sectionTitle}>9. Children’s Privacy</Text>
        <Text style={styles.paragraph}>
          The App is intended for users aged 18 and above. We do not knowingly
          collect data from children under 13.
        </Text>

        <Text style={styles.sectionTitle}>10. Third-Party Services</Text>
        <Text style={styles.paragraph}>
          Some features may link to third-party libraries (e.g., authentication
          or analytics). Their privacy practices are separate and governed by
          their own policies.
        </Text>

<Text style={styles.paragraph}>
  Please note that this app does not collect financial trading data 
  or execute real-money trades. All competitions are simulated.
</Text>


        <Text style={styles.sectionTitle}>11. Changes to This Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy periodically. Continued use of the
          App means you accept the updated terms.
        </Text>

        <Text style={styles.sectionTitle}>12. Contact Us</Text>
        <Text style={styles.paragraph}>
          For concerns or inquiries about this Privacy Policy, visit the Help
          Center inside the App or contact our support email.
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
