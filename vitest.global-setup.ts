import { execSync } from "node:child_process";
import pg from "pg";

const ADMIN_URL = "postgresql://app:app@127.0.0.1:5433/app";
const TEST_URL = "postgresql://app:app@127.0.0.1:5433/auth_test";

/** Why: auth tests need the migrated Postgres schema before the first case runs. */
export default async function setup(): Promise<void> {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'auth_test'");
  if (existing.rowCount === 0) {
    await admin.query("CREATE DATABASE auth_test");
  }
  await admin.end();
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_URL },
  });
}
