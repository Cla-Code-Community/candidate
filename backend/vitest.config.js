import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode ?? "test", process.cwd(), "");

  return {
    test: {
      globals: true,
      environment: "node",
      setupFiles: ["./tests/setup.js"],
      env,
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        include: ["src/**/*.ts"],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
        exclude: [
          "src/swagger.ts",
          "src/db/schema/**",
          "src/db/client.ts",
          "src/db/types/**",
          "src/modules/types/**",
          "drizzle.config.js",
          "index.js",
        ],
      },
    },
  };
});
