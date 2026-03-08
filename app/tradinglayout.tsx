// TradingLayout.tsx
import { Ionicons } from "@expo/vector-icons";
import uuid from "react-native-uuid";

import { AccountType, useApp } from "./AppContext";

import ProfileBadge from "../components/ProfileBadge";

import type { ChartViewHandle } from "./ChartView";

import { useEffect, useRef, useState } from "react";

import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,

  TouchableOpacity,
  View
} from "react-native";


import AboutScreen from "./About";
import AccountSwitcher from "./AccountSwitcher";
import AlertScreen from "./Alert";
import ChartView from "./ChartView";
import DepositWithdrawScreen from "./DepositWithdraw";
import InviteEarnScreen from "./InviteEarn";
import LeaderboardBar from "./LeaderboardBar";
import ProfileScreen from "./Profile";
import TournamentScreen from "./Tournament";
import TradeSummaryBar from "./TradeSummaryBar";


import { getAuth } from "firebase/auth";
import {
  doc,

  increment, onSnapshot, runTransaction,
  serverTimestamp, setDoc, updateDoc
} from "firebase/firestore";
import { db } from "../firebaseConfig";

// ------------------------ TYPES ------------------------


type TradeType = "buy" | "sell";

interface Trade {
  id: string;
  type: TradeType;
  amount: number;
  entryPrice: number;
   currentPrice: number; 
  expiryTime: number;
  account: AccountType;
  
  openTime: number;
    
}

interface ClosedTrade extends Trade {
  result: "GAIN" | "LOSS";
  payout: number;
  closePrice: number;
   openPrice: number;
    closeTime: number; 
  
}



// ------------------------ FIREBASE HELPERS ------------------------

const auth = getAuth();


