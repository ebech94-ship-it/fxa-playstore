// app/AppContext.tsx
import { auth, db } from "@/lib/firebase";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";


import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

/* ---------------- TYPES ---------------- */

export type AccountType =
  | { type: "demo" }
  | { type: "real" }
  | { type: "tournament"; tournamentId: string };

export type PlayerTournament = {
 id: string; 
  tournamentId: string;

  // UI
  name: string;
  symbol: string;
  currency: string;   // ✅ IMPORTANT (RESTORED)

 prizeModel?: "guaranteed" | "dynamic";
 prizePool: number;
collectedFunds: number;

startingBalance: number;
    balance: number;
 

  joined: boolean;

  status: "upcoming" | "ongoing" | "finished";

  rebuyCount?: number;
  rebuys?: any[];

  rankingScore?: number;
rebuyInjectedTotal?: number;
lastRebuyAt?: number;

  startTime?: number;
  endTime?: number;

  performance?: {
  pnl: number;
  roi: number;
  wins: number;
  losses: number;
  trades: number;
  winRate: number;
  rebuyInjectedTotal?: number;
};
};

type AppSettings = {
  enablePayouts: boolean;
  maintenanceMode: boolean;
};


type Accounts = {
  demo?: {
    balance: number;
    currency: string;
  };
  real?: {
    balance: number;
    currency: string;
  };
  tournaments?: Record<string, PlayerTournament>;

};
 export type UserProfile = {
  // identity
   uid?: string;
  publicId?: string; 
  username?: string;
  displayName?: string;
  email?: string;
  phone?: string;
provider?: string;
role?: string;  
verifiedAt?: any;

referredBy?: string | null;

referralCount?: number;
pendingReferrals?: number;
activeReferrals?: number;
validReferrals?: number;

referralPoints?: number;
referralEarnings?: number;

coins?: number;

claimedRewards?: Record<
  string,
  {
    claimedAt: any;
    reward: any;
  }
>;

freeTournamentTickets?: number;

referralBadge?: string | null; // 🔥 IMPORTANT (tournament-qualified referrals)
  // personal
  country?: string;
  countryCode?: string;
  dateOfBirth?: string;

  // media

  avatarUrl?: string;
accounts?: any;
  preview?: boolean; // 👈 ADD THIS
  // status
  verified: boolean;
  profileCompleted?: boolean;

};

type FirestoreUserDoc = {
  publicId?: string;
  username?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  country?: string;
  countryCode?: string;
  dateOfBirth?: string;
  avatarUrl?: string;

  profileCompleted?: boolean;
  verified?: boolean;

deleted?: boolean;
deletedAt?: any;

  accounts?: Accounts;
  
     uid?: string;
  provider?: string;
  verifiedAt?: any;

  referredBy?: string | null;

referralCount?: number;
pendingReferrals?: number;
activeReferrals?: number;
validReferrals?: number;

referralPoints?: number;
referralEarnings?: number;

coins?: number;

claimedRewards?: Record<
  string,
  {
    claimedAt: any;
    reward: any;
  }
>;

freeTournamentTickets?: number;

referralBadge?: string | null;

  // 🔐 admin / roles
  isAdmin?: boolean;
  roles?: {
    admin?: boolean;
  };

};



