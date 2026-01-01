// TradingLayout.tsx
import { Ionicons } from "@expo/vector-icons";
import uuid from "react-native-uuid";

import type { AccountType, TournamentAccount } from "../types/accounts";

import type { ChartViewHandle } from "./ChartView";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
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


import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collectionGroup,
  doc, increment, onSnapshot,
  query,
  serverTimestamp, setDoc, updateDoc,
  where,
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

type PlayerTournamentAccount = {
  tournamentId: string;
  balance: number;
  initialBalance: number;
  status: "active" | "completed";
};


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
      "accounts.real.balance": increment(delta),
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



// ------------------------ MAIN COMPONENT ------------------------

export default function TradingLayout() {
  const PAYOUT = 95; // Fixed payout %
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

// -------- Chart Settings --------
const [useHeikinAshi, setUseHeikinAshi] = useState(false);
const [compressWicks, setCompressWicks] = useState(false);
const [tournamentMeta, setTournamentMeta] = useState<
  Record<string, TournamentMeta>
>({});


useEffect(() => {
  // ChartView handles readiness internally
  chartRef.current?.setHeikinAshi(useHeikinAshi);
}, [useHeikinAshi]);

useEffect(() => {
  chartRef.current?.setWickCompression(compressWicks ? 0.3 : 1);
}, [compressWicks]);

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
  real:
    typeof userData.accounts?.real?.balance === "number"
      ? userData.accounts.real.balance
      : prev.real,

  demo: prev.demo,
tournament: prev.tournament, // 🔥 DO NOT TOUCH HERE

}));


    });

    // cleanup when auth state changes or component unmounts
    return () => unsubscribe();
  });

  return () => unsubAuth(); // cleanup auth listener
}, []); // no external deps needed now

  const [activeAccount, setActiveAccount] = useState<AccountType>({
  type: "demo",
});
const [tournaments, setTournaments] = useState<PlayerTournamentAccount[]>([]);



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
  if (activeAccount.type === "demo" && balances.demo - stake < 0) {
    console.log("Not enough demo balance");
    return;
  }

  if (activeAccount.type === "real" && balances.real - stake < 0) {
    console.log("Not enough real balance");
    return;
  }

 if (activeAccount.type === "tournament") {
  if (balances.tournament - stake < 0) {
    console.log("Not enough tournament balance");
    return;
  }
}


  const now = Date.now();
  const id = uuid.v4() as string;

  // ===============================
  // 💰 DEDUCT STAKE IMMEDIATELY
  // ===============================

  // 🟦 DEMO → local only
  if (activeAccount.type === "demo") {
    setBalances((prev) => ({
      ...prev,
      demo: prev.demo - stake,
    }));
  }

  // 🟨 REAL → Firestore
  if (activeAccount.type === "real") {
    updateAccountBalance(uid, activeAccount, -stake);
  }

  // 🟥 TOURNAMENT → tournament player doc
  if (activeAccount.type === "tournament") {
    const playerRef = doc(
      db,
      "tournaments",
      activeAccount.tournamentId,
      "players",
      uid
    );

    updateDoc(playerRef, {
      balance: increment(-stake),
      updatedAt: serverTimestamp(),
    });
  }

  


  // Track open trade (include openPrice for summary)
  const t: Trade & { openPrice?: number } = {
    id,
    type,
    amount: stake,
    entryPrice,
    currentPrice: entryPrice,
    openPrice: entryPrice, // keep an explicit field for summary & closedTrades
    openTime: now,
    expiryTime: now + parseExpirationMs(expiration),
    account: activeAccount,
  };

  setOpenTrades((prev) => [...prev, t]);

