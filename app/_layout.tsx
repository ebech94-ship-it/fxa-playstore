import { useColorScheme } from "@/hooks/use-color-scheme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";

import "react-native-reanimated";

import AccountSwitcher from "@/app/AccountSwitcher";
import { Modal, View } from "react-native";
import { AppProvider, useApp } from "./AppContext";

/* ===============================
   AUTH GATE
   =============================== */
function AuthGate() {
  const { authUser, loading, appReady } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (loading || !appReady) return;

    if (authUser) {
      router.replace("/tradinglayout");
    } else {
      router.replace("/welcome");
    }
  }, [authUser, loading, appReady, router]);

  return null;
}

/* ===============================
   INNER APP
   =============================== */
function InnerApp() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  const handledRef = useRef(false);
  const routerRef = useRef(router);

  const { openAccountSwitcher,   setOpenAccountSwitcher,
    balances,  activeAccount,  setActiveAccount,
  tournamentAccounts  } = useApp();

  /* ===============================
     DEEP LINK HANDLING
     =============================== */
  useEffect(() => {
    const handleLink = async (url: string) => {
      if (handledRef.current) return;

      const parsed = Linking.parse(url);
      const ref = parsed.queryParams?.ref;

      if (parsed.scheme !== "forextournamentsarena") return;

      if (ref) {
        handledRef.current = true;
        await AsyncStorage.setItem("inviteRef", String(ref));
        routerRef.current.replace("/welcome");
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleLink(url);
    });

    const sub = Linking.addEventListener("url", ({ url }) => {
      handleLink(url);
    });

    return () => sub.remove();
  }, []);

const handleSwitch = (account: any) => {
  setActiveAccount(account);
};
const tournamentBalances = tournamentAccounts;

  return (
    <ThemeProvider
      value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
    >
      {/* AUTH REDIRECT */}
      <AuthGate />

      {/* ROUTES */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="splash" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="tradinglayout" />
      </Stack>

      {/* =========================
         GLOBAL ACCOUNT SWITCHER MODAL
         ========================= */}
      <Modal
        visible={openAccountSwitcher}
        animationType="slide"
        transparent
        onRequestClose={() => setOpenAccountSwitcher(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
          }}
        >
         <AccountSwitcher
  balances={balances}
  activeAccount={activeAccount}
  tournamentBalances={tournamentBalances}
  onSwitch={handleSwitch}
/>
        </View>
      </Modal>

      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

/* ===============================
   ROOT LAYOUT
   =============================== */
export default function RootLayout() {
  return (
    <AppProvider>
      <InnerApp />
    </AppProvider>
  );
}