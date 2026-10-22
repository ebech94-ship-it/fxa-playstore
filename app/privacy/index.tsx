import { Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function PrivacyPolicyScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Privacy Policy",
          headerStyle: { backgroundColor: "#0a0a0a" },
          headerTintColor: "#fff",
        }}
      />

      <ScrollView style={styles.container}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.subtitle}>Last Updated: October 2026</Text>

        <Text style={styles.sectionTitle}>1. Introduction</Text>
        <Text style={styles.paragraph}>
          Forex Tournaments Arena ("the App", "we", or "our") is committed to
          protecting your privacy. This Privacy Policy explains how we collect,
          store, use, and safeguard your information when you use our mobile
          application.
        </Text>

        <Text style={styles.sectionTitle}>2. Information We Collect</Text>
        <Text style={styles.paragraph}>
          We may collect the following information when you use the App:
          {"\n"}• Account details, such as your name and email address
          {"\n"}• Optional profile information, such as your profile image
          or bio
          {"\n"}• Virtual coin balances and reward records
          {"\n"}• Simulated trading activity and tournament performance data,
          including scores and win/loss records
          {"\n"}• Referral and leaderboard information
          {"\n"}• Technical information needed to operate and troubleshoot
          the App
          {"\n"}• Information you choose to provide when contacting support
        </Text>

        <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          We use your information to:
          {"\n"}• Provide access to tournaments and gameplay features
          {"\n"}• Maintain virtual coin balances and reward records
          {"\n"}• Improve app functionality and performance
          {"\n"}• Personalize the user experience
          {"\n"}• Maintain fair gameplay and enforce our rules
          {"\n"}• Manage eligible referrals and tournament results
          {"\n"}• Communicate important updates and notifications
        </Text>

        <Text style={styles.sectionTitle}>4. Data Storage & Security</Text>
        <Text style={styles.paragraph}>
          We take reasonable steps to protect your information against
          unauthorized access, misuse, loss, or alteration. Account and
          gameplay information may be stored using cloud infrastructure
          and authentication services. No method of electronic storage
          can be guaranteed to be completely secure.
        </Text>

        <Text style={styles.sectionTitle}>5. Sharing Your Information</Text>
        <Text style={styles.paragraph}>
          We do not sell, rent, or trade your personal information. Information
          may be shared in these limited circumstances:
          {"\n"}• When required by law
          {"\n"}• To protect the rights and safety of users
          {"\n"}• To enforce our Terms & Conditions
          {"\n"}• With service providers necessary to operate and maintain
          the App, such as authentication and cloud hosting services
        </Text>

        <Text style={styles.sectionTitle}>6. Use of Synthetic Charts</Text>
        <Text style={styles.paragraph}>
          The candles and charts in this App are simulated and do not
          represent actual market data. The App provides simulated trading
          for gameplay and competition purposes and does not execute
          real financial-market trades.
        </Text>

        <Text style={styles.sectionTitle}>7. User Rights</Text>
        <Text style={styles.paragraph}>
          Subject to applicable law, you may request to:
          {"\n"}• Delete your account
          {"\n"}• Correct inaccurate information
          {"\n"}• Request information about the personal data we hold
        </Text>

        <Text style={styles.sectionTitle}>8. Account Deletion</Text>
        <Text style={styles.paragraph}>
          Users can request account deletion through the available account
          settings or by contacting support. Account data will be deleted
          or retained only where required by law or necessary for legitimate
          security and operational purposes.
        </Text>

        <Text style={styles.sectionTitle}>9. Cookies & Tracking</Text>
        <Text style={styles.paragraph}>
          The App may process technical information necessary for its
          functionality, security, and troubleshooting. Any analytics
          or tracking practices used will depend on the services actually
          implemented in the App.
        </Text>

        <Text style={styles.sectionTitle}>10. Children's Privacy</Text>
        <Text style={styles.paragraph}>
          The App is intended for users aged 18 and above. We do not knowingly
          collect personal information from children below the applicable
          legal age.
        </Text>

        <Text style={styles.sectionTitle}>11. App Services</Text>
        <Text style={styles.paragraph}>
          The App provides simulated trading, virtual coins, tournament
          participation, leaderboards, and eligible virtual coin rewards.
          Virtual coins are in-app units with no cash value and cannot be
          withdrawn or redeemed for real money.
        </Text>
        <Text style={styles.paragraph}>
          The App may use authentication and cloud storage services to
          maintain accounts and gameplay information. Information handled
          by those services is subject to their applicable privacy policies.
        </Text>

        <Text style={styles.sectionTitle}>12. Changes to This Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy periodically to reflect changes
          to the App or applicable requirements. The latest version will
          display its updated date.
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