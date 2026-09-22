import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"logo" | "text" | "exit">("logo");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("text"), 300);
    const t2 = setTimeout(() => setPhase("exit"), 800);
    const t3 = setTimeout(() => onComplete(), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase !== "exit" ? null : null}
      <motion.div
        key="splash"
        initial={{ opacity: 1 }}
        animate={{ opacity: phase === "exit" ? 0 : 1 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background overflow-hidden"
      >
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 200 + i * 80,
                height: 200 + i * 80,
                left: `${20 + i * 12}%`,
                top: `${30 + (i % 3) * 15}%`,
                background: `radial-gradient(circle, ${
                  i % 3 === 0 ? "hsla(0, 0%, 10%, 0.06)" :
                  i % 3 === 1 ? "hsla(0, 0%, 10%, 0.04)" :
                  "hsla(0, 0%, 10%, 0.03)"
                }, transparent 70%)`,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 1], opacity: [0, 0.8, 0.4] }}
              transition={{ duration: 2, delay: i * 0.15, ease: "easeOut" }}
            />
          ))}
        </div>

        {/* Scanning line effect */}
        <motion.div
          className="absolute left-0 right-0 h-px"
          style={{
            background: "linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)",
            boxShadow: "0 0 20px 2px hsla(var(--primary), 0.3)",
          }}
          initial={{ top: "0%", opacity: 0 }}
          animate={{ top: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2, delay: 0.3, ease: "linear" }}
        />

        {/* Central content */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Logo with glow */}
          <motion.div
            className="relative"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, duration: 0.8 }}
          >
            <div className="absolute inset-0 blur-2xl bg-primary/30 rounded-full scale-150" />
            <img
              src={`${import.meta.env.BASE_URL}images/logo-mark.png`}
              alt="WeatherGPT"
              className="w-20 h-20 relative z-10 drop-shadow-2xl"
            />
            {/* Orbiting ring */}
            <motion.div
              className="absolute inset-[-12px] border-2 border-primary/30 rounded-full"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, rotate: 360 }}
              transition={{ scale: { duration: 0.5, delay: 0.3 }, rotate: { duration: 8, repeat: Infinity, ease: "linear" } }}
              style={{ borderTopColor: "hsl(var(--primary))" }}
            />
          </motion.div>

          {/* Title */}
          <motion.div
            className="mt-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: phase === "text" || phase === "exit" ? 1 : 0, y: phase === "text" || phase === "exit" ? 0 : 20 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <h1 className="text-4xl md:text-5xl font-display font-extrabold tracking-tight text-foreground">
              Weather<span className="text-primary">GPT</span>
            </h1>
            <motion.p
              className="mt-3 text-muted-foreground text-sm md:text-base tracking-widest uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.5 }}
            >
              Urban Heat Island Intelligence
            </motion.p>
          </motion.div>

          {/* Loading bar */}
          <motion.div
            className="mt-8 w-48 h-1 bg-secondary/50 rounded-full overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-foreground via-foreground/70 to-foreground/40 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, delay: 1, ease: "easeInOut" }}
            />
          </motion.div>

          {/* Status text */}
          <motion.p
            className="mt-4 text-xs text-muted-foreground/60 font-mono"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            Initializing heat analysis systems...
          </motion.p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
