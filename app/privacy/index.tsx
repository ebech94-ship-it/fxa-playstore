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
        <Text style={styles.subtitle}>Last Updated: July 2026</Text>

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
          • Account details (such as your name, email address, phone number, and optional profile image){'\n'}
          • Payment-related information necessary to process eligible platform transactions, such as tournament 
          participation fees and prize payouts.
           Payment credentials and mobile money PINs are not stored by FX Arena.
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
          All data is stored securely using industry-standard security practices and cloud infrastructure protections.
           We take reasonable steps to prevent unauthorized access,
          misuse, loss, or alteration of your data.
          User account data is securely stored using cloud infrastructure and 
          authentication services. Payment transactions are securely processed by our 
          trusted third-party payment provider, Swychr Technology Africa Limited.
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
          • With trusted third-party service providers that help operate the App, including 
          authentication, cloud hosting, analytics, and payment processing.
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
<Text style={styles.sectionTitle}>8. Account Deletion</Text>
        <Text style={styles.paragraph}>
          Users can request deletion of their account through the available account
           settings or by contacting support. After verification, account data will be deleted or
            retained only where required for legal, security, or operational purposes.
        </Text>
        <Text style={styles.sectionTitle}>9. Cookies & Tracking</Text>
        <Text style={styles.paragraph}>
          The App may use analytics and device identifiers to understand app performance, 
          fix issues, and improve user experience. No invasive tracking is used.
        </Text>

        <Text style={styles.sectionTitle}>10. Children’s Privacy</Text>
        <Text style={styles.paragraph}>
          The App is intended for users aged 18 and above. We do not knowingly collect personal
           information from users below the applicable legal age.
        </Text>

      <Text style={styles.sectionTitle}>11. Third-Party Services</Text>

<Text style={styles.paragraph}>
The App relies on trusted third-party service providers to deliver certain
features, including authentication, cloud storage, notifications, analytics,
and payment processing. These providers process data only as necessary to
perform their services and are governed by their own privacy policies.
</Text>

<Text style={styles.paragraph}>
Tournament registration fees and eligible prize payouts are securely processed
by Swychr Technology Africa Limited. FX Arena does not store users' mobile
money credentials or payment account passwords.
</Text>

<Text style={styles.paragraph}>
The App does not execute real-money forex trades or provide brokerage,
investment, or financial advisory services. All trading activities and
competitions are simulated.
</Text>
        <Text style={styles.sectionTitle}>12. Changes to This Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy periodically. Continued use of the
          App means you accept the updated terms.
        </Text>

        <Text style={styles.sectionTitle}>13. Contact Us</Text>
        <Text style={styles.paragraph}>
          For concerns regarding this Privacy Policy, visit the Help Center 
          within the App or contact us at ebech@republic.beauty.
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
