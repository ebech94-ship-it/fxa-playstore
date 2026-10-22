
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

export default function DepositWithdraw() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(
    auth.currentUser?.uid ?? null
  );
  const [coins, setCoins] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, user => {
      setUid(user?.uid ?? null);
      if (!user) {
        setCoins(0);
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!uid) return;

    setLoading(true);

    const unsubscribe = onSnapshot(
      doc(db, "users", uid),
      snapshot => {
        const data = snapshot.data();
       setCoins(Math.max(0, Number(data?.coins ?? 0)));
        setLoading(false);
      },
      error => {
        console.error("Wallet listener failed:", error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [uid]);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>‹  Back</Text>
        </TouchableOpacity>

        <LinearGradient
          colors={["#182747", "#101322", "#30204E"]}
          style={styles.hero}
        >
          <Text style={styles.eyebrow}>FX ARENA • VIRTUAL ECONOMY</Text>
          <Text style={styles.title}>Coins Wallet</Text>
          <Text style={styles.subtitle}>
            Your coins. Your progress. Your arena.
          </Text>

          <View style={styles.coinCircle}>
            <Text style={styles.coinIcon}>◈</Text>
          </View>

          <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>

          {loading ? (
            <ActivityIndicator color="#FFD166" size="large" />
          ) : (
            <Text style={styles.balance}>
              {coins.toLocaleString()}{" "}
              <Text style={styles.coinUnit}>Coins</Text>
            </Text>
          )}

          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE WALLET</Text>
          </View>
        </LinearGradient>

        <View style={styles.notice}>
          <Text style={styles.noticeIcon}>✦</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>Earn coins, don't buy them</Text>
            <Text style={styles.noticeText}>
             Your wallet starts at 0 Coins. Earn virtual coins through
eligible referrals and tournament participation.
Coins appear when credited to your account.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>YOUR WALLET</Text>

        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Text style={styles.cardEmoji}>♧</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Referral rewards</Text>
            <Text style={styles.cardText}>
              Invite friends and earn coins when referral
              requirements are met.
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Text style={styles.cardEmoji}>🏆</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Tournament rewards</Text>
            <Text style={styles.cardText}>
              Eligible rewards are credited after the tournament
              results are finalized and approved.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Text style={styles.cardEmoji}>↻</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Live balance</Text>
            <Text style={styles.cardText}>
              Your balance refreshes automatically when your
              wallet record changes.
            </Text>
          </View>
          <View style={styles.liveDot} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Virtual coins only</Text>
          <Text style={styles.footerText}>
            Coins are virtual in-app units. This wallet has no
            deposit, cash withdrawal, or Mobile Money payment
            feature.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080D18",
    paddingHorizontal: 18,
  },
  backButton: {
    marginTop: 12,
    marginBottom: 18,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#151E30",
  },
  backText: { color: "#E2E8F0", fontSize: 14, fontWeight: "700" },
  hero: {
    borderRadius: 26,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4A4770",
    overflow: "hidden",
  },
  eyebrow: {
    color: "#C4B5FD",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "900",
    marginTop: 10,
  },
  subtitle: {
    color: "#A7B2C8",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  coinCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#332A53",
    borderWidth: 1,
    borderColor: "#F5C76A",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 25,
    marginBottom: 18,
  },
  coinIcon: { color: "#FFD166", fontSize: 42, fontWeight: "900" },
  balanceLabel: {
    color: "#A7B2C8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  balance: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "900",
    marginTop: 8,
  },
  coinUnit: { color: "#FFD166", fontSize: 18 },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 16,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#142D2A",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#34D399",
  },
  liveText: {
    color: "#6EE7B7",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  notice: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#17182B",
    borderColor: "#3B3260",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginTop: 18,
  },
  noticeIcon: { color: "#FFD166", fontSize: 24 },
  noticeTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  noticeText: {
    color: "#A7B2C8",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
  },
  sectionTitle: {
    color: "#8795AE",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 26,
    marginBottom: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: 18,
    backgroundColor: "#111A2A",
    borderWidth: 1,
    borderColor: "#26334A",
    marginBottom: 10,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#252342",
    alignItems: "center",
    justifyContent: "center",
  },
  cardEmoji: { color: "#FFD166", fontSize: 22 },
  cardContent: { flex: 1 },
  cardTitle: { color: "#F8FAFC", fontSize: 13, fontWeight: "800" },
  cardText: {
    color: "#94A3B8",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  arrow: { color: "#A78BFA", fontSize: 25 },
  footer: {
    marginTop: 12,
    marginBottom: 30,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#101827",
  },
  footerTitle: { color: "#CBD5E1", fontSize: 12, fontWeight: "800" },
  footerText: {
    color: "#8492A8",
    fontSize: 11,
    lineHeight: 18,
    marginTop: 6,
  },
});
