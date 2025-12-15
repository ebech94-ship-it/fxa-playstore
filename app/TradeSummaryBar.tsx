// TradeSummaryBar.tsx — FIXED (Newest trades visible at TOP)

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
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

interface TradeSummaryBarProps {
  openTrades?: any[];
  closedTrades?: any[];
  balances?: {
    real: number;
    demo: number;
    tournament: number;
  };
  activeAccount?: "real" | "demo" | "tournament";
  onResizeChart?: () => void;
}

export default function TradeSummaryBar({
  openTrades: parentOpenTrades = [],
  closedTrades: parentClosedTrades = [],
  balances,
  activeAccount,
  onResizeChart,
}: TradeSummaryBarProps) {
  const translateY = useRef(
    new Animated.Value(EXPANDED_HEIGHT - COLLAPSED_HEIGHT)
  ).current;

  const scrollRef = useRef<ScrollView>(null);

  const user = auth.currentUser;
  const [openTrades, setOpenTrades] = useState<any[]>([]);
  const [closedTrades, setClosedTrades] = useState<any[]>([]);

  /* ---------------- SORT (NEWEST FIRST) ---------------- */

  const sortedOpenTrades = useMemo(() => {
    return [...openTrades].sort(
      (a, b) => (b.openTime ?? 0) - (a.openTime ?? 0)
    );
  }, [openTrades]);

  const sortedClosedTrades = useMemo(() => {
    return [...closedTrades].sort(
      (a, b) => (b.closeTime ?? 0) - (a.closeTime ?? 0)
    );
  }, [closedTrades]);

  /* -------- AUTO SCROLL TO TOP ON NEW TRADE -------- */

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [sortedOpenTrades.length, sortedClosedTrades.length]);

  /* ---------------- TIME HELPERS ---------------- */

  const [tick, setTick] = useState(0);

  const getDate = (ts: any): Date | null => {
    if (!ts) return null;
    if (typeof ts?.toDate === "function") return ts.toDate();
    if (typeof ts === "number") return new Date(ts);
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  };

  const timeAgo = (date: Date | null) => {
    if (!date) return "-";
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const formatTimeWithAgo = (ts: any) => {
    const d = getDate(ts);
    return d ? `${d.toLocaleTimeString()} (${timeAgo(d)})` : "-";
  };

  const formatTimeOnly = (ts: any) => {
    const d = getDate(ts);
    return d ? d.toLocaleTimeString() : "-";
  };

  const getCloseTime = (trade: any): Date | null => {
    const openDate = getDate(trade.openTime);
    if (!openDate || !trade.duration) return null;
    return new Date(openDate.getTime() + trade.duration * 1000);
  };

  /* ---------------- DATA SOURCE ---------------- */

  useEffect(() => {
    const parentHasTrades =
      parentOpenTrades.length > 0 || parentClosedTrades.length > 0;

    if (parentHasTrades) {
      setOpenTrades(parentOpenTrades);
      setClosedTrades(parentClosedTrades);
      return;
    }

    if (!user?.uid) return;

    const tradesRef = collection(db, "userTrades");
    const q = query(tradesRef, where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const open: any[] = [];
      const closed: any[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status === "open") open.push(data);
        else closed.push(data);
      });

      setOpenTrades(open);
      setClosedTrades(closed);
    });

    return unsubscribe;
  }, [user?.uid, parentOpenTrades, parentClosedTrades]);

  /* ---------------- TICKER ---------------- */

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  /* ---------------- SWIPE PANEL ---------------- */

  const [panelHeight, setPanelHeight] = useState(EXPANDED_HEIGHT);
  const dragRatio = useRef(1);

