import { useState, useRef, useEffect } from "react";
import { useGetCities, useGetCityDataset, FALLBACK_CITIES, getFallbackCityDataset } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Brain, Car, TreePine, Droplets, Building2, Users, Loader2, PlayCircle, MapPin, ChevronDown, Check, Bot, AlertCircle, TrendingUp, Zap, CloudLightning
} from "lucide-react";
import { generateLlmAdvisory } from "@/lib/llm";
import { cn } from "@/lib/utils";
import { Chatbot } from "@/components/Chatbot";

export default function Advisor() {
  const { data: rawCities } = useGetCities();
  const cities = (Array.isArray(rawCities) && rawCities.length > 0) ? rawCities : FALLBACK_CITIES;

  const [selectedCityId, setSelectedCityId] = useState<number | "">("");
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

  const { data: rawDataset, isLoading: loadingDataset } = useGetCityDataset(
    selectedCityId !== "" ? selectedCityId : 0, 
    { query: { enabled: selectedCityId !== "", queryKey: ['dataset', selectedCityId] } }
  );

  // Guarantee non-null dataset if city selected
  const dataset = (selectedCityId !== "")
    ? ((rawDataset && rawDataset.city) ? rawDataset : getFallbackCityDataset(selectedCityId))
    : null;

  return (
    <div className="space-y-6 pb-12">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-card border border-border/50 p-6 md:p-8 rounded-3xl shadow-xl relative overflow-visible z-20">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent pointer-events-none rounded-3xl" />
        <div className="relative z-30 w-full">
          <div className="flex items-center gap-3 mb-3">
            <Brain className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl md:text-4xl font-display font-extrabold text-foreground">AI Heat Reduction Advisor</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl text-sm md:text-base mb-6">
            Leverage AI to analyze key urban factors for UP cities and generate actionable intelligence for reducing the urban heat island effect.
          </p>
          
          <div className="relative max-w-[320px]" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`w-full flex items-center justify-between bg-card hover:bg-secondary/60 border ${isDropdownOpen ? 'border-primary ring-1 ring-primary/30' : 'border-border/50'} text-foreground text-sm rounded-xl p-3 px-4 transition-all duration-200 shadow-sm cursor-pointer`}
            >
              <div className="flex items-center gap-2 truncate text-left">
                {selectedCityId === "" ? (
                  <span className="truncate font-medium text-muted-foreground truncate block">Choose a city to analyze...</span>
                ) : (
                  <><MapPin className="w-4 h-4 text-purple-400 flex-shrink-0" /> <span className="truncate font-medium block">{cities.find(c => c.id === selectedCityId)?.name || "Select City"}</span></>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-primary' : ''}`} />
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
                      onClick={() => { setSelectedCityId(""); setIsDropdownOpen(false); }}
                      className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-secondary/60 transition-colors ${selectedCityId === "" ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
                    >
                      <span>Choose a city to analyze...</span>
                      {selectedCityId === "" && <Check className="w-4 h-4" />}
                    </button>
                    
                    <div className="h-px bg-border/40 my-2 mx-4" />
                    
                    {cities.map((city) => (
                      <button
                        key={city.id}
                        onClick={() => { setSelectedCityId(city.id); setIsDropdownOpen(false); }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-secondary/60 transition-colors outline-none focus-visible:bg-secondary/60 ${selectedCityId === city.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
                      >
                        <div className="flex items-center gap-3">
                          <MapPin className={`w-4 h-4 ${selectedCityId === city.id ? 'text-purple-400' : 'text-muted-foreground/60'}`} />
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

      {loadingDataset && selectedCityId !== "" && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
            <p className="text-muted-foreground">Running AI heat analysis...</p>
          </div>
        </div>
      )}

      {dataset && dataset.city && !loadingDataset && (
        <AdvisorResults city={dataset.city} />
      )}

      {/* Chatbot Section - Always Visible */}
      <div className="mt-8">
        <h3 className="font-bold text-xl mb-6 flex items-center gap-2">
          <Bot className="w-6 h-6 text-purple-400" />
          Interactive AI Advisor
        </h3>
        <Chatbot contextData={dataset && dataset.city ? dataset.city : { status: "No city currently selected by the user. Ask them to name a specific UP city if they want local analysis." }} />
      </div>
    </div>
  );
}

function AdvisorResults({ city }: { city: any }) {
  const safeCity = city || FALLBACK_CITIES[0];
  const totalArea = Math.max(safeCity.totalArea || 1, 1);
  const totalVehicles = safeCity.totalVehicles || 500000;
  const forestCover = safeCity.forestCover || 5;
  const urbanGreenSpace = safeCity.urbanGreenSpace || 8;
  const populationDensity = safeCity.populationDensity || 1500;
  const builtUpArea = safeCity.builtUpArea || 200;
  const waterArea = (safeCity as any).waterBodiesArea || 10;
  
  const vehicleDensity = totalVehicles / totalArea;
  const greenRatio = (forestCover + urbanGreenSpace) / 100;
  const waterIndex = waterArea / totalArea;
  const builtRatio = builtUpArea / totalArea;

  // Heat Contribution AI Logic
  const rawVehicles = Math.min((vehicleDensity / 5000), 1) * 35; 
  const rawGreen = Math.min(Math.max((1 - greenRatio), 0), 1) * 30;
  const rawPop = Math.min((populationDensity / 15000), 1) * 20;
  const rawWater = Math.min(Math.max((1 - waterIndex), 0), 1) * 15;
  const rawBuilt = Math.min((builtRatio), 1) * 25;

  const totalRaw = Math.max(rawVehicles + rawGreen + rawPop + rawWater + rawBuilt, 1);
  
  const contributions = [
    { name: "Vehicle emissions", value: (rawVehicles / totalRaw) * 100, icon: Car, color: "text-red-400", bg: "bg-red-400" },
    { name: "Low green cover", value: (rawGreen / totalRaw) * 100, icon: TreePine, color: "text-emerald-400", bg: "bg-emerald-400" },
    { name: "Dense construction", value: (rawBuilt / totalRaw) * 100, icon: Building2, color: "text-orange-400", bg: "bg-orange-400" },
    { name: "Population density", value: (rawPop / totalRaw) * 100, icon: Users, color: "text-blue-400", bg: "bg-blue-400" },
    { name: "Water deficit", value: (rawWater / totalRaw) * 100, icon: Droplets, color: "text-cyan-400", bg: "bg-cyan-400" },
  ].sort((a, b) => b.value - a.value);

  // Score Calculation
  const penalty = Math.min((totalRaw / 125) * 100, 95);
  const score = Math.round(100 - penalty);
  
  let riskText = "";
  let riskColor = "";
  if (score < 30) { riskText = "High heat risk"; riskColor = "text-red-500"; }
  else if (score < 60) { riskText = "Moderate heat risk"; riskColor = "text-orange-500"; }
  else if (score < 80) { riskText = "Good heat management"; riskColor = "text-yellow-400"; }
  else { riskText = "Sustainable city"; riskColor = "text-green-400"; }

  const [llmAdvisory, setLlmAdvisory] = useState<any>(null);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [isGeneratingAdvisory, setIsGeneratingAdvisory] = useState(false);

  useEffect(() => {
    async function generateAdvisory() {
      setIsGeneratingAdvisory(true);
      setLlmAdvisory(null);
      setLlmError(null);
      try {
        const telemetry = {
          city_name: safeCity.name,
          populationDensity: populationDensity,
          ndvi: greenRatio,
          ndbi: builtRatio,
          vehicleDensity: vehicleDensity,
          waterIndex: waterIndex
        };

        const result = await generateLlmAdvisory(telemetry);
        setLlmAdvisory(result);
      } catch (e: any) {
        setLlmError(e.message || "Failed to connect to AI Provider");
        console.error(e);
      } finally {
        setIsGeneratingAdvisory(false);
      }
    }
    
    // Auto-generate when city changes
    generateAdvisory();
  }, [safeCity.name, populationDensity, greenRatio, builtRatio, vehicleDensity, waterIndex]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        
        {/* Left Column: Metrics & Score */}
        <div className="space-y-6">
          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[220px]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-bl-[100px] pointer-events-none" />
            <h3 className="font-bold text-lg mb-2 text-muted-foreground">Smart City Heat Score</h3>
            <div className={`text-6xl font-display font-black tracking-tighter ${riskColor} mb-2`}>
              {score}
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary text-sm font-semibold">
              <span className={riskColor}>{riskText}</span>
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg">
            <h3 className="font-bold text-lg mb-4">Key Urban Indicators</h3>
            <div className="space-y-4">
              <IndicatorRow label="Vehicle Density" value={`${Math.round(vehicleDensity)} /km²`} />
              <IndicatorRow label="Green Cover Ratio" value={`${(greenRatio * 100).toFixed(1)}%`} />
              <IndicatorRow label="Water Avail. Index" value={`${(waterIndex * 100).toFixed(2)}%`} />
              <IndicatorRow label="Population Density" value={`${Math.round(populationDensity)} /km²`} />
              <IndicatorRow label="Built-up Ratio" value={`${(builtRatio * 100).toFixed(1)}%`} />
            </div>
          </div>
        </div>

        {/* Middle Column: Contributors */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-primary" />
            Heat Contribution Analysis
          </h3>
          <div className="space-y-5">
            {contributions.map((c, i) => (
              <div key={c.name} className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <c.icon className={`w-4 h-4 ${c.color}`} /> {c.name}
                  </span>
                  <span className="text-foreground">{(c.value || 0).toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${c.value || 0}%` }} 
                    transition={{ duration: 1, delay: i * 0.1 }}
                    className={`h-full ${c.bg} rounded-full`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: AI Suggestions & Impacts */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg space-y-6 flex flex-col h-full max-h-[600px]">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            AI Reduction Suggestions
          </h3>
          
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 relative">
            {isGeneratingAdvisory ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/50 backdrop-blur-sm z-10 rounded-xl">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground font-medium">AI Advisor is analyzing {safeCity.name}...</p>
              </div>
            ) : llmError ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-red-500/5 rounded-xl border border-dashed border-red-500/30">
                <AlertCircle className="w-8 h-8 text-red-500 mb-3 opacity-80" />
                <p className="text-sm text-red-500 font-bold mb-1">API Error Occurred</p>
                <p className="text-xs text-red-400/80 mb-4">{llmError}</p>
                {llmError.toLowerCase().includes("api key") && (
                  <p className="text-xs text-foreground bg-card border border-border p-3 rounded-lg shadow-sm mt-3">
                    <strong>Missing or Invalid API Key:</strong> The key in <code className="bg-secondary px-1 py-0.5 rounded">heatzone-frontend/.env</code> was rejected by the AI Provider. Please generate a valid key and paste it in.
                  </p>
                )}
              </div>
            ) : llmAdvisory ? (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 shadow-sm space-y-4">
                <div>
                  <h4 className="font-bold text-sm flex items-center gap-2 mb-1"><AlertCircle className="w-4 h-4 text-primary" /> Assessment</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{llmAdvisory.assessment}</p>
                </div>
                <div>
                  <h4 className="font-bold text-sm flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-amber-500" /> Primary Drivers</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{llmAdvisory.primaryDrivers}</p>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-bold text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500" /> Immediate Actions</h4>
                  {llmAdvisory.immediateActions?.map((act: string, i: number) => (
                    <div key={i} className="bg-secondary/40 border border-border/50 rounded-lg p-3 text-xs text-foreground">
                      {act}
                    </div>
                  ))}
                </div>

                {llmAdvisory.strategicInterventions?.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-border/50">
                    <h4 className="font-bold text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-500" /> Strategic Planning</h4>
                    {llmAdvisory.strategicInterventions?.map((act: string, i: number) => (
                      <div key={i} className="bg-secondary/40 border border-border/50 rounded-lg p-3 text-xs text-foreground">
                        {act}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-secondary/20 rounded-xl border border-dashed border-border">
                <Brain className="w-8 h-8 text-muted-foreground mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">Select a city to generate live AI reduction suggestions using Gemini.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </motion.div>
  );
}

function IndicatorRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-bold font-mono text-foreground">{value}</span>
    </div>
  );
}
