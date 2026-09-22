import VoiceOrb from './VoiceOrb';
import { AudioLines, MicOff, Mic, X } from 'lucide-react';

const stripMarkdown = (text) => {
  if (!text) return '';
  return text
    .replace(/^[\s]*\|[\s\-:|]+\|[\s]*$/gm, '')     // Remove table separator rows
    .replace(/\|/g, ' ')                              // Remove pipe characters
    .replace(/[*_#`~>]/g, '')                         // Remove markdown formatting tokens
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')               // Convert links to plain text
    .replace(/!\[.*?\]\(.*?\)/g, '')                   // Remove images
    .replace(/---+|===+/g, '')                         // Remove horizontal rules
    .replace(/[ \t]+/g, ' ')                           // Collapse whitespace
    .replace(/\n{2,}/g, '\n')                          // Collapse multiple newlines
    .trim();
};

export default function VoiceModal({
  isOpen,
  voiceState,
  isMuted,
  voiceTranscript,
  voiceError,
  messages,
  onToggleMute,
  onInterrupt,
  onClose
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-zinc-950 text-white z-50 flex flex-col justify-between items-center p-6 select-none animate-in fade-in duration-300 font-sans">
      {/* Top Bar */}
      <div className="w-full max-w-lg flex justify-between items-center pt-2">
        <div className="flex items-center space-x-2 text-zinc-400 text-sm font-medium">
          <AudioLines className="w-4 h-4 text-white animate-pulse" />
          <span>WeatherGPT Voice</span>
        </div>

        <button
          onClick={onToggleMute}
          className="p-2.5 text-zinc-300 hover:text-white rounded-full bg-zinc-900 hover:bg-zinc-800 transition cursor-pointer border border-zinc-800"
          title={isMuted ? "Unmute Mic" : "Mute Mic"}
        >
          {isMuted ? <MicOff className="w-5 h-5 text-red-400" /> : <Mic className="w-5 h-5" />}
        </button>
      </div>

      {/* Live Voice Conversation Session Feed */}
      {messages.length > 0 && (
        <div className="w-full max-w-md max-h-32 overflow-y-auto my-2 px-4 py-2 bg-zinc-900/60 backdrop-blur-md rounded-2xl border border-zinc-800/60 text-xs space-y-2 no-scrollbar">
          {messages.slice(-2).map((m, i) => (
            <div key={i} className="flex flex-col space-y-0.5">
              <span className="font-semibold text-zinc-400">{m.role === 'user' ? 'You' : 'WeatherGPT'}</span>
              <p className="text-zinc-200 line-clamp-2">{stripMarkdown(m.content)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Center Orb Visualizer */}
      <div className="flex-1 flex flex-col items-center justify-center my-auto w-full max-w-lg">
        <VoiceOrb voiceState={voiceState} onInterrupt={onInterrupt} />

        <div className="text-center space-y-2 mt-2 px-4">
          <h2 className="text-2xl font-medium tracking-tight text-white capitalize">
            {voiceState === 'connecting' && "Connecting..."}
            {voiceState === 'listening' && (isMuted ? "Muted" : "Listening...")}
            {voiceState === 'thinking' && "Thinking..."}
            {voiceState === 'speaking' && "Speaking..."}
          </h2>

          {voiceTranscript ? (
            <p className="text-base text-zinc-300 max-w-md mx-auto font-normal leading-relaxed line-clamp-2 italic">
              "{voiceTranscript}"
            </p>
          ) : (
            <p className="text-xs text-zinc-500 font-medium tracking-wide">
              {voiceState === 'listening' && !isMuted && "Speak your query"}
            </p>
          )}



          {voiceError && (
            <p className="text-xs text-red-400 mt-2 font-medium">{voiceError}</p>
          )}
        </div>
      </div>

      {/* Bottom Bar: Red X Close Button */}
      <div className="w-full max-w-lg flex items-center justify-center pb-6">
        <button
          onClick={onClose}
          className="w-14 h-14 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition shadow-lg shadow-red-950/40 transform active:scale-95 cursor-pointer"
          title="End Voice Conversation & Return to Chat"
        >
          <X className="w-7 h-7 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}
