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
  tournamentId: string;

  // UI
  name: string;
  symbol: string;
  currency: string;   // ✅ IMPORTANT (RESTORED)

  // core
  balance: number;
  initialBalance: number;

  joined: boolean;

  status: "upcoming" | "ongoing" | "finished";

  rebuyCount?: number;
  rebuys?: any[];

  startTime?: number;
  endTime?: number;
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
verifiedAt?: any;

referredBy?: string | null;
  referralCount?: number;
  referralPoints?: number;
  referralEarnings?: number;
  validReferrals?: number; // 🔥 IMPORTANT (tournament-qualified referrals)
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

  accounts?: Accounts;
  
     uid?: string;
  provider?: string;
  verifiedAt?: any;

  referredBy?: string | null;
  referralCount?: number;
  referralPoints?: number;
  referralEarnings?: number;
    validReferrals?: number;
claimedRewards?: string[];
freeTournamentTickets?: number;

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

   appReady: boolean;
setAppReady: (value: boolean) => void;

 // 🔔 Alerts
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  loading: boolean;
userTournamentRaw: Record<string, PlayerTournament>;
  // ✅ New additions
  balances: { demo: number; real: number; tournament: number };
  activeBalance: number;
  profile: UserProfile | null;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  profileVerified: boolean;
  profileLoaded: boolean;
  profileSubmitted: boolean;
setProfileSubmitted: React.Dispatch<React.SetStateAction<boolean>>;


  tournamentAccounts: TournamentAccount[];
 
  joinedMap: Record<string, boolean>;

};


export type TournamentAccount = {
  type: "tournament";

  tournamentId: string;

  id: string;      // tournament doc id (UI)
  name: string;    // tournament name (UI)
  symbol: string;  // "$" | "T"

  balance: number;
  initialBalance: number;
  currency: string;

  status: "upcoming" | "ongoing" | "finished";

  joined: boolean;
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
   userTournamentRaw: {},
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

  profileSubmitted: false,       // ✅ ADD
  setProfileSubmitted: () => {}, // ✅ ADD

  tournamentAccounts: [],
  
  joinedMap: {},
   unreadCount: 0,             // ✅ default
  setUnreadCount: () => {},   // ✅ noop default
});

/* ---------------- PROVIDER ---------------- */ 

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [now, setNow] = useState(Date.now());
  // 🔐 Admin state
const [isAdmin, setIsAdmin] = useState(false);
const [adminLoaded, setAdminLoaded] = useState(false);
const [userTournamentRaw, setUserTournamentRaw] =
  useState<Record<string, PlayerTournament>>({});

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

const [liveTournamentBalances, setLiveTournamentBalances] = useState<Record<string, number>>({});
const [tournamentMeta, setTournamentMeta] = useState<
  Record<string, { name: string; symbol: string }>
>({});

const [demoBalance, setDemoBalance] = useState<number>(1000);

const activeBalance = useMemo(() => {
  if (activeAccount.type === "demo") {
    return accounts?.demo?.balance ?? demoBalance ?? 1000;
  }

  if (activeAccount.type === "real") {
    return userDoc?.accounts?.real?.balance ?? 0;
  }

  if (activeAccount.type === "tournament") {
    const id = activeAccount.tournamentId;

    return (
      userDoc?.accounts?.tournaments?.[id]?.balance ??
      liveTournamentBalances[id] ??
      activeTournament?.balance ??
      0
    );
  }

  return 0;
}, [
  activeAccount,
  accounts,
  userDoc,
  demoBalance,
  liveTournamentBalances,
  activeTournament,
]);

const balancesState = useMemo(
  () => ({
    demo: demoBalance,
    real: userDoc?.accounts?.real?.balance ?? 0,
    tournament: activeTournament
      ? liveTournamentBalances[activeTournament.tournamentId] ??
        activeTournament.balance
      : 0,
  }),
  [
    demoBalance,
    userDoc?.accounts?.real?.balance,
    activeTournament,
    liveTournamentBalances,
  ]
);


  const [loading, setLoading] = useState(true);
  const [appReady, setAppReady] = useState(false);
const [unreadCount, setUnreadCount] = useState(0);


  // ✅ ADD FUNCTION RIGHT HERE ⬇⬇⬇
const switchAccount = useCallback((account: AccountType) => {
  if (account.type === "tournament") {
    const t =
  tournaments.find(x => x.tournamentId === account.tournamentId) ||
  userDoc?.accounts?.tournaments?.[account.tournamentId];

    if (!t) return;

    setActiveTournament(t);
    setActiveAccount(account);
    return;
  }

  setActiveTournament(null);
  setActiveAccount(account);
}, [tournaments, userDoc?.accounts?.tournaments]);

const [profile, setProfile] = useState<UserProfile | null>(null);
const [profileLoaded, setProfileLoaded] = useState(false);
const [profileSubmitted, setProfileSubmitted] = useState(false);

const tournamentAccounts = useMemo(() => 
  tournaments.map(t => ({
     type: "tournament" as const,
    tournamentId: t.tournamentId,
    id: t.tournamentId,
    name: t.name ?? tournamentMeta[t.tournamentId]?.name ?? "Tournament",
    symbol:  t.symbol ??
  tournamentMeta[t.tournamentId]?.symbol ?? "$",
 balance:
  liveTournamentBalances[t.tournamentId] ??
  t.balance ??  0,
    initialBalance: t.initialBalance,
      currency: t.currency ?? t.symbol ?? "$", // ✅ SAFETY FALLBACK
    status: t.status ?? "upcoming",
    joined: t.joined,
  })), [tournaments, tournamentMeta, liveTournamentBalances]);

