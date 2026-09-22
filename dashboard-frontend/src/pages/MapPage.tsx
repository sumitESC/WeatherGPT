import { useState, useMemo, useEffect } from "react";
import { useGetAllHeatPredictions, FALLBACK_CITIES, getFallbackHeatPrediction } from "@workspace/api-client-react";
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, LayerGroup, useMap } from "react-leaflet";
import { Link } from "wouter";
import { HeatZoneBadge } from "@/components/HeatZoneBadge";
import { getHeatZoneHex } from "@/lib/utils";
import { Loader2, ArrowRight, Satellite, Map as MapIcon, ExternalLink, Thermometer, Construction, TreePine, Droplet, Globe, Layers } from "lucide-react";
import { motion } from "framer-motion";

import "leaflet/dist/leaflet.css";

function MapController() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const timer1 = setTimeout(() => map.invalidateSize(), 100);
    const timer2 = setTimeout(() => map.invalidateSize(), 500);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [map]);
  return null;
}

interface TileConfig {
  name: string;
  url: string;
  attribution: string;
  className?: string;
  maxZoom?: number;
}

const TILE_LAYERS: Record<string, TileConfig> = {
  osm_dark: {
    name: "OSM Dark",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    className: "leaflet-tile-osm-dark",
    maxZoom: 19,
  },
  esri_dark: {
    name: "Esri Dark",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a> — GIS User Community',
    maxZoom: 16,
  },
  carto_dark: {
    name: "Carto Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  },
  satellite: {
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a> — Earthstar Geographics',
    maxZoom: 18,
  },
};

const gibsDate = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
})();

const OVERLAYS = {
  none: null,
  temperature: {
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/${gibsDate}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
    attribution: '&copy; <a href="https://earthdata.nasa.gov">NASA EOSDIS GIBS</a>',
  },
  satellite: {
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    attribution: '&copy; <a href="https://earthdata.nasa.gov">NASA EOSDIS GIBS</a>',
  },
  clouds: {
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    attribution: '&copy; <a href="https://earthdata.nasa.gov">NASA EOSDIS GIBS</a>',
  },
};

