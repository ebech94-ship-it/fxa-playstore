// components/ProfileBadge.tsx
import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View } from "react-native";
import { useApp } from "../app/AppContext";



export default function ProfileBadge() {

 const { profile, profileVerified, profileLoaded } = useApp();

if (!profileLoaded) {
  return (
    <View style={{ height: 110 }} />
  );
}


  return (
    <View style={styles.container}>
      {/* Avatar (optional) */}
      {profile?.avatarUrl && (
        <Image
          source={{ uri: profile.avatarUrl }}
          style={styles.avatar}
        />
      )}

      {/* Username and country */}
      <View style={styles.info}>
        {profile?.username && (
  <Text style={styles.username}>{profile.username}</Text>
)}
        {profile?.country && <Text style={styles.country}>{profile.country}</Text>}
      </View>

      {/* Verification badge */}
      <View style={profileVerified ? styles.verified : styles.unverified}>
        <Ionicons
          name={profileVerified ? "checkmark-circle" : "warning"}
          size={18}
          color={profileVerified ? "#16213e" : "white"}
        />
        <Text style={profileVerified ? styles.verifiedText : styles.unverifiedText}>
          {profileVerified ? "Verified ✓" : "Unverified"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 12,
    width: "90%",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 6,
  },
  info: {
    alignItems: "center",
    marginBottom: 6,
  },
  username: { color: "white", fontWeight: "bold", fontSize: 14 },
  country: { color: "gray", fontSize: 12 },

  verified: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#21e6c1",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    justifyContent: "center",
  },
  verifiedText: { color: "#16213e", marginLeft: 6, fontSize: 13 },

  unverified: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ff4444",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    justifyContent: "center",
  },
  unverifiedText: { color: "white", marginLeft: 6, fontSize: 13 },
});
