import { 
  FALLBACK_CITIES, 
  getFallbackOverview, 
  getFallbackHeatPrediction, 
  getFallbackWeather, 
  getFallbackRecommendations, 
  getFallbackCityDataset 
} from "./fallback-data";

export type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
};

export type ErrorType<T = unknown> = ApiError<T>;

export type BodyType<T> = T;

const NO_BODY_STATUS = new Set([204, 205, 304]);
const DEFAULT_JSON_ACCEPT = "application/json, application/problem+json";

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

function resolveMethod(input: RequestInfo | URL, explicitMethod?: string): string {
  if (explicitMethod) return explicitMethod.toUpperCase();
  if (isRequest(input)) return input.method.toUpperCase();
  return "GET";
}

function isUrl(input: RequestInfo | URL): input is URL {
  return typeof URL !== "undefined" && input instanceof URL;
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (isUrl(input)) return input.toString();
  return input.url;
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();

  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function getMediaType(headers: Headers): string | null {
  const value = headers.get("content-type");
  return value ? value.split(";", 1)[0].trim().toLowerCase() : null;
}

function isJsonMediaType(mediaType: string | null): boolean {
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

function isTextMediaType(mediaType: string | null): boolean {
  return Boolean(
    mediaType &&
      (mediaType.startsWith("text/") ||
        mediaType === "application/xml" ||
        mediaType === "text/xml" ||
        mediaType.endsWith("+xml") ||
        mediaType === "application/x-www-form-urlencoded"),
  );
}

function hasNoBody(response: Response, method: string): boolean {
  if (method === "HEAD") return true;
  if (NO_BODY_STATUS.has(response.status)) return true;
  if (response.headers.get("content-length") === "0") return true;
  if (response.body == null) return true;
  return false;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function getStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate !== "string") return undefined;

  const trimmed = candidate.trim();
  return trimmed === "" ? undefined : trimmed;
}

function truncate(text: string, maxLength = 300): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildErrorMessage(response: Response, data: unknown): string {
  const prefix = `HTTP ${response.status} ${response.statusText}`;

  if (typeof data === "string") {
    const text = data.trim();
    return text ? `${prefix}: ${truncate(text)}` : prefix;
  }

  const title = getStringField(data, "title");
  const detail = getStringField(data, "detail");
  const message =
    getStringField(data, "message") ??
    getStringField(data, "error_description") ??
    getStringField(data, "error");

  if (title && detail) return `${prefix}: ${title} — ${detail}`;
  if (detail) return `${prefix}: ${detail}`;
  if (message) return `${prefix}: ${message}`;
  if (title) return `${prefix}: ${title}`;

  return prefix;
}

export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;

  constructor(
    response: Response,
    data: T | null,
    requestInfo: { method: string; url: string },
  ) {
    super(buildErrorMessage(response, data));
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
  }
}

export class ResponseParseError extends Error {
  readonly name = "ResponseParseError";
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;
  readonly rawBody: string;
  readonly cause: unknown;

  constructor(
    response: Response,
    rawBody: string,
    cause: unknown,
    requestInfo: { method: string; url: string },
  ) {
    super(
      `Failed to parse response from ${requestInfo.method} ${response.url || requestInfo.url} ` +
        `(${response.status} ${response.statusText}) as JSON`,
    );
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
    this.rawBody = rawBody;
    this.cause = cause;
  }
}

async function parseJsonBody(
  response: Response,
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  const raw = await response.text();
  const normalized = stripBom(raw);

  if (normalized.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(normalized);
  } catch (cause) {
    throw new ResponseParseError(response, raw, cause, requestInfo);
  }
}

