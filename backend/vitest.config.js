import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

function loadTestEnv(mode = "test") {
  const cwd = process.cwd();
  const files = [".env", `.env.${mode}`];
  const env = {};

  for (const file of files) {
    const path = resolve(cwd, file);
    if (existsSync(path)) {
      Object.assign(env, config({ path }).parsed);
    }
  }

  return env;
}

export default defineConfig(({ mode }) => {
  const env = loadTestEnv(mode ?? "test");

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
