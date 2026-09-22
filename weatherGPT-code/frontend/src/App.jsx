import { useState, useEffect, useCallback } from 'react';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import ChatContainer from './components/chat/ChatContainer';
import ChatInput from './components/chat/ChatInput';
import VoiceModal from './components/voice/VoiceModal';
import Toast from './components/chat/Toast';
import SplashPreloader from './components/layout/SplashPreloader';
import LandingPage from './components/landing/LandingPage';
import { useChat } from './hooks/useChat';
import { useSessions } from './hooks/useSessions';
import { useSpeechAssistant } from './hooks/useSpeechAssistant';
import { useBackendStatus } from './hooks/useBackendStatus';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

function App() {
  const [isPreloaderActive, setIsPreloaderActive] = useState(true);
  const [viewMode, setViewMode] = useState('landing'); // 'landing' | 'chat'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const {
    status: backendStatus,
    apiBaseUrl,
    retry: retryBackend
  } = useBackendStatus();

  const {
    sessions,
    activeSession,
    activeSessionId,
    createNewSession,
    switchSession,
    deleteSession,
    renameSession,
    updateActiveMessages,
    autoNameSessionIfNeeded
  } = useSessions();

  const handleMessagesChange = useCallback((newMsgs) => {
    updateActiveMessages(newMsgs);
  }, [updateActiveMessages]);

  const handleFirstUserMessage = useCallback((firstPrompt) => {
    autoNameSessionIfNeeded(activeSessionId, firstPrompt);
  }, [activeSessionId, autoNameSessionIfNeeded]);

  const {
    messages,
    input,
    setInput,
    isLoading,
    toastMessage,
    showToast,
    clearToast,
    loadMessages,
    handleSend,
    handleEditAndRegenerate,
    handleRegenerateResponse,
    handleDeleteMessage,
    handleRetryFromHere,
    handleToggleLike,
    handleToggleDislike,
    handleToggleSave,
    handleNewChat
  } = useChat({
    onMessagesChange: handleMessagesChange,
    onFirstUserMessage: handleFirstUserMessage
  });

  useEffect(() => {
    if (activeSession) {
      loadMessages(activeSession.messages || []);
    }
  }, [activeSessionId, activeSession, loadMessages]);

  const [viewportHeight, setViewportHeight] = useState(() => {
    return window.visualViewport ? window.visualViewport.height : window.innerHeight;
  });

  useEffect(() => {
    const updateViewport = () => {
      const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      setViewportHeight(h);
      if (viewMode === 'chat') {
        if (window.scrollY !== 0) {
          window.scrollTo(0, 0);
        }
        if (document.body.scrollTop !== 0) {
          document.body.scrollTop = 0;
        }
      }
    };

    updateViewport();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewport);
      window.visualViewport.addEventListener('scroll', updateViewport);
    }
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewport);
        window.visualViewport.removeEventListener('scroll', updateViewport);
      }
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, [viewMode]);

  const handleCreateNewChat = useCallback(() => {
    const newSess = createNewSession();
    loadMessages([]);
    handleNewChat();
    setViewMode('chat');
  }, [createNewSession, loadMessages, handleNewChat]);

  const handleSelectSession = useCallback((sessionId) => {
    switchSession(sessionId);
    setViewMode('chat');
  }, [switchSession]);

  const handleDirectChatSend = useCallback((queryText) => {
    setViewMode('chat');
    if (messages.length > 0 && activeSession?.messages?.length > 0) {
      const newSess = createNewSession();
      loadMessages([]);
      handleSend(queryText);
      autoNameSessionIfNeeded(newSess.id, queryText);
    } else {
      handleSend(queryText);
      autoNameSessionIfNeeded(activeSessionId, queryText);
    }
  }, [messages, activeSession, createNewSession, loadMessages, handleSend, autoNameSessionIfNeeded, activeSessionId]);

  const {
    isVoiceMode,
    voiceState,
    isMuted,
    voiceTranscript,
    voiceError,
    openVoiceMode,
    closeVoiceMode,
    toggleMute,
    handleInterrupt
  } = useSpeechAssistant({
    onSendMessage: (txt) => {
      setViewMode('chat');
      return handleSend(txt);
    },
    onNewChat: handleCreateNewChat
  });

  const handleOpenVoiceFromLanding = useCallback(() => {
    setViewMode('chat');
    openVoiceMode();
  }, [openVoiceMode]);

  return (
    <>
      {/* Animated Splash Preloader */}
      {isPreloaderActive && (
        <SplashPreloader 
          isBackendReady={backendStatus === 'online'}
          onLoaded={() => setIsPreloaderActive(false)} 
        />
      )}

      {/* Main Application Container */}
      {viewMode === 'landing' ? (
        <LandingPage 
          onLaunchChat={() => setViewMode('chat')}
          onOpenVoiceMode={handleOpenVoiceFromLanding}
          backendStatus={backendStatus}
        />
      ) : (
        <div 
          style={{ height: `${viewportHeight}px` }}
          className="flex flex-col w-full overflow-hidden bg-white text-zinc-900 font-sans selection:bg-zinc-200 relative transition-[height] duration-75 ease-out"
        >
          <Header 
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            activeSessionTitle={activeSession?.title}
            onOpenVoiceMode={openVoiceMode} 
            onNewChat={handleCreateNewChat} 
            onOpenLanding={() => setViewMode('landing')}
            backendStatus={backendStatus}
            onRetryBackend={retryBackend}
          />

          {/* Render Free Instance Cold Start Notification Banner */}
          {backendStatus === 'waking_up' && (
            <div className="flex-none bg-amber-50 border-b border-amber-200/80 px-4 py-2 flex items-center justify-between text-xs text-amber-800 transition-all">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                <span>
                  <strong>Waking up Render backend server...</strong> Free hosting spins down after inactivity; initial connection takes ~20 seconds.
                </span>
              </div>
              <span className="text-[10px] text-amber-600 font-mono hidden sm:inline">{apiBaseUrl}</span>
            </div>
          )}

          {backendStatus === 'error' && (
            <div className="flex-none bg-rose-50 border-b border-rose-200/80 px-4 py-2 flex items-center justify-between text-xs text-rose-800 transition-all">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  Unable to reach backend API at <code className="bg-rose-100 px-1 py-0.5 rounded font-mono text-[11px]">{apiBaseUrl}</code>. Make sure your Render server is live or update <code className="bg-rose-100 px-1 py-0.5 rounded font-mono text-[11px]">VITE_API_BASE_URL</code> in <code className="bg-rose-100 px-1 py-0.5 rounded font-mono text-[11px]">.env</code>.
                </span>
              </div>
              <button 
                onClick={retryBackend}
                className="flex items-center space-x-1 text-xs font-medium text-rose-700 hover:text-rose-900 underline ml-2 shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          )}

          <Sidebar 
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={handleSelectSession}
            onNewSession={handleCreateNewChat}
            onDeleteSession={deleteSession}
            onRenameSession={renameSession}
            onDirectChatSend={handleDirectChatSend}
          />

          <ChatContainer 
            messages={messages}
            isLoading={isLoading}
            onSelectSuggestion={(prompt) => {
              setViewMode('chat');
              handleSend(prompt);
            }}
            onOpenVoiceMode={openVoiceMode}
            onEditAndRegenerate={handleEditAndRegenerate}
            onRegenerateResponse={handleRegenerateResponse}
            onDeleteMessage={handleDeleteMessage}
            onRetryFromHere={handleRetryFromHere}
            onToggleLike={handleToggleLike}
            onToggleDislike={handleToggleDislike}
            onToggleSave={handleToggleSave}
            showToast={showToast}
          />

          <ChatInput 
            input={input}
            setInput={setInput}
            onSubmit={() => handleSend()}
            isLoading={isLoading}
            onOpenVoiceMode={openVoiceMode}
          />

          <VoiceModal 
            isOpen={isVoiceMode}
            voiceState={voiceState}
            isMuted={isMuted}
            voiceTranscript={voiceTranscript}
            voiceError={voiceError}
            messages={messages}
            onToggleMute={toggleMute}
            onInterrupt={handleInterrupt}
            onClose={closeVoiceMode}
          />

          <Toast 
            toast={toastMessage}
            onClose={clearToast}
          />
        </div>
      )}
    </>
  );
}

export default App;
