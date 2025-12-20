import { useEffect, useRef } from "react";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ThemeProvider,
  DarkTheme,
  DefaultTheme,
} from "@react-navigation/native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import "react-native-reanimated";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const handledRef = useRef(false); // 🔐 guard

  useEffect(() => {
    const handleLink = async (url: string) => {
      if (handledRef.current) return;

      const parsed = Linking.parse(url);
      const ref = parsed.queryParams?.ref;

      // Optional safety check
      if (parsed.scheme !== "forextournamentsarena") return;

      if (ref) {
        handledRef.current = true;
        await AsyncStorage.setItem("inviteRef", String(ref));
        router.replace("/welcome");
      }
    };

    // Cold start
    Linking.getInitialURL().then((url) => {
      if (url) handleLink(url);
    });

    // Background → foreground
    const sub = Linking.addEventListener("url", ({ url }) => {
      handleLink(url);
    });

    return () => sub.remove();
  }, [router]);

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