const joinedMap = useMemo(() => {
  const raw = userDoc?.accounts?.tournaments ?? {};

  const map: Record<string, boolean> = {};

  Object.keys(raw).forEach((id) => {
    map[id] = true;
  });

  return map;
}, [userDoc?.accounts?.tournaments]);
/* ---------------- HELPERS ---------------- */


useEffect(() => {
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
  if (!authUser?.uid) return;

  const key = `demoBalance_${authUser.uid}`;

  AsyncStorage.getItem(key)
    .then((val) => {
      if (val !== null) {
        setDemoBalance(parseFloat(val));
      } else {
        // First time user → default demo balance
        setDemoBalance(1000);
      }
    })
    .catch(console.error);
}, [authUser?.uid]);

useEffect(() => {
  if (!authUser?.uid) return;

  const key = `demoBalance_${authUser.uid}`;

  AsyncStorage.setItem(key, demoBalance.toString())
    .catch(console.error);
}, [demoBalance, authUser?.uid]);

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
    setTournaments([]);
    setActiveTournament(null);
    setActiveAccount({ type: "demo" });
    setProfile(null);
    setProfileSubmitted(false);
    setProfileLoaded(false);
    setIsAdmin(false);
    setAdminLoaded(false);
    setLoading(false);
    return;
  }

  const ref = doc(db, "users", authUser.uid);

  const unsub = onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      setLoading(false);
      return;
    }

    const data = snap.data() as FirestoreUserDoc;
     // 🔥 ENSURE PUBLIC ID EXISTS

    setUserDoc(data);

    // 🔐 ADMIN CHECK
    setIsAdmin(data?.roles?.admin === true || data?.isAdmin === true);
    setAdminLoaded(true);

    const acc: Accounts = data.accounts ?? {};
    setAccounts(acc);
    const raw = acc?.tournaments ?? {};

setUserTournamentRaw(raw);
console.log(
  "TOURNAMENTS RAW:",
  JSON.stringify(acc.tournaments, null, 2)
);
    // Build tournament list from user accounts, only include joined tournaments
const rawTournaments = data?.accounts?.tournaments ?? {};

setUserTournamentRaw(rawTournaments);

// UI CACHE ONLY (NO BUSINESS LOGIC)
const tournamentList: PlayerTournament[] = Object.entries(rawTournaments).map(
  ([id, t]: any) => ({
    tournamentId: id,
    name: t.name ?? "Tournament",
    symbol: t.symbol ?? "$",
    currency: t.currency ?? "$",

    balance: Number(t.balance ?? 0),
    initialBalance: Number(t.initialBalance ?? 0),

    joined: t.joined ?? true,

    // IMPORTANT: DO NOT TRUST THIS FULLY
    // status will be computed later
    status: "upcoming",

    rebuyCount: t.rebuyCount ?? 0,
    rebuys: t.rebuys ?? [],

    startTime: t.startTime ?? null,
    endTime: t.endTime ?? null,
  })
);

setTournaments(tournamentList);

console.log(
  "🔥 TOURNAMENT LIST:",
  JSON.stringify(tournamentList, null, 2)
);

    // ✅ Reset active tournament if it was deleted
    if (activeAccountRef.current.type === "tournament") {
      const activeTournamentId = activeAccountRef.current.tournamentId;
      const stillExists = tournamentList.find(
        (t) => t.tournamentId === activeTournamentId
      );

      if (!stillExists) {
        setActiveAccount({ type: "demo" });
        setActiveTournament(null);
      }
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

  setLiveTournamentBalances(prev => {
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
    !!userDoc.country &&
    !!userDoc.avatarUrl;

  setProfile(prev => ({
    publicId: userDoc.publicId,
    username: userDoc.username ?? prev?.username ?? "New User",
    displayName: userDoc.displayName ?? prev?.displayName,
    email: userDoc.email ?? prev?.email,
    phone: userDoc.phone ?? prev?.phone,
    country: userDoc.country ?? prev?.country,
    dateOfBirth: userDoc.dateOfBirth ?? prev?.dateOfBirth,
    avatarUrl:
      typeof userDoc.avatarUrl === "string"
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
    collection(db, "alerts"),
    (snap) => {
      totalAlerts = snap.size;
      setUnreadCount(Math.max(totalAlerts - readCount, 0));
    }
  );

  const q = query(
    collection(db, "userAlertReads"),
    where("userId", "==", authUser.uid)
  );

  const unsubReads = onSnapshot(q, (snap) => {
    readCount = snap.size;
    setUnreadCount(Math.max(totalAlerts - readCount, 0));
  });

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
  userTournamentRaw,
  tournaments,
  activeAccount,
  activeTournament,
  setActiveAccount: switchAccount,
  setActiveTournament,
  loading,
  balances: balancesState,
  activeBalance,
  profile,
  profileLoaded,
  setProfile,
  profileVerified: profile?.verified === true,
  profileSubmitted,
  setProfileSubmitted,
  tournamentAccounts,
  joinedMap,
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
  userTournamentRaw,
  tournaments,
  activeAccount,
  activeTournament,
  switchAccount,
  setActiveTournament,
  loading,
  balancesState,
  activeBalance,
  profile,
  profileLoaded,
  profileSubmitted,
  tournamentAccounts,
  joinedMap,
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
