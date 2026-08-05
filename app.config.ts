import "dotenv/config";

export default {
  expo: {
    name: "FX ARENA",
    slug: "forex-tournaments-arena",
    owner: "ebeh",

    version: "1.0.0",
    orientation: "default",
    scheme: "forextournamentsarena",
    jsEngine: "hermes", // Hermes enabled
    icon: "./assets/images/icon.png",
    userInterfaceStyle: "automatic",

    // Only bundle essential assets for smaller APK
    assetBundlePatterns: [
      "assets/images/*",
      "assets/fonts/*"
    ],

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
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },

   plugins: [
  [
    "expo-splash-screen",
    {
      image: "./assets/images/myicon.png",
      imageWidth: 200,
      resizeMode: "contain",
      backgroundColor: "#ffffff",
      dark: { backgroundColor: "#000000" },
    },
  ],
 "expo-status-bar",
  "expo-font",
  "expo-secure-store",
  "expo-web-browser",
  "expo-localization",
  "expo-router",

  "@react-native-community/datetimepicker",
  "expo-image",
  "expo-sharing",

  [
    "expo-build-properties",
    {
      ios: { useFrameworks: "static" },
      android: {
        enableProguardInReleaseBuilds: true,
        extraProguardRules:
          "-keep class com.ebeh.forextournamentsarena.** { *; }",
      },
    },
  ],
],

    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },

    updates: {
      url: "https://u.expo.dev/9aeadda0-8d0b-4833-9971-158baac2d2ad",
      enabled: true,
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0,
    },

    runtimeVersion: {
      policy: "appVersion",
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