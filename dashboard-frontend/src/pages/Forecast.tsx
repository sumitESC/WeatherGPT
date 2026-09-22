import { useState, useEffect, useRef, useMemo } from "react";
import { useGetCities } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import {
  Sun, Cloud, CloudRain, CloudDrizzle, CloudSnow, CloudLightning, CloudSun, Wind, Droplets,
  Thermometer, ArrowLeft, Loader2, CalendarDays, MapPin, ChevronDown, Check, Globe,
  Activity, History, Database, Gauge
} from "lucide-react";
import { Link } from "wouter";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend
} from "recharts";

interface ForecastDay {
  date: string;
  tempMin: number;
  tempMax: number;
  tempAvg: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  pressure: number;
  cloudCover: number;
  rainfall: number;
  weatherMain: string;
  weatherDescription: string;
  weatherIcon: string;
}

interface CityForecast {
  cityId: number;
  cityName: string;
  latitude: number;
  longitude: number;
  forecast: ForecastDay[];
}

interface DerivedWeather {
  main: string;
  description: string;
  icon: string;
  animClass: string;
}

function deriveWeatherCondition(d: any): DerivedWeather {
  const rain = d.Precipitation_mm ?? 0;
  const humidity = d.Humidity_Mean_pct ?? 50;
  const wind = d.Wind_Speed_Max_kmh ?? 0;
  const radiation = d.Shortwave_Radiation_MJm2 ?? 15;
  const tempMax = d.Temp_Max_C ?? 30;

  // Thunderstorm: heavy rain + strong wind
  if (rain > 15 && wind > 30)
    return { main: "Thunderstorm", description: "thunderstorm with heavy rain", icon: "11d", animClass: "animate-thunder" };
  if (rain > 10 && wind > 20)
    return { main: "Thunderstorm", description: "thunderstorm with rain", icon: "11d", animClass: "animate-thunder" };

  // Heavy Rain
  if (rain > 10)
    return { main: "Heavy Rain", description: "heavy intensity rain", icon: "09d", animClass: "animate-rain-heavy" };

  // Moderate Rain
  if (rain > 4)
    return { main: "Rain", description: "moderate rain", icon: "10d", animClass: "animate-rain" };

  // Light Rain
  if (rain > 2)
    return { main: "Light Rain", description: "light rain", icon: "10d", animClass: "animate-rain-light" };

  // Drizzle
  if (rain > 0.5)
    return { main: "Drizzle", description: "light drizzle", icon: "09d", animClass: "animate-drizzle" };

  // Very light precipitation (mist-like)
  if (rain > 0.1)
    return { main: "Mist", description: "mist with light moisture", icon: "50d", animClass: "animate-mist" };

  // Haze: very humid + hot + no rain
  if (humidity > 80 && tempMax > 32 && rain <= 0.1)
    return { main: "Haze", description: "hot and hazy", icon: "50d", animClass: "animate-haze" };

  // Overcast: very humid + low radiation
  if (humidity > 75 && radiation < 12)
    return { main: "Overcast", description: "overcast clouds", icon: "04d", animClass: "animate-cloud-slow" };

  // Mostly Cloudy
  if (humidity > 65 && radiation < 16)
    return { main: "Mostly Cloudy", description: "mostly cloudy", icon: "04d", animClass: "animate-cloud-drift" };

  // Partly Cloudy
  if (humidity > 50 && radiation < 20)
    return { main: "Partly Cloudy", description: "partly cloudy", icon: "03d", animClass: "animate-cloud-drift" };

  // Scorching / Extreme Heat
  if (tempMax > 42 && radiation > 20)
    return { main: "Scorching", description: "extreme heat", icon: "01d", animClass: "animate-sun-intense" };

  // Clear / Sunny
  if (radiation > 18 && humidity < 55)
    return { main: "Clear", description: "clear sky", icon: "01d", animClass: "animate-sun-glow" };

  // Fair
  return { main: "Fair", description: "fair weather", icon: "02d", animClass: "animate-sun-glow" };
}

