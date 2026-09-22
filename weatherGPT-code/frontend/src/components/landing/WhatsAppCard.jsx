import { Smartphone, ExternalLink, ShieldCheck, Zap } from 'lucide-react';

export default function WhatsAppCard({ whatsappUrl }) {
  return (
    <section className="py-16 px-4 sm:px-8 max-w-6xl mx-auto w-full text-zinc-900">
      <div className="bg-zinc-950 border border-zinc-800 text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-xl">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800 text-xs font-semibold">
              <Smartphone className="w-3.5 h-3.5 text-white" />
              <span>Zero-Install Messaging Integration</span>
            </div>
            
            <h3 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              WeatherGPT WhatsApp Assistant
            </h3>
            
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-2xl">
              Send text queries, voice messages, or tap <span className="text-white font-semibold">&quot;Share Location Pin&quot;</span> on WhatsApp to receive instant localized weather advisories, 5-day forecasts, and extreme weather early warnings.
            </p>

            <div className="pt-2 flex flex-wrap gap-3 text-xs text-zinc-300 font-mono">
              <span className="bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center space-x-1.5">
                <Smartphone className="w-3.5 h-3.5 text-white" />
                <span>WhatsApp: +91 9125600020</span>
              </span>
              <span className="bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center space-x-1.5">
                <Zap className="w-3.5 h-3.5 text-white" />
                <span>Serverless Edge</span>
              </span>
              <span className="bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
                <span>HMAC SHA-256 Verified</span>
              </span>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col items-center lg:items-end justify-center">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-zinc-200 text-zinc-950 font-extrabold rounded-2xl transition-all shadow-lg flex items-center justify-center space-x-3 text-base cursor-pointer transform hover:scale-105"
            >
              <Smartphone className="w-5 h-5 text-zinc-950" />
              <span>Chat on WhatsApp</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            <span className="text-[11px] text-zinc-400 mt-2">Direct link to +91 9125600020</span>
          </div>
        </div>
      </div>
    </section>
  );
}

