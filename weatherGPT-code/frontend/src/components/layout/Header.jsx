import { Menu, SquarePen, Sparkles, Loader2, WifiOff, RefreshCw, Home } from 'lucide-react';

export default function Header({ 
  onToggleSidebar, 
  activeSessionTitle, 
  onOpenVoiceMode, 
  onNewChat,
  onOpenLanding,
  backendStatus = 'online', // 'connecting' | 'waking_up' | 'online' | 'error'
  onRetryBackend
}) {
  return (
    <header className="flex-none flex justify-between items-center px-3 sm:px-4 py-2.5 sm:py-3 border-b border-zinc-100 bg-white/80 backdrop-blur-md z-20">
      <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
        <button 
          onClick={onToggleSidebar}
          title="Open Session History & Sidebar"
          className="p-1.5 text-zinc-700 hover:text-zinc-900 rounded-lg transition hover:bg-zinc-100 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {onOpenLanding && (
          <button
            onClick={onOpenLanding}
            title="View WeatherGPT Landing Showcase & Features"
            className="p-1.5 text-zinc-700 hover:text-sky-600 rounded-lg transition hover:bg-sky-50 cursor-pointer"
          >
            <Home className="w-5 h-5" />
          </button>
        )}
        
        <div 
          onClick={onOpenLanding}
          className="flex items-center space-x-1.5 cursor-pointer select-none min-w-0 group"
          title="Back to Landing Page"
        >
          <span className="font-semibold text-base tracking-tight text-zinc-900 group-hover:text-sky-600 transition shrink-0">
            WeatherGPT
          </span>
          {activeSessionTitle && (
            <>
              <span className="text-zinc-300 shrink-0 hidden sm:inline">•</span>
              <span className="text-xs font-medium text-zinc-500 max-w-[150px] sm:max-w-[200px] truncate hidden sm:inline">
                {activeSessionTitle}
              </span>
            </>
          )}
        </div>

        {/* Render Backend Connection Status Badge */}
        <div className="hidden md:flex items-center ml-2">
          {backendStatus === 'online' && (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[11px] font-medium" title="Connected to Render Backend">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Backend Ready</span>
            </div>
          )}

          {(backendStatus === 'connecting' || backendStatus === 'waking_up') && (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200/60 text-amber-700 text-[11px] font-medium" title="Connecting / Waking up Render free instance">
              <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
              <span>{backendStatus === 'waking_up' ? 'Waking up Render Server...' : 'Connecting to Backend...'}</span>
            </div>
          )}

          {backendStatus === 'error' && (
            <button 
              onClick={onRetryBackend}
              title="Click to retry connecting to Render backend"
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200/60 text-rose-700 text-[11px] font-medium hover:bg-rose-100 transition cursor-pointer"
            >
              <WifiOff className="w-3 h-3 text-rose-600" />
              <span>Backend Offline</span>
              <RefreshCw className="w-3 h-3 ml-0.5 text-rose-500 hover:rotate-180 transition-transform" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-1.5 shrink-0">
        <button 
          onClick={onOpenVoiceMode}
          title="Start Interactive AI Voice Assistant"
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-full transition cursor-pointer border border-zinc-200/60"
        >
          <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500/20" />
          <span className="hidden sm:inline">Voice Mode</span>
        </button>

        <button 
          onClick={onNewChat}
          title="New Chat"
          className="p-1.5 text-zinc-700 hover:text-zinc-900 rounded-lg transition hover:bg-zinc-100 cursor-pointer"
        >
          <SquarePen className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
