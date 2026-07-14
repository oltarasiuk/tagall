import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    // Unit tests never talk to a provider or a database, so they must not
    // require a populated .env to import server modules.
    env: { SKIP_ENV_VALIDATION: "true" },
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/server/**/*.ts"],
    },
  },
});
