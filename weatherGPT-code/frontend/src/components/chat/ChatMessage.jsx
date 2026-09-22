import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles,
  Pencil,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  VolumeX,
  Bookmark,
  MoreHorizontal,
  X,
  Send
} from 'lucide-react';

const cleanTextForTTS = (text) => {
  if (!text) return '';
  let cleaned = text;

  const lines = cleaned.split('\n');
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (/^\|[\s\-:|]+\|$/.test(trimmed)) return '';
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
      if (cells.length === 2) return `${cells[0]}: ${cells[1]}.`;
      else if (cells.length > 2) return cells.join(', ') + '.';
    }
    return line;
  });
  cleaned = processedLines.filter(l => l !== '').join('\n');

  cleaned = cleaned
    .replace(/^[-\s*_=#]{2,}$/gm, '')
    .replace(/---+|===+/g, '')
    .replace(/-{2,}/g, ' ')
    .replace(/ - /g, ' ')
    .replace(/\|/g, ' ')
    .replace(/[*_#`~>]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '');

  cleaned = cleaned
    .replace(/°C/g, ' degrees Celsius')
    .replace(/°F/g, ' degrees Fahrenheit')
    .replace(/≈/g, ' about ')
    .replace(/%/g, ' percent ')
    .replace(/m\/s|m s⁻¹/g, ' meters per second ')
    .replace(/km\/h/g, ' kilometers per hour ')
    .replace(/hPa/g, ' hectopascals ')
    .replace(/µg\/m³|ug\/m3/g, ' micrograms per cubic meter ')
    .replace(/\bAQI\b/g, ' A Q I ');

  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');

  return cleaned
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, '. ')
    .replace(/\.\.+/g, '.')
    .trim();
};

export default function ChatMessage({
  message,
  onEditAndRegenerate,
  onRegenerateResponse,
  onDeleteMessage,
  onRetryFromHere,
  onToggleLike,
  onToggleDislike,
  onToggleSave,
  showToast
}) {
  const isUser = message.role === 'user';
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isCopied, setIsCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const textareaRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    setEditContent(message.content);
  }, [message.content]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [isEditing]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (isPlayingAudio && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isPlayingAudio]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setIsCopied(true);
    if (showToast) showToast('Copied to clipboard', 'success');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    if (!editContent.trim()) return;
    setIsEditing(false);
    if (onEditAndRegenerate) {
      onEditAndRegenerate(message.id, editContent);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const toggleReadAloud = () => {
    if (!('speechSynthesis' in window)) {
      if (showToast) showToast('Read aloud is not supported in this browser', 'error');
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      if (showToast) showToast('Speech stopped', 'info');
    } else {
      window.speechSynthesis.cancel();
      const cleaned = cleanTextForTTS(message.content);
      const utterance = new SpeechSynthesisUtterance(cleaned);

      const voices = window.speechSynthesis.getVoices();
      const isHindi = /[\u0900-\u097F]/.test(cleaned);

      if (isHindi) {
        utterance.lang = 'hi-IN';
        const hindiVoice = voices.find(v => v.lang.startsWith('hi') && (v.name.includes('Natural') || v.name.includes('Swara') || v.name.includes('Google'))) || voices.find(v => v.lang.startsWith('hi'));
        if (hindiVoice) utterance.voice = hindiVoice;
      } else {
        utterance.lang = 'en-US';
        const bestVoice = voices.find(v =>
          v.lang.startsWith('en') && (
            v.name.includes('Natural') ||
            v.name.includes('Aria') ||
            v.name.includes('Guy') ||
            v.name.includes('Jenny') ||
            v.name.includes('Google US English') ||
            v.name.includes('Google UK English Female') ||
            v.name.includes('Samantha') ||
            v.name.includes('Serena')
          )
        ) || voices.find(v => v.lang.startsWith('en-US')) || voices.find(v => v.lang.startsWith('en'));
        if (bestVoice) utterance.voice = bestVoice;
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.02;

      utterance.onstart = () => {
        setIsPlayingAudio(true);
        if (showToast) showToast('Reading aloud...', 'info');
      };

      utterance.onend = () => {
        setIsPlayingAudio(false);
      };

      utterance.onerror = () => {
        setIsPlayingAudio(false);
      };

      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="group relative flex flex-col space-y-2 text-[15px]">
      {/* Header Avatar & Role */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 flex-wrap sm:flex-nowrap">
          {isUser ? (
            <div className="w-7 h-7 bg-zinc-800 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
              You
            </div>
          ) : (
            <div className="w-7 h-7 bg-zinc-950 text-white rounded-full flex items-center justify-center shadow-xs shrink-0">
              <Sparkles className="w-4 h-4 stroke-[2]" />
            </div>
          )}
          <span className="font-semibold text-zinc-900 tracking-tight text-[15px] shrink-0">
            {isUser ? 'You' : 'WeatherGPT'}
          </span>
          {message.timestamp && (
            <span className="text-xs text-zinc-400 font-normal whitespace-nowrap shrink-0">
              {message.timestamp}
            </span>
          )}
          {message.saved && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap shrink-0">
              <Bookmark className="w-2.5 h-2.5 mr-1 fill-amber-500 text-amber-500" /> Saved
            </span>
          )}
        </div>

        {/* Floating Quick Action Toolbar (Desktop Hover / Always Accessible) */}
        {!isEditing && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center space-x-1 bg-white border border-zinc-200 shadow-sm rounded-lg p-1 text-zinc-600">
            {isUser ? (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 hover:bg-zinc-100 hover:text-zinc-900 rounded-md transition-colors cursor-pointer"
                  title="Edit & Regenerate"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleCopy}
                  className="p-1.5 hover:bg-zinc-100 hover:text-zinc-900 rounded-md transition-colors cursor-pointer"
                  title="Copy message"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => onRegenerateResponse && onRegenerateResponse(message.id)}
                  className="p-1.5 hover:bg-zinc-100 hover:text-zinc-900 rounded-md transition-colors cursor-pointer"
                  title="Regenerate response"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onRetryFromHere && onRetryFromHere(message.id)}
                  className="p-1.5 hover:bg-zinc-100 hover:text-zinc-900 rounded-md transition-colors cursor-pointer"
                  title="Retry from here"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDeleteMessage && onDeleteMessage(message.id)}
                  className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                  title="Delete message"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleCopy}
                  className="p-1.5 hover:bg-zinc-100 hover:text-zinc-900 rounded-md transition-colors cursor-pointer"
                  title="Copy response"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => onToggleLike && onToggleLike(message.id)}
                  className={`p-1.5 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer ${message.liked ? 'text-sky-600 font-bold fill-sky-100' : 'hover:text-zinc-900'
                    }`}
                  title="Like response"
                >
                  <ThumbsUp className={`w-3.5 h-3.5 ${message.liked ? 'fill-sky-500 text-sky-600' : ''}`} />
                </button>
                <button
                  onClick={() => onToggleDislike && onToggleDislike(message.id)}
                  className={`p-1.5 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer ${message.disliked ? 'text-rose-600 font-bold fill-rose-100' : 'hover:text-zinc-900'
                    }`}
                  title="Dislike response"
                >
                  <ThumbsDown className={`w-3.5 h-3.5 ${message.disliked ? 'fill-rose-500 text-rose-600' : ''}`} />
                </button>
                <button
                  onClick={() => onRegenerateResponse && onRegenerateResponse(message.id)}
                  className="p-1.5 hover:bg-zinc-100 hover:text-zinc-900 rounded-md transition-colors cursor-pointer"
                  title="Regenerate response"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={toggleReadAloud}
                  className={`p-1.5 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer ${isPlayingAudio ? 'text-indigo-600 bg-indigo-50 font-bold' : 'hover:text-zinc-900'
                    }`}
                  title={isPlayingAudio ? 'Stop reading' : 'Read aloud'}
                >
                  {isPlayingAudio ? (
                    <VolumeX className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => onToggleSave && onToggleSave(message.id)}
                  className={`p-1.5 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer ${message.saved ? 'text-amber-600' : 'hover:text-zinc-900'
                    }`}
                  title={message.saved ? 'Unpin message' : 'Save message'}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${message.saved ? 'fill-amber-500 text-amber-500' : ''}`} />
                </button>
              </>
            )}

            {/* Dropdown Menu Toggle */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-1.5 hover:bg-zinc-100 hover:text-zinc-900 rounded-md transition-colors cursor-pointer"
                title="More actions"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-zinc-200 rounded-lg shadow-xl py-1 z-30 text-xs font-medium text-zinc-700">
                  {isUser ? (
                    <>
                      <button
                        onClick={() => { setIsEditing(true); setShowMoreMenu(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-100 flex items-center space-x-2"
                      >
                        <Pencil className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Edit & Regenerate</span>
                      </button>
                      <button
                        onClick={() => { handleCopy(); setShowMoreMenu(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-100 flex items-center space-x-2"
                      >
                        <Copy className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Copy message</span>
                      </button>
                      <button
                        onClick={() => { onRegenerateResponse && onRegenerateResponse(message.id); setShowMoreMenu(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-100 flex items-center space-x-2"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Regenerate response</span>
                      </button>
                      <button
                        onClick={() => { onRetryFromHere && onRetryFromHere(message.id); setShowMoreMenu(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-100 flex items-center space-x-2"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                        <span>↩Retry from here</span>
                      </button>
                      <div className="border-t border-zinc-100 my-1"></div>
                      <button
                        onClick={() => { onDeleteMessage && onDeleteMessage(message.id); setShowMoreMenu(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 flex items-center space-x-2"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Delete message</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { handleCopy(); setShowMoreMenu(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-100 flex items-center space-x-2"
                      >
                        <Copy className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Copy response</span>
                      </button>
                      <button
                        onClick={() => { toggleReadAloud(); setShowMoreMenu(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-100 flex items-center space-x-2"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Read aloud</span>
                      </button>
                      <button
                        onClick={() => { onToggleSave && onToggleSave(message.id); setShowMoreMenu(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-100 flex items-center space-x-2"
                      >
                        <Bookmark className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{message.saved ? 'Unsave' : 'Save response'}</span>
                      </button>
                      <button
                        onClick={() => { onRegenerateResponse && onRegenerateResponse(message.id); setShowMoreMenu(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-100 flex items-center space-x-2"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Regenerate</span>
                      </button>
                      <div className="border-t border-zinc-100 my-1"></div>
                      <button
                        onClick={() => { onDeleteMessage && onDeleteMessage(message.id); setShowMoreMenu(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 flex items-center space-x-2"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Delete message</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Audio Playing Wave Indicator */}
      {isPlayingAudio && !isUser && (
        <div className="pl-9.5 flex items-center space-x-2 text-xs font-medium text-indigo-600 bg-indigo-50/80 p-2 rounded-lg border border-indigo-100">
          <div className="flex items-end space-x-1 h-3.5">
            <span className="w-1 bg-indigo-600 animate-[bounce_0.8s_infinite_100ms] rounded-full h-full"></span>
            <span className="w-1 bg-indigo-600 animate-[bounce_0.8s_infinite_300ms] rounded-full h-2/3"></span>
            <span className="w-1 bg-indigo-600 animate-[bounce_0.8s_infinite_200ms] rounded-full h-4/5"></span>
          </div>
          <span>Reading response aloud...</span>
          <button
            onClick={toggleReadAloud}
            className="ml-auto text-indigo-700 hover:text-indigo-900 underline text-[11px] font-semibold cursor-pointer"
          >
            Stop
          </button>
        </div>
      )}

      {/* Message Content or Inline Textarea Editor */}
      <div className="pl-9.5 text-zinc-800 leading-relaxed font-normal">
        {isEditing ? (
          <div className="flex flex-col space-y-2 bg-zinc-50 border border-zinc-300 rounded-xl p-3 shadow-xs">
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              className="w-full bg-white text-zinc-900 p-2.5 text-[15px] border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-y"
              placeholder="Edit your prompt..."
            />
            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                onClick={handleCancelEdit}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-200/70 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editContent.trim()}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Save & Regenerate</span>
              </button>
            </div>
          </div>
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-zinc max-w-none text-[15px] prose-p:leading-relaxed prose-pre:bg-zinc-900 prose-pre:text-zinc-100">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-3.5 rounded-xl border border-zinc-200 shadow-xs bg-white">
                    <table className="w-full text-left border-collapse text-sm min-w-full" {...props} />
                  </div>
                ),
                thead: ({ node, ...props }) => (
                  <thead className="bg-zinc-100/90 border-b border-zinc-200 text-zinc-900 font-semibold" {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-700 border-r border-zinc-200 last:border-r-0" {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td className="px-3.5 py-2.5 text-sm text-zinc-800 border-b border-zinc-100 border-r border-zinc-100 last:border-r-0 bg-white" {...props} />
                ),
                tr: ({ node, ...props }) => (
                  <tr className="hover:bg-zinc-50/80 transition-colors" {...props} />
                )
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Inline Quick Action Toolbar (Mobile / Static Footer under message) */}
      {!isEditing && (
        <div className="pl-9.5 pt-1 flex items-center space-x-3 text-xs text-zinc-400">
          {isUser ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="hover:text-zinc-700 transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit</span>
              </button>
              <span>•</span>
              <button
                onClick={handleCopy}
                className="hover:text-zinc-700 transition-colors flex items-center space-x-1 cursor-pointer"
              >
                {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
              <span>•</span>
              <button
                onClick={() => onRegenerateResponse && onRegenerateResponse(message.id)}
                className="hover:text-zinc-700 transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Regenerate</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleCopy}
                className="hover:text-zinc-700 transition-colors flex items-center space-x-1 cursor-pointer"
              >
                {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
              <span>•</span>
              <button
                onClick={() => onToggleLike && onToggleLike(message.id)}
                className={`hover:text-zinc-700 transition-colors flex items-center space-x-1 cursor-pointer ${message.liked ? 'text-sky-600 font-semibold' : ''
                  }`}
              >
                <ThumbsUp className={`w-3 h-3 ${message.liked ? 'fill-sky-500 text-sky-600' : ''}`} />
                <span>{message.liked ? 'Liked' : 'Like'}</span>
              </button>
              <span>•</span>
              <button
                onClick={toggleReadAloud}
                className={`hover:text-zinc-700 transition-colors flex items-center space-x-1 cursor-pointer ${isPlayingAudio ? 'text-indigo-600 font-semibold' : ''
                  }`}
              >
                <Volume2 className="w-3 h-3" />
                <span>{isPlayingAudio ? 'Stop' : 'Read aloud'}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