type AppContextType = {
  appSettings: AppSettings;
  // 🔐 admin
  isAdmin: boolean;
  adminLoaded: boolean;

  authUser: User | null;
  userDoc: FirestoreUserDoc | null;

  accounts: Accounts | null;

  tournaments: PlayerTournament[];
  demoBalance: number;
setDemoBalance: React.Dispatch<React.SetStateAction<number>>;

  // UI / trading
  activeAccount: AccountType;
  activeTournament: PlayerTournament | null;

  setActiveAccount: (a: AccountType) => void;
  setActiveTournament: (t: PlayerTournament | null) => void;

openAccountSwitcher: boolean;
setOpenAccountSwitcher: (value: boolean) => void;

switcherHintTournamentId: string | null;
setSwitcherHintTournamentId: (value: string | null) => void;

   appReady: boolean;
setAppReady: (value: boolean) => void;

 // 🔔 Alerts
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  loading: boolean;

  // ✅ New additions
  balances: { demo: number; real: number; tournament: number };
  activeBalance: number;
  profile: UserProfile | null;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  profileVerified: boolean;
  profileLoaded: boolean;
  profileSubmitted: boolean;
setProfileSubmitted: React.Dispatch<React.SetStateAction<boolean>>;
referrals: {
  referralCount: number;
  pendingReferrals: number;
  activeReferrals: number;
  validReferrals: number;
  referralPoints: number;
  referralEarnings: number;
  coins: number;
  freeTournamentTickets: number;
  referralBadge: string | null;

  claimedRewards: Record<string, any>;
};

  tournamentAccounts: TournamentAccount[];
  activeLeaderboardParticipants: Participant[];
  addLeaderboardUser: (user: Participant) => void;
 
  joinedMap: Record<string, boolean>;
  leaderboardParticipants: Record<string, Participant[]>;
  setLeaderboardParticipants: React.Dispatch<
  React.SetStateAction<Record<string, Participant[]>>
>;
participantBalances: Record<string, number>;  
setParticipantBalances: React.Dispatch<
  React.SetStateAction<Record<string, number>>
>;

};
export type Participant = {
  id: string;
  username?: string;
  balance?: number;
   email?: string;
  publicId?: string;
  startingBalance?: number;
  avatar?: string;
  countryCode?: string;
  performance?: number;
  rankingScore?: number;
  rebuyInjectedTotal?: number;
  rebuyCount?: number;
};


export type TournamentAccount = {
  type: "tournament";

  tournamentId: string;

  id: string;      // tournament doc id (UI)
  name: string;    // tournament name (UI)
  symbol: string;  // "$" | "T"
prizeModel?: "guaranteed" | "dynamic";
  balance: number;
  
  currency: string;
  startingBalance?: number;
rebuyFee?: number;
  status: "upcoming" | "ongoing" | "finished";

  joined: boolean;

  performance?: {
  pnl: number;
  roi: number;
  wins: number;
  losses: number;
  trades: number;
  winRate: number;
  rebuyInjectedTotal?: number;
};
};

/* ---------------- CONTEXT ---------------- */

const AppContext = createContext<AppContextType>({
  appSettings: {
  enablePayouts: true,
  maintenanceMode: false,
},
  isAdmin: false,
  adminLoaded: false,

  authUser: null,
  userDoc: null,
  accounts: null,
 
  tournaments: [],
  activeAccount: { type: "demo" },
  activeTournament: null,
  activeLeaderboardParticipants: [],
 addLeaderboardUser: () => {},

  setActiveAccount: () => {},
  setActiveTournament: () => {},

  appReady: false,
setAppReady: () => {},


  // 🔥 ADD THESE TWO LINES
  demoBalance: 1000,
  setDemoBalance: () => {},
  loading: true,

  balances: { demo: 1000, real: 0, tournament: 0 },
  activeBalance: 1000,
  profile: null,
  setProfile: () => {},          // ✅ ADD
  profileVerified: false,
  profileLoaded: false,
referrals: {
  referralCount: 0,
  pendingReferrals: 0,
  activeReferrals: 0,
  validReferrals: 0,
  referralPoints: 0,
  referralEarnings: 0,
  coins: 0,
  freeTournamentTickets: 0,
  referralBadge: null,
  claimedRewards: {},
},
  profileSubmitted: false,       // ✅ ADD
  setProfileSubmitted: () => {}, // ✅ ADD

openAccountSwitcher: false,
setOpenAccountSwitcher: () => {},

switcherHintTournamentId: null,
setSwitcherHintTournamentId: () => {},

  tournamentAccounts: [],
  leaderboardParticipants: {},
  setLeaderboardParticipants: () => {},

  joinedMap: {},
   unreadCount: 0,             // ✅ default
  setUnreadCount: () => {},   // ✅ noop default
  participantBalances: {},
  setParticipantBalances: () => {},
});

 
 
