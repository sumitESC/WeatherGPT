import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { fetchLiveUpdates } from "@/lib/renderApi";
import { Flame } from "lucide-react";

interface LandingLayoutProps {
  children: ReactNode;
}

export function LandingLayout({ children }: LandingLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  // Live UP Climate Weather Feed Ticker (Populated 100% dynamically from Render backend)
  const [liveCities, setLiveCities] = useState<Array<{ name: string; temp: string; risk: string; icon: string; status: string }>>([]);

  const [activeTickerIndex, setActiveTickerIndex] = useState(0);

  // Fetch live updates from backend API
  useEffect(() => {
    let isMounted = true;
    async function loadTickerData() {
      try {
        const liveRes = await fetchLiveUpdates();
        if (isMounted && liveRes && Array.isArray(liveRes.live_city_updates) && liveRes.live_city_updates.length > 0) {
          // Filter cities crossing climate thresholds (Temp >= 34°C, Risk >= 45, Rain >= 1mm, Wind >= 12km/h, Humidity >= 65%)
          const thresholdCities = liveRes.live_city_updates.filter((c: any) => {
            return (c.heat_risk_score || 0) >= 45 || (c.temp_max_c || 0) >= 34.0 || (c.precipitation_mm || 0) >= 1.0 || (c.wind_speed_kmh || 0) >= 12.0 || (c.humidity_pct || 0) >= 65;
          });

          const targetCities = thresholdCities.length > 0 ? thresholdCities : liveRes.live_city_updates;

          // Sort by highest heat risk score & temperature descending
          const sorted = [...targetCities].sort((a: any, b: any) => (b.heat_risk_score || 0) - (a.heat_risk_score || 0));

          const mapped = sorted.map((c: any) => {
            let icon = "☀️";
            const zone = (c.heat_zone || "moderate").toUpperCase();
            if (zone === "EXTREME") icon = "🔥";
            else if (zone === "HIGH") icon = "🌡️";
            else if (c.precipitation_mm > 0) icon = "🌧️";

            return {
              name: c.city,
              temp: `${(c.temp_max_c || 34).toFixed(1)}°C`,
              risk: `${Math.round(c.heat_risk_score || 50)} (${zone})`,
              icon,
              status: c.primary_driver || "Live Threshold Exceeded"
            };
          });
          setLiveCities(mapped);
        }
      } catch (err) {
        console.warn("LandingLayout ticker live fetch warning:", err);
      }
    }

    loadTickerData();
    const interval = setInterval(loadTickerData, 60000);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (liveCities.length === 0) return;
    const timer = setInterval(() => {
      setActiveTickerIndex((prev) => (prev + 1) % liveCities.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [liveCities.length]);

  const currentTicker = liveCities[activeTickerIndex % (liveCities.length || 1)] || liveCities[0];

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/map", label: "Heat Map" },
    { href: "/analytics", label: "Analytics" },
    { href: "/advisor", label: "Advisor" },
    { href: "/forecast", label: "Forecast" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-foreground selection:text-background">

      {/* ─── High-Contrast Dark Glassmorphism Top Navigation Bar ─── */}
      <motion.header
        className="fixed top-0 left-0 right-0 z-50 bg-[#090d16]/95 backdrop-blur-xl border-b border-white/10 shadow-2xl text-white transition-all duration-300"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Top Ticker Strip */}
        <div className="w-full bg-[#030712] border-b border-white/10 py-1.5 px-4 sm:px-6 text-xs font-mono flex items-center justify-between overflow-hidden">
          <div className="flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1.5 font-bold text-blue-400 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-500/30 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              LIVE UP CLIMATE STREAM
            </span>
            <span className="hidden md:inline text-gray-400 text-[11px]">75 Districts Monitored</span>
          </div>

          <AnimatePresence mode="wait">
            {currentTicker ? (
              <motion.div
                key={activeTickerIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 font-semibold text-white truncate mx-4 text-[11px]"
              >
                <span>{currentTicker.icon}</span>
                <span className="font-bold text-yellow-400">{currentTicker.name.toUpperCase()}</span>
                <span>Temp: <strong className="text-red-400">{currentTicker.temp}</strong></span>
                <span className="hidden sm:inline">Risk: <strong className="text-orange-400">{currentTicker.risk}</strong></span>
                <span className="hidden lg:inline text-gray-400">({currentTicker.status})</span>
              </motion.div>
            ) : (
              <div className="flex items-center gap-2 font-semibold text-gray-400 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Connecting to Render API stream...
              </div>
            )}
          </AnimatePresence>

          <Link href="/map" className="shrink-0 text-blue-400 font-bold hover:underline hidden sm:flex items-center gap-1 text-[11px]">
            Open Map →
          </Link>
        </div>

        {/* Main Nav Bar */}
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="relative z-50 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-md animate-coin-flip shrink-0">
              <Flame className="w-4 h-4 stroke-[2]" />
            </div>
            <motion.span
              className="font-display font-black text-xl tracking-[0.2em] uppercase text-white"
              transition={{ duration: 0.3 }}
            >
              WeatherGPT
            </motion.span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-10">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs font-bold tracking-widest uppercase text-gray-200 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="hidden lg:inline-flex text-xs font-mono tracking-widest px-6 py-2.5 uppercase transition-all duration-300 bg-white text-black hover:bg-gray-200 font-bold rounded-lg shadow-md"
            >
              Enter Dashboard →
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              className="lg:hidden relative z-50 w-10 h-10 flex flex-col items-center justify-center gap-1.5"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <motion.span
                className="block w-6 h-0.5 origin-center bg-white"
                animate={mobileMenuOpen ? { rotate: 45, y: 4 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.3 }}
              />
              <motion.span
                className="block w-6 h-0.5 origin-center bg-white"
                animate={mobileMenuOpen ? { rotate: -45, y: -4 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.3 }}
              />
            </button>
          </div>
        </div>
      </motion.header>

      {/* ─── Mobile Menu Overlay ─── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-[#090d16] text-white flex flex-col items-center justify-center gap-8"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {navLinks.map((link, i) => (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
              >
                <Link
                  href={link.href}
                  className="font-display text-4xl uppercase tracking-wider text-white hover:text-blue-400 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: navLinks.length * 0.08 }}
            >
              <Link
                href="/dashboard"
                className="font-mono text-xs tracking-widest uppercase bg-white text-black font-bold px-8 py-4 mt-8 hover:bg-gray-200 transition-colors rounded-xl"
                onClick={() => setMobileMenuOpen(false)}
              >
                Enter Dashboard →
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Main Content ─── */}
      <main className="flex-1 w-full pt-28">
        {children}
      </main>

      {/* ─── Massive Typographic Footer ─── */}
      <footer className="bg-foreground text-background pt-24 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12 mb-24">
            <div>
              <h4 className="font-mono text-xs uppercase tracking-widest text-background/50 mb-6">Navigation</h4>
              <ul className="space-y-4">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:opacity-70 transition-opacity text-sm">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-mono text-xs uppercase tracking-widest text-background/50 mb-6">Follow Us</h4>
              <ul className="space-y-4 text-sm">
                <li><a href="https://www.linkedin.com/in/sumit-kushwaha" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">LinkedIn</a></li>
                <li><a href="https://github.com/sumitESC" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">GitHub</a></li>
                <li><a href="https://wa.me/919125600020" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">WhatsApp</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-mono text-xs uppercase tracking-widest text-background/50 mb-6">Research</h4>
              <ul className="space-y-4 text-sm">
                <li><a href="#" className="hover:opacity-70 transition-opacity">Urban Heat Islands</a></li>
                <li><a href="#" className="hover:opacity-70 transition-opacity">Green Infrastructure</a></li>
                <li><a href="#" className="hover:opacity-70 transition-opacity">Climate Adaptation</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-mono text-xs uppercase tracking-widest text-background/50 mb-6">Contact</h4>
              <p className="text-background/70 leading-relaxed mb-4 text-sm">
                Uttar Pradesh, India<br />
                Created by Sumit Kushwaha<br />
                Heat Intelligence Lab
              </p>
              <p className="font-mono text-sm">iamkussumit@gmail.com</p>
            </div>
          </div>

          {/* Huge logo text */}
          <div className="border-t border-background/15 pt-12 text-center overflow-hidden">
            <h2 className="font-display font-bold text-[11vw] leading-none tracking-tight whitespace-nowrap opacity-90">
              WeatherGPT
            </h2>
          </div>

          <div className="mt-12 flex flex-col md:flex-row items-center justify-between text-xs font-mono text-background/40 border-t border-background/10 pt-8">
            <div className="flex gap-6 mb-4 md:mb-0">
              <a href="#" className="hover:text-background transition-colors">Terms & Conditions</a>
              <a href="#" className="hover:text-background transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-background transition-colors">Accessibility</a>
            </div>
            <p>© {new Date().getFullYear()} WeatherGPT. Created by Sumit Kushwaha. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
