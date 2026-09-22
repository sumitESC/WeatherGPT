import { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import SuggestionCards from './SuggestionCards';
import { Sparkles } from 'lucide-react';

export default function ChatContainer({ 
  messages, 
  isLoading, 
  onSelectSuggestion, 
  onOpenVoiceMode,
  onEditAndRegenerate,
  onRegenerateResponse,
  onDeleteMessage,
  onRetryFromHere,
  onToggleLike,
  onToggleDislike,
  onToggleSave,
  showToast
}) {
  const mainScrollRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  return (
    <main 
      ref={mainScrollRef}
      className="flex-1 min-h-0 overflow-y-auto w-full max-w-2xl mx-auto flex flex-col px-4 scroll-smooth"
    >
      {messages.length === 0 ? (
        <SuggestionCards 
          onSelectSuggestion={onSelectSuggestion}
          onOpenVoiceMode={onOpenVoiceMode}
        />
      ) : (
        <div className="py-4 sm:py-6 space-y-6 sm:space-y-8 pb-6">
          {messages.map((msg, idx) => (
            <ChatMessage 
              key={msg.id || idx} 
              message={msg} 
              onEditAndRegenerate={onEditAndRegenerate}
              onRegenerateResponse={onRegenerateResponse}
              onDeleteMessage={onDeleteMessage}
              onRetryFromHere={onRetryFromHere}
              onToggleLike={onToggleLike}
              onToggleDislike={onToggleDislike}
              onToggleSave={onToggleSave}
              showToast={showToast}
            />
          ))}

          {isLoading && (
            <div className="flex flex-col space-y-1.5 text-[15px]">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 bg-zinc-950 text-white rounded-full flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4 stroke-[2]" />
                </div>
                <span className="font-semibold text-zinc-900 tracking-tight text-[15px]">
                  WeatherGPT
                </span>
              </div>
              <div className="pl-9.5 flex items-center space-x-1.5 py-1">
                <div className="w-2.5 h-2.5 bg-zinc-900 rounded-full animate-bounce"></div>
                <div className="w-2.5 h-2.5 bg-zinc-900 rounded-full animate-bounce [animation-delay:0.15s]"></div>
                <div className="w-2.5 h-2.5 bg-zinc-900 rounded-full animate-bounce [animation-delay:0.3s]"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}
    </main>
  );
}
