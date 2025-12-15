// TradingLayout.tsx
import { Ionicons } from "@expo/vector-icons";
import uuid from "react-native-uuid";


import type { ChartViewHandle } from "./ChartView";


import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";

import AboutContact from "./AboutContact";
import AccountSwitcher from "./AccountSwitcher";
import AlertScreen from "./Alert";
import ChartView from "./ChartView";
import DepositWithdrawScreen from "./DepositWithdraw";
import LeaderboardBar from "./LeaderboardBar";
import ProfileScreen from "./Profile";
import TournamentScreen from "./Tournament";
import TradeHistoryScreen from "./Tradehistory";
import TradeSummaryBar from "./TradeSummaryBar";


import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot,  setDoc, updateDoc, } from "firebase/firestore";
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

interface ClosedTrade extends Trade {
  result: "GAIN" | "LOSS";
  payout: number;
  closePrice: number;
   openPrice: number; 
  
}


// ------------------------ FIREBASE HELPERS ------------------------

const auth = getAuth();


const updateAccountBalance = async (
  userId: string,
  account: AccountType,
  newBalance: number
) => {
  // ❌ Never update demo balance
  if (account === "demo") return;

  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      [`accounts.${account}.balance`]: newBalance,
    });

    console.log(`Updated ${account} balance →`, newBalance);
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

const [profile, setProfile] = useState<any>(null);
const [profileVerified, setProfileVerified] = useState<boolean>(false);
const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  // 🔥 Sync balances with Firestore in real time
 useEffect(() => {
  const unsubAuth = onAuthStateChanged(auth, (user) => {
    if (!user) {
      console.log("❌ User not logged in – stopping Firestore listener.");
      // optionally zero balances or keep demo
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const userData = docSnap.data();
      if (!userData?.accounts) return;

      setBalances(prev => ({
  real: userData.accounts?.real?.balance ?? prev.real,
  demo: prev.demo,
  tournament: userData.accounts?.tournament?.balance ?? prev.tournament,
}));

    });

    // cleanup when auth state changes or component unmounts
    return () => unsubscribe();
  });

  return () => unsubAuth(); // cleanup auth listener
}, []); // no external deps needed now

  const [activeAccount, setActiveAccount] = useState<
    "real" | "demo" | "tournament"
  >("demo");

  
  const [orientation, setOrientation] = useState("portrait");

const chartRef = useRef<ChartViewHandle | null>(null);

  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
 const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);

const currentUser = auth.currentUser;
  // Parse expiration like "30s", "1m", "5m"
  function parseExpirationMs(exp: string) {
  const val = parseInt(exp, 10);
  if (Number.isNaN(val)) return 0;

  if (exp.endsWith("s")) return val * 1000;
  if (exp.endsWith("m")) return val * 60 * 1000;
  if (exp.endsWith("h")) return val * 60 * 60 * 1000;
  if (exp.endsWith("d")) return val * 24 * 60 * 60 * 1000;
  return 0;
}


 const createTradeInFirestore = async (userId: string, trade: Trade) => {
  try {
    const ref = doc(db, "users", userId, "trades", trade.id);
    await setDoc(ref, trade, { merge: true }); // <-- FIXED
    console.log("🔥 Trade saved:", trade);
  } catch (err) {
    console.log("❌ Error saving trade:", err);
  }
};


const closeTradeInFirestore = async (userId: string, closed: ClosedTrade) => {
  try {
    const ref = doc(db, "users", userId, "closedTrades", closed.id);
    await setDoc(ref, closed, { merge: true }); // <-- FIXED
    console.log("🔥 Closed trade saved:", closed);
  } catch (err) {
    console.log("❌ Error saving closed trade:", err);
  }
};


 
 // Open a trade (deduct stake now, add marker now)
