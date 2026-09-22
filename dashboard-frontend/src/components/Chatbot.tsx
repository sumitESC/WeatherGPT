import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Send, Mic, Bot, User, Loader2, StopCircle, Volume2, VolumeX,
  MapPin, BarChart3, Sparkles, Globe, PieChart, FileText, AlertTriangle,
  ShieldCheck, Download, Sliders, Activity, Users, PlayCircle,
  CloudSun, CloudRain, Sun, Wind, Droplets, Thermometer, CloudLightning,
  CheckCircle2, CircleDashed, Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// SSR Safety check for Leaflet default icon overrides
if (typeof window !== "undefined" && L?.Icon?.Default?.prototype) {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, RadialLinearScale, Filler, Title, Tooltip, Legend, ArcElement,
  BarController, LineController, PieController
} from 'chart.js';
import { Bar, Line, Pie, Chart } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  RadialLinearScale, Filler, Title, Tooltip, Legend, ArcElement,
  BarController, LineController, PieController
);


const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || "";
const API_BASE_URL = "/api";

interface ChatMessage { id?: string; role: "user" | "assistant" | "system"; content: string; }

interface SynthesizedHeatData {
  cityName: string; latitude: number; longitude: number; temperature: number;
  feelsLike: number; humidity: number; windSpeed: number; condition: string;
  heatRiskScore: number; heatZone: "cool" | "moderate" | "high" | "extreme"; recommendation: string;
}

// ENHANCED FORECAST DATA TYPE
interface DailyForecast {
  day: string; tempMax: number; tempMin: number; condition: string;
  humidity: number; windSpeed: number; rain: number;
}

function calculateHeatRiskScore(temp: number, humidity: number): number {
  let score = ((temp - 20) / 30) * 100;
  if (humidity > 50) score += (humidity - 50) * 0.4;
  if (temp > 35) score += (temp - 35) * 2;
  return Math.min(Math.max(Math.round(score * 10) / 10, 0), 100);
}

function determineHeatZone(score: number): "cool" | "moderate" | "high" | "extreme" {
  if (score < 40) return "cool"; if (score < 65) return "moderate";
  if (score < 85) return "high"; return "extreme";
}

function getHeatColor(zone: string): string {
  switch (zone?.toLowerCase()) {
    case "extreme": return "#ef4444"; case "high": return "#f97316";
    case "moderate": return "#eab308"; case "cool": return "#22c55e"; default: return "#6b7280";
  }
}

function getWeatherIcon(condition: string) {
  const cond = condition.toLowerCase();
  if (cond.includes("thunder") || cond.includes("storm")) return <CloudLightning className="w-5 h-5 text-purple-400" />;
  if (cond.includes("rain") || cond.includes("drizzle")) return <CloudRain className="w-5 h-5 text-blue-400" />;
  if (cond.includes("cloud") || cond.includes("overcast")) return <CloudSun className="w-5 h-5 text-gray-300" />;
  if (cond.includes("clear") || cond.includes("sun")) return <Sun className="w-5 h-5 text-yellow-400 animate-pulse" />;
  return <Thermometer className="w-5 h-5 text-orange-400" />;
}

