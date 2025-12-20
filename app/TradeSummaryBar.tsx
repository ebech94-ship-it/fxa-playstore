// TradeSummaryBar.tsx — CLEAN / UI-ONLY / STABLE

import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { height } = Dimensions.get("window");

const COLLAPSED_HEIGHT = 50;
const EXPANDED_HEIGHT = height * 0.5;

/* ===============================
   TYPES
=============================== */

interface TradeSummaryBarProps {
  openTrades?: any[];
  closedTrades?: any[];
  activeAccount: "real" | "demo" | "tournament";
  onResizeChart?: () => void;
}

/* ===============================
   COMPONENT
=============================== */

export default function TradeSummaryBar({
  openTrades: parentOpenTrades = [],
  closedTrades: parentClosedTrades = [],
}: TradeSummaryBarProps) {
  /* -------------------------------
     PANEL ANIMATION STATE
  ------------------------------- */
  const translateY = useRef(
    new Animated.Value(EXPANDED_HEIGHT - COLLAPSED_HEIGHT)
  ).current;

  const lastY = useRef(EXPANDED_HEIGHT - COLLAPSED_HEIGHT);

  /* -------------------------------
     LOCAL MIRROR STATE (UI ONLY)
  ------------------------------- */
  const [openTrades, setOpenTrades] = useState<any[]>([]);
  const [closedTrades, setClosedTrades] = useState<any[]>([]);

  /* -------------------------------
     FORCE RE-RENDER FOR COUNTDOWN
  ------------------------------- */
  const [tick, setTick] = useState(0);

  const formatTime = (timestamp: number) => {
  const d = new Date(timestamp);

  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};
  /* ===============================
     SYNC FROM PARENT (SOURCE OF TRUTH)
     =============================== */
  useEffect(() => {
    setOpenTrades(parentOpenTrades);
    setClosedTrades(parentClosedTrades);
  }, [parentOpenTrades, parentClosedTrades]);

  /* ===============================
     COUNTDOWN TIMER
     =============================== */
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  /* ===============================
     SWIPE / DRAG LOGIC
     =============================== */
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10,

      onPanResponderMove: (_, g) => {
        const newY = Math.max(
          0,
          Math.min(
            EXPANDED_HEIGHT - COLLAPSED_HEIGHT,
            lastY.current + g.dy
          )
        );
        translateY.setValue(newY);
      },

      onPanResponderRelease: (_, g) => {
        const shouldExpand = g.dy < 0;
        const toValue = shouldExpand
          ? 0
          : EXPANDED_HEIGHT - COLLAPSED_HEIGHT;

        lastY.current = toValue;

        Animated.spring(translateY, {
          toValue,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  /* ===============================
     RENDER
     =============================== */
  return (
    <Animated.View
      style={[
        styles.panel,
        { height: EXPANDED_HEIGHT, transform: [{ translateY }] },
      ]}
      {...panResponder.panHandlers}
    >
      {/* HANDLE */}
      <View style={styles.handle}>
        <View style={styles.handleLine} />
        <Text style={styles.handleText}>Portfolio / Trade Summary</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* ================= OPEN TRADES ================= */}
        <Text style={styles.sectionTitle}>Open Trades</Text>

        {openTrades.length === 0 ? (
          <Text style={styles.emptyText}>No open trades</Text>
        ) : (
          openTrades.map((t, i) => (
            <View key={t.id ?? i} style={styles.tradeRow}>
            <Text style={styles.tradeText}>
  Entry: {t.entryPrice.toFixed(2)} → Now:{" "}
  <Text
    style={{
      color:
        t.type === "buy"
          ? t.currentPrice >= t.entryPrice
            ? "#4caf50"
            : "#f44336"
          : t.currentPrice <= t.entryPrice
          ? "#4caf50"
          : "#f44336",
    }}
  >
    {t.currentPrice.toFixed(2)}
  </Text>
</Text>


              {/* force re-render */}
              <Text style={{ height: 0, opacity: 0 }}>{tick}</Text>
            </View>
          ))
        )}

        {/* ================= CLOSED TRADES ================= */}
        <Text style={styles.sectionTitle}>Closed Trades</Text>

        {closedTrades.length === 0 ? (
          <Text style={styles.emptyText}>No closed trades</Text>
        ) : (
          closedTrades.map((t, i) => {
            const profit =
              t.result === "GAIN"
                ? `+$${(t.payout - t.amount).toFixed(2)}`
                : `-$${Number(t.amount).toFixed(2)}`;

            return (
  <View
    key={t.id ?? i}
    style={[
      styles.tradeRow,
      {
        backgroundColor:
          t.result === "GAIN" ? "#1e4620" : "#5a1d1d",
      },
    ]}
  >
    <Text style={styles.tradeText}>
      {(t.type ?? "buy").toUpperCase()} • {t.result} • {profit}
    </Text>

    <Text style={styles.tradeText}>
      Open: {t.entryPrice?.toFixed(2)} → Close:{" "}
      {t.closePrice?.toFixed(2)}
    </Text>

    <Text style={styles.timeText}>
      Opened: {formatTime(t.openTime)} | Closed:{" "}
      {formatTime(t.closeTime)}
    </Text>
  </View>
);

          })
        )}
      </ScrollView>
    </Animated.View>
  );
}

/* ===============================
   STYLES
=============================== */

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
  },

  handle: {
    height: COLLAPSED_HEIGHT,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },

  handleLine: {
    width: 40,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#888",
    marginBottom: 3,
  },

  handleText: {
    color: "white",
    fontWeight: "600",
  },

  content: {
    flex: 1,
    padding: 10,
  },

  sectionTitle: {
    color: "#ccc",
    fontSize: 14,
    marginVertical: 6,
  },

  tradeRow: {
    marginVertical: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
  },

  tradeText: {
    color: "white",
    fontSize: 13,
  },

  timeText: {
    color: "#ccc",
    fontSize: 12,
  },

  emptyText: {
    color: "#777",
  },
});
