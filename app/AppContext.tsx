// app/AppContext.tsx
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
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
    walletBalance?: number;

};



type AppContextType = {
  authUser: User | null;
  userDoc: FirestoreUserDoc | null;

  accounts: Accounts | null;

  tournaments: PlayerTournament[];

  // UI / trading
  activeAccount: AccountType;
  activeTournament: PlayerTournament | null;

  setActiveAccount: (a: AccountType) => void;
  setActiveTournament: (t: PlayerTournament | null) => void;

   appReady: boolean;
setAppReady: (value: boolean) => void;


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
});

/* ---------------- PROVIDER ---------------- */ 

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [now, setNow] = useState(Date.now());

  const [authUser, setAuthUser] = useState<User | null>(null);

  const [accounts, setAccounts] = useState<Accounts | null>(null);

  const [tournaments, setTournaments] = useState<PlayerTournament[]>([]);
const [activeTournament, setActiveTournament] =
  useState<PlayerTournament | null>(null);
const activeAccountRef = useRef<AccountType>({ type: "demo" });
const activeTournamentRef = useRef<PlayerTournament | null>(null);


  const [activeAccount, setActiveAccount] = useState<AccountType>({
  type: "demo", // default account
});
const [userDoc, setUserDoc] = useState<FirestoreUserDoc | null>(null);

const [liveTournamentBalances, setLiveTournamentBalances] = useState<Record<string, number>>({});
const [tournamentMeta, setTournamentMeta] = useState<
  Record<string, { name: string; symbol: string }>
>({});

const activeBalance = (() => {
  if (activeAccount.type === "demo") {
    return accounts?.demo?.balance ?? 1000;
  }

  if (activeAccount.type === "real") {
    return userDoc?.walletBalance?? 0;
  }

  // ✅ tournament → LIVE source
  return (
    liveTournamentBalances[activeAccount.tournamentId] ??
    activeTournament?.balance ??
    0
  );
})();

const balancesState = {
  demo: accounts?.demo?.balance ?? 1000,
   real: userDoc?.walletBalance ?? 0,
  tournament: activeTournament?.balance ?? 0,
};


  const [loading, setLoading] = useState(true);
  const [appReady, setAppReady] = useState(false);



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





const tournamentAccounts: TournamentAccount[] = tournaments.map(t => ({
  type: "tournament",
  tournamentId: t.tournamentId,
  id: t.tournamentId,
  name: tournamentMeta[t.tournamentId]?.name ?? "Tournament",
symbol: tournamentMeta[t.tournamentId]?.symbol ?? "T",

  balance: liveTournamentBalances[t.tournamentId] ?? t.balance,
  initialBalance: t.initialBalance,
  currency: t.currency,
  status: t.status ?? "upcoming",
  joined: t.joined,
}));



  /* 🔐 Auth listener */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setLoading(false);
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
    setTournaments([]);
    setActiveTournament(null);
    setActiveAccount({ type: "demo" });
    setProfile(null);
  setProfileSubmitted(false); // ✅ reset
  setProfileLoaded(false);
    return;
  }

  const ref = doc(db, "users", authUser.uid);
  const unsub = onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;

    
      const data = snap.data() as FirestoreUserDoc;
    setUserDoc(data);

    const acc: Accounts = data.accounts ?? {};
    setAccounts(acc);

  const tournamentList = acc.tournaments
  ? Object.entries(acc.tournaments).map(([id, t]) => {
      let status: "upcoming" | "ongoing" | "finished" = "upcoming";

      const start = t.startTime;
      const end = t.endTime;

      if (start && end) {
        if (now < start) status = "upcoming";
        else if (now <= end) status = "ongoing";
        else status = "finished";
      }

      return {
        ...t,
        tournamentId: id,
        status,
      };
    })
  : [];

setTournaments(tournamentList);


  // ✅ Keep current active account if it still exists
if (activeAccountRef.current.type === "tournament") {
  const activeTournamentId = activeAccountRef.current.tournamentId;

  const stillExists = tournamentList.find(
    t => t.tournamentId === activeTournamentId
  );

  if (!stillExists) {
    setActiveAccount({ type: "demo" });
    setActiveTournament(null);
  }
}

  });

  return unsub;
}, [authUser, now]);


useEffect(() => {
  if (!userDoc) {
    setProfileLoaded(true);
    return;
  }

  // 🛑 DO NOT overwrite freshly submitted profile
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
  username: userDoc.username ?? prev?.username ?? "Guest",
  displayName: userDoc.displayName ?? prev?.displayName,
  email: userDoc.email ?? prev?.email,
  phone: userDoc.phone ?? prev?.phone,
  country: userDoc.country ?? prev?.country,
  dateOfBirth: userDoc.dateOfBirth ?? prev?.dateOfBirth,
  avatarUrl:  typeof userDoc.avatarUrl === "string"
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
      setLiveTournamentBalances((prev) => ({
        ...prev,
        [t.tournamentId]: data.balance ?? 0,
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

  tournaments.forEach(t => {
    const ref = doc(db, "tournaments", t.tournamentId);

    const unsub = onSnapshot(ref, snap => {
      if (!snap.exists()) return;

      const data = snap.data();
      setTournamentMeta(prev => ({
        ...prev,
        [t.tournamentId]: {
          name: data.name ?? "Tournament",
          symbol: data.symbol ?? "T",
        },
      }));
    });

    unsubs.push(unsub);
  });

  return () => unsubs.forEach(u => u());
}, [tournaments]);



  
  return (
    <AppContext.Provider
  value={{
    appReady,
  setAppReady,

    authUser,
  
    userDoc,
    accounts,
  
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
