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

import { AppProvider, useApp } from "./AppContext";

/* ===============================
   AUTH GATE (OUTSIDE)
   =============================== */
function AuthGate() {
  const { authUser, loading, appReady } = useApp();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (loading || !appReady) return;
    if (hasRedirected.current) return;

    hasRedirected.current = true;

    if (authUser) {
      router.replace("/tradinglayout");
    } else {
      router.replace("/welcome");
    }
  }, [authUser, loading, appReady, router]);

  return null;
}



export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const handledRef = useRef(false);
  const routerRef = useRef(router);
  


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

  return (
 <AppProvider>
  <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
    <AuthGate />
    <Stack screenOptions={{ headerShown: false }}>

          <Stack.Screen name="index" />
          <Stack.Screen name="splash" />
          <Stack.Screen name="welcome" />
          <Stack.Screen name="tradinglayout" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AppProvider>
  );
}
