export default function VoiceOrb({ voiceState, onInterrupt }) {
  return (
    <div className="relative flex items-center justify-center my-6">
      {/* Outer Glow Halo */}
      <div className={`absolute w-72 h-72 sm:w-80 sm:h-80 rounded-full blur-3xl transition-all duration-700 opacity-25 ${
        voiceState === 'listening' ? 'bg-white' :
        voiceState === 'thinking' ? 'bg-blue-400' :
        voiceState === 'speaking' ? 'bg-emerald-400' : 'bg-zinc-500'
      }`}></div>

      {/* Central Morphing Orb Shape */}
      <div 
        onClick={onInterrupt}
        title="Tap Orb to interrupt WeatherGPT"
        className={`w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-white flex items-center justify-center transition-all duration-500 shadow-[0_0_90px_rgba(255,255,255,0.4)] cursor-pointer hover:scale-105 active:scale-95 ${
          voiceState === 'listening' ? 'scale-100 animate-pulse' :
          voiceState === 'thinking' ? 'rounded-[40%_60%_70%_30%/50%_60%_30%_70%] animate-[spin_5s_linear_infinite] scale-95' :
          voiceState === 'speaking' ? 'scale-105 shadow-[0_0_120px_rgba(255,255,255,0.6)]' : 'scale-90 opacity-80'
        }`}
      >
        {voiceState === 'speaking' ? (
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-12 bg-zinc-950 rounded-full animate-[bounce_0.6s_infinite_100ms]"></div>
            <div className="w-2.5 h-16 bg-zinc-950 rounded-full animate-[bounce_0.6s_infinite_300ms]"></div>
            <div className="w-2.5 h-20 bg-zinc-950 rounded-full animate-[bounce_0.6s_infinite_200ms]"></div>
            <div className="w-2.5 h-12 bg-zinc-950 rounded-full animate-[bounce_0.6s_infinite_400ms]"></div>
          </div>
        ) : voiceState === 'thinking' ? (
          <div className="w-8 h-8 rounded-full border-4 border-zinc-900 border-t-transparent animate-spin"></div>
        ) : (
          <div className="w-4 h-4 bg-zinc-950 rounded-full animate-ping opacity-75"></div>
        )}
      </div>
    </div>
  );
}
