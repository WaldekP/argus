// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // dist/ i .expo/ to artefakty builda, tools/ to osobny projekt na Node 24
    // (natywny TypeScript, wlasny package.json) i nie podlega regulom Expo.
    ignores: ["dist/*", ".expo/*", "tools/*"],
  },
  {
    // Edge Functions to Deno: importy po URL i przez specyfikator npm: sa
    // poprawne, ale resolver eslinta ich nie widzi. Typy sprawdza Deno przy
    // deployu, wiec tutaj wylaczamy tylko regule od rozwiazywania sciezek.
    files: ["backend/**/*.ts"],
    rules: {
      "import/no-unresolved": "off",
    },
  }
]);
