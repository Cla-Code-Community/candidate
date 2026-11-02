import { describe, expect, it } from "vitest";
import { assertLocalSeedAllowed } from "../../../src/scripts/seedPolicy";

describe("demo seed policy", () => {
  it.each([undefined, "dev", "development", "staging", "production"])(
    "rejects deployment environment %s despite opt-in",
    (APP_ENV) => {
      expect(() => assertLocalSeedAllowed({ APP_ENV, ALLOW_DEMO_SEED: "true" })).toThrow();
    },
  );
  it("requires local opt-in and rejects production runtime", () => {
    expect(() => assertLocalSeedAllowed({ APP_ENV: "local" })).toThrow();
    expect(() => assertLocalSeedAllowed({ APP_ENV: "local", ALLOW_DEMO_SEED: "true", NODE_ENV: "production" })).toThrow();
    expect(() => assertLocalSeedAllowed({ APP_ENV: "local", ALLOW_DEMO_SEED: "true", NODE_ENV: "development" })).not.toThrow();
  });
});