const handleTrade = (type: "buy" | "sell") => {
  const stake = Number(amount) || 0;
  if (stake <= 0) return;

  if (balances[activeAccount] - stake < 0) {
    console.log("Not enough balance");
    return;
  }

  const uid = auth.currentUser?.uid;
  if (!uid) {
    console.log("❌ You must be logged in to trade");
    return;
  }

  const entryPrice = chartRef.current?.getCurrentPrice?.();
  if (entryPrice == null) {
    console.log("Chart not ready yet — can't open trade.");
    return;
  }

  const now = Date.now();
  const id = uuid.v4() as string;


  // Deduct stake immediately (demo = local only)
  setBalances((prev) => {
    const newBalance = prev[activeAccount] - stake;

    // SAVE ONLY for real & tournament
    if (activeAccount !== "demo") {
      const uidLocal = auth.currentUser?.uid;
      if (uidLocal) updateAccountBalance(uidLocal, activeAccount, newBalance);
    }

    return {
      ...prev,
      [activeAccount]: newBalance,
    };
  });

  // Track open trade (include openPrice for summary)
  const t: Trade & { openPrice?: number } = {
    id,
    type,
    amount: stake,
    entryPrice,
    openPrice: entryPrice, // keep an explicit field for summary & closedTrades
    expireTime: now + parseExpirationMs(expiration),
    account: activeAccount,
  };

  setOpenTrades((prev) => [...prev, t]);

  // 🔥 SAVE TO FIRESTORE
  createTradeInFirestore(uid, t);

  // Calculate potential profit
  const potentialProfit = stake * (1 + profitPercent / 100);

  
 // Drop a marker on the chart — correct 6-argument call
if (chartRef.current?.onTrade) {
  chartRef.current.onTrade(
    type.toUpperCase(),             // string
    stake,                          // number
    entryPrice,                     // number
    id,                             // string
    potentialProfit,                // number
    parseExpirationMs(expiration)   // number
  );
}

console.log(
  `Opened ${type} ${stake} @ ${entryPrice} on ${activeAccount}| Potential: $${potentialProfit.toFixed(
    2
  )}`
);

};

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
          // WIN / LOSS
          const wentUp = finalPrice > t.entryPrice;
          const wentDown = finalPrice < t.entryPrice;
          const isWin =
            (t.type === "buy" && wentUp) ||
            (t.type === "sell" && wentDown);

          // Calculate payout ONCE
          const tradePayout = isWin
            ? t.amount * (1 + profitPercent / 100)
            : 0;

          // -----------------------
          // 🟢 WIN → add payout
          // -----------------------
          if (isWin) {
            setBalances((b) => {
              const newBalance = b[t.account] + tradePayout;

              // Firestore update (real + tournament only)
              if (t.account !== "demo") {
                const uid = auth.currentUser?.uid;
                if (uid) updateAccountBalance(uid, t.account, newBalance);
              }

              return { ...b, [t.account]: newBalance };
            });

            console.log(
              `WIN ${t.type} → +${tradePayout} | entry=${t.entryPrice} close=${finalPrice}`
            );
          }

          // -----------------------
          // 🔴 LOSS → no balance change
          // -----------------------
          else {
            console.log(
              `LOSS ${t.type} | entry=${t.entryPrice} close=${finalPrice} | balance unchanged`
            );

            // Firestore still gets the unchanged balance
            setBalances((b) => {
              const newBalance = b[t.account];

              if (t.account !== "demo") {
                const uid = auth.currentUser?.uid;
                if (uid) updateAccountBalance(uid, t.account, newBalance);
              }

              return b; // no change
            });
          }

          // Build closed trade record
          const closedTrade: ClosedTrade = {
            ...t,
            openPrice: (t as any).openPrice ?? t.entryPrice,
            result: isWin ? "GAIN" : "LOSS",
            payout: tradePayout,
            closePrice: finalPrice,
          };

          setClosedTrades((prev) => [...prev, closedTrade]);

          const uidLocal = auth.currentUser?.uid;
          if (uidLocal) closeTradeInFirestore(uidLocal, closedTrade);

          // Remove marker
          chartRef.current?.removeMarker?.(t.id);
        } else {
          stillOpen.push(t);
        }
      });

      return stillOpen;
    });
  }, 1000);

  return () => clearInterval(timer);
}, [profitPercent]);


