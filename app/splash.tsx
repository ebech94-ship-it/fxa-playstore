// SplashScreen.js
import { router } from "expo-router";
import React, { useEffect, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

export default function SplashScreen() {
  const [progress] = useState(new Animated.Value(0));

  useEffect(() => {
  Animated.timing(progress, {
    toValue: 1,
    duration: 10000,
    useNativeDriver: false,
  }).start(() => {
    router.replace("/welcome");
  });
}, [progress]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.topContent}>
        <Text style={styles.title}>FX ARENA</Text>
        <Text style={styles.subtitle}>TRADING TOURNAMENTS</Text>

        <Image
          source={require('../assets/images/splashscreen.png')}
          style={styles.arenaImage}
          resizeMode="contain"
        />

        <Text style={styles.connecting}>Connecting...</Text>

        <View style={styles.progressBarContainer}>
          <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
        </View>
      </View>

      <View style={styles.bottomContent}>
        <Text style={styles.powered}>Powered by BECHEM</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000C26', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 40 },
  topContent: { alignItems: 'center' },
  bottomContent: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 36, color: 'white', fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 20, color: '#E2C13E', fontWeight: 'bold', marginBottom: 20 },
  arenaImage: { width: 250, height: 250, marginBottom: 20 },
  connecting: { fontSize: 18, color: 'white', marginBottom: 10 },
  progressBarContainer: { height: 6, width: 250, backgroundColor: '#555', borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#4CAF50' },
  powered: { fontSize: 16, color: 'gray' },
});
