import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchSessionTitle } from '../services/api';

const STORAGE_KEY = 'weathergpt_sessions_v1';

const createSessionObj = (title = 'New Weather Chat') => ({
  id: 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
  title,
  messages: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

export function useSessions() {
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to load sessions from localStorage", e);
    }
    return [createSessionObj()];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    return sessions[0]?.id || '';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error("Failed to save sessions to localStorage", e);
    }
  }, [sessions]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  const createNewSession = useCallback(() => {
    const newSess = createSessionObj();
    setSessions(prev => [newSess, ...prev]);
    setActiveSessionId(newSess.id);
    return newSess;
  }, []);

  const switchSession = useCallback((id) => {
    const target = sessions.find(s => s.id === id);
    if (target) {
      setActiveSessionId(id);
    }
  }, [sessions]);

  const deleteSession = useCallback((id) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) {
        const fresh = createSessionObj();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (id === activeSessionId) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  }, [activeSessionId]);

  const renameSession = useCallback((id, newTitle) => {
    if (!newTitle.trim()) return;
    setSessions(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, title: newTitle.trim(), updatedAt: new Date().toISOString() };
      }
      return s;
    }));
  }, []);

  const updateActiveMessages = useCallback((newMessages) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages: newMessages, updatedAt: new Date().toISOString() };
      }
      return s;
    }));
  }, [activeSessionId]);

  const autoNameSessionIfNeeded = useCallback(async (sessionId, firstUserPrompt) => {
    if (!firstUserPrompt) return;
    const targetSession = sessions.find(s => s.id === sessionId);
    
    if (targetSession && (targetSession.title === 'New Weather Chat' || !targetSession.title)) {
      const generatedTitle = await fetchSessionTitle(firstUserPrompt);
      if (generatedTitle) {
        renameSession(sessionId, generatedTitle);
      } else {
        const fallback = firstUserPrompt.split(' ').slice(0, 4).join(' ');
        renameSession(sessionId, fallback.charAt(0).toUpperCase() + fallback.slice(1));
      }
    }
  }, [sessions, renameSession]);

  return {
    sessions,
    activeSession,
    activeSessionId,
    createNewSession,
    switchSession,
    deleteSession,
    renameSession,
    updateActiveMessages,
    autoNameSessionIfNeeded
  };
}
