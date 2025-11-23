// TradingLayout.tsx
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { ProfileContext } from "./ProfileContext";

import AccountSwitcher from "./AccountSwitcher";
import AlertScreen from "./Alert";
import ChartView from "./ChartView";
import DepositWithdrawScreen from "./DepositWithdraw";
import LeaderboardBar from "./LeaderboardBar";
import ProfileScreen from "./Profile";
import TournamentScreen from "./Tournament";
import TradeHistoryScreen from "./Tradehistory";
import TradeSummaryBar from "./TradeSummaryBar";

import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

// ------------------------ TYPES ------------------------

type AccountType = "real" | "demo" | "tournament";
type TradeType = "buy" | "sell";

interface Trade {
  id: string;
  type: TradeType;
  amount: number;
  entryPrice: number;
  expireTime: number;
  account: AccountType;
  
}

interface ChartRef {
  getCurrentPrice: () => number;
  removeMarker: (id: string) => void;
  onTrade?: (
    type: "buy" | "sell",
    stake: number,
    entryPrice: number,
    id: string,
    potentialProfit: number,
    durationMs: number
  ) => void;
}

// ------------------------ FIREBASE HELPERS ------------------------

const auth = getAuth();
const currentUser = auth.currentUser;

const updateBalance = async (userId: string, newBalance: number) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { balance: newBalance });
    console.log("Balance updated for user:", userId);
  } catch (error) {
    console.error("Error updating balance:", error);
  }
};

// ------------------------ MAIN COMPONENT ------------------------

