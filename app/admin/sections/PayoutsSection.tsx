import { getAuth } from "firebase/auth";
import { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";

type Payout = {
  id: string;
  userName: string;
  amount: number;
  method?: string;
  wallet?: string;
  status: "locked" | "processing" | "success" | "failed" | "refunded" | "cancelled";
};

// -----------------------------
// STATUS COLOR ENGINE 🔥
// -----------------------------
const statusColor = (status: Payout["status"]) => {
  switch (status) {
    case "locked":
      return "#ffb020";
    case "processing":
      return "#4fc3f7";
    case "success":
      return "#00e676";
    case "failed":
      return "#ff5252";
    case "refunded":
      return "#ba68c8";
    case "cancelled":
      return "#9e9e9e";
    default:
      return "#777";
  }
};

export default function PayoutsSection() {
  const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const auth = getAuth();

  // -----------------------------
  // FETCH PAYOUTS
  // -----------------------------
  const fetchPayouts = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken();

      const res = await fetch(
        `${API_BASE}/admin/transactions?type=withdrawal&status=locked`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();
      setPayouts(data || []);
    } catch (err) {
      console.error("Payout fetch error:", err);
    }
  }, [API_BASE, auth]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  // -----------------------------
  // ACTIONS
  // -----------------------------
  const action = async (route: string, payload: any) => {
    const user = auth.currentUser;
    if (!user) return;

    const token = await user.getIdToken();

    await fetch(`${API_BASE}${route}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    fetchPayouts();
  };

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <View style={styles.container}>
      <Text style={styles.header}>🔥 Withdrawal Control Center</Text>

      <ScrollView>
        {payouts.length === 0 ? (
          <Text style={styles.empty}>No active payouts</Text>
        ) : (
          payouts.map((p) => (
            <View
              key={p.id}
              style={[
                styles.card,
                { borderColor: statusColor(p.status) },
              ]}
            >
              {/* HEADER ROW */}
              <View style={styles.topRow}>
                <Text style={styles.name}>{p.userName}</Text>

                <View
                  style={[
                    styles.badge,
                    { backgroundColor: statusColor(p.status) },
                  ]}
                >
                  <Text style={styles.badgeText}>{p.status.toUpperCase()}</Text>
                </View>
              </View>

              {/* AMOUNT */}
              <Text style={styles.amount}>{p.amount} FRS</Text>

              {/* META */}
              <Text style={styles.meta}>Method: {p.method}</Text>
              <Text style={styles.meta}>Wallet: {p.wallet}</Text>
              <Text style={styles.meta}>ID: {p.id}</Text>

              {/* ACTION ROW */}
              <View style={styles.actions}>
                {p.status === "locked" && (
                  <>
                    <Pressable
                      onPress={() =>
                        action("/admin/approve-withdrawal", {
                          transactionId: p.id,
                        })
                      }
                      style={[styles.btn, styles.approve]}
                    >
                      <Text style={styles.btnText}>Approve</Text>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        action("/admin/reject-withdrawal", {
                          transactionId: p.id,
                        })
                      }
                      style={[styles.btn, styles.reject]}
                    >
                      <Text style={styles.btnText}>Reject</Text>
                    </Pressable>
                  </>
                )}

                {p.status === "failed" && (
                  <Pressable
                    onPress={() =>
                      action("/admin/retry-payout", {
                        transactionId: p.id,
                      })
                    }
                    style={[styles.btn, styles.retry]}
                  >
                    <Text style={styles.btnText}>Retry</Text>
                  </Pressable>
                )}

                {/* FORCE */}
                <Pressable
                  onPress={() =>
                    action("/admin/force-payout-status", {
                      transactionId: p.id,
                      status: "success",
                    })
                  }
                  style={[styles.btn, styles.forceSuccess]}
                >
                  <Text style={styles.btnText}>Force OK</Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    action("/admin/force-payout-status", {
                      transactionId: p.id,
                      status: "failed",
                    })
                  }
                  style={[styles.btn, styles.forceFail]}
                >
                  <Text style={styles.btnText}>Force Fail</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// -----------------------------
// STYLES (GLASS + NEON + FIRE)
// -----------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#050508",
  },

  header: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 16,
    textShadowColor: "#ff2d55",
    textShadowRadius: 10,
  },

  card: {
    backgroundColor: "#0f0f14",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  name: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },

  amount: {
    color: "#7cf",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },

  meta: {
    color: "#999",
    fontSize: 12,
  },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  badgeText: {
    color: "#000",
    fontSize: 10,
    fontWeight: "900",
  },

  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  btn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },

  btnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },

  approve: {
    backgroundColor: "#00c853",
  },

  reject: {
    backgroundColor: "#ff1744",
  },

  retry: {
    backgroundColor: "#ff9100",
  },

  forceSuccess: {
    backgroundColor: "#00e676",
  },

  forceFail: {
    backgroundColor: "#d50000",
  },

  empty: {
    color: "#666",
    textAlign: "center",
    marginTop: 20,
  },
});