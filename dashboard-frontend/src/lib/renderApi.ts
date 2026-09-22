/**
 * WeatherGPT — Render Backend API Service
 * Base URL: https://heatzone-backend.onrender.com
 */

export const RENDER_BACKEND_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');

// Interfaces for API Responses

export interface RootStatusResponse {
  status: string;
  service: string;
  version?: string;
  endpoints?: Record<string, string>;
}

export interface HeatwaveRiskForecast {
  date: string;
  temp_max_c: number;
  temp_min_c: number;
  humidity_pct: number;
  rainfall_mm: number;
  wind_speed_kmh: number;
  heat_risk_score: number;
  heat_zone: 'Low' | 'Moderate' | 'High' | 'Extreme';
  primary_driver: string;
}

export interface CityForecastResponse {
  city: string;
  forecast_days: number;
  generated_at?: string;
  forecast: HeatwaveRiskForecast[];
}

export interface SatModelAnalysisResponse {
  city: string;
  horizon_hours: number;
  stage_1_corridors?: {
    monsoon_signal?: string;
    loo_wind_velocity?: number;
    western_disturbance?: string;
  };
  stage_2_satellite_indices?: {
    ndvi?: number;
    ndwi?: number;
    ndbi?: number;
    surface_temp_anomaly?: number;
  };
  stage_3_forecast_matrix?: Record<string, any>;
  summary?: string;
}

export interface CurrentWeatherResponse {
  city: string;
  date: string;
  temp_max_c: number;
  temp_min_c?: number;
  humidity_pct: number;
  rainfall_mm: number;
  wind_speed_kmh: number;
  pressure_hpa?: number;
  heat_risk_score: number;
  heat_zone: 'Low' | 'Moderate' | 'High' | 'Extreme';
  primary_driver?: string;
}

export interface HistoryRecord {
  date: string;
  temp_max_c: number;
  temp_min_c?: number;
  humidity_pct: number;
  rainfall_mm: number;
  wind_speed_kmh: number;
  heat_risk_score?: number;
  heat_zone?: string;
}

export interface HistoryResponse {
  city: string;
  start_date: string;
  end_date: string;
  records: HistoryRecord[];
}

export interface IndiaSentinelContextResponse {
  date: string;
  sentinel_cities?: Record<string, {
    temp_c: number;
    humidity: number;
    heat_index: number;
    status: string;
  }>;
  corridor_summary?: string;
}

// API Helper Functions

async function handleResponse<T>(res: Response, endpointName: string): Promise<T> {
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`[Render API Error] ${endpointName} failed (${res.status}): ${errorText}`);
  }
  return res.json() as Promise<T>;
}

// GET / - Root API status and health check
export async function fetchRootStatus(): Promise<RootStatusResponse> {
  const res = await fetch(`${RENDER_BACKEND_URL}/`);
  return handleResponse<RootStatusResponse>(res, 'fetchRootStatus');
}

// GET /api/v1/forecast/{city} - 16-Day AI Forecast + ML Heatwave Risk
export async function fetchCityForecast(city: string): Promise<CityForecastResponse> {
  const res = await fetch(`${RENDER_BACKEND_URL}/api/v1/forecast/${encodeURIComponent(city)}`);
  return handleResponse<CityForecastResponse>(res, `fetchCityForecast(${city})`);
}

// GET /api/v1/sat_model/{city}?horizon={hours} - Full Satellite Telemetry Analysis
export async function fetchSatModelAnalysis(city: string, horizon: number = 72): Promise<SatModelAnalysisResponse> {
  const url = `${RENDER_BACKEND_URL}/api/v1/sat_model/${encodeURIComponent(city)}?horizon=${horizon}`;
  const res = await fetch(url);
  return handleResponse<SatModelAnalysisResponse>(res, `fetchSatModelAnalysis(${city})`);
}

