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
  Smartphone,
  Calendar,
  Bell
} from 'lucide-react';

export default function HeroSection({ onOpenAssistant, onOpenVoice, whatsappUrl }) {
  const [activePrompt, setActivePrompt] = useState('');

  const handleSuggestionClick = (promptText) => {
    onOpenAssistant(promptText);
  };

  return (
    <section className="relative w-full min-h-screen bg-white text-zinc-900 overflow-hidden flex flex-col justify-between selection:bg-zinc-950 selection:text-white pt-6 pb-10">
      
      {/* Background Glow & Silhouettes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Radial Ambient Glow */}
        <div className="absolute top-0 inset-x-0 h-[65%] bg-gradient-to-b from-zinc-100/80 via-white to-white" />
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-200/50 via-zinc-100/20 to-transparent blur-3xl" />

        {/* Subtle Silhouette Vectors */}
        <svg className="absolute bottom-16 inset-x-0 w-full h-64 text-zinc-100/80 object-cover" preserveAspectRatio="none" viewBox="0 0 1440 320">
          <path fill="currentColor" fillOpacity="0.8" d="M0,192L48,176C96,160,192,128,288,138.7C384,149,480,203,576,213.3C672,224,768,192,864,165.3C960,139,1056,117,1152,128C1248,139,1344,181,1392,202.7L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
        <svg className="absolute bottom-10 inset-x-0 w-full h-48 text-zinc-200/50 object-cover" preserveAspectRatio="none" viewBox="0 0 1440 320">
          <path fill="currentColor" d="M0,224L60,213.3C120,203,240,181,360,186.7C480,192,600,224,720,213.3C840,203,960,149,1080,138.7C1200,128,1320,160,1380,176L1440,192L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"></path>
        </svg>

        {/* Bottom Division Ledge */}
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-white via-white/95 to-transparent border-t border-zinc-200/60" />
      </div>

      {/* Header Pill */}
      <div className="relative z-30 px-4 sm:px-8 max-w-7xl mx-auto w-full flex items-center justify-between">
        
        {/* Main WeatherGPT Logo Brand Pill */}
        <div 
          onClick={() => onOpenAssistant()} 
          className="flex items-center space-x-2 sm:space-x-3 cursor-pointer group select-none"
        >
          <div className="w-8 h-8 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition shrink-0 animate-coin-flip">
            <Sparkles className="w-4 h-4 text-white stroke-[2]" />
          </div>
          <span className="font-extrabold text-lg sm:text-xl tracking-tight text-zinc-950 group-hover:text-black transition">
            WeatherGPT
          </span>
          <span className="text-zinc-300 font-light hidden md:inline">•</span>
          <span className="text-xs sm:text-sm font-medium text-zinc-500 hidden md:inline tracking-wide">
            AI Weather Assistant &bull; Real-time &bull; Forecasts &bull; Advisories
          </span>
        </div>

        {/* Top Right Action CTAs */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-full border border-zinc-200/80 transition cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5 text-zinc-950" />
            <span>WhatsApp Bot</span>
          </a>

          <button
            onClick={() => onOpenAssistant()}
            className="flex items-center space-x-1.5 sm:space-x-2 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-extrabold text-white bg-zinc-950 hover:bg-black rounded-full transition shadow-md cursor-pointer transform hover:scale-105 active:scale-95 shrink-0"
          >
            <span>Open Assistant</span>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* Hero Canvas */}
      <div className="relative z-20 my-auto py-6 sm:py-8 px-3 sm:px-4 max-w-7xl mx-auto w-full flex flex-col items-center justify-center">
        
        {/* ========================================================================= */}
        {/* MOBILE SMARTPHONE HERO VIEW (Shown strictly on phones < 768px)            */}
        {/* Clean native cards without fake bezels, fake webcams, or fake status bars */}
        {/* ========================================================================= */}
        <div className="md:hidden w-full max-w-md mx-auto flex flex-col items-center space-y-5 text-center py-2">
          
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-semibold text-zinc-800 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>AI Meteorological Intelligence</span>
          </div>

          {/* Headline */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight leading-tight">
              Conversational Weather Intelligence
            </h1>
            <p className="text-xs text-zinc-500 font-normal leading-relaxed px-2">
              Real-time weather telemetry, 30-day ML forecasts, AQI advisories, and interactive AI voice mode.
            </p>
          </div>

          {/* Voice Orb Launcher Card */}
          <div 
            onClick={onOpenVoice}
            className="w-full bg-gradient-to-tr from-zinc-900 via-zinc-950 to-black text-white p-5 rounded-3xl shadow-xl border border-zinc-800 flex items-center justify-between cursor-pointer group active:scale-[0.98] transition"
          >
            <div className="flex items-center space-x-3 text-left">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center group-hover:scale-105 transition shrink-0">
                <Sparkles className="w-6 h-6 text-amber-400 stroke-[2]" />
              </div>
              <div>
                <div className="font-bold text-sm text-white">Interactive Voice Mode</div>
                <div className="text-[11px] text-zinc-400">Speak naturally for instant weather answer</div>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white text-zinc-950 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-amber-400 transition">
              <Mic className="w-4 h-4" />
            </div>
          </div>

          {/* Direct CTA Buttons */}
          <div className="w-full grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => onOpenAssistant()}
              className="w-full py-3 px-4 bg-zinc-950 hover:bg-black text-white font-extrabold rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-md active:scale-95 transition cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-white" />
              <span>Launch Chat</span>
            </button>

            <button
              onClick={onOpenVoice}
              className="w-full py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 border border-zinc-200 font-extrabold rounded-2xl text-xs flex items-center justify-center space-x-2 active:scale-95 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500/20" />
              <span>Voice Mode</span>
            </button>
          </div>

          {/* Native Mobile Quick Prompt Cards */}
          <div className="w-full space-y-2 pt-2 text-left">
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider px-1">
              Tap a suggestion to ask instantly:
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={() => handleSuggestionClick("What's the weather in Delhi right now?")}
                className="w-full p-3 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 rounded-2xl text-left transition cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-xs text-zinc-900 group-hover:text-black">What's the weather in Delhi right now?</div>
                  <div className="text-[11px] text-zinc-500">Real-time condition & temp</div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-950 shrink-0 ml-2" />
              </button>

              <button 
                onClick={() => handleSuggestionClick("Is the air quality good in Mumbai?")}
                className="w-full p-3 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 rounded-2xl text-left transition cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-xs text-zinc-900 group-hover:text-black">Is the air quality good in Mumbai?</div>
                  <div className="text-[11px] text-zinc-500">PM2.5 & AQI forecast</div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-950 shrink-0 ml-2" />
              </button>

              <button 
                onClick={() => handleSuggestionClick("Give me the 7 day forecast for Bengaluru")}
                className="w-full p-3 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 rounded-2xl text-left transition cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-xs text-zinc-900 group-hover:text-black">Give me the 7-day forecast for Bengaluru</div>
                  <div className="text-[11px] text-zinc-500">Rainfall probability & trends</div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-950 shrink-0 ml-2" />
              </button>
            </div>
          </div>

        </div>


        {/* ========================================================================= */}
        {/* DESKTOP & TABLET SHOWCASE STAGE (Shown on screens >= 768px)                */}
        {/* Interactive 3D Laptop and 3D Smartphone Frame Showcase                    */}
        {/* ========================================================================= */}
        <div className="hidden md:flex relative w-full max-w-6xl flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8 lg:gap-4 my-auto">
          
          {/* Left Callout */}
          <div className="hidden lg:flex flex-col items-start absolute left-[-2%] top-[12%] z-30 max-w-[230px]">
            <div 
              onClick={() => onOpenAssistant()}
              className="bg-white/95 hover:bg-white border border-zinc-200 hover:border-zinc-900 p-4 rounded-2xl shadow-xl backdrop-blur-md text-left transition transform hover:scale-105 cursor-pointer group"
            >
              <div className="flex items-center space-x-2 text-zinc-950 font-bold text-sm">
                <div className="w-7 h-7 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-zinc-950" />
                </div>
                <span>Text Chat</span>
              </div>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                Ask anything about weather, forecasts, climate and more.
              </p>
            </div>

            {/* Curved SVG Indicator Arrow */}
            <svg className="w-20 h-14 text-zinc-400 ml-12 mt-1 pointer-events-none" viewBox="0 0 80 50" fill="none">
              <path d="M 10 10 Q 50 35 70 45" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
              <polygon points="70,45 60,40 64,48" fill="currentColor" />
            </svg>
          </div>

          {/* Laptop Mockup */}
          <div className="w-full lg:w-[58%] max-w-2xl mx-auto group transform hover:-translate-y-1 transition duration-500 relative">
            
            {/* Laptop Outer Bezel & Screen Chassis */}
            <div className="relative rounded-t-2xl p-2 bg-zinc-900 border-t border-x border-zinc-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] ring-1 ring-black/10">
              
              {/* Webcam Dot */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-black border border-zinc-800 flex items-center justify-center">
                <span className="w-0.5 h-0.5 rounded-full bg-zinc-500" />
              </div>

              {/* Laptop Display Screen */}
              <div className="w-full min-h-[340px] sm:h-[400px] bg-white text-zinc-900 rounded-lg flex flex-col justify-between p-3 sm:p-5 font-sans overflow-hidden select-none shadow-inner border border-zinc-200">
                
                {/* Screen Header Bar */}
                <div className="flex items-center justify-between border-b border-zinc-100 pb-2 text-xs text-zinc-600">
                  <div className="flex items-center space-x-2">
                    <Menu className="w-4 h-4 text-zinc-600 cursor-pointer" />
                    <Home className="w-4 h-4 text-zinc-600 cursor-pointer" />
                    <span className="font-semibold text-zinc-900 text-xs sm:text-sm tracking-tight">WeatherGPT</span>
                    <span className="text-zinc-400 text-[11px] hidden sm:inline">New Weather Chat</span>
                    <span className="bg-zinc-100 text-zinc-900 text-[10px] font-medium px-2 py-0.5 rounded-full border border-zinc-300 hidden xs:flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 animate-pulse" />
                      <span>Backend Ready</span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={onOpenVoice} className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-[10px] sm:text-xs font-medium px-2.5 py-1 rounded-full border border-zinc-300 flex items-center space-x-1.5 cursor-pointer transition">
                      <Sparkles className="w-3.5 h-3.5 text-zinc-950" />
                      <span>Voice Mode</span>
                    </button>
                    <Edit3 className="w-4 h-4 text-zinc-400 cursor-pointer hover:text-zinc-700" />
                  </div>
                </div>

                {/* Center Soundwave Voice Icon */}
                <div className="flex flex-col items-center justify-center my-auto py-2">
                  <div 
                    onClick={onOpenVoice}
                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-zinc-950 flex items-center justify-center text-white shadow-md hover:scale-105 transition cursor-pointer group"
                    title="Click to start Voice Assistant"
                  >
                    <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-white stroke-[1.75] group-hover:scale-110 transition" />
                  </div>
                  <span className="text-[11px] font-medium text-zinc-400 tracking-wide mt-2">
                    Tap icon for Voice Mode
                  </span>
                </div>

                {/* 4 Quick Suggestion Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 max-w-lg mx-auto w-full my-auto">
                  <button 
                    onClick={() => handleSuggestionClick("What's the weather in Delhi right now?")}
                    className="flex flex-col text-left p-2.5 sm:p-3 bg-zinc-100/80 hover:bg-zinc-200/80 border border-zinc-200/50 rounded-xl sm:rounded-2xl transition group active:scale-[0.98] cursor-pointer"
                  >
                    <span className="font-semibold text-xs text-zinc-900 group-hover:text-black">Check weather</span>
                    <span className="text-[11px] text-zinc-500 font-normal mt-0.5">in Delhi right now</span>
                  </button>
                  <button 
                    onClick={() => handleSuggestionClick("Is the air quality good in Mumbai?")}
                    className="flex flex-col text-left p-2.5 sm:p-3 bg-zinc-100/80 hover:bg-zinc-200/80 border border-zinc-200/50 rounded-xl sm:rounded-2xl transition group active:scale-[0.98] cursor-pointer"
                  >
                    <span className="font-semibold text-xs text-zinc-900 group-hover:text-black">Air Quality</span>
                    <span className="text-[11px] text-zinc-500 font-normal mt-0.5">Check pollution in Mumbai</span>
                  </button>
                  <button 
                    onClick={() => handleSuggestionClick("Give me the 7 day forecast for Bengaluru")}
                    className="flex flex-col text-left p-2.5 sm:p-3 bg-zinc-100/80 hover:bg-zinc-200/80 border border-zinc-200/50 rounded-xl sm:rounded-2xl transition group active:scale-[0.98] cursor-pointer hidden xs:flex"
                  >
                    <span className="font-semibold text-xs text-zinc-900 group-hover:text-black">7-Day Forecast</span>
                    <span className="text-[11px] text-zinc-500 font-normal mt-0.5">Will it rain in Bengaluru?</span>
                  </button>
                  <button 
                    onClick={() => handleSuggestionClick("What is the current temperature and humidity in Kolkata?")}
                    className="flex flex-col text-left p-2.5 sm:p-3 bg-zinc-100/80 hover:bg-zinc-200/80 border border-zinc-200/50 rounded-xl sm:rounded-2xl transition group active:scale-[0.98] cursor-pointer hidden xs:flex"
                  >
                    <span className="font-semibold text-xs text-zinc-900 group-hover:text-black">Weather & Humidity</span>
                    <span className="text-[11px] text-zinc-500 font-normal mt-0.5">Current conditions in Kolkata</span>
                  </button>
                </div>

                {/* Bottom Interactive Chat Bar */}
                <div className="w-full max-w-lg mx-auto pt-2">
                  <div className="bg-zinc-100 border border-zinc-200 rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between shadow-xs">
                    <input 
                      type="text" 
                      readOnly 
                      value={activePrompt}
                      placeholder="Ask anything about the weather..." 
                      onClick={() => onOpenAssistant()}
                      className="bg-transparent text-xs text-zinc-900 placeholder-zinc-400 outline-none w-full cursor-pointer font-normal"
                    />
                    <div className="flex items-center space-x-2 shrink-0">
                      <Mic onClick={onOpenVoice} className="w-4 h-4 text-zinc-600 hover:text-zinc-900 cursor-pointer" />
                      <Sparkles onClick={() => onOpenAssistant()} className="w-4 h-4 text-zinc-600 hover:text-zinc-900 cursor-pointer" />
                      <button onClick={() => onOpenAssistant()} className="w-6 h-6 rounded-full bg-zinc-950 hover:bg-black text-white flex items-center justify-center transition cursor-pointer">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] text-zinc-400 text-center mt-1.5 font-normal">
                    WeatherGPT can make mistakes. Verify important weather info.
                  </div>
                </div>

              </div>
            </div>

            {/* Laptop Base */}
            <div className="relative h-4 bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900 rounded-b-xl border-t border-zinc-700 shadow-md flex justify-center">
              <div className="w-20 h-1.5 bg-zinc-950 rounded-b-md" />
            </div>

          </div>

          {/* Mobile Mockup & Voice Widget */}
          <div className="w-full lg:w-[38%] flex flex-col sm:flex-row items-center justify-center lg:justify-end gap-6 sm:gap-6 relative">
            
            {/* Phone Chassis */}
            <div className="w-60 sm:w-64 shrink-0 rounded-[2.5rem] p-2 bg-gradient-to-b from-zinc-800 via-zinc-900 to-black border border-zinc-800 shadow-2xl ring-1 ring-black/10 group transform hover:-translate-y-1 transition duration-500 relative">
              
              {/* Dynamic Island Notch */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-4 bg-black rounded-full z-20 flex items-center justify-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-zinc-900 border border-zinc-800" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
              </div>

              {/* Phone Display Screen */}
              <div className="w-full h-[360px] sm:h-[410px] bg-white text-zinc-900 rounded-[2.1rem] flex flex-col justify-between p-3 font-sans select-none overflow-hidden border border-zinc-200">
                
                {/* Mobile Status Bar */}
                <div className="flex justify-between items-center text-[10px] text-zinc-600 px-2 pt-1 font-semibold">
                  <span>9:41</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-[9px]">5G</span>
                    <span className="w-3 h-2 border border-zinc-600 rounded-xs inline-block" />
                  </div>
                </div>

                {/* Mobile Header */}
                <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5 pt-1 text-xs">
                  <div className="flex items-center space-x-1.5">
                    <Home className="w-3.5 h-3.5 text-zinc-700" />
                    <span className="font-semibold text-zinc-900 text-xs tracking-tight">WeatherGPT</span>
                    <span className="bg-zinc-100 text-zinc-900 text-[9px] font-medium px-1.5 py-0.2 rounded-full border border-zinc-300">Ready</span>
                  </div>
                  <Menu className="w-4 h-4 text-zinc-700" />
                </div>

                {/* Mobile Soundwave Icon */}
                <div className="flex flex-col items-center justify-center py-2">
                  <div onClick={onOpenVoice} className="w-11 h-11 rounded-full bg-zinc-950 flex items-center justify-center text-white cursor-pointer shadow-md hover:scale-105 transition">
                    <Sparkles className="w-5 h-5 text-white stroke-[1.75]" />
                  </div>
                  <span className="text-[9px] text-zinc-400 font-medium mt-1">Tap icon for Voice Mode</span>
                </div>

                {/* Mobile Cards Stack */}
                <div className="space-y-1.5 my-auto">
                  <div onClick={() => handleSuggestionClick("What's the weather in Delhi right now?")} className="bg-zinc-100/80 border border-zinc-200/50 rounded-lg p-2 text-left text-[10px] cursor-pointer hover:bg-zinc-200/80">
                    <div className="font-semibold text-zinc-900">Check weather</div>
                    <div className="text-[9px] text-zinc-500">in Delhi right now</div>
                  </div>
                  <div onClick={() => handleSuggestionClick("Is the air quality good in Mumbai?")} className="bg-zinc-100/80 border border-zinc-200/50 rounded-lg p-2 text-left text-[10px] cursor-pointer hover:bg-zinc-200/80">
                    <div className="font-semibold text-zinc-900">Air Quality</div>
                    <div className="text-[9px] text-zinc-500">Check pollution in Mumbai</div>
                  </div>
                  <div onClick={() => handleSuggestionClick("Give me the 7 day forecast for Bengaluru")} className="bg-zinc-100/80 border border-zinc-200/50 rounded-lg p-2 text-left text-[10px] cursor-pointer hover:bg-zinc-200/80">
                    <div className="font-semibold text-zinc-900">7-Day Forecast</div>
                    <div className="text-[9px] text-zinc-500">Will it rain in Bengaluru?</div>
                  </div>
                </div>

                {/* Mobile Input */}
                <div className="pt-1">
                  <div className="bg-zinc-100 border border-zinc-200 rounded-full px-3 py-1 flex items-center justify-between text-[10px]">
                    <span className="text-zinc-400 truncate">Ask anything about weather...</span>
                    <div className="flex items-center space-x-1 shrink-0">
                      <Mic onClick={onOpenVoice} className="w-3.5 h-3.5 text-zinc-500" />
                      <ArrowRight onClick={() => onOpenAssistant()} className="w-3.5 h-3.5 text-zinc-900" />
                    </div>
                  </div>
                  <div className="text-[8px] text-zinc-400 text-center mt-1">
                    WeatherGPT can make mistakes.
                  </div>
                </div>

              </div>
            </div>

            {/* 3D Monochrome Voice Orb Widget */}
            <div className="flex flex-col items-center justify-center space-y-3 shrink-0">
              <div 
                onClick={onOpenVoice} 
                className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full p-1 bg-gradient-to-tr from-zinc-800 via-zinc-950 to-black shadow-xl cursor-pointer group transform hover:scale-105 transition duration-300 ring-2 ring-zinc-300/40"
              >
                <div className="w-full h-full rounded-full bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden border border-zinc-800">
                  <div className="absolute inset-0 bg-white/10 animate-pulse rounded-full" />
                  <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 text-white z-10 stroke-[1.75] group-hover:scale-110 transition" />
                  <span className="text-xs font-bold text-white z-10 mt-1 tracking-wide">
                    Listening...
                  </span>
                </div>
              </div>

              <button 
                onClick={onOpenVoice}
                className="px-4 py-1.5 rounded-full bg-zinc-950 hover:bg-black border border-zinc-800 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md cursor-pointer transition transform hover:scale-105"
              >
                <Mic className="w-3.5 h-3.5 text-white" />
                <span>Tap to speak</span>
              </button>
            </div>

          </div>

          {/* Right Callout */}
          <div className="hidden lg:flex flex-col items-end absolute right-[-2%] top-[12%] z-30 max-w-[230px]">
            <div 
              onClick={onOpenVoice}
              className="bg-white/95 hover:bg-white border border-zinc-200 hover:border-zinc-900 p-4 rounded-2xl shadow-xl backdrop-blur-md text-left transition transform hover:scale-105 cursor-pointer group"
            >
              <div className="flex items-center space-x-2 text-zinc-950 font-bold text-sm">
                <div className="w-7 h-7 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-zinc-950 stroke-[2]" />
                </div>
                <span>Voice Mode</span>
              </div>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                Speak naturally and get instant weather updates & insights.
              </p>
            </div>

            {/* Curved SVG Indicator Arrow */}
            <svg className="w-20 h-14 text-zinc-400 mr-12 mt-1 pointer-events-none" viewBox="0 0 80 50" fill="none">
              <path d="M 70 10 Q 30 35 10 45" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
              <polygon points="10,45 20,40 16,48" fill="currentColor" />
            </svg>
          </div>

        </div>

      </div>

      {/* Bottom Feature Dock */}
      <div className="relative z-30 pt-6 px-3 sm:px-4 max-w-6xl mx-auto w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        
        <div 
          onClick={() => onOpenAssistant()}
          className="bg-white hover:bg-zinc-50 border border-zinc-200/90 rounded-2xl sm:rounded-full py-2.5 sm:py-3 px-4 sm:px-5 shadow-sm transition flex items-center space-x-3 cursor-pointer group transform hover:scale-105"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-950 shrink-0 group-hover:scale-110 transition">
            <ShieldCheck className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="text-left">
            <div className="font-extrabold text-xs sm:text-sm text-zinc-950">Sense-Layer AI</div>
            <div className="text-[11px] text-zinc-500">100% real data, zero hallucinations</div>
          </div>
        </div>

        <div 
          onClick={() => onOpenAssistant()}
          className="bg-white hover:bg-zinc-50 border border-zinc-200/90 rounded-2xl sm:rounded-full py-2.5 sm:py-3 px-4 sm:px-5 shadow-sm transition flex items-center space-x-3 cursor-pointer group transform hover:scale-105"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-950 shrink-0 group-hover:scale-110 transition">
            <Calendar className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="text-left">
            <div className="font-extrabold text-xs sm:text-sm text-zinc-950">30-Day Forecasts</div>
            <div className="text-[11px] text-zinc-500">HeatZone ML 720-hour predictions</div>
          </div>
        </div>

        <div 
          onClick={onOpenVoice}
          className="bg-white hover:bg-zinc-50 border border-zinc-200/90 rounded-2xl sm:rounded-full py-2.5 sm:py-3 px-4 sm:px-5 shadow-sm transition flex items-center space-x-3 cursor-pointer group transform hover:scale-105"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-950 shrink-0 group-hover:scale-110 transition">
            <Mic className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="text-left">
            <div className="font-extrabold text-xs sm:text-sm text-zinc-950">Smart Voice Mode</div>
            <div className="text-[11px] text-zinc-500">Speak naturally and seamlessly</div>
          </div>
        </div>

        <div 
          onClick={() => onOpenAssistant()}
          className="bg-white hover:bg-zinc-50 border border-zinc-200/90 rounded-2xl sm:rounded-full py-2.5 sm:py-3 px-4 sm:px-5 shadow-sm transition flex items-center space-x-3 cursor-pointer group transform hover:scale-105"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-950 shrink-0 group-hover:scale-110 transition">
            <Smartphone className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="text-left">
            <div className="font-extrabold text-xs sm:text-sm text-zinc-950">WhatsApp & Alerts</div>
            <div className="text-[11px] text-zinc-500">Zero-install bot & emergency SMS</div>
          </div>
        </div>

      </div>

    </section>
  );
}
