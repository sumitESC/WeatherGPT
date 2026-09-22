/**
 * ML Proxy Service
 * Handles all communication between the Node.js BFF and the Python FastAPI ML engine.
 * All functions return null on failure so routes can gracefully degrade.
 */

const ML_API_BASE = process.env.PYTHON_ML_API_URL || "http://127.0.0.1:8000/api/v1";
const ML_TIMEOUT_MS = 15_000; // 15 seconds — ML inference needs time

interface MLForecastPrediction {
  date: string;
  Temp_Max_C: number;
  Temp_Min_C: number;
  Precipitation_mm: number;
  Humidity_Mean_pct: number;
  Wind_Speed_Max_kmh: number;
  Pressure_MSL_hPa: number;
  Shortwave_Radiation_MJm2: number;
  heat_risk_score?: number;
  heat_zone?: string;
  primary_driver?: string;
}

export interface MLForecastResponse {
  city: string;
  forecast_horizon: number;
  predictions: MLForecastPrediction[];
  warnings: string[];
}

export interface MLHistoryResponse {
  city: string;
  start_date: string;
  end_date: string;
  data: Record<string, unknown>[];
}

export interface MLSatModelResponse {
  local_diagnostics?: Record<string, unknown>;
  upstream_corridor_analysis?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MLContextResponse {
  date: string;
  sentinel_cities_analyzed: number;
  context_signals: Record<string, unknown>;
}

async function mlFetch<T>(path: string): Promise<T | null> {
  const url = `${ML_API_BASE}${path}`;
  console.log(`[ML Proxy] Fetching: ${url}`);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[ML Proxy] ${url} returned ${response.status}`);
      const text = await response.text();
      console.error(`[ML Proxy] Response body: ${text}`);
      return null;
    }

    return (await response.json()) as T;
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error(`[ML Proxy] ${url} timed out after ${ML_TIMEOUT_MS}ms`);
    } else {
      console.error(`[ML Proxy] ${url} failed:`, err.message || err);
    }
    return null;
  }
}

// ─── ML Forecast cache (5 min TTL) ──────────────────────────────────────────
const mlForecastCache = new Map<string, { data: MLForecastResponse; ts: number }>();
const ML_FORECAST_CACHE_TTL = 300_000; // 5 minutes

/**
 * Fetch the 16-day AI ensemble forecast for a city (cached for 5 min).
 */
export async function fetchMLForecast(city: string): Promise<MLForecastResponse | null> {
  const cacheKey = city.toLowerCase();
  const cached = mlForecastCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ML_FORECAST_CACHE_TTL) return cached.data;
  
  const result = await mlFetch<MLForecastResponse>(`/forecast/${encodeURIComponent(city)}`);
  if (result) {
    mlForecastCache.set(cacheKey, { data: result, ts: Date.now() });
  }
  return result;
}

/**
 * Fetch historical weather data for a city within a date range.
 */
export async function fetchMLHistory(
  city: string,
  startDate: string,
  endDate: string
): Promise<MLHistoryResponse | null> {
  return mlFetch<MLHistoryResponse>(
    `/history/${encodeURIComponent(city)}?start_date=${startDate}&end_date=${endDate}`
  );
}

/**
 * Fetch satellite model diagnostics (NDVI, LST, upstream corridors) for a city.
 */
export async function fetchMLSatModel(city: string): Promise<MLSatModelResponse | null> {
  return mlFetch<MLSatModelResponse>(`/sat_model/${encodeURIComponent(city)}`);
}

/**
 * Fetch upstream weather context signals for a city.
 */
export async function fetchMLContext(city: string): Promise<MLContextResponse | null> {
  return mlFetch<MLContextResponse>(`/context/${encodeURIComponent(city)}`);
}

/**
 * Check if the Python ML engine is reachable.
 */
export async function isMLEngineOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(ML_API_BASE.replace("/api/v1", "/"), {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}
