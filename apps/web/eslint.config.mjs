import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "coverage/**"],
  },
  {
    rules: {
      // Product images are merchant-supplied URLs from any host.
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
