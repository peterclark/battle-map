import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  // `docs/reference/` holds standalone Three.js pages kept as art direction.
  // They are not part of the app — nothing imports them and the build never
  // sees them — and they were authored to different conventions, so linting
  // them would only produce noise to be suppressed.
  { ignores: ["dist", "coverage", "docs/reference"] },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    settings: { react: { version: "18.3" } },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // The new JSX transform makes the React import unnecessary
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      // `const { dropped, ...rest } = x` is how this codebase omits a key
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
];