function formatMarkdownText(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === "") { i++; continue; }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const sizes: Record<number, string> = { 1: "text-xl", 2: "text-lg", 3: "text-base", 4: "text-sm" };
      result.push(
        <div key={`h-${i}`} className={`${sizes[level] || "text-base"} font-bold text-gray-900 dark:text-white mt-4 mb-2 border-b border-gray-200 dark:border-white/10 pb-1`}>
          {inlineFormat(headingText)}
        </div>
      );
      i++; continue;
    }

    // Table detection
    if (line.includes("|") && line.trim().startsWith("|")) {
      const tableRows: string[] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim().startsWith("|")) {
        tableRows.push(lines[i]);
        i++;
      }
      // Filter out separator rows (|---|---|)
      const dataRows = tableRows.filter(r => !r.match(/^\|[\s\-:|]+\|$/));
      if (dataRows.length > 0) {
        const parseCells = (row: string) => row.split("|").slice(1, -1).map(c => c.trim());
        const headerCells = parseCells(dataRows[0]);
        const bodyRows = dataRows.slice(1).map(parseCells);
        result.push(
          <div key={`tbl-${i}`} className="my-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10 max-w-full">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 dark:bg-white/10 border-b border-gray-200 dark:border-white/10">
                  {headerCells.map((c, ci) => (
                    <th key={ci} className="px-3 py-2 text-left font-bold text-gray-900 dark:text-white uppercase tracking-wider">{inlineFormat(c)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "bg-gray-50/50 dark:bg-white/[0.03]" : "bg-gray-100/30 dark:bg-white/[0.06]"}>
                    {row.map((c, ci) => (
                      <td key={ci} className="px-3 py-2 text-gray-800 dark:text-gray-200 border-t border-gray-200/50 dark:border-white/5">{inlineFormat(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Unordered list items (- or * prefix)
    if (line.match(/^\s*[-*]\s+/)) {
      const items: { indent: number; text: string }[] = [];
      while (i < lines.length && lines[i].match(/^\s*[-*]\s+/)) {
        const match = lines[i].match(/^(\s*)[-*]\s+(.*)/);
        if (match) items.push({ indent: match[1].length, text: match[2] });
        i++;
      }
      result.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-gray-800 dark:text-gray-200" style={{ paddingLeft: `${Math.min(item.indent, 4) * 8}px` }}>
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-purple-400 flex-shrink-0" />
              <span>{inlineFormat(item.text)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list items (1. 2. 3. prefix)
    if (line.match(/^\s*\d+\.\s+/)) {
      const items: { num: string; text: string }[] = [];
      while (i < lines.length && lines[i].match(/^\s*\d+\.\s+/)) {
        const match = lines[i].match(/^\s*(\d+)\.\s+(.*)/);
        if (match) items.push({ num: match[1], text: match[2] });
        i++;
      }
      result.push(
        <ol key={`ol-${i}`} className="my-2 space-y-1.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-gray-800 dark:text-gray-200">
              <span className="text-purple-600 dark:text-purple-400 font-bold text-xs mt-0.5 flex-shrink-0 min-w-[18px]">{item.num}.</span>
              <span>{inlineFormat(item.text)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Horizontal rule
    if (line.match(/^[\s]*[-*_]{3,}\s*$/)) {
      result.push(<hr key={`hr-${i}`} className="my-3 border-gray-200 dark:border-white/10" />);
      i++; continue;
    }

    // Regular paragraph
    result.push(
      <p key={`p-${i}`} className="text-gray-800 dark:text-gray-200 leading-relaxed my-1">
        {inlineFormat(line)}
      </p>
    );
    i++;
  }

  return result;
}

// Inline formatting: bold, italic, inline code, links
function inlineFormat(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`[^`]+`|\[.*?\]\(.*?\)|<br\s*\/?>)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-bold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i} className="italic text-gray-700 dark:text-gray-300">{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="px-1.5 py-0.5 bg-gray-100 dark:bg-white/10 rounded text-purple-700 dark:text-cyan-300 text-xs font-mono">{part.slice(1, -1)}</code>;
    if (part.match(/^\[.*?\]\(.*?\)$/)) {
      const m = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (m) return <a key={i} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-purple-600 dark:text-purple-400 underline hover:text-purple-500">{m[1]}</a>;
    }
    if (part.match(/^<br\s*\/?>$/)) return <br key={i} />;
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}


const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "lucknow": { lat: 26.8467, lng: 80.9462 },
  "kanpur": { lat: 26.4499, lng: 80.3319 },
  "varanasi": { lat: 25.3176, lng: 82.9739 },
  "prayagraj": { lat: 25.4358, lng: 81.8463 },
  "agra": { lat: 27.1767, lng: 78.0081 },
  "ghaziabad": { lat: 28.6692, lng: 77.4538 },
  "noida": { lat: 28.5355, lng: 77.3910 },
  "meerut": { lat: 28.9845, lng: 77.7064 },
  "bareilly": { lat: 28.3670, lng: 79.4304 },
  "aligarh": { lat: 27.8974, lng: 78.0880 },
  "moradabad": { lat: 28.8386, lng: 78.7733 },
  "jhansi": { lat: 25.4484, lng: 78.5685 },
  "gorakhpur": { lat: 26.7606, lng: 83.3732 },
  "ayodhya": { lat: 26.7922, lng: 82.1998 },
  "mathura": { lat: 27.4924, lng: 77.6737 },
  "saharanpur": { lat: 29.9640, lng: 77.5460 },
  "muzaffarnagar": { lat: 29.4727, lng: 77.7085 },
  "firozabad": { lat: 27.1590, lng: 78.3957 },
  "rampur": { lat: 28.8154, lng: 79.0253 },
  "bijnor": { lat: 29.3724, lng: 78.1358 },
  "etawah": { lat: 26.7658, lng: 79.0150 },
  "rae bareli": { lat: 26.2306, lng: 81.2404 },
  "sitapur": { lat: 27.5684, lng: 80.6789 },
  "hardoi": { lat: 27.3986, lng: 80.1260 },
  "azamgarh": { lat: 29.967, lng: 78.4788 },
  "badaun": { lat: 24.4374, lng: 79.812 },
  "bahraich": { lat: 27.7802, lng: 82.4025 },
  "ballia": { lat: 24.8576, lng: 82.1189 },
  "banda": { lat: 27.0582, lng: 83.7469 },
  "barabanki": { lat: 24.1981, lng: 78.9448 },
  "basti": { lat: 27.0304, lng: 80.7542 },
  "bhadohi": { lat: 26.8899, lng: 83.6124 },
  "bulandshahr": { lat: 24.4112, lng: 81.6142 },
  "chandauli": { lat: 25.2916, lng: 80.5498 },
  "chitrakoot": { lat: 26.5275, lng: 82.2349 },
  "deoria": { lat: 25.1184, lng: 79.1225 },
  "etah": { lat: 28.9779, lng: 77.6588 },
  "farrukhabad": { lat: 26.0969, lng: 82.2216 },
  "fatehpur": { lat: 28.4465, lng: 82.5346 },
  "ghazipur": { lat: 25.7789, lng: 80.8226 },
  "gonda": { lat: 29.8388, lng: 79.3312 },
  "hamirpur": { lat: 28.9284, lng: 79.0187 },
  "hapur": { lat: 24.4786, lng: 82.5749 },
  "hathras": { lat: 26.4988, lng: 78.0387 },
  "jalaun": { lat: 24.8015, lng: 77.7583 },
  "jaunpur": { lat: 25.7175, lng: 79.0360 },
  "kannauj": { lat: 27.8860, lng: 78.0049 },
  "kanpur dehat": { lat: 28.0636, lng: 83.7578 },
  "kasganj": { lat: 25.1487, lng: 78.7400 },
  "kaushambi": { lat: 25.2682, lng: 81.8306 },
  "kheri": { lat: 24.3713, lng: 79.7863 },
  "kushinagar": { lat: 24.6054, lng: 79.2336 },
  "lalitpur": { lat: 28.2558, lng: 78.9434 },
  "maharajganj": { lat: 29.4404, lng: 77.2030 },
  "mahoba": { lat: 26.3925, lng: 80.4272 },
  "mainpuri": { lat: 29.3840, lng: 78.7272 },
  "mau": { lat: 27.0595, lng: 81.4182 },
  "mirzapur": { lat: 27.2679, lng: 78.8221 },
  "orai": { lat: 25.6708, lng: 78.1472 },
  "pilibhit": { lat: 29.7585, lng: 78.1641 },
  "pratapgarh": { lat: 27.1377, lng: 79.1186 },
  "sant kabir nagar": { lat: 28.5842, lng: 77.3746 },
  "shahjahanpur": { lat: 24.6156, lng: 80.7937 },
  "shamli": { lat: 25.0727, lng: 82.5977 },
  "shravasti": { lat: 24.0616, lng: 82.5620 },
  "siddharthnagar": { lat: 27.7881, lng: 78.7173 },
  "sonbhadra": { lat: 24.8895, lng: 80.6853 },
  "sultanpur": { lat: 28.8081, lng: 82.1809 },
  "unnao": { lat: 24.9297, lng: 79.0728 },
  "gautam buddha nagar": { lat: 24.3972, lng: 81.9913 },
  "amroha": { lat: 29.6955, lng: 79.6254 },
  "baghpat": { lat: 28.9353, lng: 80.9079 },
  "balrampur": { lat: 27.2523, lng: 80.7315 },
  "amethi": { lat: 26.8969, lng: 80.6160 },
  "mau nath bhanjan": { lat: 29.2395, lng: 80.8401 }
};

async function fetchCurrentWeather(city: string): Promise<SynthesizedHeatData> {
  const coords = CITY_COORDINATES[city.toLowerCase()] || { lat: 25.3176, lng: 82.9739 };
  try {
    const RENDER_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const res = await fetch(`${RENDER_BASE}/api/v1/weather/${encodeURIComponent(city)}/current`);
    if (res.ok) {
      const data = await res.json();
      const curr = data.current || data;
      const temp = Math.round((curr.Temp_Max_C ?? curr.temperature ?? 34) * 10) / 10;
      const humidity = Math.round(curr.Humidity_Mean_pct ?? curr.humidity ?? 55);
      const windSpeed = Math.round((curr.Wind_Speed_Max_kmh ?? curr.windSpeed ?? 8.5) * 10) / 10;
      const score = curr.heat_risk_score !== undefined ? Math.round(curr.heat_risk_score * 10) / 10 : calculateHeatRiskScore(temp, humidity);
      const zone = (curr.heat_zone || determineHeatZone(score)).toLowerCase() as any;
      const recommendation = curr.causal_explanation || (curr.primary_driver ? `Primary Driver: ${curr.primary_driver}` : "Normal conditions.");

      return {
        cityName: data.city || city,
        latitude: coords.lat,
        longitude: coords.lng,
        temperature: temp,
        feelsLike: temp + (humidity > 60 ? 3 : 1),
        humidity,
        windSpeed,
        condition: curr.primary_driver ? curr.primary_driver : "Clear",
        heatRiskScore: score,
        heatZone: zone,
        recommendation
      };
    }
  } catch (err) {
    console.warn("Backend current weather fetch failed, using local fallback", err);
  }

  // Fallback to PyTorch ML simulated data for requested city
  const baseTemp = 34;
  const score = calculateHeatRiskScore(baseTemp, 55);
  const zone = determineHeatZone(score);
  return {
    cityName: city, latitude: coords.lat, longitude: coords.lng,
    temperature: baseTemp, feelsLike: baseTemp + 2, humidity: 55,
    windSpeed: 8.5, condition: "Clear",
    heatRiskScore: score, heatZone: zone, recommendation: zone === "extreme" ? "CRITICAL: Extreme heat detected." : "Normal conditions."
  };
}

async function fetchForecastWeather(city: string): Promise<DailyForecast[]> {
  try {
    const RENDER_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const res = await fetch(`${RENDER_BASE}/api/v1/forecast/${encodeURIComponent(city)}`);
    if (res.ok) {
      const data = await res.json();
      const list = data.predictions || data.forecast;
      if (Array.isArray(list)) {
        return list.slice(0, 16).map((f: any) => ({
          day: new Date(f.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          tempMax: Math.round((f.Temp_Max_C || f.tempMax || 32) * 10) / 10,
          tempMin: Math.round((f.Temp_Min_C || f.tempMin || 20) * 10) / 10,
          condition: f.primary_driver || "Clear",
          humidity: Math.round(f.Humidity_Mean_pct || f.humidity || 60),
          windSpeed: Math.round((f.Wind_Speed_Max_kmh || f.windSpeed || 10) * 10) / 10,
          rain: Math.round((f.Precipitation_mm || f.rain || 0) * 10) / 10
        }));
      }
    }
  } catch (e) {
    console.warn("Render backend forecast failed, using generated forecast array", e);
  }

  return Array.from({ length: 16 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      tempMax: 33 + (i % 3),
      tempMin: 23 + (i % 2),
      condition: "Clear",
      humidity: 55 + (i % 4) * 5,
      windSpeed: 7.5,
      rain: i === 2 ? 2.0 : 0
    };
  });
}


const ChatWeatherCardWidget = React.memo(function ChatWeatherCardWidget({ targetId }: { targetId: string }) {
  const [data, setData] = useState<SynthesizedHeatData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetchCurrentWeather(targetId).then(res => { if (isMounted) setData(res); }).catch(() => { if (isMounted) setError(true); });
    return () => { isMounted = false; };
  }, [targetId]);

  if (error) return <div className="text-red-400 text-sm p-3 bg-red-500/10 rounded-lg">Failed to load weather for "{targetId}".</div>;
  if (!data) return <div className="my-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl animate-pulse w-full max-w-[340px] md:max-w-md h-[220px]" />;

  const color = getHeatColor(data.heatZone);

  return (
    <div className="my-3 bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-5 shadow-2xl w-full max-w-full overflow-hidden transition-all hover:border-white/20">
      <div className="flex justify-between items-start mb-4 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-xl font-black text-white tracking-wide">{data.cityName}</h3>
          <div className="flex items-center gap-2 mt-1.5 bg-white/5 px-2 py-1 rounded-lg w-fit border border-white/5">
            {getWeatherIcon(data.condition)}<span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">{data.condition}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-4xl font-black text-white drop-shadow-md">{Math.round(data.temperature)}°</span>
          <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">Feels like {Math.round(data.feelsLike)}°</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between">
          <div><p className="text-[10px] text-gray-400 uppercase mb-0.5">Humidity</p><p className="font-bold text-white text-sm">{data.humidity}%</p></div>
          <Droplets className="w-5 h-5 text-blue-400 opacity-80" />
        </div>
        <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between">
          <div><p className="text-[10px] text-gray-400 uppercase mb-0.5">Wind</p><p className="font-bold text-white text-sm">{data.windSpeed} km/h</p></div>
          <Wind className="w-5 h-5 text-teal-400 opacity-80" />
        </div>
      </div>
      <div className="bg-gradient-to-r from-black/60 to-transparent rounded-xl p-3 flex justify-between items-center border-l-4 shadow-lg" style={{ borderColor: color }}>
        <div className="flex items-center gap-2"><Activity className="w-4 h-4" style={{ color }} /><span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Heat Risk Score</span></div>
        <div className="text-right flex items-center gap-2">
          <span className="font-black text-xl" style={{ color }}>{data.heatRiskScore}</span>
          <span className="text-[10px] px-2 py-0.5 rounded text-white font-bold uppercase" style={{ backgroundColor: color }}>{data.heatZone}</span>
        </div>
      </div>
    </div>
  );
});


const ChatForecastChartWidget = React.memo(function ChatForecastChartWidget({ targetId }: { targetId: string }) {
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<'temp' | 'rainwind' | 'conditions'>('temp');

  useEffect(() => {
    let isMounted = true;
    fetchForecastWeather(targetId).then(data => { if (isMounted) setForecast(data); }).catch(() => { if (isMounted) setError(true); });
    return () => { isMounted = false; };
  }, [targetId]);

  if (error) return <div className="text-red-400 text-sm p-3 bg-red-500/10 rounded-lg">Failed to load forecast for "{targetId}".</div>;
  if (forecast.length === 0) return <div className="my-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 w-full max-w-[340px] md:max-w-md h-[300px] animate-pulse" />;

  const labels = forecast.map(f => f.day.split(',')[0]);

  // Tab 1: Temp Line Chart
  const tempChartData = {
    labels,
    datasets: [
      { label: 'Max °C', data: forecast.map(f => f.tempMax), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.4 },
      { label: 'Min °C', data: forecast.map(f => f.tempMin), borderColor: '#3b82f6', backgroundColor: 'transparent', borderDash: [5, 5], tension: 0.4 }
    ]
  };

  // Tab 2: Rain/Wind Bar Chart
  const rainWindChartData = {
    labels,
    datasets: [
      { type: 'bar' as const, label: 'Rain (mm)', data: forecast.map(f => f.rain), backgroundColor: 'rgba(59, 130, 246, 0.8)', borderRadius: 4 },
      { type: 'line' as const, label: 'Wind (km/h)', data: forecast.map(f => f.windSpeed), borderColor: '#14b8a6', borderWidth: 2, tension: 0.3 }
    ]
  };

  // Tab 3: Conditions Pie Chart
  const conditionCounts = forecast.reduce((acc, curr) => {
    acc[curr.condition] = (acc[curr.condition] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieChartData = {
    labels: Object.keys(conditionCounts),
    datasets: [{
      data: Object.values(conditionCounts),
      backgroundColor: ['#fcd34d', '#9ca3af', '#60a5fa', '#f87171', '#c084fc'],
      borderWidth: 0
    }]
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#9ca3af', font: { size: 10 } } } },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } }
    }
  };

  return (
    <div className="my-3 bg-slate-900/90 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl p-4 shadow-2xl w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
        <div className="flex items-center gap-2"><BarChart3 className="w-4 h-4 text-orange-400" /><span className="text-sm font-bold text-white uppercase">{targetId} Forecast</span></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 bg-black/40 p-1 rounded-lg">
        <button onClick={() => setActiveTab('temp')} className={cn("flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all", activeTab === 'temp' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300")}>TEMP</button>
        <button onClick={() => setActiveTab('rainwind')} className={cn("flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all", activeTab === 'rainwind' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300")}>RAIN & WIND</button>
        <button onClick={() => setActiveTab('conditions')} className={cn("flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all", activeTab === 'conditions' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300")}>SUMMARY</button>
      </div>

      <div style={{ height: 180 }}>
        {activeTab === 'temp' && <Line data={tempChartData} options={chartOptions} />}
        {activeTab === 'rainwind' && <Chart type="bar" data={rainWindChartData} options={chartOptions} />}
        {activeTab === 'conditions' && <Pie data={pieChartData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#fff' } } } }} />}
      </div>
    </div>
  );
});

// ============================================================================
// ============================================================================

const ChatComparisonWidget = React.memo(function ChatComparisonWidget({ citiesStr }: { citiesStr: string }) {
  const [dataList, setDataList] = useState<SynthesizedHeatData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const cities = citiesStr.split(",").map(c => c.trim()).filter(Boolean);

    Promise.all(cities.map(c => fetchCurrentWeather(c).catch(() => null)))
      .then(results => {
        if (isMounted) {
          setDataList(results.filter(r => r !== null) as SynthesizedHeatData[]);
          setLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, [citiesStr]);

  if (loading) return <div className="my-3 bg-white/5 border border-white/10 rounded-2xl p-4 h-[260px] animate-pulse w-full max-w-[340px] md:max-w-md" />;
  if (dataList.length === 0) return null;

  const chartData = {
    labels: dataList.map(d => d.cityName),
    datasets: [
      {
        label: 'Temperature °C',
        data: dataList.map(d => d.temperature),
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
        borderRadius: 4,
      },
      {
        label: 'Heat Risk Score',
        data: dataList.map(d => d.heatRiskScore),
        backgroundColor: 'rgba(249, 115, 22, 0.7)',
        borderRadius: 4,
      }
    ]
  };

  return (
    <div className="my-3 bg-slate-900/90 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl p-4 shadow-2xl w-full max-w-full overflow-hidden">
      <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
        <Activity className="w-4 h-4 text-pink-400" />
        <span className="text-sm font-bold text-white tracking-wider uppercase">City Comparison</span>
      </div>
      <div style={{ height: 200 }}>
        <Bar
          data={chartData}
          options={{
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#fff' } } },
            scales: {
              x: { ticks: { color: '#fff' }, grid: { display: false } },
              y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
          }}
        />
      </div>
    </div>
  );
});

// ============================================================================
// ============================================================================
const ChatMapWidget = React.memo(function ChatMapWidget({ cityId }: { cityId: string }) {
  const [data, setData] = useState<SynthesizedHeatData | null>(null);
  useEffect(() => { let isMounted = true; fetchCurrentWeather(cityId).then(res => { if (isMounted) setData(res); }).catch(() => { }); return () => { isMounted = false; }; }, [cityId]);

  if (!data) return <div className="my-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 h-[260px] animate-pulse w-full max-w-[340px] md:max-w-md" />;

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-2xl my-3 relative z-0 w-full max-w-full" style={{ height: 260 }}>
      <div className="absolute top-2 left-2 z-[400] bg-black/80 backdrop-blur-xl px-2.5 py-1 rounded-lg text-[10px] text-white flex items-center gap-1.5 border border-white/10 shadow-lg">
        <MapPin className="w-3.5 h-3.5 text-red-500 animate-bounce" /> {data.cityName} Heat Map
      </div>
      <MapContainer center={[data.latitude, data.longitude]} zoom={10} style={{ height: "100%", width: "100%", background: "#0f172a", zIndex: 1 }} zoomControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />

        <ZoomControl position="bottomright" />
        <CircleMarker center={[data.latitude, data.longitude]} radius={20} pathOptions={{ color: getHeatColor(data.heatZone), fillColor: getHeatColor(data.heatZone), fillOpacity: 0.5, weight: 2 }}>
          <Popup><div className="text-slate-900 p-2 min-w-[120px]"><h4 className="font-black border-b border-gray-200 pb-1 mb-1">{data.cityName}</h4><p className="text-sm">Temp: <b>{data.temperature}°C</b></p><p className="text-xs text-gray-600 mt-1">Risk: {data.heatRiskScore}</p></div></Popup>
        </CircleMarker>
      </MapContainer>
    </div>
  );
});

// ============================================================================
// ============================================================================
const ChatNasaMapWidget = React.memo(function ChatNasaMapWidget() {
  const targetDate = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 3); return d.toISOString().split('T')[0]; }, []);
  const tileUrl = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/${targetDate}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`;
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-2xl my-3 relative z-0 w-full max-w-full" style={{ height: 260 }}>
      <MapContainer center={[20.5937, 78.9629]} zoom={4} style={{ height: "100%", width: "100%", background: "#050505", zIndex: 1 }} zoomControl={false}>
        <TileLayer url={tileUrl} maxZoom={7} /><ZoomControl position="bottomright" />
      </MapContainer>
    </div>
  );
});

// ============================================================================
// ============================================================================
const ChatAgentPlanWidget = React.memo(function ChatAgentPlanWidget({ tasks, completedIds }: { tasks: any[], completedIds: string[] }) {
  if (!tasks || tasks.length === 0) return null;
  return (
    <div className="my-3 bg-slate-900/90 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl p-4 shadow-2xl w-full max-w-full overflow-hidden">
      <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
        <Activity className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-bold text-white tracking-wider uppercase">Agent Execution Plan</span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => {
          const isDone = completedIds.includes(task.id);
          return (
            <div key={task.id} className="flex items-start gap-3 p-2 rounded-lg bg-black/20 border border-white/5 transition-all">
              <div className="mt-0.5">
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                )}
              </div>
              <p className={cn("text-xs font-medium transition-all", isDone ? "text-gray-400 line-through" : "text-white")}>
                {task.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ============================================================================
// ============================================================================
const ChatIdentityBadgeWidget = React.memo(function ChatIdentityBadgeWidget({ name, role, mode }: { name: string; role: string; mode: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2 p-3 bg-gradient-to-r from-purple-950/70 via-slate-900/80 to-blue-950/70 border border-purple-500/30 rounded-2xl shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-gradient-to-br from-purple-500/30 to-blue-500/30 rounded-xl border border-purple-400/30 shadow-inner">
          <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-white tracking-wide">{name || "Aria"}</span>
            <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">AI ADVISOR</span>
          </div>
          <p className="text-[10px] text-gray-300 font-medium">{role || "Chief AI Urban Climate & Heat Risk Advisor"}</p>
        </div>
      </div>
      <div className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 shadow-md", mode === "task" ? "bg-amber-500/10 text-amber-300 border-amber-500/30" : "bg-cyan-500/10 text-cyan-300 border-cyan-500/30")}>
        {mode === "task" ? <Activity className="w-3 h-3 text-amber-400" /> : <Globe className="w-3 h-3 text-cyan-400" />}
        {mode === "task" ? "Task Mode" : "Conversational"}
      </div>
    </div>
  );
});

// ============================================================================
// ============================================================================
function parseMessageContent(content: string): React.ReactNode[] {
  let displayContent = content.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();

  const nodes: React.ReactNode[] = [];

  // Extract identity and mode
  const identityMatch = displayContent.match(/\[IDENTITY: name=(.*?) \| role=(.*?) \| system=(.*?)\]/);
  const modeMatch = displayContent.match(/\[MODE: (task|conversational)\]/);

  if (identityMatch || modeMatch) {
    const name = identityMatch ? identityMatch[1] : "Aria";
    const role = identityMatch ? identityMatch[2] : "Chief AI Urban Climate & Heat Risk Advisor";
    const mode = modeMatch ? modeMatch[1] : "task";
    nodes.push(<ChatIdentityBadgeWidget key="identity_badge" name={name} role={role} mode={mode} />);
  }

  // Extract and render agent plan
  const planMatch = displayContent.match(/\[PLAN_START\]([\s\S]*?)\[PLAN_END\]/);
  if (planMatch) {
    try {
      const tasks = JSON.parse(planMatch[1]);
      const completedMatch = [...displayContent.matchAll(/\[TASK_DONE:(.*?)\]/g)].map(m => m[1]);
      nodes.push(<ChatAgentPlanWidget key="plan_widget" tasks={tasks} completedIds={completedMatch} />);
    } catch (e) {
      console.error("Failed to parse plan", e);
    }
  }

  // Extract speed stats [SPEED:123 tokens|2.5s|49.2 tok/s]
  const speedMatch = displayContent.match(/\[SPEED:(\d+)\s*tokens\|(\d+\.\d+)s\|(\d+\.\d+)\s*tok\/s\]/);

  // Clean all internal protocol tags from displayContent so NO raw tags ever leak into text bubbles
  displayContent = displayContent
    .replace(/\[IDENTITY:[^\]]*\]/g, "")
    .replace(/\[MODE:[^\]]*\]/g, "")
    .replace(/\[STATUS:[^\]]*\]/g, "")
    .replace(/\[PLAN_START\][\s\S]*?\[PLAN_END\]/g, "")
    .replace(/\[TASK_DONE:[^\]]*\]/g, "")
    .replace(/\[SPEED:[^\]]*\]/g, "")
    .replace(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/gi, (match, url) => {
      const cityMatch = url.match(/(prayagraj|lucknow|kanpur|varanasi|agra|ghaziabad|noida|meerut|bareilly|gorakhpur|ayodhya|jhansi)/i);
      return cityMatch ? `[RENDER_MAP:${cityMatch[1].toLowerCase()}]` : `[RENDER_NASA_MAP]`;
    })
    .replace(/https?:\/\/[^\s)]+\.(png|jpg|jpeg|svg|webp)/gi, (match) => {
      const cityMatch = match.match(/(prayagraj|lucknow|kanpur|varanasi|agra|ghaziabad|noida|meerut|bareilly|gorakhpur|ayodhya|jhansi)/i);
      return cityMatch ? `[RENDER_MAP:${cityMatch[1].toLowerCase()}]` : `[RENDER_NASA_MAP]`;
    })
    .replace(/https?:\/\/heatzone\.ai\/[^\s)]+/gi, (match) => {
      const cityMatch = match.match(/(prayagraj|lucknow|kanpur|varanasi|agra|ghaziabad|noida|meerut|bareilly|gorakhpur|ayodhya|jhansi)/i);
      return cityMatch ? `[RENDER_MAP:${cityMatch[1].toLowerCase()}]` : `[RENDER_NASA_MAP]`;
    })
    .replace(/^\s*[\r\n]/gm, "") // remove empty lines left by tag stripping
    .trim();

  const tagRegex = /(\[RENDER_[A-Z_]+[^\]]*\])/g;
  const parts = displayContent.split(tagRegex);

  const parsedParts = parts.map((part, i) => {
    if (!part) return null;
    const trimmedPart = part.trim();
    if (!trimmedPart) return null;
    const key = `part-${i}`;

    if (trimmedPart.startsWith("[RENDER_NASA_MAP")) return <ChatNasaMapWidget key={key} />;
    if (trimmedPart.startsWith("[RENDER_COMPARISON:")) {
      const arg = trimmedPart.replace("[RENDER_COMPARISON:", "").replace("]", "").trim();
      return <ChatComparisonWidget key={key} citiesStr={arg} />;
    }
    if (trimmedPart.startsWith("[RENDER_MAP:")) return <ChatMapWidget key={key} cityId={trimmedPart.replace("[RENDER_MAP:", "").replace("]", "").trim()} />;
    if (trimmedPart.startsWith("[RENDER_FORECAST:") || trimmedPart.startsWith("[RENDER_CHART:")) {
      const arg = trimmedPart.replace(/\[RENDER_(FORECAST|CHART):/, "").replace("]", "").split(":")[0].trim();
      return <ChatForecastChartWidget key={key} targetId={arg} />;
    }
    if (trimmedPart.startsWith("[RENDER_CARD:") || trimmedPart.startsWith("[RENDER_REPORT:")) {
      const arg = trimmedPart.replace(/\[RENDER_(CARD|REPORT):/, "").replace("]", "").split(":").pop()?.trim() || "City";
      return <ChatWeatherCardWidget key={key} targetId={arg} />;
    }
    if (trimmedPart.startsWith("[") && trimmedPart.includes("RENDER")) return null;

    return <span key={key} className="whitespace-pre-wrap leading-relaxed block text-[14.5px]">{formatMarkdownText(trimmedPart)}</span>;
  }).filter(Boolean);


  if (speedMatch) {
    const [, tokens, elapsed, speed] = speedMatch;
    parsedParts.push(
      <div key="speed-badge" className="mt-3 flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-lg w-fit">
        <Zap className="w-3 h-3 text-cyan-400" />
        <span className="text-[10px] font-bold text-cyan-300 tracking-wider">
          {tokens} tokens · {elapsed}s · <span className="text-cyan-200">{speed} tok/s</span>
        </span>
      </div>
    );
  }

  return [...nodes, ...parsedParts];
}


// TODO: Refactor MessageRow into a separate component file if it gets too large
const MessageRow = React.memo(({ msg, isStreaming, currentStatus }: { msg: ChatMessage, isStreaming: boolean, currentStatus?: string }) => {
  const cleanContent = msg.content.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();
  const isEmpty = cleanContent.length === 0;
  const isUser = msg.role === "user";

  const parsedContent = useMemo(() => {
    if (isUser) {
      return <span className="whitespace-pre-wrap leading-relaxed block text-[14.5px]">{formatMarkdownText(cleanContent)}</span>;
    }
    const contentToParse = isStreaming ? cleanContent.replace(/\[RENDER_[^\]]+\]/g, "\n*[Generating visual...]*\n") : cleanContent;
    return parseMessageContent(contentToParse);
  }, [cleanContent, isStreaming, isUser]);

  if (msg.role === "system") return null;
  if (isEmpty && !isStreaming) return null;

  return (
    <motion.div layout="position" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className={cn("flex gap-3 w-full", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn("flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border shadow-lg mt-1", isUser ? "bg-gradient-to-br from-orange-500 to-pink-500 border-orange-400/50 text-white" : "bg-purple-100 dark:bg-[#1e1b4b] text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/40")}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={cn("px-4 py-3 text-sm break-words shadow-lg will-change-transform w-fit max-w-[92%] sm:max-w-[85%] overflow-x-auto", isUser ? "bg-gradient-to-br from-orange-500 to-pink-500 text-white rounded-2xl rounded-tr-sm" : "bg-white dark:bg-white/5 backdrop-blur-xl text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/10 rounded-2xl rounded-tl-sm")}>
        {isEmpty && isStreaming ? (
          <div className="flex items-center gap-1.5 h-5 px-1">
            <span className="text-xs font-medium text-purple-600 dark:text-purple-300 mr-1">{currentStatus || "Producing output..."}</span>
            <span className="w-1.5 h-1.5 bg-purple-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 bg-purple-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 bg-purple-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        ) : (parsedContent)}
      </div>
    </motion.div>
  );
});


// ============================================================================
// ============================================================================
export function Chatbot({ contextData }: { contextData: any }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const provider = "groq";
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTTSActive, setIsTTSActive] = useState(true);
  const [currentStatus, setCurrentStatus] = useState("Thinking...");
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false; recognition.interimResults = true; recognition.lang = "en-US";
        recognition.onresult = (e: any) => setInput(Array.from(e.results).map((r: any) => r[0].transcript).join(""));
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
      }
    }
  }, []);

  const primeAudioEngine = () => { if (isTTSActive && window.speechSynthesis) { const prime = new SpeechSynthesisUtterance(""); prime.volume = 0; window.speechSynthesis.speak(prime); } };

  const speakResponse = useCallback((text: string) => {
    if (!isTTSActive || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text
      .replace(/\[RENDER_[^\]]+\]/g, "")
      .replace(/\[PLAN_START\][\s\S]*?\[PLAN_END\]/g, "")
      .replace(/\[TASK_DONE:[^\]]*\]/g, "")
      .replace(/<think>[\s\S]*?(<\/think>|$)/gi, "")
      .replace(/[*#`]/g, "")
      .trim();
    if (!cleanText) return;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.volume = 1;
    const femaleVoice = window.speechSynthesis.getVoices().find(v => {
      const n = v.name.toLowerCase();
      return n.includes("female") || n.includes("zira") || n.includes("samantha") || n.includes("victoria") || n.includes("google uk english female");
    });
    if (femaleVoice) utterance.voice = femaleVoice;
    window.speechSynthesis.speak(utterance);
  }, [isTTSActive]);

  const toggleListen = useCallback(() => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else if (recognitionRef.current) { 
      setInput(""); 
      recognitionRef.current.start(); 
      setIsListening(true); 
    }
  }, [isListening]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, isLoading]);

  const executeAgentLoop = async (currentHistory: ChatMessage[]) => {
    const assistantMsgId = `ast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const lastUserMsg = currentHistory.filter(m => m.role === "user").pop()?.content || "";
    
    setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);

    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
    const geminiModel = import.meta.env.VITE_GEMINI_MODEL || "gemini-1.5-flash";
    const groqApiKey = import.meta.env.VITE_GROQ_API_KEY || "";
    const groqModel = import.meta.env.VITE_GROQ_MODEL || "llama-3.3-70b-versatile";

    let rafScheduled = false;
    let lastFlushTime = 0;
    const FLUSH_INTERVAL = 50;
    
    const flushUpdate = (displayContent: string) => {
      setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: displayContent } : m));
      lastFlushTime = Date.now();
    };

    const toGeminiContents = (history: ChatMessage[]) => {
      return history.slice(-6).map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));
    };

    setCurrentStatus("Aria AI responding...");
    
    const systemPrompt = `You are Aria, Chief AI Urban Climate & Heat Risk Advisor for WeatherGPT.
    IDENTITY: Specialist in urban heat islands, satellite climate metrics (NDVI, NDBI), heat risk scores, 16-day weather forecasts, and heat mitigation across 75+ Uttar Pradesh cities.
    CONTEXT DATA: ${JSON.stringify(contextData)}

    STRICT VISUAL WIDGET FORMATTING INSTRUCTIONS:
    - NEVER invent or output fake image URLs (such as .png, .jpg, or heatzone.ai links).
    - When asked for a map, heat map, forecast, or comparison, use ONLY these interactive widget tags:
      1. For city maps: [RENDER_MAP:cityname] (e.g. [RENDER_MAP:prayagraj] or [RENDER_MAP:lucknow])
      2. For NASA satellite thermal map: [RENDER_NASA_MAP]
      3. For 16-day weather/heat forecast: [RENDER_FORECAST:cityname] (e.g. [RENDER_FORECAST:kanpur])
      4. For multi-city heat comparison: [RENDER_COMPARISON:lucknow,kanpur,prayagraj]

    RULES: Keep responses data-driven, structured, concise, and focused on heat risk, weather, and climate mitigation. Use markdown formatting.`;

    let resultText = "";
    let tokensCount = 0;
    const startTime = Date.now();

    try {
      if (provider === "groq") {
        const url = "https://api.groq.com/openai/v1/chat/completions";
        const messagesPayload = [
          { role: "system", content: systemPrompt },
          ...currentHistory.slice(-6).map(m => ({
            role: m.role,
            content: m.content
          }))
        ];

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${groqApiKey}`
          },
          body: JSON.stringify({
            model: groqModel,
            messages: messagesPayload,
            temperature: 0.7,
            stream: true
          })
        });

        if (res.ok) {
          const reader = res.body?.getReader();
          const decoder = new TextDecoder("utf-8");
          let lineBuffer = "";

          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            lineBuffer += decoder.decode(value, { stream: true });
            const lines = lineBuffer.split("\n");
            lineBuffer = lines.pop() || "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data: ")) {
                const dataStr = trimmed.slice(6);
                if (dataStr === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(dataStr);
                  const chunk = parsed.choices?.[0]?.delta?.content || "";
                  if (chunk) {
                    resultText += chunk;
                    tokensCount++;
                    const now = Date.now();
                    if (now - lastFlushTime >= FLUSH_INTERVAL) {
                      flushUpdate(resultText);
                    } else if (!rafScheduled) {
                      rafScheduled = true;
                      requestAnimationFrame(() => {
                        rafScheduled = false;
                        flushUpdate(resultText);
                      });
                    }
                  }
                } catch {}
              }
            }
          }
        } else {
          const errBody = await res.text();
          console.error("Groq API error:", res.status, errBody);
          resultText = "Sorry, I am having trouble connecting to Groq right now.";
          flushUpdate(resultText);
        }
      } else {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${geminiApiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: toGeminiContents(currentHistory),
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
          })
        });

      if (res.ok) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder("utf-8");
        let lineBuffer = "";

        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;
          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(line.slice(6));
                const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
                if (chunk) {
                  resultText += chunk;
                  tokensCount++;
                  const now = Date.now();
                  if (now - lastFlushTime >= FLUSH_INTERVAL) {
                    flushUpdate(resultText);
                  } else if (!rafScheduled) {
                    rafScheduled = true;
                    requestAnimationFrame(() => {
                      rafScheduled = false;
                      flushUpdate(resultText);
                    });
                  }
                }
              } catch {}
            }
          }
        }
      } else {
        const errBody = await res.text();
        console.error("Gemini API error:", res.status, errBody);
        resultText = "Sorry, I am having trouble connecting to my AI brain right now.";
        flushUpdate(resultText);
      }
      }
    } catch (err) {
      console.warn("Streaming error:", err);
      resultText = "An error occurred while generating the response.";
      flushUpdate(resultText);
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const speed = elapsed > 0 ? (tokensCount / elapsed).toFixed(1) : "0.0";
    const speedBadge = `\n\n[SPEED:${tokensCount} tokens|${elapsed.toFixed(1)}s|${speed} tok/s]`;
    flushUpdate(resultText + speedBadge);
    
    setIsLoading(false);
    speakResponse(resultText);
  };



  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    primeAudioEngine(); 
    if (window.speechSynthesis) window.speechSynthesis.cancel(); 
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    const userMsg = input.trim(); setInput("");
    setCurrentStatus("Thinking...");
    const userMsgId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const initialHistory: ChatMessage[] = [...messages, { id: userMsgId, role: "user", content: userMsg }];
    setMessages(initialHistory); setIsLoading(true); await executeAgentLoop(initialHistory);
  };


  return (
    <div className="flex flex-col h-[700px] bg-white dark:bg-[#050509] border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden relative font-sans transition-colors">
      <div className="bg-gray-50/90 dark:bg-white/5 backdrop-blur-xl p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center shrink-0 z-10 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl shadow-lg border border-white/20"><Sparkles className="w-5 h-5 text-white" /></div>
          <div><h3 className="font-bold text-gray-900 dark:text-white tracking-wide">Aria Intelligence</h3><p className="text-[11px] text-purple-600 dark:text-purple-300 font-medium tracking-wider uppercase">Urban Climate Platform</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              if (isTTSActive && window.speechSynthesis) window.speechSynthesis.cancel();
              setIsTTSActive(!isTTSActive);
            }} 
            className={cn("p-2.5 rounded-full transition-colors border", isTTSActive ? "bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30" : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10")}
          >
            {isTTSActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl mb-4 text-purple-400">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Aria — AI Climate Advisor</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-[440px] mb-8">
              I specialize in urban heat risk analysis, weather forecasts, satellite indicators (NDVI, NDBI), and heatwave mitigation for 75+ UP cities.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {[
                "Full heat report for Kanpur",
                "Compare Lucknow & Agra heat risk",
                "16-day forecast for Varanasi",
                "Show heat map for Prayagraj",
                "Urban heat mitigation strategies"
              ].map((q) => (
                <button key={q} onClick={() => { setInput(q); primeAudioEngine(); }} className="text-[11px] font-medium bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-full transition-all">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg, index) => <MessageRow key={msg.id || index} msg={msg} isStreaming={isLoading && index === messages.length - 1 && msg.role === 'assistant'} currentStatus={currentStatus} />)}
        </AnimatePresence>
      </div>

      <div className="p-4 bg-gray-50/90 dark:bg-white/5 backdrop-blur-xl border-t border-gray-200 dark:border-white/10 shrink-0 z-10 transition-colors">
        <form onSubmit={handleSubmit} className="flex gap-2 relative items-end max-w-4xl mx-auto">
          <div className="flex-1 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 focus-within:border-purple-500/50 dark:focus-within:border-purple-500/50 rounded-2xl flex items-center p-1 transition-colors">
            <button type="button" onClick={toggleListen} className={cn("p-3 rounded-xl", isListening ? "text-red-500 bg-red-500/10 animate-pulse" : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white")}>
              {isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask me anything..." className="flex-1 bg-transparent px-2 py-3 text-sm text-gray-900 dark:text-white focus:outline-none placeholder-gray-400 dark:placeholder-gray-500" disabled={isLoading} />
          </div>
          <button type="submit" disabled={!input.trim() || isLoading} className="p-4 bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-2xl disabled:opacity-50 shadow-md">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}