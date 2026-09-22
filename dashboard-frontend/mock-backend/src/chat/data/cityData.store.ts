import fs from "fs";
import { ChatConfig } from "../config/chat.config";

class CityDataStore {
  private static instance: CityDataStore;
  
  public cityDataMap = new Map<string, any>();
  public forecastDataMap = new Map<string, any>();
  public dataLoadedAt = 0;
  
  private reloadTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.loadAllDatasets();
    this.startAutoReload();
  }

  public static getInstance(): CityDataStore {
    if (!CityDataStore.instance) {
      CityDataStore.instance = new CityDataStore();
    }
    return CityDataStore.instance;
  }

  private loadAllDatasets() {
    try {
      // Load UP Cities dataset
      if (fs.existsSync(ChatConfig.UP_CITIES_PATH)) {
        const raw = JSON.parse(fs.readFileSync(ChatConfig.UP_CITIES_PATH, "utf-8"));
        const cities = raw.cities || raw;
        for (const city of cities) {
          if (city.name) this.cityDataMap.set(city.name.toLowerCase(), city);
        }
        console.log(`[DataStore] Loaded ${this.cityDataMap.size} cities from up_cities.json`);
      } else {
        console.warn(`[DataStore] up_cities.json not found at ${ChatConfig.UP_CITIES_PATH}`);
      }

      // Load ML Heatscore Forecasts
      if (fs.existsSync(ChatConfig.ML_FORECAST_PATH)) {
        const forecasts = JSON.parse(fs.readFileSync(ChatConfig.ML_FORECAST_PATH, "utf-8"));
        if (Array.isArray(forecasts)) {
          for (const item of forecasts) {
            if (item.city) this.forecastDataMap.set(item.city.toLowerCase(), item);
          }
        }
        console.log(`[DataStore] Loaded ${this.forecastDataMap.size} city forecasts from ML JSON`);
      } else {
        console.warn(`[DataStore] ML forecast file not found at ${ChatConfig.ML_FORECAST_PATH}`);
      }

      this.dataLoadedAt = Date.now();
    } catch (err) {
      console.error("[DataStore] Failed to load datasets:", err);
    }
  }

  private startAutoReload() {
    if (this.reloadTimer) {
      clearInterval(this.reloadTimer);
    }
    this.reloadTimer = setInterval(() => {
      this.loadAllDatasets();
    }, ChatConfig.DATA_RELOAD_INTERVAL);
  }

  public getInstantCityContext(cityName: string): string {
    const key = cityName.toLowerCase();
    const parts: string[] = [];

    const city = this.cityDataMap.get(key);
    if (city) {
      const popM = city.population_2025 ? (city.population_2025 / 1e6).toFixed(2) + "M" : "N/A";
      const vehM = city.total_vehicles ? (city.total_vehicles / 1e6).toFixed(2) + "M" : "N/A";
      const evK = city.electric_vehicles ? (city.electric_vehicles / 1e3).toFixed(0) + "K" : "0";
      parts.push(
        `CITY:${city.name}|Pop:${popM}|Density:${city.population_density}/km²|Area:${city.total_area_sqkm}km²|Elev:${city.elevation_m}m` +
        `|Veh:${vehM}|EV:${evK}|2W:${(city.two_wheelers / 1e3).toFixed(0)}K|4W:${((city.four_wheelers_petrol + city.four_wheelers_diesel) / 1e3).toFixed(0)}K|HeavyComm:${(city.heavy_commercial / 1e3).toFixed(0)}K` +
        `|NDVI:${city.ndvi_mean}|NDBI:${city.ndbi_mean}|NDWI:${city.ndwi_mean}` +
        `|Forest:${city.forest_cover_pct}%|GreenSpace:${city.urban_green_space_pct}%|TreeDensity:${city.tree_density_per_sqkm}/km²` +
        `|BuiltUp:${city.built_up_area_sqkm}km²|Industrial:${city.industrial_area_sqkm}km²|Water:${city.water_bodies_area_sqkm}km²` +
        `|BldgHeight:${city.avg_building_height_m}m|CanyonIdx:${city.urban_canyon_index}|IndustrialHeat:${city.industrial_heat_factor}|ACExhaust:${city.ac_thermal_exhaust_index}`
      );
    }

    const forecast = this.forecastDataMap.get(key);
    if (forecast?.forecast) {
      const days = forecast.forecast.slice(0, 16);
      const dayStrs = days.map((d: any) => {
        const dateShort = d.date.slice(5);
        const hr = d.heat_risk_score ? Math.round(d.heat_risk_score) : "?";
        return `${dateShort}:${d.Temp_Max_C?.toFixed(0)}/${d.Temp_Min_C?.toFixed(0)}°C,H${(d.Humidity_Mean_pct ?? 0).toFixed(0)}%,W${(d.Wind_Speed_Max_kmh ?? 0).toFixed(0)}km/h,R${(d.Precipitation_mm ?? 0).toFixed(1)}mm,HR${hr}(${d.heat_zone || '?'})`;
      });
      parts.push(`FORECAST:${cityName}|BaseDate:${forecast.base_date}|${dayStrs.join("|")}`);

      const firstDay = days[0];
      if (firstDay?.primary_driver) {
        parts.push(`HEAT_DRIVER:${firstDay.primary_driver}|${firstDay.causal_explanation || ''}`);
      }
    }

    return parts.join("\n");
  }

  public getAllCitiesSummary(): string {
    const summaries: string[] = [];
    for (const [, city] of this.cityDataMap) {
      const forecast = this.forecastDataMap.get(city.name.toLowerCase());
      const todayForecast = forecast?.forecast?.[0];
      const hr = todayForecast?.heat_risk_score ? Math.round(todayForecast.heat_risk_score) : "?";
      const zone = todayForecast?.heat_zone || "?";
      const temp = todayForecast?.Temp_Max_C ? todayForecast.Temp_Max_C.toFixed(0) : "?";
      summaries.push(`${city.name}:${temp}°C,HR${hr}(${zone}),Pop${(city.population_2025 / 1e6).toFixed(1)}M,Veh${(city.total_vehicles / 1e6).toFixed(1)}M`);
    }
    return `ALL_CITIES_SNAPSHOT:\n${summaries.join("\n")}`;
  }
}

export const dataStore = CityDataStore.getInstance();