/* ---------------- PROVIDER ---------------- */ 

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [now, setNow] = useState(Date.now());
  // 🔐 Admin state
const [isAdmin, setIsAdmin] = useState(false);
const [adminLoaded, setAdminLoaded] = useState(false);


  const [authUser, setAuthUser] = useState<User | null>(null);

  const [accounts, setAccounts] = useState<Accounts | null>(null);
const [tournaments, setTournaments] = useState<PlayerTournament[]>([]);
  
  const [activeTournament, setActiveTournament] =
  useState<PlayerTournament | null>(null);

const activeAccountRef = useRef<AccountType>({ type: "demo" });
const activeTournamentRef = useRef<PlayerTournament | null>(null);

const [appSettings, setAppSettings] = useState<AppSettings>({
  enablePayouts: true,
  maintenanceMode: false,
});

  const [activeAccount, setActiveAccount] = useState<AccountType>({
  type: "demo", // default account
});
const [userDoc, setUserDoc] = useState<FirestoreUserDoc | null>(null);

const [participantBalances, setParticipantBalances] = useState<Record<string, number>>({});
const [participantDocs, setParticipantDocs] = useState<
  Record<string, Record<string, any>>
>({});

const [tournamentMeta, setTournamentMeta] = useState<
  Record<string, { name: string; symbol: string }>
>({});
const [leaderboardParticipants, setLeaderboardParticipants] = useState<
  Record<string, Participant[]>
>({});

const addLeaderboardUser = (user: Participant) => {
  setLeaderboardParticipants(prev => ({
    ...prev,
    demo: [
      user,
      ...(prev.demo ?? []).filter(p => p.id !== user.id)
    ].sort((a,b)=>
      (b.balance ?? 0) - (a.balance ?? 0)
    )
  }));
};

const [demoBalance, setDemoBalance] = useState<number>(1000);

const referrals = useMemo(() => ({
  referralCount: userDoc?.referralCount ?? 0,
  pendingReferrals: userDoc?.pendingReferrals ?? 0,
  activeReferrals: userDoc?.activeReferrals ?? 0,
  validReferrals: userDoc?.validReferrals ?? 0,

  referralPoints: userDoc?.referralPoints ?? 0,
  referralEarnings: userDoc?.referralEarnings ?? 0,

  coins: userDoc?.coins ?? 0,

  freeTournamentTickets:
    userDoc?.freeTournamentTickets ?? 0,

  referralBadge:
    userDoc?.referralBadge ?? null,

  claimedRewards:
    userDoc?.claimedRewards ?? {},

}), [userDoc]);

const activeBalance = useMemo(() => {
  if (activeAccount.type === "demo") {
  return demoBalance ?? 1000;
}

  if (activeAccount.type === "real") {
  return Number(userDoc?.coins ?? 0);
}


  if (activeAccount.type === "tournament") {
    const id = activeAccount.tournamentId;

    return participantDocs[id]?.balance ??
      participantBalances[id] ??
      0;
  }

  return 0;
}, [
  activeAccount,
  accounts,
  userDoc,
  demoBalance,
  participantBalances,
 
  participantDocs,
]);

const balancesState = useMemo(
  () => ({
   demo:
 userDoc?.accounts?.demo?.balance ??
 demoBalance,
   real: Number(userDoc?.coins ?? 0),
    tournament: activeTournament
      ? participantBalances[activeTournament.tournamentId] ??
        activeTournament.balance
      : 0,
  }),
  [
    demoBalance,
   userDoc?.coins,
    activeTournament,
    participantBalances,
  ]
);


  const [loading, setLoading] = useState(false);
  const [appReady, setAppReady] = useState(false);
const [unreadCount, setUnreadCount] = useState(0);

const tournamentsRef = useRef<PlayerTournament[]>([]);
  // ✅ ADD FUNCTION RIGHT HERE ⬇⬇⬇


