// TradeSummaryBar.tsx — CLASS 2 FRIENDLY / ACCOUNT-AWARE
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

interface TradeSummaryBarProps {
  openTrades?: any[];
  closedTrades?: any[];
  activeAccount: "real" | "demo" | "tournament";
  tournamentInfo?: { id: string; name: string }[];
  onResizeChart?: () => void;
}

export default function TradeSummaryBar({
  openTrades: parentOpenTrades = [],
  closedTrades: parentClosedTrades = [],
  activeAccount,
  tournamentInfo = [],
}: TradeSummaryBarProps) {
  const { height: screenHeight } = useWindowDimensions();
  const COLLAPSED_HEIGHT = 50;
  const EXPANDED_HEIGHT = Math.min(screenHeight * 0.7, 420);
  const maxTranslateY = EXPANDED_HEIGHT - COLLAPSED_HEIGHT;

  const translateY = useRef(new Animated.Value(maxTranslateY)).current;
  const lastY = useRef(maxTranslateY);

const minTranslateY = 0;

useEffect(() => {
  translateY.setValue(maxTranslateY);
  lastY.current = maxTranslateY;
}, [maxTranslateY, minTranslateY, translateY]);


  const [openTrades, setOpenTrades] = useState<any[]>([]);
  const [closedTrades, setClosedTrades] = useState<any[]>([]);
  const [tick, setTick] = useState(0);

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  useEffect(() => {
    setOpenTrades(parentOpenTrades);
    setClosedTrades(parentClosedTrades);
  }, [parentOpenTrades, parentClosedTrades]);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

 const panResponder = useRef(
  PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10,

    onPanResponderMove: (_, g) => {
      const rawY = lastY.current + g.dy;
      const clampedY = Math.max(minTranslateY, Math.min(maxTranslateY, rawY));
      translateY.setValue(clampedY);
    },

    onPanResponderRelease: (_, g) => {
      const rawY = lastY.current + g.dy;
      const clampedY = Math.max(minTranslateY, Math.min(maxTranslateY, rawY));

      const shouldExpand =
        g.vy < -0.3 || clampedY < maxTranslateY * 0.6;

      const toValue = shouldExpand ? minTranslateY : maxTranslateY;
      lastY.current = toValue;

      Animated.spring(translateY, {
        toValue,
        damping: 20,
        stiffness: 180,
        useNativeDriver: true,
      }).start();
    },
  })
).current;

  const getRemainingTime = (expiryTime: number) => {
    const now = Date.now();
    const diff = expiryTime - now;
    if (diff <= 0) return "00:00";
    const seconds = Math.floor(diff / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Animated.View
      style={[styles.panel, { height: EXPANDED_HEIGHT, transform: [{ translateY }] }]}
      
    >
      {/* HANDLE */}
      <View style={styles.handle} {...panResponder.panHandlers}>
        <View style={styles.handleLine} />
        <Text style={styles.handleText}>Portfolio / Trade Summary</Text>
      </View>

      <ScrollView
  style={styles.content}
  keyboardShouldPersistTaps="handled"
  scrollEventThrottle={16}>
        {/* ===== ACTIVE ACCOUNT HEADING ===== */}
        <View style={styles.accountHeader}>
          <Text
            style={[
              styles.accountText,
              activeAccount === "demo"
                ? { color: "#ff69b4" }
                : activeAccount === "real"
                ? { color: "#00bfff" }
                : { color: "#ffd700" },
            ]}
          >
            {activeAccount === "tournament"
              ? tournamentInfo?.map((t: { id: string; name: string }) => t.name).join(", ") ??
                "Tournament"
              : `Active Account: ${activeAccount.toUpperCase()}`}
          </Text>
        </View>

        {/* ================= OPEN TRADES ================= */}
        <Text style={styles.sectionTitle}>Open Trades</Text>
        {openTrades.length === 0 ? (
          <Text style={styles.emptyText}>No open trades</Text>
        ) : (
          openTrades.map((t, i) => {
            const remaining = getRemainingTime(t.expiryTime);
            return (
              <View key={t.id ?? i} style={styles.tradeRow}>
                {/* ===== ACCOUNT LABEL PER TRADE ===== */}
                <Text
                  style={{
                    fontSize: 12,
                    color:
                      t.accountType === "demo"
                        ? "#ff69b4"
                        : t.accountType === "real"
                        ? "#00bfff"
                        : "#ffd700",
                    fontWeight: "600",
                    marginBottom: 4,
                  }}
                >
                  {t.accountType === "tournament"
    ? t.tournamentName ?? "Tournament"
    : t.accountType?.toUpperCase()}
                </Text>

                {/* ===== TRADE INFO ===== */}
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
                <Text
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    fontWeight: "600",
                    color: remaining === "00:00" ? "#f44336" : "#ffcc00",
                  }}
                >
                  Expires in: {remaining}
                </Text>

                <Text style={{ height: 0, opacity: 0 }}>{tick}</Text>
              </View>
            );
          })
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
                  { backgroundColor: t.result === "GAIN" ? "#1e4620" : "#5a1d1d" },
                ]}
              >
                {/* ===== ACCOUNT LABEL PER TRADE ===== */}
                <Text
                  style={{
                    fontSize: 12,
                    color:
                      t.accountType === "demo"
                        ? "#ff69b4"
                        : t.accountType === "real"
                        ? "#00bfff"
                        : "#ffd700",
                    fontWeight: "600",
                    marginBottom: 4,
                  }}
                >
                  {t.accountType?.toUpperCase()}
                </Text>

                {/* ===== TRADE INFO ===== */}
                <Text style={styles.tradeText}>
                  {(t.type ?? "buy").toUpperCase()} • {t.result} • {profit}
                </Text>
                <Text style={styles.tradeText}>
                  Open: {t.entryPrice?.toFixed(2)} → Close: {t.closePrice?.toFixed(2)}
                </Text>
                <Text style={styles.timeText}>
                  Opened: {formatTime(t.openTime)} | Closed: {formatTime(t.closeTime)}
                </Text>
              </View>
            );
          })
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
  },
  handle: {
    height: 50,
      paddingVertical: 8,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  handleLine: { width: 40, height: 2, borderRadius: 2, backgroundColor: "#888", marginBottom: 3 },
  handleText: { color: "white", fontWeight: "600" },
  content: { flex: 1, padding: 10 },
  sectionTitle: { color: "#ccc", fontSize: 14, marginVertical: 6 },
  tradeRow: { marginVertical: 6, padding: 10, borderRadius: 8, backgroundColor: "#2a2a2a" },
  tradeText: { color: "white", fontSize: 13 },
  timeText: { color: "#ccc", fontSize: 12 },
  emptyText: { color: "#777" },
  accountHeader: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: "#222", borderBottomWidth: 1, borderBottomColor: "#444" },
  accountText: { fontSize: 14, fontWeight: "700" },
});
