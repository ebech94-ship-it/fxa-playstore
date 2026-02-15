module.exports = {
  root: true,
  parser: "@typescript-eslint/parser", // ✅ for TypeScript
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint", "react", "react-native", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended", // ✅ TS rules
    "plugin:react/recommended",             // ✅ React rules
    "plugin:react-native/all",              // ✅ RN rules
    "plugin:import/recommended",
    "plugin:import/typescript"              // ✅ import rules for TS
  ],
  settings: {
    react: { version: "detect" },
    "import/resolver": {
      node: { extensions: [".js", ".jsx", ".ts", ".tsx"] },
      alias: { map: [["@env", "./"]], extensions: [".js", ".jsx", ".ts", ".tsx"] },
    },
  },
  rules: {
    "semi": ["error", "always"],
    "quotes": ["error", "double"],
    "@typescript-eslint/no-unused-vars": ["warn"],
    "react/prop-types": "off",
    "react-native/no-inline-styles": "warn",
  },
};