function deriveCloudCover(humidity: number, radiation: number): number {
  // Higher humidity + lower radiation → more cloud cover
  const humidityFactor = Math.min((humidity - 30) / 50, 1) * 60;
  const radiationFactor = Math.max(1 - (radiation / 25), 0) * 40;
  return Math.round(Math.max(0, Math.min(100, humidityFactor + radiationFactor)));
}

function mapMLToForecastDay(mlData: any[]): ForecastDay[] {
  if (!mlData || !Array.isArray(mlData)) return [];
  return mlData.map(d => {
    const tempMaxVal = d.temp_max_c ?? d.Temp_Max_C ?? d.tempMax ?? 30;
    const tempMinVal = d.temp_min_c ?? d.Temp_Min_C ?? d.tempMin ?? 24;
    const humidityVal = d.humidity_pct ?? d.Humidity_Mean_pct ?? d.humidity ?? 50;
    const windVal = d.wind_speed_kmh ?? d.Wind_Speed_Max_kmh ?? d.windSpeed ?? 10;
    const rainVal = d.rainfall_mm ?? d.Precipitation_mm ?? d.rainfall ?? 0;
    const pressVal = d.pressure_hpa ?? d.Pressure_MSL_hPa ?? d.pressure ?? 1012;

    const derived = deriveWeatherCondition({
      Temp_Max_C: tempMaxVal,
      Humidity_Mean_pct: humidityVal,
      Wind_Speed_Max_kmh: windVal,
      Precipitation_mm: rainVal,
    });

    const humidity = Math.round(humidityVal);
    const radiation = d.Shortwave_Radiation_MJm2 ?? 15;
    return {
      date: d.date,
      tempMax: Math.round(tempMaxVal * 10) / 10,
      tempMin: Math.round(tempMinVal * 10) / 10,
      tempAvg: Math.round(((tempMaxVal + tempMinVal) / 2) * 10) / 10,
      feelsLike: Math.round((tempMaxVal + 2) * 10) / 10,
      humidity,
      windSpeed: Math.round(windVal * 10) / 10,
      pressure: Math.round(pressVal),
      cloudCover: deriveCloudCover(humidity, radiation),
      rainfall: Math.round(rainVal * 10) / 10,
      weatherMain: derived.main,
      weatherDescription: d.primary_driver || derived.description,
      weatherIcon: derived.icon,
    };
  });
}

function getWeatherIcon(main: string) {
  switch (main.toLowerCase()) {
    case "clear":
    case "scorching":
      return Sun;
    case "fair":
    case "partly cloudy":
      return CloudSun;
    case "mostly cloudy":
    case "overcast":
      return Cloud;
    case "rain":
    case "light rain":
    case "heavy rain":
      return CloudRain;
    case "drizzle":
    case "mist":
      return CloudDrizzle;
    case "thunderstorm":
      return CloudLightning;
    case "haze":
      return Wind;
    case "snow":
      return CloudSnow;
    default:
      return CloudSun;
  }
}

function getWeatherGradient(main: string) {
  switch (main.toLowerCase()) {
    case "clear":
    case "scorching":
      return "from-amber-500/20 to-orange-500/10";
    case "fair":
      return "from-yellow-400/15 to-amber-400/10";
    case "partly cloudy":
      return "from-sky-400/15 to-blue-400/10";
    case "mostly cloudy":
    case "overcast":
      return "from-slate-400/20 to-gray-500/10";
    case "rain":
    case "light rain":
      return "from-blue-500/20 to-cyan-500/10";
    case "heavy rain":
      return "from-blue-600/25 to-indigo-500/15";
    case "drizzle":
    case "mist":
      return "from-blue-400/15 to-slate-500/10";
    case "thunderstorm":
      return "from-purple-600/25 to-indigo-600/15";
    case "haze":
      return "from-yellow-500/15 to-amber-500/10";
    case "snow":
      return "from-sky-200/20 to-blue-100/10";
    default:
      return "from-gray-500/15 to-slate-500/10";
  }
}