async function parseErrorBody(response: Response, method: string): Promise<unknown> {
  if (hasNoBody(response, method)) {
    return null;
  }

  const mediaType = getMediaType(response.headers);

  if (mediaType && !isJsonMediaType(mediaType) && !isTextMediaType(mediaType)) {
    return typeof response.blob === "function" ? response.blob() : response.text();
  }

  const raw = await response.text();
  const normalized = stripBom(raw);
  const trimmed = normalized.trim();

  if (trimmed === "") {
    return null;
  }

  if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
    try {
      return JSON.parse(normalized);
    } catch {
      return raw;
    }
  }

  return raw;
}

function inferResponseType(response: Response): "json" | "text" | "blob" {
  const mediaType = getMediaType(response.headers);

  if (isJsonMediaType(mediaType)) return "json";
  if (isTextMediaType(mediaType) || mediaType == null) return "text";
  return "blob";
}

async function parseSuccessBody(
  response: Response,
  responseType: "json" | "text" | "blob" | "auto",
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  if (hasNoBody(response, requestInfo.method)) {
    return null;
  }

  const effectiveType =
    responseType === "auto" ? inferResponseType(response) : responseType;

  switch (effectiveType) {
    case "json":
      return parseJsonBody(response, requestInfo);

    case "text": {
      const text = await response.text();
      return text === "" ? null : text;
    }

    case "blob":
      if (typeof response.blob !== "function") {
        throw new TypeError(
          "Blob responses are not supported in this runtime. " +
            "Use responseType \"json\" or \"text\" instead.",
        );
      }
      return response.blob();
  }
}

// Helper function to dispatch backend waking event
function notifyBackendWaking(message?: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("heatzone:backend-waking", {
        detail: { message: message || "Backend server is waking up on Render..." }
      })
    );
  }
}

// Helper function to dispatch backend active event (dismiss overlay immediately)
function notifyBackendActive() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("heatzone:backend-active"));
  }
}

// Fallback resolver for missing endpoints
function handleFallback(urlStr: string): any {
  if (urlStr.includes("/api/cities/")) {
    const match = urlStr.match(/\/api\/cities\/(\d+)/);
    const id = match ? parseInt(match[1]) : 1;
    return FALLBACK_CITIES.find(c => c.id === id) || FALLBACK_CITIES[0];
  }

  if (urlStr.includes("/api/cities")) {
    try {
      localStorage.setItem('heatzone_cities', JSON.stringify(FALLBACK_CITIES));
    } catch (e) {}
    return FALLBACK_CITIES;
  }

  if (urlStr.includes("/api/datasets/overview")) {
    return getFallbackOverview();
  }

  if (urlStr.includes("/api/heatzone/all")) {
    return FALLBACK_CITIES.map(getFallbackHeatPrediction);
  }

  if (urlStr.includes("/api/heatzone/predict/")) {
    const match = urlStr.match(/\/api\/heatzone\/predict\/(\d+)/);
    const id = match ? parseInt(match[1]) : 1;
    const city = FALLBACK_CITIES.find(c => c.id === id) || FALLBACK_CITIES[0];
    return getFallbackHeatPrediction(city);
  }

  if (urlStr.includes("/api/weather/current/")) {
    const match = urlStr.match(/\/api\/weather\/current\/(\d+)/);
    const id = match ? parseInt(match[1]) : 1;
    const city = FALLBACK_CITIES.find(c => c.id === id) || FALLBACK_CITIES[0];
    return getFallbackWeather(city);
  }

  if (urlStr.includes("/api/recommendations/")) {
    const match = urlStr.match(/\/api\/recommendations\/(\d+)/);
    const id = match ? parseInt(match[1]) : 1;
    return getFallbackRecommendations(id);
  }

  if (urlStr.includes("/api/datasets/city/")) {
    const match = urlStr.match(/\/api\/datasets\/city\/(\d+)/);
    const id = match ? parseInt(match[1]) : 1;
    return getFallbackCityDataset(id);
  }

  if (urlStr.includes("/api/weather/history/") || urlStr.includes("/api/heatzone/history/")) {
    const match = urlStr.match(/\/(?:weather|heatzone)\/history\/(\d+)/);
    const id = match ? parseInt(match[1]) : 1;
    return getFallbackCityDataset(id).heatHistory;
  }

  return null;
}