export default function MapPage() {
  const { data: cities, isLoading } = useGetAllHeatPredictions();
  const [tileMode, setTileMode] = useState("osm_dark");
  const [overlayMode, setOverlayMode] = useState("none");

  const cityList = useMemo(() => {
    if (Array.isArray(cities) && cities.length > 0) return cities;
    return FALLBACK_CITIES.map(getFallbackHeatPrediction);
  }, [cities]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  const center: [number, number] = [26.8467, 80.9462];
  const tile = TILE_LAYERS[tileMode] || TILE_LAYERS.osm_dark;
  const overlay = OVERLAYS[overlayMode];

  return (
    <div className="space-y-6">
      <div className="shrink-0">
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Geospatial Analysis</h1>
        <p className="text-muted-foreground">Interactive map of Uttar Pradesh urban heat islands.</p>
      </div>

      <div className="rounded-2xl overflow-hidden border border-border/50 shadow-2xl shadow-black/20 relative z-0 h-[520px]">
        <MapContainer
          center={center}
          zoom={7}
          style={{ height: '520px', width: '100%', zIndex: 0 }}
          zoomControl={false}
        >
          {/* FIX 1: Added MapController to force Leaflet to calculate dimensions */}
          <MapController />

          <TileLayer
            key={tileMode}
            attribution={tile.attribution}
            url={tile.url}
            className={tile.className}
            maxZoom={tile.maxZoom}
          />

          {/* FIX 2: Actually render the selected overlay to the map */}
          {overlay && (
            <TileLayer
              key={overlayMode}
              attribution={overlay.attribution}
              url={overlay.url}
              opacity={0.65}
            />
          )}

          <ZoomControl position="bottomright" />

          <LayerGroup>
            {cityList.map((city) => {
              const color = getHeatZoneHex(city.heatZone);
              const ndbiVal = typeof city.ndbi === "number" && !isNaN(city.ndbi) ? city.ndbi : (typeof (city as any).builtUpRatio === "number" ? 0.20 + (city as any).builtUpRatio * 0.35 : 0.385);
              const ndviVal = typeof city.ndvi === "number" && !isNaN(city.ndvi) ? city.ndvi : (typeof (city as any).greenCoverRatio === "number" ? (city as any).greenCoverRatio : 0.220);
              const ndwiVal = typeof city.ndwi === "number" && !isNaN(city.ndwi) ? city.ndwi : -0.210;

              return (
                <CircleMarker
                  key={city.cityId}
                  center={[city.latitude, city.longitude] as [number, number]}
                  radius={city.heatRiskScore / 3}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.4,
                    weight: 2,
                  }}
                >
                  <Popup className="custom-popup">
                    <div className="p-1 min-w-[210px] text-white">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-display font-bold text-lg text-white m-0 leading-none">{city.cityName}</h3>
                        <HeatZoneBadge zone={city.heatZone} showIcon={false} />
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between items-center text-sm border-b border-white/10 pb-1.5">
                          <span className="text-slate-300 font-semibold">Overall Risk Score</span>
                          <span className="font-mono font-bold text-base" style={{ color }}>{city.heatRiskScore.toFixed(1)}/100</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="flex flex-col p-2 bg-slate-800/80 rounded-xl border border-white/10">
                            <span className="text-[10px] uppercase text-slate-400 font-bold flex items-center gap-1"><Thermometer className="w-3 h-3 text-red-400" /> Temp</span>
                            <span className="font-bold text-sm text-white">{city.temperature.toFixed(1)} °C</span>
                          </div>
                          <div className="flex flex-col p-2 bg-slate-800/80 rounded-xl border border-white/10">
                            <span className="text-[10px] uppercase text-slate-400 font-bold flex items-center gap-1"><Construction className="w-3 h-3 text-orange-400" /> NDBI</span>
                            <span className="font-bold text-sm text-white">{ndbiVal.toFixed(3)}</span>
                          </div>
                          <div className="flex flex-col p-2 bg-slate-800/80 rounded-xl border border-white/10">
                            <span className="text-[10px] uppercase text-slate-400 font-bold flex items-center gap-1"><TreePine className="w-3 h-3 text-emerald-400" /> NDVI</span>
                            <span className="font-bold text-sm text-white">{ndviVal.toFixed(3)}</span>
                          </div>
                          <div className="flex flex-col p-2 bg-slate-800/80 rounded-xl border border-white/10">
                            <span className="text-[10px] uppercase text-slate-400 font-bold flex items-center gap-1"><Droplet className="w-3 h-3 text-blue-400" /> NDWI</span>
                            <span className="font-bold text-sm text-white">{ndwiVal.toFixed(3)}</span>
                          </div>
                        </div>
                      </div>

                      <Link
                        href={`/city/${city.cityId}`}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white !text-white py-2.5 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        <span className="text-white font-bold">View Full Analysis</span>
                        <ArrowRight className="w-4 h-4 text-white shrink-0" />
                      </Link>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </LayerGroup>
        </MapContainer>

        {/* The rest of your UI absolute overlays... */}
        <div className="absolute top-4 left-4 z-[400] flex flex-col gap-2 pointer-events-none">
          <div className="pointer-events-auto flex flex-col gap-2">
            <div className="flex items-center bg-card/90 backdrop-blur-md border border-border rounded-xl shadow-xl overflow-hidden text-xs font-semibold">
              <button
                onClick={() => setTileMode("osm_dark")}
                className={`px-3 py-2 transition-colors flex items-center gap-1.5 ${tileMode === "osm_dark" ? "bg-emerald-600 text-white font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
                title="OpenStreetMap with Dark Filter"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400" /> OSM Dark
              </button>
              <div className="w-px h-4 bg-border"></div>
              <button
                onClick={() => setTileMode("esri_dark")}
                className={`px-3 py-2 transition-colors flex items-center gap-1.5 ${tileMode === "esri_dark" ? "bg-purple-600 text-white font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
                title="Esri World Dark Gray Canvas"
              >
                <MapIcon className="w-3.5 h-3.5 text-purple-400" /> Esri Dark
              </button>
              <div className="w-px h-4 bg-border"></div>
              <button
                onClick={() => setTileMode("carto_dark")}
                className={`px-3 py-2 transition-colors flex items-center gap-1.5 ${tileMode === "carto_dark" ? "bg-blue-600 text-white font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
                title="CartoDB Dark Matter"
              >
                <Layers className="w-3.5 h-3.5 text-blue-400" /> Carto Dark
              </button>
              <div className="w-px h-4 bg-border"></div>
              <button
                onClick={() => setTileMode("satellite")}
                className={`px-3 py-2 transition-colors flex items-center gap-1.5 ${tileMode === "satellite" ? "bg-amber-600 text-white font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
                title="Esri World Satellite Imagery"
              >
                <Satellite className="w-3.5 h-3.5 text-amber-400" /> Satellite
              </button>
            </div>

            <div className="flex flex-wrap bg-card/90 backdrop-blur-md border border-border rounded-xl shadow-xl overflow-hidden text-xs font-semibold">
              <button
                onClick={() => setOverlayMode("none")}
                className={`px-2.5 py-2 transition-colors ${overlayMode === "none" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
              >
                Cities Only
              </button>
              <div className="w-px bg-border"></div>
              <button
                onClick={() => setOverlayMode("temperature")}
                className={`px-2.5 py-2 transition-colors flex items-center gap-1 ${overlayMode === "temperature" ? "bg-orange-500 text-white" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
              >
                <span className="w-2 h-2 rounded-full bg-orange-500"></span> 🌡 LST
              </button>
              <div className="w-px bg-border"></div>
              <button
                onClick={() => setOverlayMode("satellite")}
                className={`px-2.5 py-2 transition-colors flex items-center gap-1 ${overlayMode === "satellite" ? "bg-emerald-500 text-white" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 🛰 MODIS
              </button>
              <div className="w-px bg-border"></div>
              <button
                onClick={() => setOverlayMode("clouds")}
                className={`px-2.5 py-2 transition-colors flex items-center gap-1 ${overlayMode === "clouds" ? "bg-blue-400 text-white" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-400"></span> ☁ VIIRS
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground/60 px-1">NASA GIBS Data: {gibsDate}</span>
          </div>
        </div>

        <div className="absolute top-4 right-4 z-[400] bg-card/90 backdrop-blur-md border border-border p-4 rounded-xl shadow-xl">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Heat Zones</h4>
          <div className="space-y-2">
            {[
              { label: 'Extreme (>45)', color: 'bg-red-500' },
              { label: 'High (36-45)', color: 'bg-orange-500' },
              { label: 'Moderate (26-35)', color: 'bg-lime-400' },
              { label: 'Cool (<26)', color: 'bg-green-700' }
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 text-sm text-foreground">
                <span className={`w-3 h-3 rounded-full ${item.color} shadow-[0_0_8px_currentColor]`}></span>
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table section remains identical... */}
      {/* Satellite Analysis Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <Satellite className="w-5 h-5 text-blue-400" />
              Satellite Analysis — City Heat Data
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Cross-reference with NASA GIBS satellite layers above for visual validation. Data: {gibsDate}</p>
          </div>
          <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-semibold">{cityList.length} Cities</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border/50 bg-secondary/30">
                <th className="text-left px-4 py-3 font-semibold">#</th>
                <th className="text-left px-4 py-3 font-semibold">City</th>
                <th className="text-left px-4 py-3 font-semibold">Zone</th>
                <th className="text-center px-4 py-3 font-semibold"><span className="inline-flex items-center gap-1"><Thermometer className="w-3 h-3" /> Temp</span></th>
                <th className="text-center px-4 py-3 font-semibold"><span className="inline-flex items-center gap-1"><Construction className="w-3 h-3" /> NDBI</span></th>
                <th className="text-center px-4 py-3 font-semibold"><span className="inline-flex items-center gap-1"><TreePine className="w-3 h-3" /> NDVI</span></th>
                <th className="text-center px-4 py-3 font-semibold"><span className="inline-flex items-center gap-1"><Droplet className="w-3 h-3" /> NDWI</span></th>
                <th className="text-center px-4 py-3 font-semibold">Risk Score</th>
                <th className="text-left px-4 py-3 font-semibold">ML Engine Explainer</th>
                <th className="text-center px-4 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {[...cityList]
                .sort((a, b) => b.heatRiskScore - a.heatRiskScore)
                .map((city, i) => {
                  const color = getHeatZoneHex(city.heatZone);
                  const riskPct = Math.min(city.heatRiskScore, 100);
                  // Generate a satellite insight based on data
                  const insight = city.heatZone === 'extreme'
                    ? 'LST likely shows intense thermal signature. Verify with 🌡 overlay.'
                    : city.heatZone === 'high'
                      ? 'Elevated surface temp expected. Check MODIS for built-up density.'
                      : city.greenCoverRatio > 30
                        ? 'Good green cover. MODIS should show vegetation around city.'
                        : 'Moderate heat. Verify urban spread with 🛰 MODIS layer.';

                  return (
                    <tr
                      key={city.cityId}
                      className="border-b border-border/30 hover:bg-secondary/20 transition-colors"
                    >
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{city.cityName}</td>
                      <td className="px-4 py-3"><HeatZoneBadge zone={city.heatZone} showIcon={false} /></td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono font-bold" style={{ color }}>{city.temperature.toFixed(1)}°C</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-mono font-bold ${(city.ndbi ?? 0) > 0.22 ? 'text-orange-400' : 'text-blue-300'}`}>
                          {city.ndbi?.toFixed(3) || "0.142"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-mono font-bold ${(city.ndvi ?? 0) > 0.25 ? 'text-emerald-400' : 'text-orange-300'}`}>
                          {city.ndvi?.toFixed(3) || "0.211"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-mono font-bold ${(city.ndwi ?? 0) > -0.2 ? 'text-blue-400' : 'text-slate-400'}`}>
                          {city.ndwi?.toFixed(3) || "-0.284"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${riskPct}%`, backgroundColor: color }}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold" style={{ color }}>{city.heatRiskScore.toFixed(0)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-medium max-w-[250px] italic">
                        {city.riskExplanation || insight}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/city/${city.cityId}`}
                          className="inline-flex items-center gap-1 text-primary hover:text-primary/80 text-xs font-semibold transition-colors"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-border/50 bg-secondary/20 text-[11px] text-muted-foreground/60 text-center">
          💡 Toggle <strong>🌡 LST</strong> on the map above to visually validate surface temperatures against this data. Use <strong>🛰 MODIS</strong> to check green cover and urban density.
        </div>
      </motion.div>
    </div>
  );
}