/* -----------------------------------------------------------
   1. REALTIME LISTENER — LOAD PROFILE CORRECTLY
----------------------------------------------------------- */
useEffect(() => {
  if (!currentUser) return;

  const ref = doc(db, "users", currentUser.uid);
  const unsub = onSnapshot(ref, snap => {
    if (snap.exists()) {
      setProfile((prev: any) => ({
        ...prev,
        ...snap.data(),
      }));

      // 🔥 SET VERIFIED HERE DIRECTLY
      setProfileVerified(snap.data().profileVerified === true);
    }
  });

  return () => unsub();
}, [currentUser]);


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
  /* -----------------------------------------------------------
   5. PROFILE COMPLETION CHECK — FIXED
      ✔ This must NOT block save
      ✔ Only updates "profileVerified", not save logic
----------------------------------------------------------- */
const checkProfileCompletion = useCallback(() => {
  if (!currentUser || !profile) {
    setProfileVerified(false);
    return;
  }

  const required = [
    profile.displayName,
    profile.username,
    profile.phone,
    profile.country,
    profile.dateOfBirth,
    profile.loginCode,
  ];

  const complete = required.every(f => f && f.trim().length > 0);

  setProfileVerified(complete);
}, [currentUser, profile]);

useEffect(() => {
  checkProfileCompletion();
}, [checkProfileCompletion]);

  const expirations = [
    "5s", "8s", "12s", "15s", "25s", "30s", "1m", "2m", "3m",  "5m",  "15m",
    "30m", "1h", "2h", "4h", "1d", "3d", ];

  // Menu
  const menuItems: { icon: string; label: string; color: string }[] = [
    { icon: "person-outline", label: "Profile", color: "#00FF00" },
    { icon: "cash-outline", label: "DepositWithdraw", color: "green" },
    { icon: "trophy-outline", label: "Tournaments", color: "#FFD700" },
    { icon: "time-outline", label: "Trade History", color: "#00BFFF" },
    { icon: "notifications-outline", label: "Alerts", color: "#FF4500" },
     { icon: "information-circle-outline", label: "AboutContact", color: "#FF69B4" },
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
       case "AboutContact":
  Component = AboutContact;
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
          <Component/>
        </View>
      </View>
    );
  };
  
  return (
  <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#0a0a0a" }}>

    {/* 🔥 FLOATING ACCOUNT SWITCHER – at top-right, OUTSIDE right panel */}
    <AccountSwitcher
  balances={balances}
  activeAccount={activeAccount}
  onSwitch={(id) => {
    setActiveAccount(id);

    // resize chart after account switches
    setTimeout(() => {
      chartRef.current?.resize?.();
    }, 50);
  }}
  onTopUp={() => {
    // only demo account can top up
    if (activeAccount !== "demo") {
      alert("You can only top up your demo account.");
      return;
    }
    // ✔ local balance update (no Firestore write)
    setBalances((prev) => ({
      ...prev,
      demo: prev.demo + 10000,
    }));
  }}
  onDeposit={() => setActivePage("DepositWithdraw")}
  onWithdraw={() => setActivePage("DepositWithdraw")}
/>

    {/* Left vertical menu */}
    <ScrollView
      style={styles.leftMenu}
      contentContainerStyle={{ paddingTop: 10, alignItems: "center" }}
    showsVerticalScrollIndicator={false}
    >
    {/* 🔥 Profile Status Badge (Top) */}
  {!profileVerified ? (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ff4444",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 12,
        width: "90%",
        justifyContent: "center",
      }}
    >
      <Ionicons name="warning" size={18} color="white" />
      <Text style={{ color: "white", marginLeft: 6, fontSize: 13 }}>
        Unverified??
      </Text>
    </View>
  ) : (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#21e6c1",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 12,
        width: "90%",
        justifyContent: "center",
      }}
    >
      <Ionicons name="checkmark-circle" size={18} color="#16213e" />
      <Text style={{ color: "#16213e", marginLeft: 6, fontSize: 13 }}>
         Verified ✓
      </Text>
    </View>
  )}

  {/* Menu Items */}
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
      <Text style={{ color: "yellow", fontWeight: "bold", fontSize: 15 }}>
        Motto: Discipline, Patience, Swiftness and Excellence.
      </Text>
    </Animated.View>

    {/* Chart + Pages */}
    {renderPage()}
    <View style={styles.chartContainer}>
      <LeaderboardBar />

   
 <ChartView
    ref={chartRef}
    symbol="BECH/USD"
    orientation={orientation as "portrait" | "landscape"}
    onLayout={() => {
      // Clear previous timer safely
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      // Start new debounce timer
      resizeTimeoutRef.current = setTimeout(() => {
        chartRef.current?.resize?.();
      }, 80);
    }}
  />

      <TradeSummaryBar
  openTrades={openTrades}
  closedTrades={closedTrades}
  activeAccount={activeAccount}
  balances={balances}
   onResizeChart={() => chartRef.current?.resize?.()}
