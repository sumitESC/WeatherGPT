import { SUGGESTIONS } from '../../constants/suggestions';
import { Sparkles } from 'lucide-react';

export default function SuggestionCards({ onSelectSuggestion, onOpenVoiceMode }) {
  return (
    <div className="flex flex-col items-center justify-between flex-1 py-8 min-h-full">
      <div className="flex-1 flex flex-col items-center justify-center my-auto">
        <div 
          onClick={onOpenVoiceMode}
          className="w-16 h-16 bg-zinc-950 rounded-full flex items-center justify-center shadow-md mb-3 transition hover:scale-105 cursor-pointer group"
          title="Click to start Voice Assistant"
        >
          <Sparkles className="w-8 h-8 text-white stroke-[1.75] group-hover:scale-110 transition" />
        </div>
        <p className="text-xs text-zinc-400 font-medium tracking-wide mt-1">Tap icon for Voice Mode</p>
      </div>

      <div className="w-full space-y-2 mb-4">
        <div className="grid grid-cols-2 gap-2.5 w-full">
          {SUGGESTIONS.map((item, index) => (
            <button
              key={index}
              onClick={() => onSelectSuggestion(item.prompt)}
              className="flex flex-col text-left p-3.5 bg-zinc-100/80 hover:bg-zinc-200/80 border border-zinc-200/40 rounded-2xl transition duration-150 group active:scale-[0.98] cursor-pointer"
            >
              <span className="font-semibold text-[14px] text-zinc-800 group-hover:text-zinc-950">
                {item.title}
              </span>
              <span className="text-[13px] text-zinc-500 font-normal mt-0.5 line-clamp-1">
                {item.subtitle}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
