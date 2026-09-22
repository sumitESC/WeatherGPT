import { Smartphone, ExternalLink, ShieldCheck, Zap } from 'lucide-react';
import { motion } from "framer-motion";

export default function WhatsAppCard({ whatsappUrl = "https://wa.me/919125600020" }: { whatsappUrl?: string }) {
  return (
    <section className="py-16 px-4 sm:px-8 max-w-6xl mx-auto w-full text-foreground">
      <div className="bg-card border border-border rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-xl">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold uppercase tracking-widest">
              <Smartphone className="w-3.5 h-3.5 text-primary" />
              <span>Zero-Install Messaging Integration</span>
            </div>
            
            <h3 className="text-2xl sm:text-4xl font-display font-extrabold text-foreground tracking-tight uppercase">
              WeatherGPT WhatsApp Assistant
            </h3>
            
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl font-sans">
              Send text queries, voice messages, or tap <span className="text-foreground font-semibold">"Share Location Pin"</span> on WhatsApp to receive instant localized weather advisories, 5-day forecasts, and extreme weather early warnings for heat zones.
            </p>

            <div className="pt-2 flex flex-wrap gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest">
              <span className="bg-muted px-3 py-1.5 rounded-lg border border-border flex items-center space-x-1.5">
                <Smartphone className="w-3.5 h-3.5 text-foreground" />
                <span>WhatsApp: +91 9125600020</span>
              </span>
              <span className="bg-muted px-3 py-1.5 rounded-lg border border-border flex items-center space-x-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-500" />
                <span>Serverless Edge</span>
              </span>
              <span className="bg-muted px-3 py-1.5 rounded-lg border border-border flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                <span>HMAC SHA-256 Verified</span>
              </span>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col items-center lg:items-end justify-center">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 bg-primary hover:opacity-90 text-primary-foreground font-mono text-xs uppercase tracking-widest font-bold transition-all shadow-lg flex items-center justify-center space-x-3 cursor-pointer transform hover:scale-105"
            >
              <Smartphone className="w-5 h-5" />
              <span>Chat on WhatsApp</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            <span className="text-[11px] text-muted-foreground mt-2 uppercase tracking-widest font-mono">Direct link to +91 9125600020</span>
          </div>
        </div>
      </div>
    </section>
  );
}
