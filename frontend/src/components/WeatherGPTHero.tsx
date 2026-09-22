import { useState } from 'react';
import { 
  MessageSquare, 
  Mic, 
  Sparkles, 
  ArrowRight, 
  Zap, 
  MapPin, 
  ShieldCheck, 
  Home, 
  Menu, 
  Edit3, 
  Smartphone
} from 'lucide-react';
import { useLocation } from 'wouter';

export default function WeatherGPTHero({ whatsappUrl = "https://wa.me/919125600020" }: { whatsappUrl?: string }) {
  const [activePrompt, setActivePrompt] = useState('');
  const weatherGptUrl = "https://weathergpt-q3w1.onrender.com/";

  const handleOpenAssistant = (promptText?: string) => {
    if (promptText) {
      console.log("Opening assistant with prompt:", promptText);
    }
    window.open(weatherGptUrl, "_blank");
  };

  const handleOpenVoice = () => {
    window.open(weatherGptUrl, "_blank");
  };

  return (
    <section className="relative w-full min-h-screen bg-card text-foreground overflow-hidden flex flex-col justify-between pt-6 pb-10 border-b border-border">
      
      {/* Background Glow & Silhouettes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[65%] bg-gradient-to-b from-background/80 via-card to-card" />
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-primary/5 to-transparent blur-3xl" />
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-card via-card/95 to-transparent border-t border-border/60" />
      </div>

      {/* Header Pill */}
      <div className="relative z-30 px-4 sm:px-8 max-w-7xl mx-auto w-full flex items-center justify-between">
        <div 
          onClick={() => handleOpenAssistant()} 
          className="flex items-center space-x-2 sm:space-x-3 cursor-pointer group select-none"
        >
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-md group-hover:scale-105 transition shrink-0 animate-coin-flip">
            <Sparkles className="w-4 h-4 stroke-[2]" />
          </div>
          <span className="font-extrabold text-lg sm:text-xl tracking-tight text-foreground">
            WeatherGPT
          </span>
          <span className="text-muted-foreground font-light hidden md:inline">•</span>
          <span className="text-xs sm:text-sm font-medium text-muted-foreground hidden md:inline tracking-wide">
            AI Weather Assistant &bull; Real-time &bull; Forecasts &bull; Advisories
          </span>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-foreground bg-secondary hover:bg-secondary/80 rounded-full transition cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>WhatsApp Bot</span>
          </a>

          <button
            onClick={() => handleOpenAssistant()}
            className="flex items-center space-x-1.5 sm:space-x-2 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-extrabold text-primary-foreground bg-primary hover:opacity-90 rounded-full transition shadow-md cursor-pointer transform hover:scale-105 active:scale-95 shrink-0"
          >
            <span>Open Assistant</span>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* Hero Canvas */}
      <div className="relative z-20 my-auto py-6 sm:py-8 px-3 sm:px-4 max-w-7xl mx-auto w-full flex flex-col items-center justify-center">
        
        {/* Mobile View */}
        <div className="md:hidden w-full max-w-md mx-auto flex flex-col items-center space-y-5 text-center py-2">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-secondary border border-border text-xs font-semibold text-foreground shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>AI Meteorological Intelligence</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight leading-tight uppercase font-display">
              Conversational Weather Intelligence
            </h1>
            <p className="text-xs text-muted-foreground font-normal leading-relaxed px-2">
              Real-time weather telemetry, 30-day ML forecasts, AQI advisories, and interactive AI voice mode.
            </p>
          </div>

          <div 
            onClick={handleOpenVoice}
            className="w-full bg-gradient-to-tr from-zinc-900 via-zinc-950 to-black text-white p-5 rounded-3xl shadow-xl border border-zinc-800 flex items-center justify-between cursor-pointer group active:scale-[0.98] transition"
          >
            <div className="flex items-center space-x-3 text-left">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:scale-105 transition shrink-0">
                <Sparkles className="w-6 h-6 text-amber-400 stroke-[2]" />
              </div>
              <div>
                <div className="font-bold text-sm text-white">Interactive Voice Mode</div>
                <div className="text-[11px] text-zinc-400">Speak naturally for instant weather answer</div>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white text-zinc-950 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-amber-400 transition">
              🎙️
            </div>
          </div>

          <div className="w-full grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => handleOpenAssistant()}
              className="w-full py-3 px-4 bg-primary text-primary-foreground font-extrabold rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-md active:scale-95 transition cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Launch Chat</span>
            </button>

            <button
              onClick={handleOpenVoice}
              className="w-full py-3 px-4 bg-secondary text-secondary-foreground border border-border font-extrabold rounded-2xl text-xs flex items-center justify-center space-x-2 active:scale-95 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Voice Mode</span>
            </button>
          </div>
        </div>


        {/* Desktop View */}
        <div className="hidden md:flex relative w-full max-w-6xl flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8 lg:gap-4 my-auto">
          
          <div className="hidden lg:flex flex-col items-start absolute left-[-2%] top-[12%] z-30 max-w-[230px]">
            <div 
              onClick={() => handleOpenAssistant()}
              className="bg-background border border-border hover:border-primary p-4 rounded-2xl shadow-xl backdrop-blur-md text-left transition transform hover:scale-105 cursor-pointer group"
            >
              <div className="flex items-center space-x-2 text-foreground font-bold text-sm">
                <div className="w-7 h-7 rounded-xl bg-secondary flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-foreground" />
                </div>
                <span>Text Chat</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Ask anything about weather, forecasts, climate and more.
              </p>
            </div>
          </div>

          {/* Laptop Mockup */}
          <div className="w-full lg:w-[58%] max-w-2xl mx-auto group transform hover:-translate-y-1 transition duration-500 relative">
            <div className="relative rounded-t-2xl p-2 bg-zinc-900 border-t border-x border-zinc-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] ring-1 ring-black/10">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-black border border-zinc-800 flex items-center justify-center">
                <span className="w-0.5 h-0.5 rounded-full bg-zinc-500" />
              </div>

              <div className="w-full min-h-[340px] sm:h-[400px] bg-background text-foreground rounded-lg flex flex-col justify-between p-3 sm:p-5 font-sans overflow-hidden select-none shadow-inner border border-border">
                
                <div className="flex items-center justify-between border-b border-border pb-2 text-xs text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <Menu className="w-4 h-4 cursor-pointer" />
                    <Home className="w-4 h-4 cursor-pointer" />
                    <span className="font-semibold text-foreground text-xs sm:text-sm tracking-tight">WeatherGPT</span>
                    <span className="text-[11px] hidden sm:inline">New Weather Chat</span>
                    <span className="bg-secondary text-foreground text-[10px] font-medium px-2 py-0.5 rounded-full border border-border hidden xs:flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Backend Ready</span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={handleOpenVoice} className="bg-secondary hover:bg-secondary/80 text-foreground text-[10px] sm:text-xs font-medium px-2.5 py-1 rounded-full border border-border flex items-center space-x-1.5 cursor-pointer transition">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Voice Mode</span>
                    </button>
                    <Edit3 className="w-4 h-4 cursor-pointer" />
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center my-auto py-2">
                  <div 
                    onClick={handleOpenVoice}
                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-md hover:scale-105 transition cursor-pointer group"
                  >
                    <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 stroke-[1.75] group-hover:scale-110 transition" />
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground tracking-wide mt-2">
                    Tap icon for Voice Mode
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 max-w-lg mx-auto w-full my-auto">
                  <button 
                    onClick={() => handleOpenAssistant("What's the weather in Delhi right now?")}
                    className="flex flex-col text-left p-2.5 sm:p-3 bg-secondary/50 hover:bg-secondary border border-border rounded-xl transition cursor-pointer"
                  >
                    <span className="font-semibold text-xs text-foreground">Check weather</span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">in Delhi right now</span>
                  </button>
                  <button 
                    onClick={() => handleOpenAssistant("Is the air quality good in Mumbai?")}
                    className="flex flex-col text-left p-2.5 sm:p-3 bg-secondary/50 hover:bg-secondary border border-border rounded-xl transition cursor-pointer"
                  >
                    <span className="font-semibold text-xs text-foreground">Air Quality</span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">Check pollution in Mumbai</span>
                  </button>
                </div>

                <div className="w-full max-w-lg mx-auto pt-2">
                  <div className="bg-secondary border border-border rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between shadow-sm">
                    <input 
                      type="text" 
                      readOnly 
                      value={activePrompt}
                      placeholder="Ask anything about the weather..." 
                      onClick={() => handleOpenAssistant()}
                      className="bg-transparent text-xs text-foreground placeholder-muted-foreground outline-none w-full cursor-pointer font-normal"
                    />
                    <div className="flex items-center space-x-2 shrink-0">
                      <Mic onClick={handleOpenVoice} className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer" />
                      <button onClick={() => handleOpenAssistant()} className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition cursor-pointer">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
            <div className="relative h-4 bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900 rounded-b-xl border-t border-zinc-700 shadow-md flex justify-center">
              <div className="w-20 h-1.5 bg-zinc-950 rounded-b-md" />
            </div>
          </div>

          {/* Mobile Mockup */}
          <div className="w-full lg:w-[38%] flex flex-col sm:flex-row items-center justify-center lg:justify-end gap-6 sm:gap-6 relative">
            <div className="w-60 sm:w-64 shrink-0 rounded-[2.5rem] p-2 bg-gradient-to-b from-zinc-800 via-zinc-900 to-black border border-zinc-800 shadow-2xl ring-1 ring-black/10 group transform hover:-translate-y-1 transition duration-500 relative">
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-4 bg-black rounded-full z-20 flex items-center justify-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-zinc-900 border border-zinc-800" />
              </div>

              <div className="w-full h-[360px] sm:h-[410px] bg-background text-foreground rounded-[2.1rem] flex flex-col justify-between p-3 font-sans select-none overflow-hidden border border-border">
                <div className="flex items-center justify-between border-b border-border pb-1.5 pt-1 text-xs mt-4">
                  <div className="flex items-center space-x-1.5">
                    <Home className="w-3.5 h-3.5 text-foreground" />
                    <span className="font-semibold text-foreground text-xs tracking-tight">WeatherGPT</span>
                  </div>
                  <Menu className="w-4 h-4 text-foreground" />
                </div>

                <div className="flex flex-col items-center justify-center py-2">
                  <div onClick={handleOpenVoice} className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground cursor-pointer shadow-md hover:scale-105 transition">
                    <Sparkles className="w-5 h-5 stroke-[1.75]" />
                  </div>
                </div>

                <div className="space-y-1.5 my-auto">
                  <div onClick={() => handleOpenAssistant("Check weather")} className="bg-secondary/80 border border-border rounded-lg p-2 text-left text-[10px] cursor-pointer">
                    <div className="font-semibold text-foreground">Check weather</div>
                    <div className="text-muted-foreground">in Delhi right now</div>
                  </div>
                  <div onClick={() => handleOpenAssistant("Air Quality")} className="bg-secondary/80 border border-border rounded-lg p-2 text-left text-[10px] cursor-pointer">
                    <div className="font-semibold text-foreground">Air Quality</div>
                    <div className="text-muted-foreground">Check pollution in Mumbai</div>
                  </div>
                </div>

                <div className="pt-1">
                  <div className="bg-secondary border border-border rounded-full px-3 py-1 flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground truncate">Ask anything...</span>
                    <div className="flex items-center space-x-1 shrink-0">
                      <Mic onClick={handleOpenVoice} className="w-3.5 h-3.5" />
                      <ArrowRight onClick={() => handleOpenAssistant()} className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Feature Dock */}
      <div className="relative z-30 pt-6 px-3 sm:px-4 max-w-6xl mx-auto w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 border-t border-border mt-8">
        {[
          { icon: MessageSquare, title: "Natural Conversations", desc: "Ask in your own words" },
          { icon: Zap, title: "Instant Responses", desc: "Powered by advanced AI" },
          { icon: MapPin, title: "Location Aware", desc: "Weather for your place" },
          { icon: ShieldCheck, title: "Trusted & Accurate", desc: "Real data. Better decisions." }
        ].map((f, i) => (
          <div 
            key={i}
            onClick={() => handleOpenAssistant()}
            className="bg-card hover:bg-secondary border border-border rounded-2xl py-3 px-5 shadow-sm transition flex items-center space-x-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-foreground shrink-0 group-hover:scale-110 transition">
              <f.icon className="w-4.5 h-4.5" />
            </div>
            <div className="text-left">
              <div className="font-bold text-sm text-foreground">{f.title}</div>
              <div className="text-[11px] text-muted-foreground">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