const mergedTournaments = useMemo(() => {
  return tournaments.map((t) => {
    const p = participantDocs[t.tournamentId];

    if (!p) return t;

    return {
      ...t,

      balance: p.balance ?? t.balance,
      startingBalance: p.startingBalance ?? t.startingBalance,

      rebuyCount: p.rebuyCount ?? 0,
      rebuys: p.rebuys ?? [],

      rankingScore: p.rankingScore ?? 0,
      rebuyInjectedTotal: p.rebuyInjectedTotal ?? 0,
      lastRebuyAt: p.lastRebuyAt ?? 0,

      performance: p.performance ?? t.performance,

      joined: true,
    };
  });
}, [tournaments, participantDocs]);



const activeLeaderboardParticipants = useMemo(() => {
  if (activeAccount.type === "demo") {
    return leaderboardParticipants["demo"] ?? [];
  }

  if (activeAccount.type === "tournament") {
    return leaderboardParticipants[activeAccount.tournamentId] ?? [];
  }

  return [];
}, [leaderboardParticipants, activeAccount]);



const [profile, setProfile] = useState<UserProfile | null>(null);
const [profileLoaded, setProfileLoaded] = useState(false);
const [profileSubmitted, setProfileSubmitted] = useState(false);

const [openAccountSwitcher, setOpenAccountSwitcher] = useState(false);
const [switcherHintTournamentId, setSwitcherHintTournamentId] = useState<string | null>(null);

const tournamentAccounts = useMemo(() =>
  mergedTournaments
    // ✅ ONLY tournaments the user actually joined
    .filter(t => {
      const p = participantDocs[t.tournamentId];
      return !!p && t.status !== "finished";
    })
    .map(t => {
      const p = participantDocs[t.tournamentId];

      return {
        type: "tournament" as const,
        tournamentId: t.tournamentId,
        id: t.tournamentId,
prizeModel: t.prizeModel,
        name: t.name ?? tournamentMeta[t.tournamentId]?.name ?? "Tournament",
        symbol: t.symbol ?? tournamentMeta[t.tournamentId]?.symbol ?? "$",

        balance: participantBalances[t.tournamentId] ?? p?.balance ?? 0,
        startingBalance: p?.startingBalance ?? t.startingBalance ?? 0,

        currency: t.currency ?? t.symbol ?? "$",
        status: t.status ?? "upcoming",

        joined: true,

        performance: p?.performance ?? t.performance,
      };
    }),
[
  mergedTournaments,
  participantDocs,
  tournamentMeta,
  participantBalances,
]);

useEffect(() => {
  if (!authUser?.uid || tournaments.length === 0) return;

  const unsubs: (() => void)[] = [];

  // 🔥 IMPORTANT: use BASE tournaments ONLY (not tournamentAccounts)
  tournaments.forEach((t) => {
    const ref = doc(
      db,
      "tournaments",
      t.tournamentId,
      "participants",
      authUser.uid
    );

    const unsub = onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
  setParticipantBalances(prev => {
    const copy = { ...prev };
    delete copy[t.tournamentId];
    return copy;
  });

  setParticipantDocs(prev => {
    const copy = { ...prev };
    delete copy[t.tournamentId];
    return copy;
  });

  return;
}

      const data = snap.data();

      setParticipantBalances((prev) => {
        const current = prev[t.tournamentId];
        const next = data.balance ?? 0;

        // 🔥 prevent unnecessary rerenders
        if (current === next) return prev;

        return {
          ...prev,
          [t.tournamentId]: next,
        };
      });

setParticipantDocs((prev) => ({
  ...prev,
  [t.tournamentId]: data,
}));
    });

    unsubs.push(unsub);
  });

  return () => unsubs.forEach((u) => u());
}, [authUser?.uid, tournaments]);

