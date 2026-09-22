import { Send, Smartphone, ExternalLink } from 'lucide-react';

export default function LandingFooter({ onOpenFeedback, whatsappUrl, linkedinUrl }) {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white py-12 px-4 sm:px-8 text-zinc-600 text-xs">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        
        <div className="space-y-1 text-center md:text-left">
          <div className="text-zinc-950 font-bold text-sm tracking-wide">WeatherGPT Platform</div>
          <p className="text-zinc-500">Conversational AI for Weather Forecasting, Early Warning Alerts & Climate Information</p>
          <p className="text-zinc-400">Created by Sumit Kushwaha © 2026 WeatherGPT. All rights reserved.</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onOpenFeedback}
            className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-xl border border-zinc-200 transition flex items-center space-x-2 cursor-pointer font-medium"
          >
            <Send className="w-3.5 h-3.5 text-zinc-700" />
            <span>Share Feedback</span>
          </button>

          <a
            href={linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-xl border border-zinc-200 transition flex items-center space-x-2 cursor-pointer font-medium"
          >
            <svg className="w-3.5 h-3.5 text-zinc-800 fill-current" viewBox="0 0 24 24">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.78a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24z" />
            </svg>
            <span>LinkedIn</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-xl border border-zinc-200 transition flex items-center space-x-2 cursor-pointer font-medium"
          >
            <Smartphone className="w-3.5 h-3.5 text-zinc-800" />
            <span>WhatsApp</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>
        </div>
      </div>
    </footer>
  );
}

