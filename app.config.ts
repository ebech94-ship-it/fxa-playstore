import "dotenv/config";

export default {
  expo: {
    name: "Forex Tournaments Arena",
    slug: "forex-tournaments-arena",
    owner: "ebeh",

    version: "1.0.0",
    orientation: "default",
    scheme: "forextournamentsarena",

    icon: "./assets/images/icon.png",
    userInterfaceStyle: "automatic",

    newArchEnabled: true,

    ios: {
      supportsTablet: true,
    },

    android: {
      package: "com.ebeh.forextournamentsarena",
      adaptiveIcon: {
        foregroundImage: "./assets/images/icon.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
        backgroundColor: "#E6F4FE",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },

    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      [
        "expo-splash-screen",
        {
          image: "./assets/images/me.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000",
          },
        },
      ],
      "expo-secure-store",
      "expo-web-browser",
      "expo-localization",
    ],

    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },

    extra: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,

      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,

      router: {},

      eas: {
        projectId: "9aeadda0-8d0b-4833-9971-158baac2d2ad",
      },
    },
  },
};
