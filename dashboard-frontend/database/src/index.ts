import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import type { Database as SQLiteDatabase } from "better-sqlite3";

const fallbackDbPath = "d:/code/Heat-Zone-Intel/sqlite.db";
const dbPath = process.env.DATABASE_URL || fallbackDbPath;

export const sqlite: SQLiteDatabase = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

export * from "./schema";
export { eq, ne, gt, gte, lt, lte, desc, asc, avg, sum, count, sql } from "drizzle-orm";
