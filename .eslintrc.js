module.exports = {
  extends: ["expo", "plugin:import/recommended"],

  settings: {
    "import/resolver": {
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx"]
      },
      alias: {
        map: [
          ["@env", "./"]
        ],
        extensions: [".js", ".jsx", ".ts", ".tsx"]
      }
    }
  }
};
