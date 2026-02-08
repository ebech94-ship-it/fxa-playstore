import AsyncStorage from "@react-native-async-storage/async-storage";

const DEMO_BALANCE_KEY = "DEMO_BALANCE_V1";

export const loadDemoBalance = async (): Promise<number | null> => {
  try {
    const v = await AsyncStorage.getItem(DEMO_BALANCE_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
};

export const saveDemoBalance = async (balance: number) => {
  try {
    await AsyncStorage.setItem(DEMO_BALANCE_KEY, String(balance));
  } catch {}
};

export const resetDemoBalance = async (amount = 1000) => {
  await saveDemoBalance(amount);
};