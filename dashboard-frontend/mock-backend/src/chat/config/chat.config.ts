import path from "path";
import { fileURLToPath } from "url";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ChatConfig = {
  // API Configuration
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  GROQ_MODEL: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  GROQ_FALLBACK_MODEL: "groq/compound",

  // Data Paths
  UP_CITIES_PATH: path.resolve(__dirname, "../../../../../../heatzone-weather-api/data/up_cities.json"),
  ML_FORECAST_PATH: path.resolve(__dirname, "../../../../../../heatzone-weather-api/dashboard/data/all_cities_heatscore_forecast.json"),

  // Cache & Reload Config
  DATA_RELOAD_INTERVAL: 5 * 60 * 1000, // 5 minutes
  DB_CACHE_TTL: 300000, // 5 minutes

  // Ollama Performance Options (kept for legacy/fallback support if needed)
  OLLAMA_PERF_OPTIONS: {
    num_gpu: 999,
    num_batch: 2048,
    num_ctx: 4096,
    use_mmap: true,
    use_mlock: true,
    num_thread: os.cpus().length,
    num_predict: -1,
    main_gpu: 0,
    low_vram: false
  },

  // Token Limits (Context Manager)
  MAX_HISTORY_MESSAGES: 6, // Keep last 6 messages
};
