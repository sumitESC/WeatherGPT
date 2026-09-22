import { createClient } from "@libsql/client";
import path from "path";

async function check() {
  const dbPath = path.resolve(process.cwd(), "sqlite.db");
  const client = createClient({ url: `file:${dbPath}` });
  try {
    const res = await client.execute("PRAGMA table_info(heat_predictions);");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Query failed:", err);
  } finally {
    client.close();
  }
}

check();