export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  const { responseType = "auto", headers: headersInit, ...init } = options;
  const method = resolveMethod(input, init.method);
  const urlStr = resolveUrl(input);

  if (init.body != null && (method === "GET" || method === "HEAD")) {
    throw new TypeError(`customFetch: ${method} requests cannot have a body.`);
  }

  const headers = mergeHeaders(isRequest(input) ? input.headers : undefined, headersInit);

  if (
    typeof init.body === "string" &&
    !headers.has("content-type") &&
    looksLikeJson(init.body)
  ) {
    headers.set("content-type", "application/json");
  }

  if (responseType === "json" && !headers.has("accept")) {
    headers.set("accept", DEFAULT_JSON_ACCEPT);
  }

  const requestInfo = { method, url: urlStr };
  let fetchUrl: RequestInfo | URL = input;

  // Ensure cities are cached with accurate coordinates
  try {
    localStorage.setItem('heatzone_cities', JSON.stringify(FALLBACK_CITIES));
  } catch (e) {}

  const backendHost = (import.meta.env.VITE_API_BASE_URL || 'https://heatzone-backend.onrender.com').replace(/\/+$/, '');
  const RENDER_BASE = `${backendHost}/api/v1`;

  // Dynamic Route Interceptor for FastAPI Backend
  if (typeof input === 'string') {
    const citiesRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('heatzone_cities') : null;
    const cities = citiesRaw ? JSON.parse(citiesRaw) : FALLBACK_CITIES;

    const getCityName = (idStr: string) => {
      const id = parseInt(idStr);
      const city = cities.find((c: any) => c.id === id);
      return city ? city.name : "Lucknow";
    };

    // 1. Intercept /api/datasets/overview -> /api/v1/live-update
    if (input.includes("/api/datasets/overview")) {
      fetchUrl = `${RENDER_BASE}/live-update`;
    }
    // 2. Intercept /api/heatzone/all -> /api/v1/live-update
    else if (input.includes("/api/heatzone/all")) {
      fetchUrl = `${RENDER_BASE}/live-update`;
    }
    // 3. Intercept /api/cities
    else if (input.endsWith("/api/cities") || input.includes("/api/cities?")) {
      fetchUrl = `${RENDER_BASE}/live-update`;
    }
    // 4. Intercept /api/weather/current/{id} or /api/heatzone/predict/{id}
    else {
      const currentMatch = input.match(/\/api\/weather\/current\/(\d+)/);
      const heatMatch = input.match(/\/api\/heatzone\/predict\/(\d+)/);
      if (currentMatch) {
        fetchUrl = `${RENDER_BASE}/weather/${getCityName(currentMatch[1])}/current`;
      } else if (heatMatch) {
        fetchUrl = `${RENDER_BASE}/weather/${getCityName(heatMatch[1])}/current`;
      } else {
        const histMatch = input.match(/\/api\/weather\/history\/(\d+)/);
        const heatHistMatch = input.match(/\/api\/heatzone\/history\/(\d+)/);
        if (histMatch) {
          fetchUrl = `${RENDER_BASE}/weather/${getCityName(histMatch[1])}/forecast`;
        } else if (heatHistMatch) {
          fetchUrl = `${RENDER_BASE}/weather/${getCityName(heatHistMatch[1])}/forecast`;
        } else if (input.includes("/api/datasets/city/")) {
          const match = input.match(/\/api\/datasets\/city\/(\d+)/);
          const cityId = match ? match[1] : "1";
          fetchUrl = `${RENDER_BASE}/weather/${getCityName(cityId)}/forecast`;
        }
      }
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s request timeout

    const response = await fetch(fetchUrl, { 
      ...init, 
      method, 
      headers,
      signal: init.signal || controller.signal
    }).catch((err) => {
      notifyBackendWaking("Backend server is unreachable or waking up on Render...");
      throw err;
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      notifyBackendActive();
    } else {
      notifyBackendWaking("Connecting to Render backend server...");
      const fallback = handleFallback(urlStr);
      if (fallback !== null) {
        return fallback as T;
      }
      const errorData = await parseErrorBody(response, method);
      throw new ApiError(response, errorData, requestInfo);
    }

    let rawData = (await parseSuccessBody(response, responseType, requestInfo)) as any;

    // Response Adapters to map FastAPI live responses to frontend model types
    if (typeof input === 'string') {
      // 1. Overview Adapter
      if (input.includes("/api/datasets/overview") && rawData) {
        const updates = rawData.live_city_updates || [];
        if (Array.isArray(updates) && updates.length > 0) {
          const totalCities = updates.length;
          const avgHeatRisk = updates.reduce((sum: number, c: any) => sum + (c.heat_risk_score || 0), 0) / totalCities;
          const extremeHeatCities = updates.filter((c: any) => (c.heat_zone || "").toLowerCase() === "extreme").length;
          const highHeatCities = updates.filter((c: any) => (c.heat_zone || "").toLowerCase() === "high").length;
          const moderateHeatCities = updates.filter((c: any) => (c.heat_zone || "").toLowerCase() === "moderate").length;
          const coolCities = updates.filter((c: any) => (c.heat_zone || "").toLowerCase() === "low" || (c.heat_zone || "").toLowerCase() === "cool").length;
          const avgTemperature = updates.reduce((sum: number, c: any) => sum + (c.temp_max_c || 0), 0) / totalCities;
          const avgHumidity = updates.reduce((sum: number, c: any) => sum + (c.humidity_pct || 0), 0) / totalCities;

          return {
            id: 1,
            totalCities,
            avgHeatRisk,
            extremeHeatCities,
            highHeatCities,
            moderateHeatCities,
            coolCities,
            avgTemperature,
            avgHumidity,
            avgNDVI: 0.185,
            avgNDBI: 0.542,
            avgEmissionIndex: 7.42,
            avgBuildingHeight: 18.5,
            avgUrbanCanyonIndex: 0.68,
            totalVehicles: 18450000,
            avgConfidenceScore: 0.942,
            lastUpdated: rawData.timestamp || new Date().toISOString()
          } as T;
        }
      }

      // 2. All Heat Predictions Adapter
      if (input.includes("/api/heatzone/all") && rawData) {
        const updates = rawData.live_city_updates || [];
        if (Array.isArray(updates) && updates.length > 0) {
          return updates.map((c: any, index: number) => {
            const rawName = (c.city || c.cityName || "").toString().trim();
            const fc = FALLBACK_CITIES.find(f => f.name.toLowerCase().trim() === rawName.toLowerCase());
            const fallbackPred = fc ? getFallbackHeatPrediction(fc) : null;
            const score = c.heat_risk_score || (fallbackPred ? fallbackPred.heatRiskScore : 50);
            const temp = c.temp_max_c || (fallbackPred ? fallbackPred.temperature : 34);

            // Compute dynamic zone if backend returns uniform or missing zone
            let zone = (c.heat_zone || "").toLowerCase();
            if (!zone || zone === "moderate" || zone === "low") {
              if (score >= 65 || temp >= 39) zone = "extreme";
              else if (score >= 48 || temp >= 35) zone = "high";
              else if (score >= 32 || temp >= 29) zone = "moderate";
              else zone = "cool";
            }

            const rawNdvi = c.ndvi ?? c.NDVI ?? (fallbackPred ? fallbackPred.ndvi : (fc ? fc.ndvi : 0.22));
            const rawNdbi = c.ndbi ?? c.NDBI ?? (fallbackPred ? fallbackPred.ndbi : 0.38);
            const rawNdwi = c.ndwi ?? c.NDWI ?? (fallbackPred ? fallbackPred.ndwi : -0.21);

            const parsedNdvi = Number(rawNdvi);
            const parsedNdbi = Number(rawNdbi);
            const parsedNdwi = Number(rawNdwi);

            return {
              id: index + 1,
              cityId: fc ? fc.id : index + 1,
              cityName: rawName || (fc ? fc.name : `City ${index + 1}`),
              heatRiskScore: score,
              heatZone: zone,
              temperature: temp,
              humidity: c.humidity_pct || (fallbackPred ? fallbackPred.humidity : 50),
              windSpeed: c.wind_speed_kmh || 10,
              precipitation: c.precipitation_mm || 0,
              vehicleDensity: fallbackPred ? fallbackPred.vehicleDensity : 12000,
              populationDensity: fc ? fc.populationDensity : 8500,
              greenCoverRatio: fallbackPred ? fallbackPred.greenCoverRatio : 0.18,
              builtUpRatio: fallbackPred ? fallbackPred.builtUpRatio : 0.55,
              ndvi: isNaN(parsedNdvi) ? 0.22 : parsedNdvi,
              ndbi: isNaN(parsedNdbi) ? 0.38 : parsedNdbi,
              ndwi: isNaN(parsedNdwi) ? -0.21 : parsedNdwi,
              emissionIndex: c.emission_index ?? (fallbackPred ? fallbackPred.emissionIndex : 4.2),
              urbanCanyonIndex: c.urban_canyon_index ?? (fallbackPred ? fallbackPred.urbanCanyonIndex : 0.48),
              industrialHeatFactor: fallbackPred ? fallbackPred.industrialHeatFactor : 0.25,
              avgBuildingHeight: fallbackPred ? fallbackPred.avgBuildingHeight : 14.5,
              confidenceScore: fallbackPred ? fallbackPred.confidenceScore : 0.92,
              primaryRiskDriver: c.primary_driver || (fallbackPred ? fallbackPred.primaryRiskDriver : "Concrete & Built-up Density"),
              riskExplanation: c.causal_explanation || (fallbackPred ? fallbackPred.riskExplanation : "High surface thermal absorption detected due to dense built structures."),
              coolingIndex: 0.25,
              trafficHeatFactor: 900,
              latitude: Number(c.latitude || c.lat) || (fc ? fc.latitude : 26.8467),
              longitude: Number(c.longitude || c.lng || c.lon) || (fc ? fc.longitude : 80.9462),
              predictedAt: (c.date || new Date().toISOString().split("T")[0]) + "T00:00:00Z"
            };
          }) as T;
        }
      }

      // 3. Cities Adapter
      if ((input.endsWith("/api/cities") || input.includes("/api/cities?")) && rawData) {
        const updates = rawData.live_city_updates || [];
        if (Array.isArray(updates) && updates.length > 0) {
          return updates.map((c: any, index: number) => {
            const rawName = (c.city || c.cityName || "").toString().trim();
            const fc = FALLBACK_CITIES.find(f => f.name.toLowerCase().trim() === rawName.toLowerCase());
            return {
              id: fc ? fc.id : index + 1,
              name: rawName || (fc ? fc.name : `City ${index + 1}`),
              state: "Uttar Pradesh",
              latitude: Number(c.latitude || c.lat) || (fc ? fc.latitude : 26.8467),
              longitude: Number(c.longitude || c.lng || c.lon) || (fc ? fc.longitude : 80.9462),
              populationDensity: fc ? fc.populationDensity : 8500,
              areaKm2: 500,
              regionType: "Urban Corridor"
            };
          }) as T;
        }
      }
    }

    if (!rawData || (typeof rawData === "object" && Object.keys(rawData).length === 0) || (Array.isArray(rawData) && rawData.length === 0)) {
      const fallback = handleFallback(urlStr);
      if (fallback !== null) {
        return fallback as T;
      }
    }

    return rawData as T;
  } catch (err: any) {
    notifyBackendWaking("Backend server is waking up on Render...");
    const fallback = handleFallback(urlStr);
    if (fallback !== null) {
      return fallback as T;
    }
    throw err;
  }
}

