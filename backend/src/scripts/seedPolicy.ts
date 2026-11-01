// Demo users, saved jobs and catalog fixtures are only permitted in an
// explicitly opted-in local environment. NODE_ENV=development also occurs in DEV.
export function assertLocalSeedAllowed(env = process.env): void {
  if (
    env.APP_ENV !== "local" ||
    env.ALLOW_DEMO_SEED !== "true" ||
    env.NODE_ENV === "production"
  ) {
    throw new Error(
      "Seed fictício bloqueado: exige APP_ENV=local, ALLOW_DEMO_SEED=true e NODE_ENV diferente de production.",
    );
  }
}
