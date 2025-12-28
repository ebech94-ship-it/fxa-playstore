import "dotenv/config";

export default {
  expo: {
    name: "Forex Tournaments Arena",
    slug: "forex-tournaments-arena",

    android: {
      package: "com.ebeh.forextournamentsarena",
    },

    extra: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,

      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    },
  },
};