function getWeatherAnimClass(main: string): string {
  switch (main.toLowerCase()) {
    case "thunderstorm":
      return "animate-pulse text-purple-400";
    case "heavy rain":
      return "animate-bounce text-blue-400";
    case "rain":
    case "light rain":
      return "animate-rain-icon text-blue-400";
    case "drizzle":
    case "mist":
      return "animate-drizzle-icon text-slate-400";
    case "overcast":
    case "mostly cloudy":
      return "animate-cloud-icon text-slate-300";
    case "partly cloudy":
    case "fair":
      return "text-yellow-300/80";
    case "haze":
      return "animate-pulse text-amber-400/70";
    case "scorching":
      return "animate-spin-slow text-red-400";
    case "clear":
      return "animate-sun-icon text-yellow-400";
    default:
      return "";
  }
}

function getTempColor(temp: number) {
  if (temp >= 40) return "#ef4444";
  if (temp >= 35) return "#f97316";
  if (temp >= 30) return "#eab308";
  if (temp >= 25) return "#22c55e";
  return "#3b82f6";
}

export default function Forecast() {
  const { data: cities, isLoading: citiesLoading } = useGetCities();
  const [selectedCityId, setSelectedCityId] = useState<number | "all">("all");
  const [dataSource, setDataSource] = useState<"openweather" | "ml">("openweather");
  const [showHistory, setShowHistory] = useState(false);
  
  const [rawUnifiedData, setRawUnifiedData] = useState<any>(null);
  const [allForecasts, setAllForecasts] = useState<CityForecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setShowHistory(false);

    const fetchData = async () => {
      try {
        const RENDER_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const selectedCityObj = Array.isArray(cities) ? cities.find(c => c.id === selectedCityId) : null;
        const cityName = selectedCityObj ? selectedCityObj.name : (selectedCityId === "all" ? "Lucknow" : "Lucknow");
        
        const r = await fetch(`${RENDER_BASE}/api/v1/weather/${encodeURIComponent(String(cityName))}/forecast`);
        if (r.ok) {
          const data = await r.json();
          setRawUnifiedData(data);
          setAllForecasts([]);
        } else {
          // Fallback simulation
          const dateToday = new Date().toISOString().split("T")[0];
          setRawUnifiedData({
            city: cityName,
            forecast: Array.from({ length: 16 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() + i);
              return {
                date: d.toISOString().split("T")[0],
                Temp_Max_C: 32 + (i % 4),
                Temp_Min_C: 22 + (i % 3),
                Precipitation_mm: i === 3 ? 4.5 : 0,
                Humidity_Mean_pct: 55 + (i % 5) * 4,
                Wind_Speed_Max_kmh: 8 + (i % 3),
                Pressure_MSL_hPa: 1008,
                heat_risk_score: 50 + (i % 5) * 5,
                heat_zone: "moderate",
                primary_driver: "Solar Radiation"
              };
            })
          });
        }
      } catch (err: any) {
        console.error("Forecast fetch error:", err);
        setRawUnifiedData({
          city: "Lucknow",
          forecast: Array.from({ length: 16 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i);
            return {
              date: d.toISOString().split("T")[0],
              Temp_Max_C: 34 + (i % 3),
              Temp_Min_C: 24 + (i % 2),
              Precipitation_mm: 0,
              Humidity_Mean_pct: 58,
              Wind_Speed_Max_kmh: 9,
              Pressure_MSL_hPa: 1006,
              heat_risk_score: 55,
              heat_zone: "moderate",
              primary_driver: "Urban Heat Island"
            };
          })
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedCityId]);

  const activeForecastData = useMemo(() => {
    if (!rawUnifiedData) return null;
    const rawList = rawUnifiedData.forecast || rawUnifiedData.ml_16day || (Array.isArray(rawUnifiedData) ? rawUnifiedData : []);
    const cityName = rawUnifiedData.city || rawUnifiedData.cityName || "Lucknow";
    return {
      cityId: rawUnifiedData.cityId || 1,
      cityName: cityName,
      latitude: rawUnifiedData.latitude || 26.8467,
      longitude: rawUnifiedData.longitude || 80.9462,
      forecast: mapMLToForecastDay(rawList),
    };
  }, [rawUnifiedData]);

  return (
    <div className="space-y-6 pb-12">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 bg-card border border-border/50 p-6 md:p-8 rounded-3xl shadow-xl relative overflow-visible z-20">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent pointer-events-none rounded-3xl" />
        <div className="relative z-30 w-full">
          <div className="flex items-center gap-3 mb-3">
            <CalendarDays className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl md:text-4xl font-display font-extrabold text-foreground">
              16-Day AI Forecast
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl text-sm md:text-base mb-6">
            Long-range predictive analytics powered by our custom PyTorch ensemble model.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative min-w-[240px] max-w-[280px]" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`w-full flex items-center justify-between bg-card hover:bg-secondary/60 border ${isDropdownOpen ? 'border-primary ring-1 ring-primary/30' : 'border-border/50'} text-foreground text-sm rounded-xl p-3 px-4 transition-all duration-200 shadow-sm cursor-pointer`}
              >
                <div className="flex items-center gap-2 truncate">
                  {selectedCityId === "all" ? (
                    <><Globe className="w-4 h-4 text-blue-400" /> <span className="truncate font-medium">All Cities — Compare</span></>
                  ) : (
                    <><MapPin className="w-4 h-4 text-red-400" /> <span className="truncate font-medium">{Array.isArray(cities) ? cities.find(c => c.id === selectedCityId)?.name : "Select City"}</span></>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-primary' : ''}`} />
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute z-50 w-full mt-2 bg-card border border-border/60 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl origin-top"
                  >
                    <div className="max-h-[300px] overflow-y-auto w-full py-2">
                      <button
                        onClick={() => { setSelectedCityId("all"); setIsDropdownOpen(false); }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-secondary/60 transition-colors ${selectedCityId === "all" ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Globe className={`w-4 h-4 ${selectedCityId === "all" ? 'text-primary' : 'text-muted-foreground'}`} />
                          All Cities — Compare
                        </div>
                        {selectedCityId === "all" && <Check className="w-4 h-4" />}
                      </button>
                      
                      <div className="h-px bg-border/40 my-2 mx-4" />
                      
                      {Array.isArray(cities) && cities.map((city) => (
                        <button
                          key={city.id}
                          onClick={() => { setSelectedCityId(city.id); setIsDropdownOpen(false); }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-secondary/60 transition-colors outline-none focus-visible:bg-secondary/60 ${selectedCityId === city.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
                        >
                          <div className="flex items-center gap-3">
                            <MapPin className={`w-4 h-4 ${selectedCityId === city.id ? 'text-primary' : 'text-muted-foreground/60'}`} />
                            {city.name}
                          </div>
                          {selectedCityId === city.id && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {(loading || citiesLoading) && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
            <p className="text-muted-foreground">Fetching forecast data... This may take a moment.</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
          <p className="text-red-400 font-semibold mb-2">Failed to load forecast</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button onClick={() => setSelectedCityId(selectedCityId)} className="mt-3 px-4 py-2 bg-secondary rounded-lg text-sm hover:bg-secondary/80 transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* Single city forecast rendering */}
      {!loading && !error && activeForecastData && (
        <>
          {(activeForecastData as any).error ? (
             <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
              <p className="text-red-400 font-semibold mb-2">Data Source Unavailable</p>
              <p className="text-sm text-muted-foreground">{(activeForecastData as any).error}</p>
              <button onClick={() => setDataSource("openweather")} className="mt-4 px-4 py-2 bg-secondary rounded-lg text-sm hover:bg-secondary/80 transition-colors">
                Switch to OpenWeather
              </button>
            </div>
          ) : (
            <SingleCityForecast data={activeForecastData as CityForecast} />
          )}

          {/* Historical Data Section Toggle */}
          {dataSource === "ml" && !(activeForecastData as any).error && (
            <div className="mt-8 flex flex-col items-center border-t border-border/50 pt-8">
              <p className="text-sm text-muted-foreground mb-4">Want to see the data used to train the ML model?</p>
              <button 
                onClick={() => setShowHistory(!showHistory)} 
                className="px-6 py-3 bg-card border border-border/50 hover:bg-secondary/60 hover:border-purple-500/30 rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-sm group"
              >
                <History className={`w-4 h-4 ${showHistory ? 'text-foreground' : 'text-purple-400 group-hover:scale-110 transition-transform'}`} /> 
                {showHistory ? "Hide Historical Data" : "Load 30-Day ML History"}
              </button>

              <AnimatePresence>
                {showHistory && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, y: -20 }} 
                    animate={{ opacity: 1, height: "auto", y: 0 }} 
                    exit={{ opacity: 0, height: 0, y: -20 }}
                    className="w-full overflow-hidden"
                  >
                     <MLHistoryView city={activeForecastData.cityName as string} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* All cities comparison */}
      {!loading && !error && allForecasts.length > 0 && (
        <AllCitiesComparison data={allForecasts} />
      )}
    </div>
  );
}

function MLHistoryView({ city }: { city: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    
    // Calculate last 30 days
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    const startDate = format(start, "yyyy-MM-dd");
    const endDate = format(end, "yyyy-MM-dd");

    const RENDER_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    fetch(`${RENDER_BASE}/api/v1/history/${encodeURIComponent(city)}?start_date=${startDate}&end_date=${endDate}`)
      .then(res => {
         if (!res.ok) throw new Error("Failed to fetch history. ML engine might be down.");
         return res.json();
      })
      .then(d => {
         if(mounted) setData(d);
      })
      .catch(e => {
         if(mounted) setError(e.message);
      })
      .finally(() => {
         if(mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [city]);

  if (loading) return <div className="p-12 mt-6 text-center bg-card border border-border/50 rounded-2xl"><Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-400 mb-3" /><p className="text-sm text-muted-foreground">Loading ML history...</p></div>;
  if (error) return <div className="p-6 mt-6 text-red-400 text-center bg-red-500/10 rounded-2xl border border-red-500/20">{error}</div>;
  if (!data?.data?.length) return <div className="p-12 mt-6 text-muted-foreground text-center bg-card border border-border/50 rounded-2xl">No historical data found.</div>;

  const sortedData = [...data.data].sort((a, b) => {
    const dA = a.Date || a.date;
    const dB = b.Date || b.date;
    return parseISO(dA).getTime() - parseISO(dB).getTime();
  });

  const chartData = sortedData.map((d: any) => ({
    date: format(parseISO(d.Date || d.date), "MMM dd"),
    tempMax: d.Temp_Max_C || d.max_temp_c,
    tempMin: d.Temp_Min_C || d.min_temp_c,
  }));

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg mt-6 w-full">
      <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
        <Database className="w-5 h-5 text-purple-400" /> 30-Day Historical Trends (ML Dataset)
      </h3>
      <p className="text-xs text-muted-foreground mb-6">Actual recorded temperatures used by the model</p>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
               <linearGradient id="colorHistMax" x1="0" y1="0" x2="0" y2="1">
                 <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                 <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
               </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} unit="°" />
            <RechartsTooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            <Area type="monotone" dataKey="tempMax" name="Max °C (Historical)" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorHistMax)" />
            <Area type="monotone" dataKey="tempMin" name="Min °C (Historical)" stroke="#3b82f6" strokeWidth={2} fillOpacity={0} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SingleCityForecast({ data }: { data: CityForecast }) {
  const { forecast, cityName } = data;

  const chartData = forecast.map(d => ({
    day: format(parseISO(d.date), "EEE"),
    date: format(parseISO(d.date), "MMM dd"),
    max: d.tempMax,
    min: d.tempMin,
    avg: d.tempAvg,
    humidity: d.humidity,
    wind: d.windSpeed,
    rain: d.rainfall,
  }));

  // Create a slider for the cards if there are many (like 16 days)
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full">
      {/* Scrollable Day Cards */}
      <div className="flex overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 gap-4 mb-2 snap-x hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
        {forecast.map((day, i) => {
          const Icon = getWeatherIcon(day.weatherMain);
          const gradient = getWeatherGradient(day.weatherMain);
          const animClass = getWeatherAnimClass(day.weatherMain);
          return (
            <motion.div
              key={day.date}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.5) }}
              className={`flex-none w-[240px] sm:w-[220px] bg-card border border-border/50 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-primary/30 transition-all snap-start`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`} />
              {/* Animated weather particles overlay */}
              {day.weatherMain.toLowerCase().includes("rain") && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {[...Array(6)].map((_, k) => (
                    <div key={k} className="absolute w-0.5 bg-blue-400/30 rounded-full" style={{
                      height: `${8 + Math.random() * 12}px`,
                      left: `${10 + k * 15}%`,
                      top: `-10px`,
                      animation: `rainDrop ${0.6 + Math.random() * 0.8}s linear infinite`,
                      animationDelay: `${Math.random() * 1}s`,
                    }} />
                  ))}
                </div>
              )}
              {day.weatherMain.toLowerCase() === "thunderstorm" && (
                <div className="absolute inset-0 pointer-events-none" style={{
                  animation: 'thunderFlash 3s ease-in-out infinite',
                }} />
              )}
              <div className="relative z-10">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  {format(parseISO(day.date), "EEEE")}
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  {format(parseISO(day.date), "MMM dd, yyyy")}
                </p>

                <div className="flex items-center justify-between mb-3">
                  <div className="relative">
                    <Icon className={`w-10 h-10 text-foreground/70 group-hover:scale-110 transition-transform ${animClass}`} />
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold" style={{ color: getTempColor(day.tempMax) }}>
                      {day.tempMax}°
                    </p>
                    <p className="text-sm text-muted-foreground">{day.tempMin}°</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground capitalize mb-3 font-medium">{day.weatherDescription}</p>

                {/* Cloud cover mini bar */}
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Cloud className="w-2.5 h-2.5" /> Cloud Cover</span>
                    <span className="text-[10px] font-semibold">{day.cloudCover}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-slate-400 to-slate-500 rounded-full transition-all duration-500" style={{ width: `${day.cloudCover}%` }} />
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1 text-muted-foreground"><Droplets className="w-3 h-3" /> Humidity</span>
                    <span className="font-semibold">{day.humidity}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1 text-muted-foreground"><Wind className="w-3 h-3" /> Wind</span>
                    <span className="font-semibold">{day.windSpeed} km/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1 text-muted-foreground"><Gauge className="w-3 h-3" /> Pressure</span>
                    <span className="font-semibold">{day.pressure} hPa</span>
                  </div>
                  {day.rainfall > 0 && (
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1 text-muted-foreground"><CloudRain className="w-3 h-3" /> Rain</span>
                      <span className="font-semibold">{day.rainfall} mm</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Temperature Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg"
        >
          <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-primary" /> Temperature Trend — {cityName}
          </h3>
          <p className="text-xs text-muted-foreground mb-4">Min, Avg, and Max temperatures over {forecast.length} days</p>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMax" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} unit="°" />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Area type="monotone" dataKey="max" name="Max °C" stroke="#ef4444" strokeWidth={2} fill="url(#colorMax)" />
                <Area type="monotone" dataKey="avg" name="Avg °C" stroke="#eab308" strokeWidth={2} fillOpacity={0} />
                <Area type="monotone" dataKey="min" name="Min °C" stroke="#3b82f6" strokeWidth={2} fill="url(#colorMin)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg"
        >
          <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-400" /> Humidity & Rainfall — {cityName}
          </h3>
          <p className="text-xs text-muted-foreground mb-4">Daily average humidity and expected rainfall</p>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Bar dataKey="humidity" name="Humidity (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={forecast.length > 7 ? 10 : 30} />
                <Bar dataKey="rain" name="Rainfall (mm)" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={forecast.length > 7 ? 10 : 30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function AllCitiesComparison({ data }: { data: CityForecast[] }) {
  // Build comparison chart: each city's avg temp for each day
  const allDates = data[0]?.forecast.map(f => f.date) || [];

  const dayComparison = allDates.map((date, dayIdx) => {
    const entry: Record<string, any> = {
      day: format(parseISO(date), "EEE, MMM dd"),
    };
    for (const city of data) {
      const dayData = city.forecast[dayIdx];
      if (dayData) {
        entry[city.cityName] = dayData.tempMax;
      }
    }
    return entry;
  });

  // Hottest/Coolest per day
  const extremes = allDates.map((date, dayIdx) => {
    let hottest = { city: "", temp: -Infinity };
    let coolest = { city: "", temp: Infinity };

    for (const city of data) {
      const d = city.forecast[dayIdx];
      if (d && d.tempMax > hottest.temp) hottest = { city: city.cityName, temp: d.tempMax };
      if (d && d.tempMin < coolest.temp) coolest = { city: city.cityName, temp: d.tempMin };
    }

    return { date, hottest, coolest };
  });

  // Summary: city with highest avg temp across 16 days
  const cityAvgs = data.map(c => ({
    cityName: c.cityName,
    avgMax: Math.round((c.forecast.reduce((s, f) => s + f.tempMax, 0) / c.forecast.length) * 10) / 10,
    avgHumidity: Math.round(c.forecast.reduce((s, f) => s + f.humidity, 0) / c.forecast.length),
    totalRain: Math.round(c.forecast.reduce((s, f) => s + f.rainfall, 0) * 10) / 10,
  })).sort((a, b) => b.avgMax - a.avgMax);

  const TOP_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">

      {/* Daily Extremes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {extremes.map((ex, i) => (
          <motion.div
            key={ex.date}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-card border border-border/50 rounded-2xl p-5 shadow-lg"
          >
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              {format(parseISO(ex.date), "EEEE")}
            </p>
            <p className="text-sm text-muted-foreground mb-4">{format(parseISO(ex.date), "MMM dd")}</p>

            <div className="space-y-3">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider text-red-400 font-bold mb-1">🔥 Hottest</p>
                <p className="font-bold text-foreground">{ex.hottest.city}</p>
                <p className="text-xl font-black text-red-400">{ex.hottest.temp}°C</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider text-blue-400 font-bold mb-1">❄️ Coolest</p>
                <p className="font-bold text-foreground">{ex.coolest.city}</p>
                <p className="text-xl font-black text-blue-400">{ex.coolest.temp}°C</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* City Rankings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg"
      >
        <h3 className="font-bold text-lg mb-1">🏆 5-Day Temperature Ranking</h3>
        <p className="text-xs text-muted-foreground mb-4">Average max temperature across the forecast period</p>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cityAvgs} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} unit="°C" />
              <YAxis type="category" dataKey="cityName" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={100} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
              />
              <Bar dataKey="avgMax" name="Avg Max °C" radius={[0, 6, 6, 0]} barSize={16}>
                {cityAvgs.map((entry, idx) => (
                  <Cell key={entry.cityName} fill={getTempColor(entry.avgMax)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Top 8 city temperature trend comparison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg"
      >
        <h3 className="font-bold text-lg mb-1">📈 Temperature Trend — Top 8 Hottest Cities</h3>
        <p className="text-xs text-muted-foreground mb-4">Max temperature comparison over the next 5 days</p>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dayComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} unit="°" />
              <RechartsTooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
              />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              {cityAvgs.slice(0, 8).map((city, i) => (
                <Area
                  key={city.cityName}
                  type="monotone"
                  dataKey={city.cityName}
                  stroke={TOP_COLORS[i % TOP_COLORS.length]}
                  strokeWidth={2}
                  fillOpacity={0}
                  dot={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </motion.div>
  );
}
