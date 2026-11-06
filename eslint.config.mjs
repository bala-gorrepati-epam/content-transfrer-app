import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Next.js ships flat-config presets, so no compatibility wrapper is needed.
// The Prettier config goes last: it turns off ESLint rules that clash with Prettier's formatting.
const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  prettier,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
