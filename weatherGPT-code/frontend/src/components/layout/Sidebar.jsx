import { useState, useMemo } from 'react';
import {
  MessageSquare,
  Search,
  Plus,
  X,
  Bookmark,
  ThumbsUp,
  Trash2,
  Pencil,
  Send,
  Sparkles,
  Check,
  Clock
} from 'lucide-react';

export default function Sidebar({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  onDirectChatSend
}) {
  const [activeTab, setActiveTab] = useState('sessions'); // 'sessions' | 'saved' | 'liked'
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitleInput, setEditTitleInput] = useState('');

  const { allSavedMessages, allLikedMessages } = useMemo(() => {
    const saved = [];
    const liked = [];
    sessions.forEach(sess => {
      sess.messages?.forEach(msg => {
        if (msg.saved) saved.push({ ...msg, sessionId: sess.id, sessionTitle: sess.title });
        if (msg.liked) liked.push({ ...msg, sessionId: sess.id, sessionTitle: sess.title });
      });
    });
    return { allSavedMessages: saved, allLikedMessages: liked };
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(sess => {
      const matchTitle = sess.title.toLowerCase().includes(q);
      const matchMessage = sess.messages?.some(m => m.content.toLowerCase().includes(q));
      return matchTitle || matchMessage;
    });
  }, [sessions, searchQuery]);

  const handleStartRename = (e, sess) => {
    e.stopPropagation();
    setEditingSessionId(sess.id);
    setEditTitleInput(sess.title);
  };

  const handleSaveRename = (e, sessionId) => {
    e.stopPropagation();
    if (editTitleInput.trim()) {
      onRenameSession(sessionId, editTitleInput.trim());
    }
    setEditingSessionId(null);
  };

  const handleDirectChatSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    onDirectChatSend(searchQuery.trim());
    setSearchQuery('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Slide-out Sidebar Drawer */}
      <div className="relative flex flex-col w-80 max-w-[85vw] bg-zinc-900 text-zinc-100 h-full shadow-2xl z-50 animate-in slide-in-from-left duration-250 border-r border-zinc-800">

        {/* Header & New Chat */}
        <div className="p-4 border-b border-zinc-800/80 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span className="font-bold text-base tracking-tight text-white">WeatherGPT</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={() => { onNewSession(); onClose(); }}
            className="w-full flex items-center justify-center space-x-2 bg-white text-zinc-900 hover:bg-zinc-100 font-semibold text-xs py-2.5 px-4 rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat Session</span>
          </button>
        </div>

        {/* Search & Direct Chat Bar */}
        <div className="p-3 border-b border-zinc-800/60 bg-zinc-950/40">
          <form onSubmit={handleDirectChatSubmit} className="relative flex items-center">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or ask weather directly..."
              className="w-full bg-zinc-800/90 text-white placeholder-zinc-500 text-xs pl-9 pr-8 py-2 rounded-lg border border-zinc-700/60 focus:outline-none focus:ring-2 focus:ring-zinc-600"
            />
            {searchQuery.trim() ? (
              <button
                type="submit"
                title="Send query directly to chat"
                className="absolute right-2 p-1 text-amber-400 hover:text-amber-300 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </form>
          {searchQuery.trim() && (
            <p className="text-[10px] text-zinc-400 mt-1.5 px-1">
              💡 Press Enter to ask this query directly in chat
            </p>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-zinc-800/80 px-2 py-1 bg-zinc-900">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${activeTab === 'sessions'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>History</span>
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${activeTab === 'saved'
                ? 'bg-zinc-800 text-amber-400 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved ({allSavedMessages.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('liked')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${activeTab === 'liked'
                ? 'bg-zinc-800 text-sky-400 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>Liked</span>
          </button>
        </div>

        {/* Tab Content List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {activeTab === 'sessions' && (
            <>
              {filteredSessions.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  No chat history found.
                </div>
              ) : (
                filteredSessions.map((sess) => {
                  const isActive = sess.id === activeSessionId;
                  const isEditing = editingSessionId === sess.id;
                  const msgCount = sess.messages?.length || 0;

                  return (
                    <div
                      key={sess.id}
                      onClick={() => { onSelectSession(sess.id); onClose(); }}
                      className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition text-xs ${isActive
                          ? 'bg-zinc-800/90 text-white font-medium border border-zinc-700/70 shadow-xs'
                          : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-white'
                        }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
                        <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-zinc-500'}`} />

                        {isEditing ? (
                          <div className="flex items-center space-x-1 w-full" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editTitleInput}
                              onChange={(e) => setEditTitleInput(e.target.value)}
                              className="w-full bg-zinc-900 text-white text-xs px-2 py-1 rounded border border-zinc-600 focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={(e) => handleSaveRename(e, sess.id)}
                              className="p-1 text-emerald-400 hover:text-emerald-300"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-xs font-semibold">{sess.title}</span>
                            <span className="text-[10px] text-zinc-500 flex items-center space-x-1">
                              <Clock className="w-2.5 h-2.5 inline mr-1" />
                              {new Date(sess.updatedAt || sess.createdAt).toLocaleDateString()} • {msgCount} msgs
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons on hover */}
                      {!isEditing && (
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleStartRename(e, sess)}
                            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-700/60 rounded transition cursor-pointer"
                            title="Rename chat"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteSession(sess.id); }}
                            className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-zinc-700/60 rounded transition cursor-pointer"
                            title="Delete chat"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {activeTab === 'saved' && (
            <div className="space-y-2 py-1">
              {allSavedMessages.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  No saved items yet. Click the 📌 icon on any message to save it!
                </div>
              ) : (
                allSavedMessages.map((msg, idx) => (
                  <div
                    key={msg.id || idx}
                    onClick={() => { onSelectSession(msg.sessionId); onClose(); }}
                    className="p-3 bg-zinc-950/60 hover:bg-zinc-800/80 border border-zinc-800 rounded-xl cursor-pointer transition text-xs flex flex-col space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-amber-400 font-semibold">
                      <span>📌 {msg.sessionTitle}</span>
                      <span className="text-zinc-500">{msg.role === 'user' ? 'You' : 'WeatherGPT'}</span>
                    </div>
                    <p className="text-zinc-300 line-clamp-2 leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'liked' && (
            <div className="space-y-2 py-1">
              {allLikedMessages.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  No liked insights yet. Click the 👍 icon on assistant responses to like them!
                </div>
              ) : (
                allLikedMessages.map((msg, idx) => (
                  <div
                    key={msg.id || idx}
                    onClick={() => { onSelectSession(msg.sessionId); onClose(); }}
                    className="p-3 bg-zinc-950/60 hover:bg-zinc-800/80 border border-zinc-800 rounded-xl cursor-pointer transition text-xs flex flex-col space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-sky-400 font-semibold">
                      <span>👍 {msg.sessionTitle}</span>
                      <span className="text-zinc-500">{msg.timestamp || 'Liked'}</span>
                    </div>
                    <p className="text-zinc-300 line-clamp-2 leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800/80 text-[11px] text-zinc-500 text-center bg-zinc-950/50">
          WeatherGPT AI Assistant • Powered by Grok
        </div>
      </div>
    </div>
  );
}