const userTournamentState = useMemo(() => {
  return tournaments
  .filter(t => !!participantDocs[t.tournamentId])
  .map(t => {
    const p = participantDocs[t.tournamentId];

    return {
      tournament: t,
      participant: p ?? null,
      joined: !!p,
      balance: participantBalances[t.tournamentId] ?? p?.balance ?? 0,
      startingBalance: p?.startingBalance ?? t.startingBalance ?? 0,
      performance: p?.performance ?? t.performance,
    };
  });
}, [tournaments, participantDocs, participantBalances]);

const switchAccount = useCallback((account: AccountType) => {
  if (account.type === "tournament") {
    const match = userTournamentState.find(
      x => x.tournament.tournamentId === account.tournamentId
    );

    if (!match) return;

    setActiveTournament({
  ...match.tournament,
  balance: match.balance,
  startingBalance: match.startingBalance,
  performance: match.performance,
  joined: true,
});

    setActiveAccount(account);
    return;
  }

  setActiveTournament(null);
  setActiveAccount(account);
}, [userTournamentState]);

const joinedMap = useMemo(() => {
  const map: Record<string, boolean> = {};

  userTournamentState.forEach(x => {
    map[x.tournament.tournamentId] = x.joined;
  });

  return map;
}, [userTournamentState]);



/* ---------------- HELPERS ---------------- */

useEffect(() => {
  tournamentsRef.current = mergedTournaments;
}, [mergedTournaments]);

useEffect(() => {
  const unsub = onSnapshot(collection(db, "tournaments"), (snap) => {
    const list: PlayerTournament[] = snap.docs.map((d) => {
      const data = d.data();

      return {
  id: d.id,
  tournamentId: d.id,

  // core
  name: data.name ?? "Tournament",
  symbol: data.symbol ?? "$",
  currency: data.currency ?? "$",
prizeModel: data.prizeModel ?? "guaranteed",
  // timing
  startTime: Number(data.startTime ?? 0),
  endTime: Number(data.endTime ?? 0),

  // financial
  entryFee: Number(data.entryFee ?? 0),
  rebuyFee: Number(data.rebuyFee ?? data.entryFee ?? 0),
  prizePool: Number(data.prizePool ?? 0),

collectedFunds: Number(data.collectedFunds ?? 0),

  startingBalance: Number(data.startingBalance ?? 0),
  

  // UI content (🔥 THIS WAS MISSING)
  description: data.description ?? "",
  rules: data.rules ?? "",
  onRegisterInfo: data.onRegisterInfo ?? "",

  payoutStructure: data.payoutStructure ?? [],

  // system
  balance: 0,
  joined: false,
  status: "upcoming",

  performance: {
    pnl: 0,
    roi: 0,
    wins: 0,
    losses: 0,
    trades: 0,
    winRate: 0,
    rebuyInjectedTotal: 0,
  },
};
    });

    setTournaments(list);
  });

  return unsub;
}, []);

useEffect(() => {
  const q = query(collection(db, "users"));

const unsub = onSnapshot(q, (snap) => {
   console.log("USERS SNAPSHOT:", snap.size);
   
    const list = snap.docs
  .filter((d) => {
  const data: any = d.data();
  return !data.deleted;
})
  .map((d) => {
      const data: any = d.data();

     return {
  id: d.id,
  username: data.username ?? data.displayName ?? "Player",
  avatar: data.avatarUrl ?? "",
  countryCode: data.countryCode ?? data.country ?? "CM",
  balance: Number(data.accounts?.demo?.balance ?? 1000),
 // ADD THESE
  publicId: data.publicId,
  email: data.email,
};
    });

// 👇 ADD THIS
if (
  authUser &&
  !list.some((p) => p.id === authUser.uid)
) {
  list.push({
    id: authUser.uid,
    username: profile?.username ?? userDoc?.username ?? "Player",
    avatar: profile?.avatarUrl ?? userDoc?.avatarUrl ?? "",
    countryCode: profile?.country ?? userDoc?.country ?? "CM",
    balance: demoBalance,
    publicId: userDoc?.publicId,
    email: userDoc?.email,
  });
}

    list.sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));

console.log("DEMO USERS:", list.length);
   setLeaderboardParticipants(prev => {
  const old = prev.demo ?? [];

  if (
    old.length === list.length &&
    old.every((p, i) =>
      p.id === list[i].id &&
      p.balance === list[i].balance &&
      p.username === list[i].username &&
      p.avatar === list[i].avatar
    )
  ) {
    return prev;
  }

  return {
    ...prev,
    demo: list,
  };
});
  });

  return unsub;
}, [
  authUser?.uid,
  demoBalance,
  profile?.username,
  profile?.avatarUrl,
  profile?.country,
  userDoc?.username,
  userDoc?.avatarUrl,
  userDoc?.country,
]);



