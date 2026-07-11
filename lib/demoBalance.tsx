import AsyncStorage from "@react-native-async-storage/async-storage";

export const loadDemoBalance = async (
  uid: string
): Promise<number | null> => {
  if (!uid) return null;

  try {
    const value = await AsyncStorage.getItem(`demoBalance_${uid}`);
    return value ? Number(value) : null;
  } catch {
    return null;
  }
};

export const saveDemoBalance = async (
  uid: string,
  balance: number
): Promise<void> => {
  if (!uid) return;

  try {
    await AsyncStorage.setItem(`demoBalance_${uid}`, String(balance));
  } catch {}
};

export const resetDemoBalance = async (
  uid: string,
  amount = 1000
): Promise<void> => {
  if (!uid) return;

  await saveDemoBalance(uid, amount);
};
