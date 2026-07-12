// components/AccountSwitcher.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import type { AccountType, TournamentAccount } from "./AppContext"; // keep type imports separate if you want
import { useApp } from "./AppContext";
// AccountSwitcher.tsx

import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View, } from "react-native";

/* ================= TYPES ================= */

type AccountSwitcherProps = {
  balances: {
    demo: number;
    real: number;
    tournament?: number; 
  };
  tournamentBalances: TournamentAccount[];
   
  activeAccount: AccountType;

 

  onSwitch: (account: AccountType) => void;
  onTopUp?: () => void;
  onDeposit?: () => void;
  onWithdraw?: () => void;
   // ✅ Add tournamentMeta so AccountSwitcher can show real tournament names
  tournamentMeta?: Record<
    string,
    { id: string; name: string; symbol: string }
  >;
};
const formatTournamentStatus = (
  status?: "upcoming" | "ongoing" | "finished"
) => {
  if (status === "ongoing") return "Ongoing";
  if (status === "finished") return "Finished";
  return "Upcoming";
};


/* ================= COMPONENT ================= */

export default function AccountSwitcher({
  balances,
  activeAccount,
  onSwitch,
  onTopUp,
  onDeposit,
  onWithdraw,
   tournamentMeta,
}: AccountSwitcherProps) {

  const { openAccountSwitcher, setOpenAccountSwitcher, tournamentAccounts } = useApp(); // context only for tournaments

  // convert context tournaments to UI-friendly shape
const switcherTournaments = tournamentAccounts
  .filter(t => t.status !== "finished")
  .map(t => ({
    id: t.tournamentId,
    name: t.name,
    status: formatTournamentStatus(t.status),
    balance: Number(t.balance ?? 0),
    currency: t.currency ?? t.symbol ?? "$",
  }));


  const [expanded, setExpanded] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const router = useRouter();

  const toggleExpand = () => setExpanded((v) => !v);

  /* ================= HELPERS ================= */
useEffect(() => {
  if (openAccountSwitcher) {
    setExpanded(true);
    setOpenAccountSwitcher(false);
  }
}, [openAccountSwitcher, setOpenAccountSwitcher]);



  const getColor = (account: AccountType) => {
    if (account.type === "real") return "#FFD700";
    if (account.type === "tournament") return "#00ff88";
    return "#60a5fa";
  };

 

 const handleSelect = (account: AccountType) => {
 
  if (
  account.type === "tournament" &&
  activeAccount.type === "tournament" &&
  account.tournamentId === activeAccount.tournamentId
) {
  setExpanded(false);
  return;
}


  onSwitch(account);
  setExpanded(false);

  if (account.type === "real") {
    setShowWarning(true);
    setTimeout(() => setShowWarning(false), 4000);
  }
};


  /* ================= RENDER ================= */
const isTournamentLowBalance = () => {
  if (activeAccount.type !== "tournament") return false;

  const current = displayBalance; 


  // find the active tournament from context
  const t = tournamentAccounts.find(
  x => x.tournamentId === activeAccount.tournamentId
);

if (!t) return false;

  const starting = Number(t?.startingBalance ?? 0);


  if (!starting) return false;

  return current <= starting * 0.5;
};

const displayBalance = (() => {
  if (activeAccount.type === "demo") {
    return balances.demo;
  }

  if (activeAccount.type === "real") {
    return balances.real;
  }

  // tournament
const t = tournamentAccounts.find(
  (x) => x.tournamentId === activeAccount.tournamentId
);
  return Number(t?.balance ?? 0);
})();

// console.log("expanded =", expanded);
// console.log("switcherTournaments count =", switcherTournaments.length);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* ACTIVE ACCOUNT */}
      <TouchableOpacity onPress={toggleExpand} style={styles.iconRow}>
        <MaterialCommunityIcons name="bank" size={32} color="#fff" />
        <Text
  style={[ styles.activeBalance,
    {color:
        activeAccount.type === "tournament" && isTournamentLowBalance()
          ? "#ff4d4f"
          : getColor(activeAccount),
    },
    activeAccount.type === "tournament" && isTournamentLowBalance()
  ? {
      textShadowColor: "#ff0000",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
    }
  : undefined,
  ]}
>
{activeAccount.type === "demo"
  ? `Demo • $${balances.demo.toFixed(2)}`
  : activeAccount.type === "real"
  ? `Real • $${balances.real.toFixed(2)}`
  : `${
      tournamentAccounts.find(
        t => t.tournamentId === activeAccount.tournamentId
      )?.name ?? "Tournament"
    } • $${displayBalance.toFixed(2)}`
}
</Text>

      </TouchableOpacity>

      {/* DROPDOWN */}
      {expanded && (
        <ScrollView style={styles.dropdown} showsVerticalScrollIndicator={false}>
          {/* DEMO */}
          <View
            style={[
              styles.card,
              activeAccount.type === "demo" && styles.activeCard,
            ]}
          >
            <TouchableOpacity
              onPress={() => handleSelect({ type: "demo" })}
            >
            <Text style={styles.cardTitle}>
  {activeAccount.type === "demo" ? "✓ " : ""}
  Demo Account
</Text>
              <Text style={[styles.balance, { color: "#60a5fa" }]}>
                ${balances.demo.toFixed(2)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onTopUp}
              style={[styles.button, { backgroundColor: "#3b82f6" }]}
            >
              <Text style={styles.buttonText}>Top Up</Text>
            </TouchableOpacity>
          </View>

          {/* REAL */}
          <View
            style={[
              styles.card,
              activeAccount.type === "real" && styles.activeCard,
            ]}
          >
            <TouchableOpacity
              onPress={() => handleSelect({ type: "real" })}
            >
              <Text style={styles.cardTitle}>
  {activeAccount.type === "real" ? "✓ " : ""}
  Real Account
</Text>
             <Text  numberOfLines={1}  ellipsizeMode="tail"
  style={[styles.activeBalance, { color: "#facc15" }]}>
  ${balances.real.toFixed(2)}
</Text>
               {/* 🎯 TRADING LOCKED BADGE */}
    {activeAccount.type === "real" && (
      <Text style={styles.tradingLockedBadge}>Trading Locked</Text>
    )}
            </TouchableOpacity>

            <View style={styles.row}>
             <TouchableOpacity
  onPress={() => router.push("/DepositWithdraw?mode=deposit")}
  style={[styles.button, { backgroundColor: "#4CAF50" }]}
>
  <Text style={styles.buttonText}>Deposit</Text>
</TouchableOpacity>

<TouchableOpacity
  onPress={() => router.push("/DepositWithdraw?mode=withdraw")}
  style={[styles.button, { backgroundColor: "#9333ea" }]}
>
  <Text style={styles.buttonText}>Withdraw</Text>
</TouchableOpacity>
            </View>
          </View>

    
          {/* TOURNAMENTS */}
<>
  <Text style={styles.sectionTitle}>
  YOUR TOURNAMENTS ({switcherTournaments.length})
</Text>
  {switcherTournaments.length === 0 ? (
    <View style={[styles.card, { opacity: 0.6 }]}>
      <Text style={styles.cardTitle}>Tournament Account</Text>
      <Text style={{ color: "#829ecfff", fontSize: 12, marginTop: 4 }}>
        No joined tournaments
      </Text>
    </View>
  ) : (
   <View>
  {switcherTournaments.map((t) => {
    const isActive =
      activeAccount.type === "tournament" &&
      activeAccount.tournamentId === t.id;

    return (
      <TouchableOpacity
        key={t.id}
        onPress={() =>
          handleSelect({
            type: "tournament",
            tournamentId: t.id,
          } as AccountType)
        }
        style={[
          styles.card,
          isActive && styles.activeCard,
        ]}
      >
       <Text numberOfLines={1} style={{ fontSize: 11 }}>
          <Text numberOfLines={1}
            style={[
              { fontWeight: "600" },
              isActive && isTournamentLowBalance()
                ? {
                    color: "#e944f8ff",
                    textShadowColor: "#ff0000",
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 6,
                  }
                : { color: "#27e90dff" },
            ]}
          >
          {isActive ? "✓ " : ""}
{t.name}
          </Text>

          <Text
            style={
              isActive && isTournamentLowBalance()
                ? {
                    color: "green",
                    textShadowColor: "#ff0000",
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 6,
                  }
                : { color: "#c915f7ff" }
            }
          >
            {" • "}
            {t.currency} {t.balance.toFixed(2)}

            {" • "}
            {t.status.toUpperCase()}
          </Text>
        </Text>
      </TouchableOpacity>
    );
  })}
</View>

  )}
</>

 
        </ScrollView>
      )}

      {/* WARNING */}
      {showWarning && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            ⚠ Real money at risk, no real trading here
          </Text>
        </View>
      )}
    </View>
  );
}
const { width: SCREEN_WIDTH } = Dimensions.get("window");