useEffect(() => {
  if (tournaments.length === 0) return;

  const unsubscribes: (() => void)[] = [];

  tournaments.forEach((t) => {
    const ref = collection(
      db,
      "tournaments",
      t.tournamentId,
      "participants"
    );

    const unsub = onSnapshot(ref, (snap) => {
      const list: Participant[] = snap.docs.map((d) => {
        const data = d.data();

       return {
  id: d.id,
  username: data.username,
  balance: data.balance ?? 0,
  avatar: data.avatar,
  avatarUrl: data.avatarUrl,
  countryCode: data.countryCode,
  publicId: data.publicId,
  email: data.email,

  startingBalance: data.startingBalance ?? 0,

  // ♻️ REBUY DATA — MUST BE PASSED TO LEADERBOARD
  rebuyInjectedTotal: data.rebuyInjectedTotal ?? 0,
  rebuyCount: data.rebuyCount ?? 0,

  rankingScore: data.rankingScore ?? 0,
};
      });

      // 🔥 SORT (important for leaderboard UI)
    list.sort((a, b) => {
  const scoreA = b.rankingScore ?? 0;
  const scoreB = a.rankingScore ?? 0;

  const balanceA = b.balance ?? 0;
  const balanceB = a.balance ?? 0;

  // PRIMARY: rankingScore
  if (scoreA !== scoreB) return scoreA - scoreB;

  // SECONDARY: balance (IMPORTANT FIX)
  return balanceA - balanceB;
}); 

      setLeaderboardParticipants((prev) => {
  const oldList = prev[t.tournamentId] ?? [];

  let changed = false;

  const merged = list.map(player => {
    const old = oldList.find(p => p.id === player.id);

   if (
  !old ||
  old.balance !== player.balance ||
  old.rankingScore !== player.rankingScore ||
  old.rebuyInjectedTotal !== player.rebuyInjectedTotal ||
  old.rebuyCount !== player.rebuyCount
) {
      changed = true;
      return player;
    }

    return old;
  });

  if (!changed && oldList.length === merged.length) {
    return prev;
  }

  return {
    ...prev,
    [t.tournamentId]: merged.sort(
      (a,b) =>
        (b.rankingScore ?? 0) -
        (a.rankingScore ?? 0)
    ),
  };
});
    });

    unsubscribes.push(unsub);
  });

  return () => unsubscribes.forEach((u) => u());
}, [tournaments]);

useEffect(() => {
  if (!authUser) return;

  const ref = doc(db, "settings", "app");

  const unsub = onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;

    const data = snap.data();
    setAppSettings({
      enablePayouts: data.enablePayouts ?? true,
      maintenanceMode: data.maintenanceMode ?? false,
    });
  });

  return unsub;
}, []);




  /* 🔐 Auth listener */
  useEffect(() => {
  const unsub = onAuthStateChanged(auth, (user) => {

    setActiveTournament(null);
    setActiveAccount({ type: "demo" });

    setParticipantBalances({});
    setParticipantDocs({});
   

    setAuthUser(user);

  });

  return unsub;
}, []);

  useEffect(() => {
  const timer = setInterval(() => {
    setNow(Date.now());
  }, 1000);

  return () => clearInterval(timer);
}, []);


useEffect(() => {
  if (
    activeTournament &&
    activeTournament.status === "finished"
  ) {
    setActiveAccount({ type: "demo" });
    setActiveTournament(null);
  }
}, [activeTournament]);

  useEffect(() => {
  activeAccountRef.current = activeAccount;
  activeTournamentRef.current = activeTournament;
}, [activeAccount, activeTournament]);


