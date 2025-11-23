import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

const { height } = Dimensions.get("window");
const COLLAPSED_HEIGHT = 50;
const EXPANDED_HEIGHT = height * 0.5;
const getAnimatedValue = (val: Animated.Value) => {
  return (val as any).__getValue();
};



export default function TradeSummaryBar() {
  const translateY = useRef(
    new Animated.Value(EXPANDED_HEIGHT - COLLAPSED_HEIGHT)
  ).current;

  const lastY = useRef(EXPANDED_HEIGHT - COLLAPSED_HEIGHT); // prevents jump

  const [openTrades, setOpenTrades] = useState<any[]>([]);
  const [closedTrades, setClosedTrades] = useState<any[]>([]);

  const user = auth.currentUser;

// ⬇️ FIXED here
const currentYRef = useRef(getAnimatedValue(translateY));


useEffect(() => {
  const listenerId = translateY.addListener(({ value }) => {
    currentYRef.current = value;
  });

  return () => {
    translateY.removeListener(listenerId);
  };
}, []); // safe to run once



  // 🔥 Real-time Firestore listener
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "userTrades"),
      where("userId", "==", user.uid)
    );
    

    const unsubscribe = onSnapshot(q, (snap) => {
      const open: any[] = [];
      const closed: any[] = [];

      snap.forEach((doc) => {
        const data = doc.data();
        if (data.status === "open") open.push(data);
        else closed.push(data);
      });

      setOpenTrades(open);
      setClosedTrades(closed);
    });

    return () => unsubscribe();
  }, [user]);

  // 🎯 Perfect smooth dragging logic
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 8,

      onPanResponderMove: (_, g) => {
        let newY = lastY.current + g.dy;

        newY = Math.max(
          0,
          Math.min(EXPANDED_HEIGHT - COLLAPSED_HEIGHT, newY)
        );

        translateY.setValue(newY);
      },

      onPanResponderRelease: () => {
        const midpoint =
          (EXPANDED_HEIGHT - COLLAPSED_HEIGHT) / 2;

       const shouldExpand = currentYRef.current < midpoint;


        const finalY = shouldExpand
          ? 0
          : EXPANDED_HEIGHT - COLLAPSED_HEIGHT;

        lastY.current = finalY;

        Animated.spring(translateY, {
          toValue: finalY,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.panel,
        {
          height: EXPANDED_HEIGHT,
          transform: [{ translateY }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Drag Handle */}
      <View style={styles.handle}>
        <View style={styles.handleLine} />
        <Text style={styles.handleText}>
          Portfolio / Trade Summary
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 70 }}
      >
        <Text style={styles.sectionTitle}>Open Trades</Text>

        {openTrades.length === 0 ? (
          <Text style={{ color: "#777" }}>No open trades</Text>
        ) : (
          openTrades.map((t, i) => (
            <View key={i} style={styles.tradeRow}>
              <Text style={styles.tradeText}>
                {t.type?.toUpperCase()} ${t.amount} → Entry:{" "}
                {t.entryPrice?.toFixed(2)} | Exp:{" "}
                {t.expireTime
                  ? new Date(t.expireTime).toLocaleTimeString()
                  : "-"}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Closed Trades</Text>

        {closedTrades.length === 0 ? (
          <Text style={{ color: "#777" }}>No closed trades</Text>
        ) : (
          closedTrades.map((t, i) => (
            <View
              key={i}
              style={[
                styles.tradeRow,
                {
                  backgroundColor:
                    t.result === "GAIN" ? "#1e4620" : "#5a1d1d",
                },
              ]}
            >
              <Text style={styles.tradeText}>
                {t.type?.toUpperCase()} ${t.amount} →{" "}
                {t.result} +${t.payout?.toFixed(2)}
              </Text>
              <Text style={{ color: "#ccc", fontSize: 12 }}>
                Open: {t.entryPrice?.toFixed(2)} | Close:{" "}
                {t.closePrice?.toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#1c1c1c",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
    zIndex: 999,
  },
  handle: {
    height: COLLAPSED_HEIGHT,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 6,
  },
  handleLine: {
    width: 40,
    height: 3,
    backgroundColor: "#aaa",
    borderRadius: 2,
    marginBottom: 4,
  },
  handleText: {
    color: "white",
    fontWeight: "600",
    fontSize: 13,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  sectionTitle: {
    color: "#ccc",
    fontSize: 15,
    marginTop: 10,
    marginBottom: 6,
    fontWeight: "600",
  },
  tradeRow: {
    marginVertical: 6,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#262626",
  },
  tradeText: {
    color: "white",
    fontSize: 13,
  },
});