/* ================= STYLES ================= */

const styles = StyleSheet.create({
container:{
    position:"absolute",
    top:8,
    right:8,
    zIndex:100,
    alignItems:"flex-end",
},
 iconRow:{
  
 maxWidth:250,
 flexDirection:"row",
    backgroundColor:"#1f2937",
    borderRadius:14,
    paddingHorizontal:12,
    paddingVertical:12,
    alignItems:"center",
    borderWidth:1,
    borderColor:"#334155",
},
  activeBalance: { marginLeft: 10, fontSize: 16, fontWeight: "800", 
  letterSpacing: 0.5, textShadowColor: "rgba(255, 215, 0, 0.9)",
textShadowOffset: { width: 0, height: 0 },
textShadowRadius: 8, },

  dropdown: {
 marginTop:1,
 width:240,
 maxHeight:350,
 backgroundColor: "#111827",
    borderRadius: 12,  padding: 10, },

  card: {
  borderWidth: 1,
  borderColor: "#374151",
  borderRadius: 6,
  paddingHorizontal: 6,
  paddingVertical: 5,
  marginBottom: 3,
},

 activeCard: {
  borderColor: "#22d3ee",
  borderWidth: 2,
  backgroundColor: "#0f2a3d",
},
  cardTitle: { color: "#fff", fontSize: 12,
  fontWeight: "700", },
  balance: { fontSize: 11, marginTop: 1, },
  row: { flexDirection: "row",
   justifyContent: "space-between", gap: 4, 
   marginTop: 4,
  },
  button: { paddingHorizontal: 8, paddingVertical: 3,
   borderRadius: 6, marginTop: 4,
  },
  buttonText: { color: "#fff", fontSize: 10,
   fontWeight: "600",  },
  sectionTitle: { color: "#9ca3af", fontSize: 10, 
  marginVertical: 4,  },
  warning: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center",
    zIndex: 1000, },
  warningText: { backgroundColor: "rgba(255,0,0,0.85)", color: "#fff", padding: 8,
    borderRadius: 6, fontWeight: "bold",  },
  tradingLockedBadge: { marginTop: 2, fontSize: 9,
   fontWeight: "600", color: "#fbbf24", // amber, stands out but subtle
  backgroundColor: "rgba(255,255,255,0.1)",
   paddingHorizontal: 4, paddingVertical: 1,
  borderRadius: 4, alignSelf: "flex-start",},
});
