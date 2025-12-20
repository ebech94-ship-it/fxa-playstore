import React, { useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Share,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { getAuth } from "firebase/auth";

const BACKEND_URL = "https://forexapp2-backend.onrender.com";

export default function InviteEarnScreen() {
  const user = getAuth().currentUser;

  const inviteLink = useMemo(() => {
    if (!user) return "";
    return `${BACKEND_URL}/invite?ref=${user.uid}`;
  }, [user]);

  const copyLink = async () => {
    await Clipboard.setStringAsync(inviteLink);
    Alert.alert("Copied", "Invite link copied to clipboard");
  };

  const shareLink = async () => {
    try {
      await Share.share({
        message: `🚀 Join me on Forex Tournaments!\n\nUse my invite link:\n${inviteLink}`,
      });
    } catch (err) {
      console.error("Share failed", err);
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Please log in to invite friends</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>🎁 Invite & Earn</Text>

        <Text style={styles.subtitle}>
          Invite friends and earn rewards when they join and trade.
        </Text>

        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Your Invite Code</Text>
          <Text style={styles.code}>{user.uid}</Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={copyLink}>
          <Text style={styles.primaryText}>Copy Invite Link</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={shareLink}>
          <Text style={styles.secondaryText}>Share Invite</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d0f",
    justifyContent: "center",
    padding: 20,
  },

  card: {
    backgroundColor: "#1a1a1f",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#333",
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },

  subtitle: {
    color: "#b9b9c5",
    fontSize: 14,
    marginBottom: 20,
  },

  codeBox: {
    backgroundColor: "#131317",
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },

  codeLabel: {
    color: "#888",
    fontSize: 12,
    marginBottom: 4,
  },

  code: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  primaryBtn: {
    backgroundColor: "#4e2cff",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },

  primaryText: {
    color: "#fff",
    fontWeight: "bold",
  },

  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#4e2cff",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  secondaryText: {
    color: "#4e2cff",
    fontWeight: "600",
  },

  text: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
  },
});
