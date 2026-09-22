import { useState, useEffect } from 'react';
import { Sparkles, CloudRain } from 'lucide-react';

export default function SplashPreloader({ onLoaded, isBackendReady = false }) {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const fallbackTimeout = setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(() => {
        if (onLoaded) onLoaded();
      }, 500);
    }, 5000);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          clearTimeout(fallbackTimeout);
          setTimeout(() => {
            setIsFadingOut(true);
            setTimeout(() => {
              if (onLoaded) onLoaded();
            }, 500);
          }, 200);
          return 100;
        }
        const increment = isBackendReady ? Math.floor(Math.random() * 20) + 15 : Math.floor(Math.random() * 10) + 5;
        return Math.min(prev + increment, 100);
      });
    }, 70);

    return () => {
      clearInterval(interval);
      clearTimeout(fallbackTimeout);
    };
  }, [onLoaded, isBackendReady]);

  return (
    <div 
      aria-busy={!isFadingOut}
      aria-live="polite"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white transition-opacity duration-500 ease-out select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Ambient Radial Accent */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05),transparent_60%)] pointer-events-none" />

      {/* Morphing Weather Orb Icon */}
      <div className="relative mb-8 flex items-center justify-center">
        {/* Pulsing Outer Rings */}
        <div className="absolute w-36 h-36 rounded-full bg-slate-800/30 blur-xl animate-pulse motion-reduce:animate-none" />

        {/* Central Orb Container */}
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-slate-700 via-slate-400 to-white p-[2px] shadow-2xl animate-coin-flip">
          <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent animate-pulse motion-reduce:animate-none" />
            <Sparkles className="w-10 h-10 text-white relative z-10 stroke-[2] motion-reduce:animate-none" />
          </div>
        </div>
      </div>

      {/* Title & Brand Tagline */}
      <div className="text-center relative z-10 mb-8 space-y-2">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          WeatherGPT
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 font-medium tracking-wide flex items-center justify-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-slate-300 fill-slate-300/20" />
          <span>Conversational AI Platform for Weather & Climate</span>
        </p>
      </div>

      {/* Progress Bar Container */}
      <div className="w-64 sm:w-80 space-y-2 relative z-10">
        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden p-[1px] border border-slate-800 backdrop-blur-sm">
          <div 
            className="h-full bg-white rounded-full transition-all duration-150 ease-out shadow-lg"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[11px] font-mono text-slate-500 px-1">
          <span>{progress < 100 ? 'Initializing Engine...' : 'Ready'}</span>
          <span className="text-white font-semibold">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
