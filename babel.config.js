module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      "expo-router/babel",   // <-- ADD THIS LINE
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./"
          }
        }
      ],
      [
        "module:react-native-dotenv",
        {
          moduleName: "@env",
          path: ".env",
          safe: false,
          allowUndefined: true,
        }
      ]
    ]
  };
};