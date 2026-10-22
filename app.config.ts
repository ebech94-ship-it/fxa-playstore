
import "dotenv/config";

export default {
  expo: {
    name: "FX ARENA",
    slug: "fxa-playstore",
    owner: "ebeh",

    version: "1.0.0",
    orientation: "default",
    scheme: "fxarenacoins",
    jsEngine: "hermes",
    icon: "./assets/images/icon.png",
    userInterfaceStyle: "automatic",

    assetBundlePatterns: [
      "assets/images/*",
      "assets/fonts/*"
    ],

    ios: {
      supportsTablet: true,
    },

    android: {
      package: "com.ebeh.fxa.playstore",
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
              "-keep class com.ebeh.fxa.playstore.** { *; }",
          },
        },
      ],
    ],

    experiments: {
      typedRoutes: true,
      reactCompiler: true,
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
        projectId: "6bd56cae-f60a-4977-96b7-189364eae541",
      },
    },
  },
};