// 🔥 SAVE TO FIRESTORE (ONLY REAL & TOURNAMENT)
if (activeAccount.type !== "demo") {
  createTradeInFirestore(uid, t);
}

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
  `Opened ${type.toUpperCase()} ${stake} @ ${entryPrice} | Account=${activeAccount.type}`
);

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

      prev.forEach((t) => {
        // 2️⃣ Update trade price
        const updatedTrade = {
          ...t,
          currentPrice: livePrice,
        };

        // 3️⃣ Not expired → keep it
        if (t.expiryTime > now) {
          stillOpen.push(updatedTrade);
          return;
        }

        // 4️⃣ Expired → decide WIN / LOSS
        const isWin =
          (t.type === "buy" && livePrice > t.entryPrice) ||
          (t.type === "sell" && livePrice < t.entryPrice);

        const payout = isWin
          ? t.amount * (1 + profitPercent / 100)
          : 0;

        if (isWin) {
          console.log(
            `🟢 WIN | ${t.type.toUpperCase()} | entry=${t.entryPrice} close=${livePrice}`
          );

          const uid = auth.currentUser?.uid;
          if (!uid) return;

          // 🟦 DEMO → local only
          if (t.account.type === "demo") {
            setBalances((b) => ({
              ...b,
              demo: b.demo + payout,
            }));
          }

          // 🟨 REAL → users/{uid}
          if (t.account.type === "real") {
            updateAccountBalance(uid, t.account, payout);
          }

          // 🟥 TOURNAMENT → tournaments/{id}/players/{uid}
          if (t.account.type === "tournament") {
            const playerRef = doc(
              db,
              "tournaments",
              t.account.tournamentId,
              "players",
              uid
            );

            updateDoc(playerRef, {
              balance: increment(payout),
              updatedAt: serverTimestamp(),
            });
          }
        } else {
          console.log(
            `🔴 LOSS | ${t.type.toUpperCase()} | entry=${t.entryPrice} close=${livePrice}`
          );
        }

        // 5️⃣ Build closed trade
        const closedTrade: ClosedTrade = {
          ...updatedTrade,
          result: isWin ? "GAIN" : "LOSS",
          payout,
          closePrice: livePrice,
          openPrice: t.entryPrice,
          closeTime: Date.now(),
        };

        // ✅ Always keep locally (UI / history)
        setClosedTrades((c) => [...c, closedTrade]);

        // ✅ Save to Firestore ONLY for real & tournament
        if (t.account.type !== "demo") {
          const uid = auth.currentUser?.uid;
          if (uid) {
            closeTradeInFirestore(uid, closedTrade);
          }
        }

        // 6️⃣ Remove chart marker
        chartRef.current?.removeMarker?.(t.id);
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
  if (!currentUser) return;

  const q = query(
    collectionGroup(db, "players"),
    where("uid", "==", currentUser.uid)
  );

  const unsub = onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => {
      const data = d.data();
      return {
        tournamentId: d.ref.parent.parent?.id ?? "",
        balance: data.balance,
        initialBalance: data.initialBalance,
        status: data.status,
      };
    });

    setTournaments(list);
  });

  return () => unsub();
}, [currentUser]);

useEffect(() => {
  if (tournaments.length === 0) return;

  const unsubs: (() => void)[] = [];

  tournaments.forEach((t) => {
    if (tournamentMeta[t.tournamentId]) return; // already loaded

    const ref = doc(db, "tournaments", t.tournamentId);

    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();

      setTournamentMeta((prev) => ({
        ...prev,
        [t.tournamentId]: {
          id: snap.id,
          name: data.name,
          symbol: data.symbol ?? "T",
        },
      }));
    });

    unsubs.push(unsub);
  });

  return () => unsubs.forEach((u) => u());
}, [tournaments, tournamentMeta]);




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
 const tournamentAccountsForUI: TournamentAccount[] = tournaments
  .map((t) => {
    const meta = tournamentMeta[t.tournamentId];
    if (!meta) return null;

// 🔁 Map player status → UI status
    const uiStatus: TournamentAccount["status"] =
      t.status === "active" ? "live" : "closed";

    return {
      id: meta.id,
      name: meta.name,      // ✅ REAL NAME
      balance: t.balance,
       status: uiStatus, 
      symbol: meta.symbol,  // ✅ "$" or "T"
    };
  })
  .filter(Boolean) as TournamentAccount[];
 


  return (
  <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#0a0a0a" }}>

{/* 🔥 FLOATING ACCOUNT SWITCHER – top-right */}
<AccountSwitcher
  balances={{
    demo: balances.demo,
    real: balances.real,
  }}
  tournaments={tournamentAccountsForUI}
  activeAccount={activeAccount}
  onSwitch={(account) => {
    setActiveAccount(account);

    // resize chart after account switches
    setTimeout(() => {
      chartRef.current?.resize?.();
    }, 50);
  }}
  onTopUp={() => {
    // only demo account can top up
    if (activeAccount.type !== "demo") {
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
/>


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
