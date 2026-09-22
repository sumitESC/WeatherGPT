import "dotenv/config";
import { refreshWeatherForAllCities } from "../artifacts/api-server/src/routes/weather.js";

async function verify() {
  console.log("Starting manual weather synchronization check...");
  try {
    const count = await refreshWeatherForAllCities();
    console.log(`Manual sync complete. Updated ${count} cities.`);
  } catch (err) {
    console.error("Manual sync failed:", err);
  }
}

verify();
