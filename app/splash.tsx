// SplashScreen.js
import { router } from "expo-router";
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

export default function SplashScreen() {
  const [progress] = useState(new Animated.Value(0));
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Animate the progress bar
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 10000,
      useNativeDriver: false,
    }).start(() => {
      router.replace("/welcome");
    });
  }, [progress]);

  // Glow animation for GodSpeed
  useEffect(() => {
    Animated.loop(
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
    ).start();
  }, [glowAnim]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#00f0ff', '#ffffff'], // pulse from blue to white
  });

  return (
    <View style={styles.container}>
      <View style={styles.topContent}>
        <Text style={styles.title}>FX ARENA</Text>
        <Text style={styles.subtitle}>MASTERING MARKET PSYCHOLOGY</Text>

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
        <Text style={styles.powered}>
          Powered by{' '}
          <Animated.Text style={[styles.glow, { color: glowColor }]}>
            GodSpeed (GS)
          </Animated.Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000C26',
    justifyContent: 'space-between', // Use space-between to push topContent down and powered to bottom
    alignItems: 'center',
    paddingVertical: 20, // reduced padding to give more room
  },

  topContent: {
    alignItems: 'center',
    paddingTop: 60, // move top content down a bit from top
  },

  bottomContent: {
    alignItems: 'center',
    marginBottom: 20, // powered by at bottom
  },

  title: {
    fontSize: 36,
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 20,
    color: '#E2C13E',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  arenaImage: {
    width: 250,
    height: 250,
    marginBottom: 20,
  },
  connecting: {
    fontSize: 18,
    color: 'white',
    marginBottom: 10,
  },
  progressBarContainer: {
    height: 6,
    width: 250,
    backgroundColor: '#555',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 20, // reduce gap to powered by
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  powered: {
    fontSize: 16,
    color: 'gray',
    marginBottom: 10, // bottom spacing
  },
  glow: {
    fontWeight: 'bold',
    textShadowColor: '#00f0ff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});

 