import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: [
      "backend/**",
      "frontend/**",
      "front_admin/**",
      "node_modules/**",
      "dist/**",
    ],
  },
]);
