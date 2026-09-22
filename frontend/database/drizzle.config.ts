import { defineConfig } from "drizzle-kit";

const fallbackDbPath = "d:/code/Heat-Zone-Intel/sqlite.db";
const dbPath = process.env.DATABASE_URL || fallbackDbPath;

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: dbPath,
  },
});
