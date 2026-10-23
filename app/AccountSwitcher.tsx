// components/AccountSwitcher.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

import type { AccountType, TournamentAccount } from "./AppContext"; // keep type imports separate if you want
import { useApp } from "./AppContext";
// AccountSwitcher.tsx

import { Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, } from "react-native";

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
// 👇 ADD THIS HERE
const getAccountPrefix = (
  account: AccountType,
  tournamentName?: string
) => {
  if (account.type === "demo") return "DE";
  if (account.type === "real") return "RE";

  if (account.type === "tournament") {
    if (!tournamentName) return "TO";

    const initials = tournamentName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 4);

    return initials || "TO";
  }

  return "AC";
};

/* ================= COMPONENT ================= */

export default function AccountSwitcher({
  balances,
  activeAccount,
  onSwitch,
  onTopUp,
 
   tournamentMeta,
}: AccountSwitcherProps) {

const {
  openAccountSwitcher,
  setOpenAccountSwitcher,
  tournamentAccounts,
  userDoc,
} = useApp();
const coinsBalance = Number(
  userDoc?.accounts?.real?.balance ?? userDoc?.coins ?? 0
);
  // convert context tournaments to UI-friendly shape
const switcherTournaments = tournamentAccounts
  .filter(t => t.status !== "finished")
  .map(t => ({
    id: t.tournamentId,
    name: t.name,
    status: formatTournamentStatus(t.status),
    balance: Number(t.balance ?? 0),
    currency: t.currency ?? t.symbol ?? "$",
    rebuyFee: Number(t.rebuyFee ?? 0),
  }));


  const [expanded, setExpanded] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [infoType, setInfoType] = useState<
  "demo" | "wallet" | "tournament" | null
>(null);

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

const InfoButton = ({
  type,
}: {
  type: "demo" | "wallet" | "tournament";
}) => (
  <TouchableOpacity
    onPress={() => setInfoType(type)}
    style={styles.infoButton}
  >
    <Text style={styles.infoButtonText}>?</Text>
  </TouchableOpacity>
);

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
  ? `DE • $${balances.demo.toFixed(1)}`
  : activeAccount.type === "real"
  ? `WALLET • ${coinsBalance.toLocaleString()} Coins`
  : `${getAccountPrefix(
      activeAccount,
      tournamentAccounts.find(
        t => t.tournamentId === activeAccount.tournamentId
      )?.name
    )} • ${displayBalance.toFixed(1)}T`
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
           <View style={styles.titleRow}>
  <Text style={styles.cardTitle}>
    {activeAccount.type === "demo" ? "✓ " : ""}
    Demo Account
  </Text>

  <InfoButton type="demo" />
</View>
              <Text style={[styles.balance, { color: "#60a5fa" }]}>
                ${balances.demo.toFixed(1)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onTopUp}
              style={[styles.button, { backgroundColor: "#3b82f6" }]}
            >
              <Text style={styles.buttonText}>Top Up</Text>
            </TouchableOpacity>
          </View>

         
{/* COINS WALLET */}
<View
  style={[
    styles.card,
    activeAccount.type === "real" && styles.activeCard,
  ]}
>
  <TouchableOpacity onPress={() => handleSelect({ type: "real" })}>
    <View style={styles.titleRow}>
      <Text style={styles.cardTitle}>
        {activeAccount.type === "real" ? "✓ " : ""}
        🪙 Coins Wallet
      </Text>
      <InfoButton type="wallet" />
    </View>

    <Text
      numberOfLines={1}
      ellipsizeMode="tail"
      style={[styles.activeBalance, { color: "#facc15", marginLeft: 0 }]}
    >
      {coinsBalance.toLocaleString()} Coins
    </Text>

    <Text style={{ color: "#94a3b8", fontSize: 10, marginTop: 3 }}>
      Virtual coins for in-app gameplay and rewards
    </Text>
  </TouchableOpacity>

  <TouchableOpacity
    onPress={() => {
      setExpanded(false);
      router.push("/DepositWithdraw");
    }}
    style={[styles.button, { backgroundColor: "#854d0e", alignSelf: "stretch" }]}
  >
    <Text style={[styles.buttonText, { textAlign: "center" }]}>
      Open Coins Wallet
    </Text>
  </TouchableOpacity>
</View>


    
          {/* TOURNAMENTS */}
<>
 <View style={styles.sectionTitleRow}>
  <Text style={styles.sectionTitle}>
    YOUR TOURNAMENTS ({switcherTournaments.length})
  </Text>

  <InfoButton type="tournament" />
</View>
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
      {/* COMPONENT INFORMATION MODAL */}
<Modal
  visible={infoType !== null}
  transparent
  animationType="fade"
  onRequestClose={() => setInfoType(null)}
>
  <View style={styles.infoOverlay}>
  <ScrollView
  style={styles.infoModal}
  contentContainerStyle={styles.infoModalContent}
  showsVerticalScrollIndicator={true}
>

      {/* HEADER */}
      <View style={styles.infoHeader}>
        <Text style={styles.infoTitle}>
          {infoType === "wallet"
            ? "💼 Wallet"
            : infoType === "demo"
            ? "🧪 Demo Account"
            : "🏆 Tournament Account"}
        </Text>

        <TouchableOpacity
          onPress={() => setInfoType(null)}
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

    
{/* COINS WALLET */}
{infoType === "wallet" && (
  <View>
    <Text style={styles.infoDescription}>
      Your Coins Wallet holds virtual Coins for use within FX ARENA.
    </Text>

    <Text style={styles.infoItem}>
      • Coins are virtual and are not real money.
    </Text>

    <Text style={styles.infoItem}>
      • Eligible tournament entry and rebuy fees may be deducted from your Coins balance.
    </Text>

    <Text style={styles.infoItem}>
      • Approved tournament and referral rewards may be credited as virtual Coins.
    </Text>

    <View style={styles.infoWarning}>
      <Text style={styles.infoWarningText}>
        🔒 Coins cannot be deposited, withdrawn, or redeemed for cash.
      </Text>
    </View>
  </View>
)}


      {/* DEMO */}
      {infoType === "demo" && (
        <View>
          <Text style={styles.infoDescription}>
            Your Demo Account is a virtual trading account designed for
            practice and learning.
          </Text>

          <Text style={styles.infoItem}>
            • Uses virtual funds only and can not be withdrawn.
          </Text>

          <Text style={styles.infoItem}>
            • No real money is at risk.
          </Text>

          <Text style={styles.infoItem}>
            • Practice trading strategies and disciplined decision making before entering tournaments.
          </Text>

          <Text style={styles.infoItem}>
            • Demo performance does not represent real-world profits.
          </Text>
        </View>
      )}

      {/* TOURNAMENT */}
      {infoType === "tournament" && (
        <View>
          <Text style={styles.infoDescription}>
            A Tournament Account is created for each tournament you join.
          </Text>

<Text style={styles.infoItem}>
            • The Tournament account created, is funded with the normally assigned starting 
            balance, which appears here after your registration is completed.
          </Text>

          
          <Text style={styles.infoItem}>
            • Your trading performance determines your ranking.
          </Text>

<Text style={styles.infoItem}>
            • Not placing trades on your Tournament Account leads to disqualification.
          </Text>

          <Text style={styles.infoItem}>
            • Tournament balances are separate from your wallet balances and can not be withdrawn.
          </Text>

          <Text style={styles.infoItem}>
            • Rebuys fees, where available, are deducted from your wallet and the tournament account loaded accordingly.
          </Text>

          <Text style={styles.infoItem}>
            • You can always rebuy when your account meets the said conditions by opening the tournament 
            card section and pressing the Rebuy button to process.
          </Text>
          <Text style={styles.infoItem}>
  • Your final ranking determines your position on the leaderboard.
    Rewards, if available, are virtual coins only and have no cash value.
</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={() => setInfoType(null)}
        style={styles.gotItButton}
      >
        <Text style={styles.gotItText}>Got it</Text>
      </TouchableOpacity>

    </ScrollView>
  </View>
</Modal>
   </View>
  );
}
const { width: SCREEN_WIDTH } = Dimensions.get("window");


/* ================= STYLES ================= */

const styles = StyleSheet.create({
container:{
    position:"absolute",
    top:8,
    right:2,
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
    borderRadius: 12,  padding: 10, right:5 },

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
  titleRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},

sectionTitleRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginVertical: 4,
},

infoButton: {
  width: 19,
  height: 19,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#64748b",
  backgroundColor: "#1e293b",
  alignItems: "center",
  justifyContent: "center",
  marginLeft: 6,
},

infoButtonText: {
  color: "#cbd5e1",
  fontSize: 12,
  fontWeight: "800",
},

infoOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.72)",
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 20,
},

