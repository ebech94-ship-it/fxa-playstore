import { Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function TermsScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Terms & Conditions",
          headerStyle: { backgroundColor: "#0a0a0a" },
          headerTintColor: "#fff",
        }}
      />

      <ScrollView style={styles.container}>
        <Text style={styles.title}>Terms & Conditions</Text>
        <Text style={styles.subtitle}>Last Updated: October 2026</Text>

        <Text style={styles.sectionTitle}>1. Purpose of the App</Text>
        <Text style={styles.paragraph}>
          Forex Tournaments Arena (FX ARENA) is an educational trading simulator
          that allows users to practise simulated trading, develop trading
          skills, and participate in competitions using virtual trading
          balances and virtual coins.
        </Text>
        <Text style={styles.paragraph}>
          The App does not provide real forex trading, brokerage, investment,
          exchange, asset management, or financial advisory services. All
          trading activities are simulated and intended for education,
          skill development, and entertainment.
        </Text>

        <Text style={styles.sectionTitle}>2. Eligibility</Text>
        <Text style={styles.paragraph}>
          You must be at least 18 years old or meet the applicable legal age
          requirement in your region to use this App. You agree to use the
          App only for lawful purposes.
        </Text>

        <Text style={styles.sectionTitle}>3. Account Registration</Text>
        <Text style={styles.paragraph}>
          You must provide accurate information during registration and are
          responsible for activities conducted through your account. You
          should keep your login credentials secure and notify support if
          you suspect unauthorized access.
        </Text>

        <Text style={styles.sectionTitle}>4. Nature of Trading</Text>
        <Text style={styles.paragraph}>
          All trading activity within the App uses simulated prices and
          virtual trading balances. No real financial-market orders are
          executed, and no real currencies, securities, or financial
          instruments are bought or sold through the App.
        </Text>

        <Text style={styles.sectionTitle}>5. Tournament Rules</Text>
        <Text style={styles.paragraph}>
          Tournaments may have specific rules covering duration, entry
          requirements, starting virtual balances, scoring, rankings, and
          virtual rewards. Users must follow the rules displayed for each
          tournament. Violations, cheating, or attempts to manipulate results
          may lead to disqualification or account restrictions.
        </Text>

        <Text style={styles.sectionTitle}>6. Use of Synthetic Charts</Text>
        <Text style={styles.paragraph}>
          The App uses synthetic charts designed for gameplay. These charts
          do not necessarily reflect real-world market movements. Price
          movements are simulated for the App's competition and learning
          environment.
        </Text>

        <Text style={styles.sectionTitle}>7. Trading Simulation</Text>
        <Text style={styles.paragraph}>
          Users may open simulated Buy or Sell positions based on their
          expectations of price movements within the simulated environment.
          All positions use virtual balances and do not result in the purchase
          or sale of real financial instruments. Simulated trading results
          have no effect on real financial markets and should not be
          interpreted as actual investment performance.
        </Text>

        <Text style={styles.sectionTitle}>8. Virtual Funds and Coins</Text>
        <Text style={styles.paragraph}>
          Demo balances, tournament balances, and Coins Wallet balances are
          virtual and exist only within the App. They are not bank deposits,
          real money, or financial assets.
        </Text>
        <Text style={styles.paragraph}>
          Virtual coins may be awarded through eligible referrals, approved
          tournament activities, or other in-app reward features. Tournament
          accounts may receive predefined virtual trading balances for
          simulation purposes.
        </Text>
        <Text style={styles.paragraph}>
          Virtual coins and trading balances have no cash value. They cannot
          be withdrawn, transferred for cash, exchanged for real money, or
          redeemed for financial value. No real-money deposits, cash
          withdrawals, or Mobile Money payments are provided through the
          Coins Wallet.
        </Text>
        <Text style={styles.paragraph}>
          Tournament rankings reflect performance within the simulation.
          Rewards, where offered in this Coins version, are virtual coins
          only and are subject to the applicable tournament rules.
        </Text>

        <Text style={styles.sectionTitle}>9. User Conduct</Text>
        <Text style={styles.paragraph}>
          You must not hack, manipulate, exploit, or interfere with the App,
          its balances, rankings, referrals, or tournament results. Fraudulent
          activity, abuse, or attempts to gain an unfair advantage may result
          in restrictions, disqualification, or account termination.
        </Text>

        <Text style={styles.sectionTitle}>10. Virtual Economy</Text>
        <Text style={styles.paragraph}>
          The App's virtual economy is intended solely for in-app gameplay.
          Virtual coins may be credited, deducted, adjusted, or reset where
          required by game rules, approved reward processing, technical
          corrections, or the prevention of abuse.
        </Text>
        <Text style={styles.paragraph}>
          Virtual coins cannot be purchased, withdrawn, or redeemed for cash
          through the Coins Wallet. Users should review the applicable
          in-app rules before participating in tournaments or other features
          that use virtual coins.
        </Text>

        <Text style={styles.sectionTitle}>11. Legal Compliance</Text>
        <Text style={styles.paragraph}>
          FX ARENA provides simulated trading and virtual competition
          features. It does not execute real-money forex trades or provide
          brokerage, investment management, or financial advisory services.
          Users are responsible for using the App in accordance with
          applicable laws.
        </Text>

        <Text style={styles.sectionTitle}>12. Privacy & Data</Text>
        <Text style={styles.paragraph}>
          User information is handled in accordance with our Privacy Policy.
          Account information and gameplay records may be processed to operate
          the App, maintain virtual balances, calculate rankings, administer
          rewards, protect accounts, and provide support. We do not sell
          users' personal information.
        </Text>

        <Text style={styles.sectionTitle}>13. Intellectual Property</Text>
        <Text style={styles.paragraph}>
          App designs, charts, visuals, branding, and other content are
          owned by FX ARENA or used with permission. You may not reproduce,
          distribute, or commercially exploit protected content without
          appropriate authorization.
        </Text>

        <Text style={styles.sectionTitle}>14. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          The App is provided on an "as-is" and "as-available" basis to the
          extent permitted by law. We do not guarantee uninterrupted,
          error-free operation or the permanent availability of virtual
          balances, rankings, or features. Nothing in these Terms excludes
          liability that cannot lawfully be excluded.
        </Text>

        <Text style={styles.sectionTitle}>15. Risk Disclosure</Text>
        <Text style={styles.paragraph}>
          Simulated trading performance does not predict or guarantee future
          real-world trading results. Users should not rely on App results
          when making real financial or investment decisions.
        </Text>

        <Text style={styles.sectionTitle}>16. Changes to the App</Text>
        <Text style={styles.paragraph}>
          We may modify tournaments, rules, interface elements, charts, virtual
          balances, and features to maintain, improve, or secure the App.
          Where appropriate, material changes will be communicated through
          the App.
        </Text>

        <Text style={styles.sectionTitle}>17. Account Termination</Text>
        <Text style={styles.paragraph}>
          We may restrict, suspend, or terminate accounts that violate these
          Terms, engage in fraud, manipulate results, or threaten the security
          and fair operation of the App. Users may contact support if they
          believe an action was taken in error.
        </Text>

        <Text style={styles.sectionTitle}>18. Governing Law</Text>
        <Text style={styles.paragraph}>
          These Terms are governed by applicable laws in the jurisdiction
          where FX ARENA is legally established, subject to any mandatory
          consumer protection laws that apply.
        </Text>

        <Text style={styles.sectionTitle}>19. Contact</Text>
        <Text style={styles.paragraph}>
          For support or questions about these Terms, use the support
          channels provided in the App or contact ebech@republic.beauty.
        </Text>

        <Text style={styles.sectionTitle}>20. Account Deletion</Text>
        <Text style={styles.paragraph}>
          Users may request account deletion through the available account
          settings or support channels. After verification, account data
          will be deleted or handled according to applicable legal
          requirements and our Privacy Policy.
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