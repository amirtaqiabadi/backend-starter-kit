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
      ZARINPAL_MERCHANT_ID: "11111111-1111-1111-1111-111111111111",
      ZARINPAL_SANDBOX: "true",
      PAYMENT_CALLBACK_HMAC_SECRET: "test-hmac-secret-must-be-32-chars-min",
      PAYMENT_CARD_ENCRYPTION_KEY: "test-card-encryption-key-32-chars!",
      PAYMENT_CALLBACK_BASE_URL: "http://localhost:3000",
      PAYMENT_SUCCESS_REDIRECT_URL: "http://localhost:3000/docs?payment=ok",
      PAYMENT_FAILURE_REDIRECT_URL: "http://localhost:3000/docs?payment=failed",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
