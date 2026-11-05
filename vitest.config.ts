import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    globalSetup: "./vitest.global-setup.ts",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: "postgresql://app:app@127.0.0.1:5433/auth_test",
      REDIS_URL: "redis://127.0.0.1:6379/1",
      SMS_PROVIDER: "console",
      SMS_DEV_LOG: "false",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