export default function TradingLayout() {
  const PAYOUT = 90; // Fixed payout %
  const [activePage, setActivePage] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(10);
  const [expiration, setExpiration] = useState<string>("15s");
  const [profitPercent] = useState<number>(PAYOUT);

  const [balances, setBalances] = useState({
    real: 0,
    demo: 1000,
    tournament: 0,
  });


  // 🔥 Sync balances with Firestore in real time
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const userRef = doc(db, "users", uid);

    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (userData?.accounts) {
          setBalances({
            real: userData.accounts.real?.balance ?? 0,
            demo: userData.accounts.demo?.balance ?? 0,
            tournament: userData.accounts.tournament?.balance ?? 0,
          });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const [activeAccount, setActiveAccount] = useState<
    "real" | "demo" | "tournament"
  >("demo");
  const [orientation, setOrientation] = useState("portrait");

  const chartRef = useRef<ChartRef | null>(null);

  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [closedTrades, setClosedTrades] = useState<Trade[]>([]);

  const [players, setPlayers] = useState<any[]>([]);

  // Parse expiration like "30s", "1m", "5m"
  function parseExpirationMs(exp: string) {
    if (exp.endsWith("s")) return parseInt(exp) * 1000;
    if (exp.endsWith("m")) return parseInt(exp) * 60 * 1000;
    if (exp.endsWith("h")) return parseInt(exp) * 60 * 60 * 1000;
    if (exp.endsWith("d")) return parseInt(exp) * 24 * 60 * 60 * 1000;
    return 0;
  }

  // Open a trade (deduct stake now, add marker now)
  const handleTrade = (type: "buy" | "sell") => {
    const stake = Number(amount) || 0;
    if (stake <= 0) return;

    if (balances[activeAccount] - stake < 0) {
      console.log("Not enough balance");
      return;
    }

    const entryPrice = chartRef.current?.getCurrentPrice?.();
    if (entryPrice == null) {
      console.log("Chart not ready yet — can't open trade.");
      return;
    }

    const now = Date.now();
    const id = now.toString();

    // Deduct stake immediately
    setBalances((prev) => ({
      ...prev,
      [activeAccount]: prev[activeAccount] - stake,
    }));

    // Track open trade
    const t = {
      id,
      type, // 'buy' | 'sell'
      amount: stake,
      entryPrice,
      expireTime: now + parseExpirationMs(expiration),
      account: activeAccount,
    };
    setOpenTrades((prev) => [...prev, t]);

    // Calculate potential profit
    const potentialProfit = stake * (1 + profitPercent / 100);
    // Drop a marker on the chart (ChartView will place at the last candle)
    if (chartRef.current?.onTrade) {
      chartRef.current.onTrade(
        type,
        stake,
        entryPrice,
        id,
        potentialProfit,
        parseExpirationMs(expiration)
      );
    }

    console.log(
      `Opened ${type} ${stake} @ ${entryPrice} on ${activeAccount}| Potential: $${potentialProfit.toFixed(
        2
      )}`
    );
  };

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("balance", "desc"), limit(30));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPlayers(data);
    });

    return () => unsubscribe(); // clean up listener
  }, []);

  // Resolve expired trades every second: win/loss → update balance, remove marker
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const finalPrice = chartRef.current?.getCurrentPrice?.();
      if (finalPrice == null) return;

      setOpenTrades((prev) => {
        let stillOpen: Trade[] = [];
        prev.forEach((t) => {
          if (t.expireTime <= now) {
            // settle this trade
            const wentUp = finalPrice > t.entryPrice;
            const wentDown = finalPrice < t.entryPrice;
            const isWin =
              (t.type === "buy" && wentUp) || (t.type === "sell" && wentDown);

            // Calculate payout
            const tradePayout = isWin ? t.amount * (1 + profitPercent / 100) : 0;

            if (isWin) {
              const payout = t.amount * (1 + profitPercent / 100); // stake + profit
              setBalances((b) => {
                const newBalance = b[t.account] + payout;

                // Update Firestore
                if (currentUser) updateBalance(currentUser.uid, newBalance);

                // ✅ Log after computing new balance
                console.log(
                  `WIN ${t.type} | entry=${t.entryPrice} close=${finalPrice} | payout=${payout} | new balance=${newBalance}`
                );

                return {
                  ...b,
                  [t.account]: newBalance,
                };
              });
            } else {
              setBalances((b) => {
                const newBalance = b[t.account];

                // Update Firestore
                if (currentUser) updateBalance(currentUser.uid, newBalance);

                console.log(
                  `LOSS ${t.type} | entry=${t.entryPrice} close=${finalPrice} | balance remains=${newBalance}`
                );

                return b;
              });
            }

            // Add to closedTrades
            setClosedTrades((prevClosed) => [
              ...prevClosed,
              {
                ...t,
                result: isWin ? "GAIN" : "LOSS",
                payout: tradePayout,
                closePrice: finalPrice,
              },
            ]);
            // Remove marker on chart
            if (chartRef.current?.removeMarker) {
              chartRef.current.removeMarker(t.id);
            }
          } else {
            stillOpen.push(t);
          }
        });
        return stillOpen;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [profitPercent]);

  // Pick profile image
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const { profileImage, setProfileImage } = useContext(ProfileContext);

  // Handle orientation changes
  useEffect(() => {
    const handleOrientation = ({
      window: { width, height },
    }: {
      window: { width: number; height: number };
    }) => {
      setOrientation(width > height ? "landscape" : "portrait");
    };

    // addEventListener returns a subscription object with a .remove() method (modern RN)
    const subscription = Dimensions.addEventListener("change", handleOrientation);

    // cleanup: call remove() on the subscription
    return () => {
      subscription?.remove();
    };
  }, []);

  // Marquee
  const screenWidth = Dimensions.get("window").width;
  const scrollAnim = useRef(new Animated.Value(screenWidth)).current;
  useEffect(() => {
    const animate = () => {
      scrollAnim.setValue(screenWidth);
      Animated.timing(scrollAnim, {
        toValue: -screenWidth,
        duration: 20000,
        useNativeDriver: true,
      }).start(() => animate());
    };
    animate();
  }, [scrollAnim, screenWidth]);

  const expirations = [
    "5s",
    "8s",
    "12s",
    "15s",
    "25s",
    "30s",
    "1m",
    "2m",
    "3m",
    "5m",
    "15m",
    "30m",
    "1h",
    "2h",
    "4h",
    "1d",
    "3d",
  ];

  // Menu
  const menuItems: { icon: string; label: string; color: string }[] = [
    { icon: "person-outline", label: "Profile", color: "#00FF00" },
    { icon: "cash-outline", label: "DepositWithdraw", color: "green" },
    { icon: "trophy-outline", label: "Tournaments", color: "#FFD700" },
    { icon: "time-outline", label: "Trade History", color: "#00BFFF" },
    { icon: "notifications-outline", label: "Alerts", color: "#FF4500" },
  ];

  const renderPage = () => {
    if (!activePage) return null;

    let Component: any = null;
    switch (activePage) {
      case "Profile":
        Component = ProfileScreen;
        break;
      case "Tournaments":
        Component = TournamentScreen;
        break;
      case "Trade History":
        Component = TradeHistoryScreen;
        break;
      case "Alerts":
        Component = AlertScreen;
        break;
      case "DepositWithdraw":
        Component = DepositWithdrawScreen;
        break;
      default:
        return null;
    }

    return (
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => setActivePage(null)}
        >
          <Text style={{ color: "red", fontSize: 24 }}>✕</Text>
        </TouchableOpacity>

        <View style={styles.pageContent}>
          <Component currentUser={currentUser} />
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#0a0a0a" }}>
      {/* Left vertical menu */}
      <ScrollView
        style={styles.leftMenu}
        contentContainerStyle={{ paddingTop: 10, alignItems: "center" }}
      >
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.menuItem}
            onPress={() => setActivePage(item.label)}
          >
            <Ionicons name={item.icon as any} size={28} color={item.color} />

            <Text style={styles.menuText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Top Marquee */}
      <Animated.View
        style={{
          position: "absolute",
          top: 1,
          width: "100%",
          transform: [{ translateX: scrollAnim }],
          zIndex: 10,
          alignItems: "center",
        }}
      >
        <Text
          style={{ color: "yellow", fontWeight: "bold", fontSize: 15 }}
          numberOfLines={1}
        >
          Motto: Discipline, Patience, Swiftness and Excellence.
        </Text>
      </Animated.View>

      {/* Chart Area */}
      {renderPage()}
      <View style={styles.chartContainer}>
        <LeaderboardBar players={players} />
        <ChartView
          ref={chartRef}
          symbol="BECH/USD"
          orientation={orientation as "portrait" | "landscape"}
        />

        {/* Bottom Summary Bar */}
        {/* Pass trades to summary bar */}
        <TradeSummaryBar openTrades={openTrades} closedTrades={closedTrades} />
      </View>

      {/* Right Panel */}
      <View style={styles.rightPanel}>
        {/* Top Row: Profile + Account Switcher */}
        <View style={styles.topRow}>
          {/* Profile */}
          <TouchableOpacity
            onPress={pickImage}
            style={{ flexDirection: "row", top: 5, right: 20, zIndex: 40 }}
          >
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={{ width: 50, height: 50, borderRadius: 25 }}
              />
            ) : (
              <Ionicons name="person-circle-outline" size={50} color="gray" />
            )}
          </TouchableOpacity>

          {/* Account Switcher */}
          <AccountSwitcher
            balances={balances}
            activeAccount={activeAccount}
            onSwitch={(id) => setActiveAccount(id)}
            onTopUp={() => console.log("Top up demo")}