/>

    </View>

    {/* Right Panel (unchanged EXCEPT switcher removed) */}
    <View style={styles.rightPanel}>
      {/* NO MORE switcher here */}

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
              style={[
                styles.expButton,
                expiration === exp && styles.expButtonActive,
              ]}
              onPress={() => setExpiration(exp)}
            >
              <Text style={styles.expButtonText}>{exp}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Profit */}
      <View
        style={[
          styles.profitBox,
          profitPercent >= 0 ? styles.profitGlowBlue : styles.profitGlowRed,
        ]}
      >
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
      <Text style={{ color: "green", fontWeight: "bold", fontSize: 12.5 }}>
        Goal: Molding A Disciplined Trader and Mastering Market/Price Movement Psychology!
      </Text>
    </Animated.View>
  </View>
);
}

// Styles
const styles = StyleSheet.create({
  leftMenu: { width: "10%", backgroundColor: "#2c2c2c", top:10, bottom: 10, paddingTop: 10, },
  menuItem: { marginVertical: 20, alignItems: "center" },
  menuText: { color: "white", fontSize: 12, marginTop: 4 },

  chartContainer: { width: "70%", justifyContent: "center", paddingBottom: 40,  alignItems: "center",},

  rightPanel: { overflow: "visible",
  position: "relative", zIndex: 10, width: "20%", backgroundColor: "#2c2c2c", padding: 10, top:30,
   justifyContent: "space-around", },
 panelSection: { marginVertical: 1 }, label: { color: "#ccc", marginBottom: 2, fontSize: 14, bottom: 2 },
  input: {  backgroundColor: "rgba(255,255,255,0.1)", borderColor: "#666",  borderWidth: 1,  borderRadius: 6, 
   padding: 5, color: "#fff", fontSize: 14, },
  inputRow: { marginVertical: 6 },
  expButton: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 3,
   marginRight: 6, },
  expButtonActive: { backgroundColor: "blue" },
  expButtonText: { color: "#fff", fontSize: 14 },
  profitBox: { backgroundColor: "rgba(255,255,0,0.1)",  borderColor: "gold", borderWidth: 1, borderRadius: 8,
 padding: 8,  marginBottom: 0, alignItems: "center",  bottom: 9, },
  profitText: { color: "darkgoldenrod", fontWeight: "bold", fontSize: 16 },
  actionButton: { padding: 12,  marginVertical: 4,  borderRadius: 8,  bottom: 20,  alignItems: "center", },
  actionText: { color: "white", fontWeight: "bold" },
  
  overlay: { position: "absolute", top: 50, left: "10%", width: "80%", height: "80%", backgroundColor: "#333",
 borderRadius: 8,  zIndex: 100,  padding: 10, },
  closeButton: { position: "absolute", top: 10, right: 10, zIndex: 10 },
  pageContent: { flex: 1, marginTop: 0 },
  profitGlowBlue: { shadowColor: "#00aaff", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 20,
  elevation: 15,},
profitGlowRed: { shadowColor: "#ff2222",  shadowOffset: { width: 0, height: 0 },  shadowOpacity: 0.9,  shadowRadius: 20,
  elevation: 15, },
  // New switcher container: fixed height so AccountSwitcher doesn't jump.
  switcherContainer: {
    width: "100%",
    minHeight: 120,
    maxHeight: 160,
    marginBottom: 12,
    justifyContent: "center",
     flexDirection: "row",
  },

});
