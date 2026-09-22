import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
import app from "./app";
import { refreshWeatherForAllCities } from "./routes/weather.js";

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  
  // Initial sync on startup (delayed slightly for environment readiness)
  console.log("READY: API Server started. Preparing initial weather sync in 2 seconds...");
  setTimeout(async () => {
    try {
      console.log("SYNC: Starting automatic weather synchronization...");
      const count = await refreshWeatherForAllCities();
      console.log(`SYNC: Initial synchronization complete. Updated ${count} cities. Datasets recorded.`);
    } catch (err) {
      console.error("SYNC: Initial synchronization failed:", err);
    }
  }, 2000);

  // Periodic sync every 15 minutes
  const FIFTEEN_MINUTES = 15 * 60 * 1000;
  setInterval(async () => {
    console.log("SYNC: Starting periodic weather synchronization...");
    try {
      const count = await refreshWeatherForAllCities();
      console.log(`SYNC: Periodic sync complete. Updated ${count} cities.`);
    } catch (err) {
      console.error("SYNC: Periodic sync failed:", err);
    }
  }, FIFTEEN_MINUTES);
});

server.setTimeout(600000); // 10 minutes timeout for deepseek-r1:8b
