import { Router } from "expo-router";
import { Alert } from "react-native";

export const verifyAdminAccess = (
  enteredCode: string,
  router: Router,
  onSuccess?: () => void,
  onFailure?: () => void
) => {
  const correctCode = "FOREXADMIN2025"; // 🔐 later move to backend

  if (enteredCode.trim() === correctCode) {
    Alert.alert("✅ Access Granted", "Welcome Administrator!");
    onSuccess?.();
    router.push("/admin/AdminDashboard");
  } else {
    Alert.alert("⛔ Access Denied", "Incorrect admin code.");
    onFailure?.();
  }
};
