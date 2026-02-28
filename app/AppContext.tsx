// app/AppContext.tsx
import { auth, db } from "@/lib/firebase";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, User, getAuth} from "firebase/auth";
import {doc, collection, onSnapshot, query, where } from "firebase/firestore";


import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* ---------------- TYPES ---------------- */

export type AccountType =
  | { type: "demo" }
  | { type: "real" }
  | { type: "tournament"; tournamentId: string };

export type PlayerTournament = {
  tournamentId: string;
  balance: number;
  initialBalance: number; 
  currency: string;
  joined: boolean;
status?: "upcoming" | "ongoing" | "finished";
  name?: string;    // optional, from Firestore
  symbol?: string;  // optional, e.g., "$" or "T"
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
type UserProfile = {
  // identity
  publicId?: string; 
  username?: string;
  displayName?: string;
  email?: string;
  phone?: string;

  // personal
  country?: string;
  dateOfBirth?: string;

  // media
  avatarUrl?: string;

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
  dateOfBirth?: string;
  avatarUrl?: string;

  profileCompleted?: boolean;
  verified?: boolean;

  accounts?: Accounts;
    realBalance?: number;
    
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
  rebuyUnlockedMap: Record<string, boolean>;
  

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
  rebuyUnlockedMap: {},
  
   unreadCount: 0,             // ✅ default
  setUnreadCount: () => {},   // ✅ noop default
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

const [liveTournamentBalances, setLiveTournamentBalances] = useState<Record<string, number>>({});
const [tournamentMeta, setTournamentMeta] = useState<
  Record<string, { name: string; symbol: string }>
>({});
const [rebuyUnlockedMap, setRebuyUnlockedMap] =
  useState<Record<string, boolean>>({});


const activeBalance = (() => {
  if (activeAccount.type === "demo") {
    return accounts?.demo?.balance ?? 1000;
  }

  if (activeAccount.type === "real") {
    return userDoc?.realBalance?? 0;
  }

  // ✅ tournament → LIVE source
  return (
    liveTournamentBalances[activeAccount.tournamentId] ??
    activeTournament?.balance ??
    0
  );
})();

const [demoBalance, setDemoBalance] = useState<number>(1000);

const balancesState = {
 demo: demoBalance,  // <-- use local demoBalance
   real: userDoc?.realBalance ?? 0,
  tournament: activeTournament
  ? liveTournamentBalances[activeTournament.tournamentId] ??
    activeTournament.balance
  : 0,

};


  const [loading, setLoading] = useState(true);
  const [appReady, setAppReady] = useState(false);
const [unreadCount, setUnreadCount] = useState(0);


  // ✅ ADD FUNCTION RIGHT HERE ⬇⬇⬇
const switchAccount = (account: AccountType) => {
  if (account.type === "tournament") {
    const t = tournaments.find(
      x => x.tournamentId === account.tournamentId
    );

    if (!t) return;

    setActiveTournament(t);
    setActiveAccount(account);
    return;
  }

  setActiveTournament(null);
  setActiveAccount(account);
};

const [profile, setProfile] = useState<UserProfile | null>(null);
const [profileLoaded, setProfileLoaded] = useState(false);
const [profileSubmitted, setProfileSubmitted] = useState(false);


const tournamentAccounts = useMemo(() => 
  tournaments.map(t => ({
     type: "tournament" as const,
    tournamentId: t.tournamentId,
    id: t.tournamentId,
    name: tournamentMeta[t.tournamentId]?.name ?? "Tournament",
    symbol: tournamentMeta[t.tournamentId]?.symbol ?? "T",
    balance: liveTournamentBalances[t.tournamentId] ?? t.balance,
    initialBalance: t.initialBalance,
    currency: t.currency,
    status: t.status ?? "upcoming",
    joined: t.joined,
  })), [tournaments, tournamentMeta, liveTournamentBalances]);

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
    setUserDoc(data);

    // 🔐 ADMIN CHECK
    setIsAdmin(data?.roles?.admin === true || data?.isAdmin === true);
    setAdminLoaded(true);

    const acc: Accounts = data.accounts ?? {};
    setAccounts(acc);

    // ✅ NO TIME LOGIC HERE
    const tournamentList = acc.tournaments
      ? Object.entries(acc.tournaments).map(([id, t]) => ({
          ...t,
          tournamentId: id,
           status: "upcoming" as const, // temporary, real status calculated elsewhere
        }))
      : [];

    setTournaments(tournamentList);

    // ✅ Active tournament safety check
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

    return prev.map(t => {
      let status: "upcoming" | "ongoing" | "finished" = "upcoming";

      if (t.startTime && t.endTime) {
        if (now < t.startTime) status = "upcoming";
        else if (now <= t.endTime) status = "ongoing";
        else status = "finished";
      }

      return { ...t, status };
    });
  });
}, [now]);


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
  if (!authUser || tournaments.length === 0) {
    setLiveTournamentBalances({});
    setRebuyUnlockedMap({});
    return;
  }

  const unsubs: (() => void)[] = [];

  tournaments.forEach((t) => {
    const ref = doc(
      db,
      "tournaments",
      t.tournamentId,
      "players",
      authUser.uid
    );

    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();

      const balance = data.balance ?? 0;
      const initialBalance = data.initialBalance ?? t.initialBalance ?? 0;

      // Update live balances
      setLiveTournamentBalances((prev) => ({
        ...prev,
        [t.tournamentId]: balance,
      }));

      // Allow rebuy if balance < 50% of initial
      setRebuyUnlockedMap((prev) => ({
        ...prev,
        [t.tournamentId]: balance < initialBalance * 0.5,
      }));
    });

    unsubs.push(unsub);
  });

  return () => unsubs.forEach((u) => u());
}, [authUser, tournaments]);


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
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) return;

  // Listen to userAlerts where read=false and deleted=false
  const q = query(
    collection(db, "userAlerts"),
    where("userId", "==", user.uid),
    where("read", "==", false),
    where("deleted", "==", false)
  );

  const unsub = onSnapshot(q, (snap) => {
    setUnreadCount(snap.size);
  });

  return () => unsub();
}, []);

  
  return (
    <AppContext.Provider
  value={{
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
     // 🔥 ADD THESE TWO
    demoBalance,
    setDemoBalance,
  
    tournaments,
    activeAccount,
    activeTournament,
    setActiveAccount: switchAccount,
    setActiveTournament,
    loading,
    balances: balancesState,      // ✅ unified balances
    activeBalance,                // ✅ single source of truth
    profile, 
    profileLoaded,
    setProfile,
    profileVerified: profile?.verified === true,
    profileSubmitted,
   setProfileSubmitted,

          
    tournamentAccounts,           // ✅ UI-ready tournament info
   rebuyUnlockedMap,
  }}
>
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