infoModal: {
  width: "100%",
  maxWidth: 380,
  maxHeight: "85%",
  backgroundColor: "#111827",
  borderRadius: 18,
  borderWidth: 1,
  borderColor: "#334155",
  padding: 18,

  shadowColor: "#000",
  shadowOffset: {
    width: 0,
    height: 8,
  },
  shadowOpacity: 0.4,
  shadowRadius: 20,
  elevation: 15,
},

infoHeader: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 14,
},

infoTitle: {
  color: "#fff",
  fontSize: 19,
  fontWeight: "800",
},

closeButton: {
  width: 30,
  height: 30,
  borderRadius: 15,
  backgroundColor: "#1f2937",
  alignItems: "center",
  justifyContent: "center",
},

closeButtonText: {
  color: "#94a3b8",
  fontSize: 15,
  fontWeight: "700",
},

infoDescription: {
  color: "#cbd5e1",
  fontSize: 14,
  lineHeight: 21,
  marginBottom: 12,
},

infoItem: {
  color: "#94a3b8",
  fontSize: 13,
  lineHeight: 20,
  marginBottom: 7,
},

infoWarning: {
  marginTop: 10,
  padding: 10,
  borderRadius: 10,
  backgroundColor: "rgba(245,158,11,0.10)",
  borderWidth: 1,
  borderColor: "rgba(245,158,11,0.35)",
},

infoWarningText: {
  color: "#fbbf24",
  fontSize: 12,
  fontWeight: "700",
  textAlign: "center",
},

gotItButton: {
  marginTop: 18,
  backgroundColor: "#2563eb",
  borderRadius: 10,
  paddingVertical: 10,
  alignItems: "center",
},

gotItText: {
  color: "#fff",
  fontSize: 13,
  fontWeight: "800",
},
infoModalContent: {
  flexGrow: 1,
  paddingBottom: 18,
},
});
