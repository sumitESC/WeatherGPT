import {
  Zap,
  Cpu,
  Database,
  Globe2,
  ShieldCheck,
  Radio,
  CloudRain,
  Mic
} from 'lucide-react';

export default function FeaturesSection() {
  const features = [
    {
      icon: CloudRain,
      title: "Real-Time Weather Telemetry",
      description: "Direct integration with global OpenWeather & ERA5 feeds for current weather, 5-day forecasts, AQI PM2.5, and UV index."
    },
    {
      icon: Cpu,
      title: "Sense Layer AI Architecture",
      description: "Real-time sense layer intent classifier combined with context-augmented LLM to eliminate hallucinations."
    },
    {
      icon: Globe2,
      title: "GFS & WRF NWP Integration",
      description: "Gridded numerical weather prediction processing for regional rainfall patterns and spatial inundation modeling."
    },
    {
      icon: Database,
      title: "26-Year ERA5 Climate Reanalysis",
      description: "ECMWF ERA5 dataset backfill (2000–2026) across 60 atmospheric variables for decadal climate trend analysis."
    },
    {
      icon: Zap,
      title: "300+ Tokens/Sec Speed",
      description: "Language Processing Unit (LPPU) execution running LLaMA-3 120B model for instantaneous response generation."
    },
    {
      icon: Mic,
      title: "Speech-to-Speech & Barge-In",
      description: "Interactive voice visualizer orb with explicit stop-word speech cancellation algorithm (< 50ms latency)."
    }
  ];

  return (
    <section className="py-12 sm:py-20 px-3.5 sm:px-8 max-w-6xl mx-auto w-full space-y-8 sm:space-y-12 text-zinc-900">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <h2 className="text-2xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight">
          Platform Architecture & Capabilities
        </h2>
        <p className="text-xs sm:text-base text-zinc-500">
          Engineered for high accuracy, low latency, and omni-channel accessibility.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {features.map((feat, idx) => {
          const IconComponent = feat.icon;
          return (
            <div
              key={idx}
              className="bg-white border border-zinc-200/90 rounded-2xl p-5 sm:p-6 space-y-3 hover:border-zinc-950 shadow-sm hover:shadow-md transition group"
            >
              <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-950 flex items-center justify-center border border-zinc-200 group-hover:bg-zinc-950 group-hover:text-white transition">
                <IconComponent className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-zinc-950 group-hover:text-black transition">
                {feat.title}
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                {feat.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