// GET /api/v1/sat_model/{city}/report - Markdown Report Output
export async function fetchSatModelReport(city: string): Promise<string> {
  const url = `${RENDER_BACKEND_URL}/api/v1/sat_model/${encodeURIComponent(city)}/report`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch report for ${city}: ${res.statusText}`);
  }
  return res.text();
}

// GET /api/v1/weather/{city}/current - Today's Current Weather & Heat Risk
export async function fetchCurrentWeather(city: string): Promise<CurrentWeatherResponse> {
  const url = `${RENDER_BACKEND_URL}/api/v1/weather/${encodeURIComponent(city)}/current`;
  const res = await fetch(url);
  return handleResponse<CurrentWeatherResponse>(res, `fetchCurrentWeather(${city})`);
}

// GET /api/v1/weather/{city}/forecast - 16-Day Unified Weather Forecast & Heat Risk
export async function fetchUnifiedWeatherForecast(city: string): Promise<CityForecastResponse> {
  const url = `${RENDER_BACKEND_URL}/api/v1/weather/${encodeURIComponent(city)}/forecast`;
  const res = await fetch(url);
  return handleResponse<CityForecastResponse>(res, `fetchUnifiedWeatherForecast(${city})`);
}

// GET /api/v1/weather/{city}/previous?date=YYYY-MM-DD - Previous Day Weather Record
export async function fetchPreviousDayWeather(city: string, date: string): Promise<CurrentWeatherResponse> {
  const url = `${RENDER_BACKEND_URL}/api/v1/weather/${encodeURIComponent(city)}/previous?date=${date}`;
  const res = await fetch(url);
  return handleResponse<CurrentWeatherResponse>(res, `fetchPreviousDayWeather(${city}, ${date})`);
}

// GET /api/v1/history/{city}?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD - Historical Weather Records
export async function fetchHistoryRecords(city: string, startDate?: string, endDate?: string): Promise<HistoryResponse> {
  let url = `${RENDER_BACKEND_URL}/api/v1/history/${encodeURIComponent(city)}`;
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (params.toString()) {
    url += `?${params.toString()}`;
  }
  const res = await fetch(url);
  return handleResponse<HistoryResponse>(res, `fetchHistoryRecords(${city})`);
}

// GET /api/v1/context/india?date=YYYY-MM-DD - Upstream India Sentinel Climate Signals
export async function fetchIndiaSentinelContext(date?: string): Promise<IndiaSentinelContextResponse> {
  let url = `${RENDER_BACKEND_URL}/api/v1/context/india`;
  if (date) {
    url += `?date=${date}`;
  }
  const res = await fetch(url);
  return handleResponse<IndiaSentinelContextResponse>(res, 'fetchIndiaSentinelContext');
}

// Live Updates & Multi-Alert Payload Interfaces

export interface LiveAlertItem {
  id: string;
  city: string;
  alert_type: 'HEAT' | 'RAIN' | 'WIND' | 'HUMIDITY' | 'CORRIDOR';
  severity: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN';
  title: string;
  message: string;
  metric: string;
  date: string;
}

export interface LiveAlertSummary {
  total_active_alerts: number;
  heat_alerts_count: number;
  rain_alerts_count: number;
  wind_alerts_count: number;
  humidity_alerts_count: number;
  corridor_alerts_count: number;
}

export interface LiveCityUpdateItem {
  city: string;
  date: string;
  temp_max_c: number;
  temp_min_c: number;
  precipitation_mm: number;
  rain_probability_pct: number;
  humidity_pct: number;
  wind_speed_kmh: number;
  heat_risk_score: number;
  heat_zone: string;
  primary_driver: string;
}

export interface LiveUpdateResponse {
  status: string;
  timestamp: string;
  base_date: string;
  total_cities_monitored: number;
  filter?: {
    city?: string;
    alert_type?: string;
  };
  summary: LiveAlertSummary;
  alerts: LiveAlertItem[];
  live_city_updates: LiveCityUpdateItem[];
  background_task?: {
    status: string;
    last_synced: string;
    manual_trigger_endpoint: string;
  };
}

// GET /api/v1/weather/live-update - Real-Time Live Weather & Multi-Alert Stream (Heat, Rain, Wind, Humidity, Corridors)
export async function fetchLiveUpdates(city?: string, alertType?: string): Promise<LiveUpdateResponse> {
  const params = new URLSearchParams();
  if (city) params.append('city', city);
  if (alertType) params.append('alert_type', alertType);
  const queryString = params.toString() ? `?${params.toString()}` : '';
  const url = `${RENDER_BACKEND_URL}/api/v1/weather/live-update${queryString}`;
  const res = await fetch(url);
  return handleResponse<LiveUpdateResponse>(res, 'fetchLiveUpdates');
}

// POST /api/v1/weather/live-update - Trigger manual live data refresh in background
export async function triggerLiveUpdate(): Promise<{ status: string; timestamp: string; message: string }> {
  const url = `${RENDER_BACKEND_URL}/api/v1/weather/live-update`;
  const res = await fetch(url, { method: 'POST' });
  return handleResponse<{ status: string; timestamp: string; message: string }>(res, 'triggerLiveUpdate');
}

