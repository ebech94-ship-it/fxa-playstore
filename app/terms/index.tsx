import { Stack } from "expo-router";
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
        <Text style={styles.subtitle}>Last Updated: July 2026</Text>

        <Text style={styles.sectionTitle}>1. Purpose of the App</Text>
        <Text style={styles.paragraph}>
         Forex Tournaments Arena is an educational trading simulator that allows
          users to practice trading skills and participate in competitive trading
           tournaments using virtual trading balances.
        </Text>
<Text style={styles.paragraph}>

The App does not provide real forex trading, brokerage, investment, exchange,
 asset management, or financial advisory services. 
 All trades are simulated and are intended solely for education, skill development,
  and entertainment.
       
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
          All trading activity within the App is performed using virtual trading balances. 
          No real financial market orders are executed, and no real currency, 
          securities, or financial instruments are bought or sold through the App.
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
<Text style={styles.sectionTitle}>7. Trading Simulation</Text>
<Text style={styles.paragraph}>
  Within the App, users may open simulated Buy or Sell positions based on
  whether they believe the simulated market price will rise or fall.
  Buy positions are used when a user expects the simulated price to increase,
  while Sell positions are used when a user expects the simulated price to
  decrease. All positions are executed using virtual funds within the
  simulation environment and do not result in the purchase or sale of any real
  financial instrument.
  The outcome of simulated trades has no effect on real-world financial markets
and should not be interpreted as investment performance.
</Text>
        <Text style={styles.sectionTitle}>8. Virtual Funds</Text>
        <Text style={styles.paragraph}>
          Demo and Tournament Account balances are virtual and exist only within the App for simulation purposes.

Tournament accounts are created only after a user voluntarily registers for an eligible 
tournament and are funded with predefined virtual balances solely for tournament participation.

Virtual trading balances cannot be redeemed, transferred, withdrawn, or exchanged for cash.

Only officially awarded tournament prizes, where applicable, may be paid to eligible winners 
in accordance with the tournament rules.
Prize availability, eligibility, and amounts depend on the specific tournament rules and applicable laws.
        </Text>

        <Text style={styles.sectionTitle}>9. User Conduct</Text>
        <Text style={styles.paragraph}>
          You must not hack, manipulate, or exploit the system or engage in any
          fraudulent behavior.
        </Text>
         <Text style={styles.sectionTitle}>10. Payment Services</Text>
        <Text style={styles.paragraph}>
      Payments within FX Arena are optional and relate only to platform services such as tournament
       participation fees, where applicable, and eligible prize distribution. Payments do not represent 
      investments, deposits, trading capital, or purchases of financial instruments.

FX Arena does not operate as a bank, payment institution, money transmitter, or custodian of customer funds.

Payment transactions are processed by our trusted third-party payment provider,
 SWYCHR TECHNOLOGY AFRICA LIMITED, in accordance with its own Terms of Service and Privacy Policy.
 Users may be required to comply with the payment provider's verification and compliance requirements 
 before certain transactions can be completed.
        </Text>

        <Text style={styles.sectionTitle}>11. Legal Compliance</Text>
        <Text style={styles.paragraph}>
          FX Arena is an educational trading simulator and tournament platform.
           It does not provide gambling services, casino games, real-money forex trading,
           brokerage, investment management, or financial advisory services.
        </Text>

        <Text style={styles.sectionTitle}>12. Privacy & Data</Text>
        <Text style={styles.paragraph}>
          User information is handled in accordance with our Privacy Policy.
           Information necessary to process payments may be shared with our third-party
            payment provider solely for transaction processing and regulatory compliance.
           FX Arena does not sell users' personal information.
        </Text>

        <Text style={styles.sectionTitle}>13. Intellectual Property</Text>
        <Text style={styles.paragraph}>
          All designs, charts, visuals, and branding belong to Forex Tournaments
          Arena.
        </Text>

        <Text style={styles.sectionTitle}>14. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          The App is provided &quot;as-is&quot; without guarantees. We are not liable
          for losses, device issues, or system errors.
        </Text>

        <Text style={styles.sectionTitle}>15. Risk Disclosure</Text>
        <Text style={styles.paragraph}>
          Trading performance achieved using virtual balances should not be interpreted 
          as an indicator or guarantee of future real-world trading performance. 
          Users should not rely on results obtained within
           the App when making real financial or investment decisions.
        </Text>

        <Text style={styles.sectionTitle}>16. Changes to App</Text>
        <Text style={styles.paragraph}>
          We reserve the right to modify tournaments, rules, UI, charts, and
          features at any time.
        </Text>

        <Text style={styles.sectionTitle}>17. Account Termination</Text>
        <Text style={styles.paragraph}>
          Accounts may be suspended or terminated for violating these Terms.
        </Text>
<Text style={styles.sectionTitle}>18. Governing Law </Text>
        <Text style={styles.paragraph}>
        These Terms are governed by the applicable laws of the jurisdiction where 
        FX Arena is legally established, together with applicable consumer protection laws.
        </Text>

        <Text style={styles.sectionTitle}>19. Contact </Text>
        <Text style={styles.paragraph}>
        For support, contact us through the support channels provided in the App or on our official website.
        </Text>
          <Text style={styles.sectionTitle}>20. Account Deletion </Text>
        <Text style={styles.paragraph}>
        Users may request deletion of their account through the available account settings or support channels. 
        Upon verification, account data will be deleted or handled according to applicable legal requirements and our Privacy Policy.
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