const updateAccountBalance = async (
  userId: string,
  account: AccountType,
  delta: number
) => {
  // ❌ Demo → local only
  // ❌ Tournament → handled elsewhere
  if (account.type !== "real") return;

  try {
    const userRef = doc(db, "users", userId);

   await updateDoc(userRef, {
  realBalance: increment(delta),
});
  } catch (e) {
    console.error("❌ Failed to update account balance:", e);
  }
};
type TournamentMeta = {
  id: string;
  name: string;
  symbol: string; // "$" | "T"
};
const payoutTournamentWin = async (
  tournamentId: string,
  uid: string,
  payout: number
) => {
  const playerRef = doc(
    db,
    "tournaments",
    tournamentId,
    "players",
    uid
  );

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(playerRef);
    if (!snap.exists()) return;

    const balance = snap.data().balance ?? 0;

    tx.update(playerRef, {
      balance: balance + payout,
      updatedAt: serverTimestamp(),
    });
  });
};
// FIRESTORE DEMO HELPERS
const updateDemoBalance = async (uid: string, newBalance: number) => {
  if (!uid) return;

  try {
    const demoRef = doc(db, "demoBalances", uid);

    await setDoc(
      demoRef,
      {
        balance: newBalance,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

  } catch (e) {
    console.error("❌ Failed to update demo balance:", e);
  }
};
// ------------------------ MAIN COMPONENT ------------------------

export default function TradingLayout() {
  const PAYOUT = 95; // Fixed payout %
  const [activePage, setActivePage] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(10);

  const [showAmountPad, setShowAmountPad] = useState(false);
const [showExpiryPad, setShowExpiryPad] = useState(false);



const expiryPosition = useRef(new Animated.ValueXY()).current;
const expiryPanResponder = useRef(
  PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event(
      [null, { dx: expiryPosition.x, dy: expiryPosition.y }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: () => {
      expiryPosition.extractOffset();
    }
  })
).current;


  const [expiration, setExpiration] = useState<string>("15s");

  const expirationOptions: string[] = ["5s","8s","10s", "12s", "15s","20s","25s",  "30s", "1m", "5m", "15m", "30m", "1h"];
 
 
  const [profitPercent] = useState<number>(PAYOUT);
  const { unreadCount } = useApp();

 const [balances, setBalances] = useState({
  real: 0,
  tournament: 0,
});

const [tournamentBalances, setTournamentBalances] = useState<
  Record<string, number>
>({});

const handleKeyPress = (key: string) => {
  if (key === "back") {
    setAmount((prev) => {
      const str = String(prev).slice(0, -1);
      return str === "" ? 0 : Number(str);
    });
    return;
  }

  if (key === "ok") {
    setShowAmountPad(false);
    return;
  }

  setAmount((prev) => {
    const next = String(prev === 0 ? "" : prev) + key;
    return Number(next);
  });
};
const { 
  profile, 
  tournaments, 
  activeAccount, 
  setActiveAccount, 
  activeTournament, 
  balances: ctxBalances,
  demoBalance,
  setDemoBalance
} = useApp();

// -------- Chart Settings --------
const [useHeikinAshi, setUseHeikinAshi] = useState(false);
const [compressWicks, setCompressWicks] = useState(false);
const [tournamentMeta, setTournamentMeta] = useState<
  Record<string, TournamentMeta>
>({});
const padPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
const panResponder = useRef(
  PanResponder.create({
    onStartShouldSetPanResponder: () => true,

    onPanResponderMove: Animated.event(
      [null, { dx: padPosition.x, dy: padPosition.y }],
      { useNativeDriver: false }
    ),

    onPanResponderRelease: () => {
      padPosition.extractOffset();
    },
  })
).current;

useEffect(() => {
  // 🔐 Only run if activeAccount is a tournament account
  if (!activeAccount || activeAccount.type !== "tournament") return;

  const tid = activeAccount.tournamentId; // TS knows this exists now
  if (!tid) return;

  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const playerRef = doc(db, "tournaments", tid, "players", uid);

  let isSubscribed = true; // guard to prevent updates after unmount

  const unsub = onSnapshot(playerRef, (snap) => {
    if (!snap.exists() || !isSubscribed) return;

    const newBalance = snap.data()?.balance ?? 0;
    setBalances((prev) => ({ ...prev, tournament: newBalance }));
  });

  return () => {
    isSubscribed = false;
    unsub(); // clean up listener
  };
}, [activeAccount]);


useEffect(() => {
  if (!tournaments || tournaments.length === 0) return;

  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const unsubs: (() => void)[] = [];

  tournaments.forEach((t) => {
    const ref = doc(
      db,
      "tournaments",
      t.tournamentId,
      "players",
      uid
    );

    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();

      setTournamentBalances((prev) => ({
        ...prev,
        [t.tournamentId]: data.balance ?? 0,
      }));
    });

    unsubs.push(unsub);
  });

  return () => unsubs.forEach((u) => u());
}, [tournaments]);



useEffect(() => {
  chartRef.current?.setWickCompression(compressWicks ? 0.3 : 1);
}, [compressWicks]);

useEffect(() => {
  setBalances((prev) => ({
    ...prev,
    real: ctxBalances.real,
  }));
}, [ctxBalances.real]);

 const chartRef = useRef<ChartViewHandle | null>(null);

  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
 const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);


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

const buildAccountPayload = (account: AccountType): AccountType => {
  if (account.type === "tournament") {
    return {
      type: "tournament",
      tournamentId: account.tournamentId,
    };
  }

  return {
    type: account.type, // "real" | "demo"
  };
};


 // Open a trade (deduct stake now, add marker now)

