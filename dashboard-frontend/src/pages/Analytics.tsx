import { useGetAllHeatPredictions, useGetCities, FALLBACK_CITIES, getFallbackHeatPrediction } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, LineChart, Line, Cell } from 'recharts';
import { motion } from "framer-motion";
import { Activity, Car, TreePine, Building2, Zap, Construction } from "lucide-react";
import { getHeatZoneHex } from "@/lib/utils";

export default function Analytics() {
  const { data: predictions, isLoading: predLoading } = useGetAllHeatPredictions();
  const { data: cities, isLoading: citiesLoading } = useGetCities();

  const activeCities = (Array.isArray(cities) && cities.length > 0) ? cities : FALLBACK_CITIES;
  const activePreds = (Array.isArray(predictions) && predictions.length > 0) ? predictions : FALLBACK_CITIES.map(getFallbackHeatPrediction);

  // Merge datasets for charts
  const mergedData = activeCities.map(city => {
    const pred = activePreds.find(p => p.cityId === city.id || p.cityName === city.name) || getFallbackHeatPrediction(city);
    return {
      name: city.name,
      heatRisk: pred?.heatRiskScore || 50,
      zone: pred?.heatZone || 'moderate',
      temperature: pred?.temperature || 34,
      ndvi: pred?.ndvi || 0.22,
      emissionIndex: pred?.emissionIndex || 4.2,
      ndbi: pred?.ndbi || 0.35,
      population: (city.population || 1000000) / 1000000 // in millions
    };
  }).sort((a, b) => b.heatRisk - a.heatRisk);

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Comparative Analytics</h1>
        <p className="text-muted-foreground">Cross-city analysis of heat contributors across Uttar Pradesh.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Heat vs Green Cover */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg"
        >
          <div className="flex items-center gap-2 mb-6">
            <TreePine className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-lg">Vegetation Health (NDVI) vs Heat Risk</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line yAxisId="left" type="monotone" dataKey="heatRisk" name="Heat Risk" stroke="hsl(var(--primary))" strokeWidth={3} activeDot={{ r: 8 }} />
                <Line yAxisId="right" type="monotone" dataKey="ndvi" name="NDVI Index" stroke="#10b981" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Vehicle Emissions */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg"
        >
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h3 className="font-bold text-lg">Emission Index Heat Contribution</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mergedData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  cursor={{ fill: 'hsla(226, 30%, 16%, 0.5)' }}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                />
                <Bar dataKey="emissionIndex" name="Emission Index" fill="#eab308" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Urban Infrastructure */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg lg:col-span-2"
        >
          <div className="flex items-center gap-2 mb-6">
            <Construction className="w-5 h-5 text-orange-400" />
            <h3 className="font-bold text-lg">Concrete Density (NDBI) & Heat Risk</h3>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mergedData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  cursor={{ fill: 'hsla(226, 30%, 16%, 0.5)' }}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="ndbi" name="NDBI Index (Concrete)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="heatRisk" name="Heat Risk Score" radius={[4, 4, 0, 0]}>
                  {mergedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getHeatZoneHex(entry.zone)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