/* 📄 User document listener */
useEffect(() => {
  if (!authUser) {
    setUserDoc(null);
    setAccounts(null);

    setActiveTournament(null);
    setActiveAccount({ type: "demo" });

    setParticipantBalances({});
    setParticipantDocs({});
    setTournamentMeta({});

    setProfile(null);
    setProfileSubmitted(false);
    setProfileLoaded(false);

    setIsAdmin(false);
    setAdminLoaded(false);

    setDemoBalance(1000);

    setLoading(false);

    return;
  }

  setLoading(true);

  const userRef = doc(db, "users", authUser.uid);

  const unsub = onSnapshot(userRef, async (snap) => {
    if (!snap.exists()) {
      setLoading(false);
      return;
    }

    const data = snap.data() as FirestoreUserDoc;

    if (data.deleted === true) {
      auth.signOut();
      return;
    }

    // -------------------------
    // User document
    // -------------------------

    setUserDoc(data);

    const acc: Accounts = data.accounts ?? {};
    setAccounts(acc);

         // -------------------------
    // Admin: Firebase custom claim + Firestore
    // -------------------------

    try {
      const tokenResult = await authUser.getIdTokenResult(true);

      setIsAdmin(
        tokenResult.claims["admin"] === true ||
        data.roles?.admin === true ||
        data.isAdmin === true
      );
    } catch (error) {
      console.error("Admin verification failed:", error);
      setIsAdmin(false);
    } finally {
      setAdminLoaded(true);
    }
    // -------------------------
    // Demo balance
    // -------------------------

    const firestoreBalance =
      data.accounts?.demo?.balance;

    if (typeof firestoreBalance === "number") {
      setDemoBalance(firestoreBalance);

      await AsyncStorage.setItem(
        `demoBalance_${authUser.uid}`,
        firestoreBalance.toString()
      );
    }

    setLoading(false);
  });

  return unsub;
}, [authUser]);



useEffect(() => {
  setTournaments(prev => {
    if (prev.length === 0) return prev;

    const updated = prev.map(t => {
      let status: "upcoming" | "ongoing" | "finished" = "upcoming";

      if (t.startTime && t.endTime) {
        if (now < t.startTime) status = "upcoming";
        else if (now <= t.endTime) status = "ongoing";
        else status = "finished";
      }

      if (t.status === status) return t;

      return { ...t, status };
    });

    const changed = updated.some((t, i) => t !== prev[i]);

    return changed ? updated : prev;
  });
}, [now]);

useEffect(() => {
  // Remove balances and meta for deleted tournaments
  const validIds = tournaments.map(t => t.tournamentId);

  setParticipantBalances(prev => {
    const updated: Record<string, number> = {};
    Object.entries(prev).forEach(([id, bal]) => {
      if (validIds.includes(id)) updated[id] = bal;
    });
    return updated;
  });

  setTournamentMeta(prev => {
    const updated: Record<string, { name: string; symbol: string }> = {};
    Object.entries(prev).forEach(([id, meta]) => {
      if (validIds.includes(id)) updated[id] = meta;
    });
    return updated;
  });
}, [tournaments]);

useEffect(() => {
  if (!userDoc) {
    setProfileLoaded(true);
    return;
  }

  if (profileSubmitted) {
    if (userDoc.profileCompleted === true) {
      setProfileSubmitted(false);
    }
    setProfileLoaded(true);
    return;
  }

  const verified =
  !!userDoc.username &&
  !!userDoc.country;

  setProfile(prev => ({
    publicId: userDoc.publicId,
    username: userDoc.username ?? prev?.username ?? "New User",
    displayName: userDoc.displayName ?? prev?.displayName,
    email: userDoc.email ?? prev?.email,
    phone: userDoc.phone ?? prev?.phone,
    country: userDoc.country ?? prev?.country,
    dateOfBirth: userDoc.dateOfBirth ?? prev?.dateOfBirth,
   avatarUrl:
  typeof userDoc.avatarUrl === "string" &&
  userDoc.avatarUrl.trim() !== ""
    ? userDoc.avatarUrl
    : prev?.avatarUrl ?? "",
    verified,
    profileCompleted: userDoc.profileCompleted === true,
  }));

  setProfileLoaded(true);
}, [userDoc, profileSubmitted]);