const handleDimensionChange = useCallback(
  ({ window }: { window: { height: number; width: number } }) => {
    const newHeight = window.height * 0.5;
    setPanelHeight(newHeight);

    const maxTranslate = newHeight - COLLAPSED_HEIGHT;
    translateY.setValue(dragRatio.current * maxTranslate);

    onResizeChart?.();
  },
  [onResizeChart, translateY]
);


  useEffect(() => {
  const sub = Dimensions.addEventListener("change", handleDimensionChange);
  return () => sub.remove();
}, [handleDimensionChange]);


  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10,

      onPanResponderMove: (_, g) => {
        const currentY = (translateY as any)._value ?? 0;
        translateY.setValue(
          Math.max(0, Math.min(panelHeight - COLLAPSED_HEIGHT, currentY + g.dy))
        );
        onResizeChart?.();
      },

      onPanResponderRelease: (_, g) => {
        const max = panelHeight - COLLAPSED_HEIGHT;
        let nextY = (translateY as any)._value ?? 0;
        if (g.dy < -30) nextY = 0;
        else if (g.dy > 30) nextY = max;
        dragRatio.current = nextY / max;

        Animated.spring(translateY, {
          toValue: nextY,
          useNativeDriver: true,
        }).start(onResizeChart);
      },
    })
  ).current;

  /* ---------------- RENDER ---------------- */

  return (
    <Animated.View
      style={[
        styles.panel,
        { height: panelHeight, transform: [{ translateY }] },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.handle}>
        <View style={styles.handleLine} />
        <Text style={styles.handleText}>Portfolio / Trade Summary</Text>
      </View>

      <ScrollView ref={scrollRef} style={styles.content}>
        <Text style={styles.accountText}>
          Active Account: {activeAccount?.toUpperCase()}
        </Text>

        <Text style={styles.sectionTitle}>Open Trades</Text>

        {sortedOpenTrades.length === 0 ? (
          <Text style={styles.empty}>No open trades</Text>
        ) : (
          sortedOpenTrades.map((t, i) => {
            const closeDate = getCloseTime(t);
            const secondsLeft = closeDate
              ? Math.max(0, Math.floor((closeDate.getTime() - Date.now()) / 1000))
              : 0;

            return (
              <View key={i} style={styles.tradeRow}>
                <Text style={styles.tradeText}>
                  {t.type.toUpperCase()} • Stake: ${t.amount}
                </Text>
                <Text style={styles.tradeText}>
                  Entry: {t.entryPrice?.toFixed(2)}
                </Text>
                <Text style={styles.time}>
                  Opened: {formatTimeWithAgo(t.openTime)}
                </Text>
                <Text style={styles.tradeText}>
                  Closes in: {secondsLeft}s
                </Text>
                <View style={{ height: 0 }}>{tick}</View>
              </View>
            );
          })
        )}

        <Text style={styles.sectionTitle}>Closed Trades</Text>

        {sortedClosedTrades.length === 0 ? (
          <Text style={styles.empty}>No closed trades</Text>
        ) : (
          sortedClosedTrades.map((t, i) => {
            const profit =
              t.result === "GAIN"
                ? `+$${t.payout?.toFixed(2)}`
                : `-$${t.amount}`;

            return (
              <View
                key={i}
                style={[
                  styles.tradeRow,
                  { backgroundColor: t.result === "GAIN" ? "#1e4620" : "#5a1d1d" },
                ]}
              >
                <Text style={styles.tradeText}>
                  {t.type.toUpperCase()} • {t.result} • {profit}
                </Text>
                <Text style={styles.tradeText}>
                  Open: {t.entryPrice?.toFixed(2)} → Close:{" "}
                  {t.closePrice?.toFixed(2)}
                </Text>
                <Text style={styles.time}>
                  Opened: {formatTimeOnly(t.openTime)}
                </Text>
                <Text style={styles.time}>
                  Closed: {formatTimeOnly(getCloseTime(t))}
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
    height: COLLAPSED_HEIGHT,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  handleLine: {
    width: 40,
    height: 2,
    backgroundColor: "#888",
    marginBottom: 3,
  },
  handleText: { color: "#fff", fontWeight: "600" },
  content: { flex: 1, padding: 10 },
  accountText: {
    color: "#0af",
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "600",
  },
  sectionTitle: { color: "#ccc", fontSize: 14, marginVertical: 6 },
  tradeRow: {
    marginVertical: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
  },
  tradeText: { color: "#fff", fontSize: 13 },
  time: { color: "#ccc", fontSize: 12 },
  empty: { color: "#777" },
});
