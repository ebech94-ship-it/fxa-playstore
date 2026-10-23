
import * as ExpoSplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
import { useApp } from "./AppContext";

export default function SplashScreen() {
  const [progress] = useState(new Animated.Value(0));
  const glowAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;
  const { setAppReady } = useApp();

  useEffect(() => {
    let mounted = true;

    const startSplash = async () => {
      try {
        await ExpoSplashScreen.hideAsync();
      } catch (error) {
        console.warn("Splash hide error:", error);
      }

      Animated.timing(progress, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: false,
      }).start(() => {
        if (mounted) setAppReady(true);
      });
    };

    startSplash();

    const safetyTimer = setTimeout(() => {
      if (mounted) setAppReady(true);
    }, 10000);

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      progress.stopAnimation();
    };
  }, [progress, setAppReady]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [glowAnim]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#00f0ff", "#ffffff"],
  });

  return (
    <View style={styles.container}>
      <View style={styles.topContent}>
        <Text style={styles.title}>FX ARENA</Text>

        <Animated.Text
          style={[
            styles.subtitle,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          MASTERING MARKET{"\n"}PSYCHOLOGY
        </Animated.Text>

        <Image
          source={require("../assets/images/splashscreen.png")}
          style={styles.arenaImage}
          resizeMode="contain"
        />

        <Text style={styles.connecting}>Connecting...</Text>

        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[styles.progressBar, { width: progressWidth }]}
          />
        </View>
      </View>

      <View style={styles.bottomContent}>
        <Text style={styles.powered}>Powered by</Text>
        <Animated.Text style={[styles.glow, { color: glowColor }]}>
          GodSpeed (GS) Technologies.
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000C26",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 20,
  },
  topContent: {
    alignItems: "center",
    paddingTop: 60,
  },
  bottomContent: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    color: "white",
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 20,
    color: "#E2C13E",
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    width: "80%",
  },
  arenaImage: {
    width: 250,
    height: 250,
    marginBottom: 20,
  },
  connecting: {
    fontSize: 18,
    color: "white",
    marginBottom: 10,
  },
  progressBarContainer: {
    height: 6,
    width: 250,
    backgroundColor: "#555",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 20,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#4CAF50",
  },
  powered: {
    fontSize: 16,
    color: "gray",
    marginBottom: 5,
  },
  glow: {
    fontSize: 16,
    fontWeight: "bold",
    textShadowColor: "#00f0ff",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});
