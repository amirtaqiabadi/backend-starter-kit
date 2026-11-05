import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://app:app@127.0.0.1:5433/app";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