const handleTrade = async (type: "buy" | "sell") => {
  // 🔐 PREVIEW MODE GUARD
  if (profile?.preview) {
    alert("Preview mode: trading is disabled");
    return;
  }
 if (activeAccount.type === "real") {
    alert("Real account trading is temporarily disabled. Use Demo or Tournament accounts.");
    return; // ⚠ Only blocks trading, not deposits/withdrawals
  }
  
  const stake = Number(amount) || 0;
  if (stake <= 0) return;

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

  // 🔎 CHECK BALANCE FIRST

  // ---------------- TOURNAMENT ACCOUNT ----------------
  if (activeAccount.type === "tournament" && activeAccount.tournamentId) {
    const playerRef = doc(
      db,
      "tournaments",
      activeAccount.tournamentId,
      "players",
      uid
    );

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(playerRef);

        if (!snap.exists()) {
          throw new Error("PLAYER_NOT_FOUND");
        }

        const balance = snap.data().balance ?? 0;

        if (balance < stake) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        const newBalance = balance - stake;

        tx.update(playerRef, {
          balance: newBalance,
          updatedAt: serverTimestamp(),
        });

        // ✅ Immediately update local balances for UI
        setBalances((prev) => ({
          ...prev,
          tournament: newBalance,
        }));

        setTournamentBalances((prev) => ({
          ...prev,
          [activeAccount.tournamentId!]: newBalance,
        }));
      });
    } catch (err) {
      console.log("❌ Tournament trade error:", err);
      alert("Tournament balance low. Go to tournament page to rebuy.");
      setActivePage("Tournaments");
      return; // ⛔ STOP TRADE
    }
  }

  // ---------------- DEMO ACCOUNT ----------------
  if (activeAccount.type === "demo") {
 if (demoBalance < stake) {
  alert("Not enough demo balance, top up your demo account to trade more");
  return;
}

const uid = auth.currentUser?.uid;
if (!uid) return;

setDemoBalance((prev) => {
  const newBalance = prev - stake;

  // ❗ Firestore update so leaderboard updates live
  updateDemoBalance(uid, newBalance);

  return newBalance;
});
}
  const now = Date.now();
  const id = uuid.v4() as string;

  // Track open trade (include openPrice for summary)
  const t: Trade & { openPrice?: number } = {
    id,
    type,
    amount: stake,
    entryPrice,
    currentPrice: entryPrice,
    openPrice: entryPrice,
    openTime: now,
    expiryTime: now + parseExpirationMs(expiration),
    account: buildAccountPayload(activeAccount),
  };

  setOpenTrades((prev) => [...prev, t]);

  // 🔥 SAVE TO FIRESTORE (ONLY REAL & TOURNAMENT)
  if (activeAccount.type !== "demo") {
    createTradeInFirestore(uid, t);
  }

  // Calculate potential profit
  const potentialProfit = stake * (1 + profitPercent / 100);

  // Drop a marker on the chart
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
    `Opened ${type.toUpperCase()} ${stake} @ ${entryPrice} | Account=${activeAccount.type}`
  );
  // 🔥 Show trade confirmation popup
setTradeToast({
 visible: true, 
  type,
  amount: stake,
  symbol: "BECH/USD",
  expiration,
});
setTimeout(() => setTradeToast(null), 2000);
};
// 🕒 SINGLE MASTER CLOCK — updates price + resolves trades
useEffect(() => {
  const timer = setInterval(() => {
    const now = Date.now();

    // 1️⃣ Get ONE price for this tick
    const livePrice = chartRef.current?.getCurrentPrice?.();
    if (livePrice == null) return;

    setOpenTrades((prev) => {
  const stillOpen: Trade[] = [];
  const newlyClosed: ClosedTrade[] = [];

  prev.forEach((t) => {
    const updatedTrade = {
      ...t,
      currentPrice: livePrice,
    };

    if (t.expiryTime > now) {
      stillOpen.push(updatedTrade);
      return;
    }

    const isWin =
      (t.type === "buy" && livePrice > t.entryPrice) ||
      (t.type === "sell" && livePrice < t.entryPrice);

    const payout = isWin
      ? t.amount * (1 + profitPercent / 100)
      : 0;

    if (isWin) {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
if (t.account.type === "demo") {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  setDemoBalance((prev) => {
    const newBalance = prev + payout;

    // 🔥 Firestore update using correct balance
    updateDemoBalance(uid, newBalance);

    return newBalance;
  });
}

      if (t.account.type === "real") {
        updateAccountBalance(uid, t.account, payout);
      }

      if (t.account.type === "tournament" && t.account.tournamentId) {
        payoutTournamentWin(t.account.tournamentId, uid, payout);
      }
    }

    const closedTrade: ClosedTrade = {
      ...updatedTrade,
      result: isWin ? "GAIN" : "LOSS",
      payout,
      closePrice: livePrice,
      openPrice: t.entryPrice,
      closeTime: now,
    };

    newlyClosed.push(closedTrade);

    if (t.account.type !== "demo") {
      const uid = auth.currentUser?.uid;
      if (uid) closeTradeInFirestore(uid, closedTrade);
    }

    chartRef.current?.removeMarker?.(t.id);
  });

  if (newlyClosed.length > 0) {
    setClosedTrades((c) => [...c, ...newlyClosed]);
  }

  return stillOpen;
});

  }, 1000);

  return () => clearInterval(timer);
}, [profitPercent, setDemoBalance, demoBalance]);



