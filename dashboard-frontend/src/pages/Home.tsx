import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { Link } from "wouter";
import { 
  Satellite, Building2, Cpu, Flame, CloudRain, ShieldAlert, Globe, 
  Activity, MapPin, ArrowRight, Zap, Car, Leaf, Factory, Compass,
  MessageSquare, Wind, Droplets, Mic, Plane, TreePine, Database
} from "lucide-react";
import WhatsAppCard from "../components/WhatsAppCard";
import WeatherGPTHero from "../components/WeatherGPTHero";

/* ─── Reusable scroll-reveal wrapper ─── */
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Horizontal text marquee ─── */
function Marquee({ text, speed = 30 }: { text: string; speed?: number }) {
  return (
    <div className="overflow-hidden whitespace-nowrap border-y border-border py-6 bg-card/40 backdrop-blur-sm">
      <motion.div
        className="inline-flex gap-24 font-display text-4xl md:text-6xl font-bold uppercase tracking-tight opacity-20"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: speed, ease: "linear", repeat: Infinity }}
      >
        {[...Array(6)].map((_, i) => (
          <span key={i} className="flex items-center gap-12">
            <span>{text}</span>
            <span className="w-3 h-3 bg-primary rounded-full animate-ping" />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

import { fetchLiveUpdates, LiveUpdateResponse } from "@/lib/renderApi";

const BASE = import.meta.env.BASE_URL;

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const [liveData, setLiveData] = useState<LiveUpdateResponse | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadLiveTelemetry() {
      try {
        const res = await fetchLiveUpdates();
        if (isMounted && res) {
          setLiveData(res);
        }
      } catch (err) {
        console.warn("Home live updates fetch warning:", err);
      }
    }
    loadLiveTelemetry();
    const timer = setInterval(loadLiveTelemetry, 60000);
    return () => { isMounted = false; clearInterval(timer); };
  }, []);

  const topAlert = liveData?.alerts && liveData.alerts.length > 0 ? liveData.alerts[0] : null;

  return (
    <div className="w-full overflow-x-hidden bg-background text-foreground">

      {/* ═══════════════ 1. HERO SECTION ═══════════════ */}
      <section ref={heroRef} className="relative min-h-[92vh] w-full flex items-center justify-center overflow-hidden bg-primary text-primary-foreground -mt-28 pt-28">
        {/* Parallax background image */}
        <motion.div className="absolute inset-0 z-0" style={{ y: heroY }}>
          <img
            src={`${BASE}images/landing/hero.png`}
            alt="WeatherGPT global intelligence distribution"
            className="w-full h-full object-cover opacity-35 scale-105"
          />
        </motion.div>

        {/* Gradient overlays */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-primary/80 via-primary/40 to-primary" />
        <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-primary/50 to-primary" />

        {/* Content */}
        <motion.div className="relative z-10 text-center px-6 max-w-5xl mx-auto py-16" style={{ opacity: heroOpacity }}>
          
          {/* Live Real-Time Banner */}
          {topAlert ? (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-500/40 text-xs font-mono text-white mb-6 backdrop-blur-md shadow-lg"
            >
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping shrink-0" />
              <span className="font-bold text-red-300 uppercase tracking-wider">LIVE TELEMETRY:</span>
              <span className="truncate max-w-md">{topAlert.title} — {topAlert.message}</span>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-foreground/10 border border-primary-foreground/20 text-xs font-mono uppercase tracking-widest text-primary-foreground/90 mb-8"
            >
              <Compass className="w-3.5 h-3.5 text-yellow-400 animate-spin-slow" />
              INTELLIGENT CONVERSATIONAL WEATHER PLATFORM
            </motion.div>
          )}

          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="font-display font-extrabold text-5xl md:text-7xl lg:text-[6rem] leading-[0.9] tracking-tighter uppercase mb-6">
              AI-POWERED
              <br />
              CONVERSATIONAL
              <br />
              WEATHER INTELLIGENCE
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="font-sans text-base md:text-xl text-primary-foreground/80 max-w-3xl mx-auto leading-relaxed mb-10"
          >
            Integrating <strong>meteorological datasets</strong> (NWP Models), <strong>forecasting engines</strong>, and <strong>disaster warning systems</strong> to provide accurate, contextual, and multilingual weather intelligence through natural language.
          </motion.p>

          {/* Dual Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link
              href="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 font-mono text-xs tracking-widest uppercase bg-primary-foreground text-primary px-8 py-4 font-bold hover:bg-white hover:shadow-2xl transition-all duration-300 shadow-xl"
            >
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
              Launch Web Dashboard
            </Link>
            
            <Link
              href="/advisor"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 font-mono text-xs tracking-widest uppercase border border-primary-foreground/40 px-8 py-4 text-primary-foreground hover:bg-primary-foreground/10 transition-all duration-300"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              Start Natural Conversation
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Marquee strip */}
      <Marquee text="REAL-TIME FORECASTS · NATURAL LANGUAGE QUERIES · EXTREME WEATHER ALERTS · MULTILINGUAL SUPPORT · CLIMATE ANALYTICS" />

      {/* ═══════════════ 2. KEY FEATURES ═══════════════ */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { number: "24/7", label: "Real-Time API", sublabel: "GFS / WRF NWP Models" },
            { number: "15+", label: "Indian Languages", sublabel: "Multilingual NLP Engine" },
            { number: "0ms", label: "Voice Access", sublabel: "For Rural Accessibility" },
            { number: "360°", label: "Multi-Domain", sublabel: "Agri, Aviation, Marine" },
          ].map((stat, i) => (
            <Reveal key={stat.label} delay={i * 0.1}>
              <div className="text-center md:text-left">
                <p className="font-display text-5xl md:text-6xl font-bold tracking-tighter">{stat.number}</p>
                <p className="font-mono text-xs tracking-widest uppercase mt-3 text-primary-foreground/80">{stat.label}</p>
                <p className="font-sans text-xs text-primary-foreground/50 mt-1">{stat.sublabel}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════════ 3. PROBLEM & MISSION ═══════════════ */}
      <section className="py-24 md:py-36 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <Reveal className="lg:col-span-5">
            <span className="font-mono text-xs tracking-widest uppercase text-primary font-bold block mb-3">OUR CORE MISSION</span>
            <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tighter leading-[0.9] mb-6">
              DEMOCRATIZING WEATHER INFORMATION
            </h2>
            <p className="font-sans text-muted-foreground text-base leading-relaxed mb-6">
              Weather information is often distributed through multiple portals, bulletins, satellite products, and complex forecast systems. This fragmentation makes it difficult for common users, researchers, disaster managers, and government agencies to quickly obtain actionable insights.
            </p>
            <p className="font-sans text-muted-foreground text-base leading-relaxed mb-8">
              There is an urgent need for an <strong>intelligent conversational platform</strong>. WeatherGPT bridges this gap by providing real-time data, early warnings, climate analysis, and decision support directly through natural language queries.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <p className="font-display text-3xl font-extrabold text-foreground">Fast</p>
                <p className="font-mono text-xs text-muted-foreground uppercase">Dissemination</p>
              </div>
              <div>
                <p className="font-display text-3xl font-extrabold text-primary">Better</p>
                <p className="font-mono text-xs text-muted-foreground uppercase">Preparedness</p>
              </div>
            </div>
          </Reveal>

          {/* Staggered Visual Grid for Use Cases */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Reveal delay={0.1}>
              <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-primary/50 transition-all">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
                  <Leaf className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-foreground">Agricultural Advisories</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Farmers receive targeted crop-weather advisories to optimize sowing schedules and protect against frost or heat stress.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.2} className="sm:mt-8">
              <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-primary/50 transition-all">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                  <Plane className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-foreground">Aviation Briefings</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Pilots and dispatchers access instant atmospheric conditions, wind vectors, and visibility thresholds via conversational interfaces.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.3}>
              <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-primary/50 transition-all">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                  <ShieldAlert className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-foreground">Disaster Management</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Rapid flood and cyclone early warning dissemination for citizens and emergency response teams during extreme events.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.4} className="sm:mt-8">
              <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-primary/50 transition-all">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                  <Building2 className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-foreground">Smart City Monitoring</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Urban planners retrieve real-time air quality metrics, thermal distributions, and historical climate analytics for resilience planning.
                </p>
              </div>
            </Reveal>
          </div>

        </div>
      </section>

      {/* ═══════════════ 4. SYSTEM ARCHITECTURE ═══════════════ */}
      <section className="py-24 bg-card/60 border-y border-border">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          
          <Reveal className="text-center max-w-3xl mx-auto mb-16">
            <span className="font-mono text-xs tracking-widest uppercase text-primary font-bold block mb-2">SCALABLE MULTI-DOMAIN PLATFORM</span>
            <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tighter">
              HOW WEATHERGPT WORKS
            </h2>
            <p className="font-sans text-muted-foreground mt-4 text-base">
              A unified architecture that bridges vast meteorological databases with modern LLM conversational capabilities.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Engine 1: Conversational AI Engine */}
            <Reveal delay={0.1}>
              <div className="bg-background border border-border rounded-3xl p-8 relative overflow-hidden shadow-2xl h-full flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-32 bg-blue-500/5 rounded-bl-full pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">INTELLIGENCE LAYER</span>
                    <Cpu className="w-7 h-7 text-blue-400" />
                  </div>
                  <h3 className="font-display text-2xl uppercase font-bold mb-4 text-foreground">CONVERSATIONAL AI ENGINE</h3>
                  <ul className="space-y-3 text-sm text-muted-foreground mb-8">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">•</span>
                      <span><strong>Natural Language Processing:</strong> Understands complex intent extraction from informal weather queries.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">•</span>
                      <span><strong>Multilingual Core:</strong> Built-in support for Indian languages, enabling widespread regional access.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">•</span>
                      <span><strong>Voice-Enabled Interaction:</strong> Breaking literacy barriers in rural areas with seamless voice-to-text integration.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">•</span>
                      <span><strong>LLM Models Integration:</strong> Compatible with OpenAI, Llama, Gemini for robust reasoning and advisory generation.</span>
                    </li>
                  </ul>
                </div>
                <Link href="/advisor" className="inline-flex items-center gap-2 text-xs font-mono uppercase text-blue-400 font-bold hover:underline">
                  Try the Conversational UI →
                </Link>
              </div>
            </Reveal>

            {/* Engine 2: Data & Integration Layer */}
            <Reveal delay={0.2}>
              <div className="bg-background border border-border rounded-3xl p-8 relative overflow-hidden shadow-2xl h-full flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-32 bg-orange-500/5 rounded-bl-full pointer-events-none" />
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-mono text-xs font-bold text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">DATA PIPELINE</span>
                    <Database className="w-7 h-7 text-orange-400" />
                  </div>
                  <h3 className="font-display text-2xl uppercase font-bold mb-4 text-foreground">METEOROLOGICAL INTEGRATION</h3>
                  <ul className="space-y-3 text-sm text-muted-foreground mb-8">
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400 font-bold">•</span>
                      <span><strong>NWP Models Integration:</strong> Directly queries massive numerical weather prediction models (GFS/WRF).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400 font-bold">•</span>
                      <span><strong>Real-Time Data Ingestion:</strong> Scalable backend utilizing MQTT, WebSocket, and WIS2.0 frameworks.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400 font-bold">•</span>
                      <span><strong>GIS & Spatial Tools:</strong> Evaluates location-based alerts using coordinate-driven APIs.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400 font-bold">•</span>
                      <span><strong>Persistent Storage:</strong> Scalable PostgreSQL / MongoDB databases orchestrating historical climate trend analytics.</span>
                    </li>
                  </ul>
                </div>
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs font-mono uppercase text-orange-400 font-bold hover:underline">
                  View Data Dashboards →
                </Link>
              </div>
            </Reveal>

          </div>
        </div>
      </section>

      {/* ═══════════════ 5. WEATHERGPT INTEGRATION ═══════════════ */}
      <WeatherGPTHero />
      
      <section className="py-12 bg-background border-y border-border">
        <WhatsAppCard />
      </section>

      {/* ═══════════════ 6. CTA SECTION ═══════════════ */}
      <section className="py-28 px-6 text-center bg-primary text-primary-foreground relative overflow-hidden">
        <Reveal>
          <span className="font-mono text-xs tracking-widest uppercase text-primary-foreground/50 mb-6 block">Unlock Meteorological Intelligence</span>
          <h2 className="font-display text-5xl md:text-8xl uppercase tracking-tighter leading-[0.85] max-w-4xl mx-auto mb-8">
            INTELLIGENCE
            <br />
            ON DEMAND
          </h2>
          <p className="font-sans text-base md:text-lg text-primary-foreground/75 max-w-xl mx-auto mb-10 leading-relaxed">
            Access accurate, scalable, and multilingual weather analytics globally through our AI-powered conversational chatbot platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-3 font-mono text-xs tracking-widest uppercase bg-primary-foreground text-primary px-10 py-5 font-bold hover:opacity-90 transition-opacity"
            >
              Open Web Dashboard
            </Link>
            <Link
              href="/advisor"
              className="inline-flex items-center justify-center gap-3 font-mono text-xs tracking-widest uppercase border border-primary-foreground/40 px-10 py-5 hover:bg-primary-foreground/10 transition-colors"
            >
              Start Chatting
            </Link>
          </div>
        </Reveal>
      </section>

    </div>
  );
}
