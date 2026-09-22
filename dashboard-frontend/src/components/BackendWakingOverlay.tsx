import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Server, RefreshCw, AlertCircle, Wifi, Flame, ShieldAlert, CheckCircle2 } from "lucide-react";
import { RENDER_BACKEND_URL } from "@/lib/renderApi";

export function BackendWakingOverlay() {
  const [isWaking, setIsWaking] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const [backendStatusText, setBackendStatusText] = useState<string>("Checking backend status...");
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [hasDismissed, setHasDismissed] = useState<boolean>(false);

  // Check if backend server is responsive
  const checkBackendHealth = useCallback(async () => {
    setIsChecking(true);
    setBackendStatusText("Pinging HeatZone API server...");
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s fast ping timeout

      const res = await fetch(`${RENDER_BACKEND_URL}/`, {
        method: "GET",
        signal: controller.signal,
        headers: { "Accept": "application/json" }
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (res && res.ok) {
        setIsWaking(false);
        setBackendStatusText("Backend active!");
        return true;
      } else {
        // Only trigger waking overlay if server actually fails or times out
        setIsWaking(true);
        setAttemptCount(prev => prev + 1);
        setBackendStatusText("Backend is inactive or waking up on Render...");
        return false;
      }
    } catch (e) {
      setIsWaking(true);
      setAttemptCount(prev => prev + 1);
      setBackendStatusText("Connecting to Render backend server...");
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Poll backend health on initial load and while waking up
  useEffect(() => {
    // Global window event listener when backend wakes up / succeeds
    const handleBackendActiveEvent = () => {
      setIsWaking(false);
      setBackendStatusText("Backend active!");
    };

    // Global window event listener to trigger overlay when API call fails due to network/timeout
    const handleBackendWakingEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ url?: string; message?: string }>;
      if (!hasDismissed) {
        setIsWaking(true);
        if (customEvent.detail?.message) {
          setBackendStatusText(customEvent.detail.message);
        }
      }
    };

    window.addEventListener("heatzone:backend-active", handleBackendActiveEvent);
    window.addEventListener("heatzone:backend-waking", handleBackendWakingEvent);
    
    // Initial health check
    checkBackendHealth();

    return () => {
      window.removeEventListener("heatzone:backend-active", handleBackendActiveEvent);
      window.removeEventListener("heatzone:backend-waking", handleBackendWakingEvent);
    };
  }, [checkBackendHealth, hasDismissed]);

  // Timer while waking up
  useEffect(() => {
    let timer: NodeJS.Timeout;
    let pollInterval: NodeJS.Timeout;

    if (isWaking && !hasDismissed) {
      timer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);

      pollInterval = setInterval(() => {
        checkBackendHealth();
      }, 4000); // Retry every 4 seconds
    } else {
      setElapsedSeconds(0);
    }

    return () => {
      clearInterval(timer);
      clearInterval(pollInterval);
    };
  }, [isWaking, hasDismissed, checkBackendHealth]);

  if (!isWaking || hasDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-background/80 backdrop-blur-xl overflow-hidden select-none"
      >
        {/* Background ambient radial gradients */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/15 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-orange-500/10 rounded-full blur-[100px]" />
        </div>

        {/* Modal Content Card */}
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="relative max-w-lg w-full bg-card/90 border border-border/80 shadow-2xl rounded-3xl p-6 sm:p-8 backdrop-blur-2xl text-center space-y-6 overflow-hidden"
        >
          {/* Top scanning highlight */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />

          {/* Icon Header */}
          <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
            {/* Radar Rings */}
            <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
            <span className="absolute inset-[-8px] rounded-full border border-orange-500/20 animate-pulse" />
            
            <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 via-orange-500/20 to-secondary border border-primary/40 flex items-center justify-center shadow-lg">
              <Server className="w-8 h-8 text-primary animate-pulse" />
            </div>
          </div>

          {/* Heading & Notice */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5 animate-bounce" />
              Render Free Tier Cold Start Active
            </div>

            <h2 className="text-2xl font-display font-extrabold text-foreground tracking-tight">
              Waking Up Backend Engine
            </h2>

            <p className="text-sm text-muted-foreground leading-relaxed px-2">
              The WeatherGPT backend server is hosted on <span className="font-semibold text-foreground">Render</span>. 
              Because free tier servers spin down during inactivity, cold starts take <span className="font-semibold text-primary">30 to 60 seconds</span> to activate.
            </p>
          </div>

          {/* Progress Box & Stats */}
          <div className="bg-secondary/40 border border-border/60 rounded-2xl p-4 space-y-3 text-left">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Wifi className={`w-3.5 h-3.5 ${isChecking ? "text-primary animate-pulse" : "text-emerald-400"}`} />
                Status: {backendStatusText}
              </span>
              <span className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                {elapsedSeconds}s elapsed
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden relative">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-500 via-primary to-orange-500 rounded-full"
                initial={{ width: "5%" }}
                animate={{ width: `${Math.min(95, (elapsedSeconds / 45) * 100)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 font-mono">
              <span>Attempt #{attemptCount}</span>
              <span>Target: {RENDER_BACKEND_URL}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={checkBackendHealth}
              disabled={isChecking}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`} />
              {isChecking ? "Connecting..." : "Retry Connection"}
            </button>

            <button
              onClick={() => setHasDismissed(true)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium transition-all border border-border/50"
            >
              Continue with Cached Data
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