useEffect(() => {
  console.log("🔥 TradingLayout balances:", balances);
}, [balances]);

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


useEffect(() => {
  // 🔐 HARD GUARD — REQUIRED
  if (!activeTournament?.tournamentId) {
    console.log("⛔ Skipping tournament meta listener: no tournamentId");
    return;
  }

  const tId = activeTournament.tournamentId;

  if (tournamentMeta[tId]) return;

  const ref = doc(db, "tournaments", tId); // ✅ now always safe

  const unsub = onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;

    const data = snap.data();

    setTournamentMeta((prev) => ({
      ...prev,
      [tId]: {
        id: snap.id,
        name: data.name,
        symbol: data.symbol ?? "T",
      },
    }));
  });

  return () => unsub();
}, [activeTournament, tournamentMeta]);



  
const [tradeToast, setTradeToast] = useState<{
  visible: boolean;
  type: "buy" | "sell";
  amount: number;
  symbol: string;
  expiration: string;
} | null>(null);
  // Menu
  const menuItems: { icon: string; label: string; color: string }[] = [
    { icon: "person-outline", label: "Profile", color: "#00FF00" },
    { icon: "cash-outline", label: "DepositWithdraw", color: "green" },
    { icon: "trophy-outline", label: "Tournaments", color: "#FFD700" },
    { icon :"gift-outline", label: "Invite&Earn", color: "#00BFFF" },
    { icon: "notifications-outline", label: "Alerts", color: "#FF4500" },
     { icon: "information-circle-outline", label: "About", color: "#FF69B4" },
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
      case "Invite&Earn":
        Component = InviteEarnScreen;
        break;
      case "Alerts":
        Component = AlertScreen;
        break;
      case "DepositWithdraw":
        Component = DepositWithdrawScreen;
        break;
       case "About":
  Component = AboutScreen;
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
      {activePage === "Profile" ? (
        <ProfileScreen
          useHeikinAshi={useHeikinAshi}
          setUseHeikinAshi={setUseHeikinAshi}
          compressWicks={compressWicks}
          setCompressWicks={setCompressWicks}
        />
      ) : (
        <Component />
      )}
    </View>
  </View>
);
  };


  return (
  <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#0a0a0a" }}>

{/* 🔥 FLOATING ACCOUNT SWITCHER – top-right */}
<AccountSwitcher
  balances={{
     demo: demoBalance,
   real: ctxBalances.real, 
    tournament: balances.tournament,
  }}
  onTopUp={() => setDemoBalance(10000)}
  tournamentBalances={tournamentBalances}
  activeAccount={activeAccount}
  tournamentMeta={tournamentMeta}
  onSwitch={(account) => {
    setActiveAccount(account);
    setTimeout(() => chartRef.current?.resize?.(), 50);
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
   
    {/* 🔥 Profile Status */}
  <ProfileBadge />



  {/* Menu Items */}
      {menuItems.map((item) => (
  <TouchableOpacity
    key={item.label}
    style={styles.menuItem}
    onPress={() => setActivePage(item.label)}
  >
    {item.label === "Alerts" ? (
      <View style={{ width: 28, height: 28 }}>
        <Ionicons name={item.icon as any} size={28} color={item.color} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}> {unreadCount > 99 ? "99+" : unreadCount}</Text>
          </View>
        )}
      </View>
    ) : (
      <Ionicons name={item.icon as any} size={28} color={item.color} />
    )}
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
     
      <LeaderboardBar
  activeAccount={activeAccount}
  username={profile?.username}
  countryCode={profile?.country}
  tournamentBalance={balances.tournament}
demoBalance={demoBalance}
 
/>


   
<View style={{ flex: 1, width: "100%" }}>
  <ChartView
    ref={chartRef}
    symbol="BECH/USD"
  />
</View>



      <TradeSummaryBar
  openTrades={openTrades}
  closedTrades={closedTrades}
  activeAccount={activeAccount.type}
   onResizeChart={() => chartRef.current?.resize?.()}
/>

    </View>

    {/* Right Panel (unchanged EXCEPT switcher removed) */}
    <View style={styles.rightPanel}>
      {/* NO MORE switcher here */}

      {/* Trade Size */}
      <View style={styles.inputRow}>
        <Text style={styles.label}>Trade Size</Text>
       <TouchableOpacity
  style={styles.input}
  onPress={() => setShowAmountPad(true)}
>
  <Text style={{ color: "#fff", fontSize: 14 }}>
    {amount}
  </Text>
</TouchableOpacity>
      </View>

      {/* Expiration */}
      <View style={styles.inputRow}>
        <Text style={styles.label}>Expiration</Text>
       <TouchableOpacity
  style={styles.expiryButton}
  onPress={() => setShowExpiryPad(true)}
>
  <Text style={styles.expiryKeyText}>{expiration}</Text>
</TouchableOpacity>
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
   <Modal
  visible={showAmountPad}
  transparent
  animationType="fade"
  onRequestClose={() => setShowAmountPad(false)}
>
  <Pressable
  style={styles.padOverlay}
  onPress={() => setShowAmountPad(false)}
>
  <Animated.View
  style={[
    styles.padContainer,
    { transform: padPosition.getTranslateTransform() }
  ]}
  {...panResponder.panHandlers}
>
<TouchableOpacity
  style={{ position:"absolute", top:6, right:8 }}
  onPress={() => setShowAmountPad(false)}
>
  <Text style={{ color:"red", fontSize:18 }}>✕</Text>
</TouchableOpacity>
      {[
        ["7","8","9"],
        ["4","5","6"],
        ["1","2","3"],
        ["0","back","ok"]
      ].map((row, i) => (
        <View key={i} style={styles.padRow}>
          {row.map((key) => (
            <TouchableOpacity
              key={key}
              style={styles.padKey}
              onPress={() => handleKeyPress(key)}
            >
              <Text style={styles.padKeyText}>
                {key === "back" ? "⌫" : key === "ok" ? "OK" : key}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

      ))}

    </Animated.View>
  </Pressable>
</Modal>
<Modal
  visible={showExpiryPad}
  transparent
  animationType="fade"
  onRequestClose={() => setShowExpiryPad(false)}
>
  <Pressable
    style={styles.padOverlay}
    onPress={() => setShowExpiryPad(false)}
  >
    <Animated.View
      style={[
        styles.expiryContainer,
        { transform: expiryPosition.getTranslateTransform() }
      ]}
      {...expiryPanResponder.panHandlers}
    >

      <TouchableOpacity
        style={{ position: "absolute", top: 6, right: 8 }}
        onPress={() => setShowExpiryPad(false)}
      >
        <Text style={{ color: "red", fontSize: 18 }}>✕</Text>
      </TouchableOpacity>

      <View style={styles.expiryGrid}>
        {expirationOptions.map((time) => (
          <TouchableOpacity
            key={time}
            style={[
              styles.expiryKey,
              expiration === time && { backgroundColor: "#00c853" }
            ]}
            onPress={() => {
              setExpiration(time);
              setShowExpiryPad(false);
            }}
          >
            <Text style={styles.expiryKeyText}>{time}</Text>
          </TouchableOpacity>
        ))}
      </View>

    </Animated.View>
  </Pressable>
</Modal>
{tradeToast && (
  <Animated.View
    style={{
      position: "absolute",
      top: 60,
      left: "50%",
      transform: [{ translateX: -120 }],
      width: 240,
      padding: 12,
      backgroundColor: tradeToast.type === "buy" ? "green" : "red",
      borderRadius: 8,
      alignItems: "center",
      zIndex: 100,
      opacity: 0.9,
    }}
  >
    <Text style={{ color: "#fff", fontWeight: "bold" }}>Trade Placed</Text>
    <Text style={{ color: "#fff" }}>{tradeToast.symbol}</Text>
    <Text style={{ color: "#fff" }}>
      {tradeToast.type.toUpperCase()} ${tradeToast.amount}
    </Text>
    <Text style={{ color: "#fff" }}>{tradeToast.expiration}</Text>
  </Animated.View>
)}
  </View>
);
}

// Styles
const styles = StyleSheet.create({
  leftMenu: { width: "10%", backgroundColor: "#2c2c2c", top:3, bottom: 10, paddingTop: 10, },
  menuItem: { marginVertical: 20, alignItems: "center" },
  menuText: { color: "white", fontSize: 12, marginTop: 4 },

  chartContainer: { width: "70%", height: "100%",  justifyContent: "flex-start", paddingBottom: 50, },

  rightPanel: { overflow: "visible",
  position: "relative", zIndex: 10, width: "20%", backgroundColor: "#2c2c2c", padding: 10, top:30,
   justifyContent: "space-around", },
 panelSection: { marginVertical: 1 }, label: { color: "#ccc", marginBottom: 2, fontSize: 14, bottom: 2 },
  input: {  backgroundColor: "rgba(255,255,255,0.1)", borderColor: "#666",  borderWidth: 1,  borderRadius: 6, 
   padding: 5, color: "#fff", fontSize: 14, },
  inputRow: { marginVertical: 6 },
  expiryButton: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 3,
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
  switcherContainer: { width: "100%", minHeight: 120,
    maxHeight: 160,  marginBottom: 12,
    justifyContent: "center", flexDirection: "row", },
  badge: {  position: "absolute",  top: -5, right: -5, backgroundColor: "red", borderRadius: 10,
  paddingHorizontal: 6, paddingVertical: 2, zIndex: 100,},
badgeText: {  color: "#fff", fontSize: 10, fontWeight: "bold",},
padOverlay:{  flex:1,  backgroundColor:"rgba(0,0,0,0.5)",  justifyContent:"center",
  alignItems:"center"},
padContainer:{ width:220, backgroundColor:"#1c1c1c", borderRadius:12,
  padding:10},

padRow:{  flexDirection:"row", justifyContent:"space-between",
  marginVertical:4},

padKey:{  width:60,  height:45, backgroundColor:"#333", borderRadius:8,
  justifyContent:"center", alignItems:"center"},

padKeyText:{  color:"#fff", fontSize:18,  fontWeight:"bold"
},
expiryContainer: {
  width: 240,
  backgroundColor: "#111",
  borderRadius: 10,
  padding: 10,
},

expiryGrid: {
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "space-between",
},

expiryKey: {
  width: "30%",
  padding: 10,
  marginVertical: 5,
  backgroundColor: "#222",
  borderRadius: 6,
  alignItems: "center",
},

expiryKeyText: {
  color: "#fff",
  fontSize: 14,
},

});
