import { auth } from "@/firebaseConfig"; // ✅ FIX
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
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef } from "react";
import "react-native-reanimated";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const handledRef = useRef(false); // 🔐 deep link guard

const routerRef = useRef(router);

  /* ===============================
     1️⃣ AUTH STATE LISTENER (GLOBAL)
     =============================== */
  useEffect(() => {
  const unsub = onAuthStateChanged(auth, async (user) => {
    if (user) {
      await AsyncStorage.setItem("isLoggedIn", "true");
      routerRef.current.replace("/tradinglayout");
    }
  });

  return unsub;
}, []);
// ✅ no router dependency needed

  /* ===============================
     2️⃣ DEEP LINK HANDLING
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
 // ✅ safe

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="splash" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="tradinglayout" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