useEffect(() => {
  if (tournaments.length === 0) {
    setTournamentMeta({});
    return;
  }

  const unsubs: (() => void)[] = [];

  tournaments.forEach((t) => {
    const ref = doc(db, "tournaments", t.tournamentId);

    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();

      setTournamentMeta((prev) => ({
        ...prev,
        [t.tournamentId]: {
          name: data.name ?? "Tournament",
          symbol: data.symbol ?? "T",
        },
      }));
    });

    unsubs.push(unsub);
  });

  return () => unsubs.forEach((u) => u());
}, [tournaments]);
useEffect(() => {
  if (!authUser?.uid) {
    setUnreadCount(0);
    return;
  }

  let totalAlerts = 0;
  let readCount = 0;

  const unsubAlerts = onSnapshot(
 collection(db,"alerts"),
 (snap)=> {
    console.log("ALERTS OK:", snap.size);
 },
 (error)=>{
    console.log("ALERTS ERROR:", error.message);
 }
);

  const q = query(
    collection(db, "userAlertReads"),
    where("userId", "==", authUser.uid)
  );

 const unsubReads = onSnapshot(q,
(snap)=>{
 console.log("USER ALERT READS OK:", snap.size);
},
(error)=>{
 console.log("USER ALERT READS ERROR:", error.message);
}
);

  return () => {
    unsubAlerts();
    unsubReads();
  };
}, [authUser?.uid]);
  const contextValue = useMemo(() => ({
  appReady,
  setAppReady,
  unreadCount,
  setUnreadCount,
  appSettings,
  isAdmin,
  adminLoaded,
  authUser,
  userDoc,
  accounts,
 
  demoBalance,
  setDemoBalance,

  tournaments: mergedTournaments,
 activeLeaderboardParticipants,

  activeAccount,
  activeTournament,
  setActiveAccount: switchAccount,
  setActiveTournament,
  loading,
  balances: balancesState,
  activeBalance,
  profile,
  openAccountSwitcher,
  setOpenAccountSwitcher,
  switcherHintTournamentId,
  setSwitcherHintTournamentId,


  profileLoaded,
  setProfile,
  profileVerified: profile?.verified === true,
  profileSubmitted,
  setProfileSubmitted,
  tournamentAccounts,
referrals,
  joinedMap,
  leaderboardParticipants,
  setLeaderboardParticipants,
  addLeaderboardUser,

  participantBalances,
  setParticipantBalances,
}), [
  appReady,
  unreadCount,
  appSettings,
  isAdmin,
  adminLoaded,
  authUser,
  userDoc,
  accounts,
  
  demoBalance,
 
  mergedTournaments,
activeLeaderboardParticipants,
addLeaderboardUser,

  activeAccount,
  activeTournament,
  switchAccount,
  setActiveTournament,
  loading,
  balancesState,
  activeBalance,
  profile,

openAccountSwitcher,
setOpenAccountSwitcher,
  
  switcherHintTournamentId,
  setSwitcherHintTournamentId,
  profileLoaded,
  profileSubmitted,
  tournamentAccounts,
  joinedMap,
  leaderboardParticipants,
  setLeaderboardParticipants,

  addLeaderboardUser,

referrals,
  participantBalances,
  setParticipantBalances,
]);
  return (
    <AppContext.Provider value={contextValue}>
  {children}
</AppContext.Provider>

  );
};

/* ---------------- HOOK ---------------- */

export const useApp = () => useContext(AppContext);

/* ---------------- EXPO ROUTER SAFETY ---------------- */

export default function EmptyScreen() {
  return null;
}
