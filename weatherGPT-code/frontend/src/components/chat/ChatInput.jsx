import { useRef, useState, useEffect } from 'react';
import { Mic, MicOff, Sparkles, ArrowUp } from 'lucide-react';

export default function ChatInput({ input, setInput, onSubmit, isLoading, onOpenVoiceMode }) {
  const inputRef = useRef(null);
  const [isDictating, setIsDictating] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        e.ctrlKey || e.altKey || e.metaKey || 
        e.key === 'Escape' || e.key === 'Tab' || e.key === 'Enter'
      ) {
        return;
      }

      if (e.key.length === 1 || e.key === 'Backspace') {
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const toggleDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice typing is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (isDictating) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsDictating(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsDictating(true);
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setInput((prev) => (prev ? prev + ' ' + finalTranscript.trim() : finalTranscript.trim()));
      }
    };

    recognition.onerror = () => {
      setIsDictating(false);
    };

    recognition.onend = () => {
      setIsDictating(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      setIsDictating(false);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (isDictating && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      setIsDictating(false);
    }
    onSubmit();
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  return (
    <div className="flex-none w-full bg-white border-t border-zinc-100/80 px-3 py-2.5 sm:px-4 sm:py-3 z-10">
      <div className="max-w-2xl mx-auto">
        <form 
          onSubmit={handleSubmit}
          className="flex items-center bg-zinc-100 focus-within:bg-zinc-100 rounded-full pl-4 sm:pl-5 pr-1.5 py-1.5 sm:py-2 border border-zinc-200/60 shadow-xs transition-all"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => {
              setTimeout(() => window.scrollTo(0, 0), 10);
            }}
            enterKeyHint="send"
            autoCapitalize="sentences"
            placeholder={isDictating ? "Listening... Speak to type..." : "Ask anything about the weather..."}
            className="flex-1 bg-transparent border-none text-[16px] sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
          />

          {/* Voice-to-Text Dictation Mic Button */}
          <button 
            type="button"
            onClick={toggleDictation}
            title={isDictating ? "Stop Voice Typing" : "Voice Typing (Dictate text)"}
            className={`p-1.5 sm:p-2 transition rounded-full mr-1 cursor-pointer relative ${
              isDictating 
                ? 'text-red-600 bg-red-100 hover:bg-red-200 animate-pulse' 
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60'
            }`}
          >
            {isDictating ? (
              <MicOff className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2]" />
            ) : (
              <Mic className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2]" />
            )}
            {isDictating && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-600 rounded-full animate-ping" />
            )}
          </button>

          {/* Voice Assistant Modal Launcher Button */}
          <button 
            type="button"
            onClick={onOpenVoiceMode}
            title="Start Interactive AI Voice Assistant"
            className="p-1.5 sm:p-2 text-zinc-500 hover:text-zinc-950 transition rounded-full hover:bg-zinc-200/60 mr-1 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2] text-amber-500 hover:scale-110 transition-transform" />
          </button>

          {/* Send Message Button */}
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-950 text-white flex items-center justify-center hover:bg-zinc-800 transition-all shadow-xs disabled:opacity-30 disabled:hover:bg-zinc-950 cursor-pointer disabled:cursor-not-allowed shrink-0"
          >
            <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          </button>
        </form>

        <div className="text-center mt-1 sm:mt-1.5">
          <span className="text-[10px] sm:text-[11px] text-zinc-400 font-medium">
            WeatherGPT can make mistakes. Verify important weather info.
          </span>
        </div>
      </div>
    </div>
  );
}