onDeposit={() => setActivePage("DepositWithdraw")}
onWithdraw={() => setActivePage("DepositWithdraw")}

          />
        </View>

        {/* Trade Size */}
        <View style={styles.inputRow}>
          <Text style={styles.label}>Trade Size</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={String(amount)}
            onChangeText={(v) => setAmount(parseInt(v) || 0)}
            placeholder="1-25000"
            placeholderTextColor="blue"
          />
        </View>

        {/* Expiration */}
        <View style={styles.inputRow}>
          <Text style={styles.label}>Expiration</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: "center", paddingHorizontal: 6 }}
          >
            {expirations.map((exp) => (
              <TouchableOpacity
                key={exp}
                style={[styles.expButton, expiration === exp && styles.expButtonActive]}
                onPress={() => setExpiration(exp)}
              >
                <Text style={styles.expButtonText}>{exp}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Profit % */}
        <View style={styles.profitBox}>
          <Text style={styles.profitText}>Profit: {profitPercent}%</Text>
        </View>

        {/* Buy / Sell */}
        <View style={styles.panelSection}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "green" }]}
            onPress={() => handleTrade("buy")}
          >
            <Text style={styles.actionText}>▲ Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "red" }]}
            onPress={() => handleTrade("sell")}
          >
            <Text style={styles.actionText}>▼ Sell</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Marquee */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 2,
          width: "100%",
          transform: [{ translateX: scrollAnim }],
          zIndex: 10,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "green", fontWeight: "bold", fontSize: 16 }}>
          Goal: Molding A Disciplined Trader!
        </Text>
      </Animated.View>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  leftMenu: {
    width: "10%",
    backgroundColor: "#2c2c2c",
    paddingTop: 10,
    // alignItems moved to ScrollView contentContainerStyle for web-safe behavior
  },
  menuItem: { marginVertical: 20, alignItems: "center" },
  menuText: { color: "white", fontSize: 12, marginTop: 4 },

  chartContainer: { width: "70%", justifyContent: "center", paddingBottom: 40, alignItems: "center" },

  rightPanel: {
    width: "20%",
    backgroundColor: "#2c2c2c",
    padding: 10,
    justifyContent: "space-around",
  },
  panelSection: { marginVertical: 1 },
  label: { color: "#ccc", marginBottom: 2, fontSize: 14, bottom: 2 },
  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "#666",
    borderWidth: 1,
    borderRadius: 6,
    padding: 5,
    color: "#fff",
    fontSize: 14,
  },
  inputRow: { marginVertical: 6 },
  expButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    marginRight: 6,
  },
  expButtonActive: { backgroundColor: "blue" },
  expButtonText: { color: "#fff", fontSize: 14 },
  profitBox: {
    backgroundColor: "rgba(255,255,0,0.1)",
    borderColor: "gold",
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 0,
    alignItems: "center",
    bottom: 9,
  },
  profitText: { color: "darkgoldenrod", fontWeight: "bold", fontSize: 16 },
  actionButton: {
    padding: 12,
    marginVertical: 4,
    borderRadius: 8,
    bottom: 20,
    alignItems: "center",
  },
  actionText: { color: "white", fontWeight: "bold" },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  overlay: {
    position: "absolute",
    top: 50,
    left: "10%",
    width: "80%",
    height: "80%",
    backgroundColor: "#333",
    borderRadius: 8,
    zIndex: 100,
    padding: 10,
  },
  closeButton: { position: "absolute", top: 10, right: 10, zIndex: 10 },
  pageContent: { flex: 1, marginTop: 0 },
});
