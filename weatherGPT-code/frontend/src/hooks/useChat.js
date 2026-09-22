import { useState, useRef, useEffect, useCallback } from 'react';
import { sendChatMessage } from '../services/api';

const generateId = () => 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

export function useChat({ onMessagesChange, onFirstUserMessage } = {}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const loadMessages = useCallback((newMsgs) => {
    const list = Array.isArray(newMsgs) ? newMsgs : [];
    setMessages(list);
    messagesRef.current = list;
  }, []);

  const updateMessagesAndNotify = useCallback((newMsgs) => {
    setMessages(newMsgs);
    messagesRef.current = newMsgs;
    if (onMessagesChange) {
      onMessagesChange(newMsgs);
    }
  }, [onMessagesChange]);

  const showToast = useCallback((text, type = 'info') => {
    setToastMessage({ text, type, id: Date.now() });
  }, []);

  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  const handleSend = useCallback(async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || isLoading) return null;

    const isFirstUserMsg = messagesRef.current.length === 0;

    const userMessage = {
      id: generateId(),
      role: 'user',
      content: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const currentHistory = [...messagesRef.current];
    const updatedWithUser = [...currentHistory, userMessage];

    updateMessagesAndNotify(updatedWithUser);
    setInput('');
    setIsLoading(true);

    if (isFirstUserMsg && onFirstUserMessage) {
      onFirstUserMessage(query.trim());
    }

    try {
      const responseText = await sendChatMessage(query, currentHistory);
      const assistantMessage = {
        id: generateId(),
        role: 'assistant',
        content: responseText,
        liked: false,
        disliked: false,
        saved: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const updatedWithAssistant = [...updatedWithUser, assistantMessage];

      updateMessagesAndNotify(updatedWithAssistant);
      return responseText;
    } catch (error) {
      console.error("Chat API Error:", error);
      const errorMessage = "I'm having trouble connecting to the WeatherGPT server. Please make sure the backend is running.";
      const errorMsgObj = {
        id: generateId(),
        role: 'assistant',
        content: errorMessage,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const updatedWithError = [...updatedWithUser, errorMsgObj];

      updateMessagesAndNotify(updatedWithError);
      return errorMessage;
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, updateMessagesAndNotify, onFirstUserMessage]);


  const handleEditAndRegenerate = useCallback(async (messageId, newContent) => {
    if (!newContent.trim() || isLoading) return;

    const currentMsgs = messagesRef.current;
    const msgIdx = currentMsgs.findIndex(m => m.id === messageId);
    if (msgIdx === -1) return;

    const historyBefore = currentMsgs.slice(0, msgIdx);
    
    const updatedUserMsg = {
      ...currentMsgs[msgIdx],
      content: newContent.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newMessagesList = [...historyBefore, updatedUserMsg];
    updateMessagesAndNotify(newMessagesList);
    setIsLoading(true);
    showToast("Updating message and regenerating...", "info");

    try {
      const responseText = await sendChatMessage(newContent.trim(), historyBefore);
      const assistantMsg = {
        id: generateId(),
        role: 'assistant',
        content: responseText,
        liked: false,
        disliked: false,
        saved: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const finalMsgs = [...newMessagesList, assistantMsg];
      updateMessagesAndNotify(finalMsgs);
      showToast("Response regenerated", "success");
    } catch (error) {
      console.error("Edit & Regenerate error:", error);
      showToast("Failed to regenerate response", "error");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, showToast, updateMessagesAndNotify]);

  const handleRegenerateResponse = useCallback(async (targetId) => {
    if (isLoading) return;

    const currentMsgs = messagesRef.current;
    let userMsgIdx = -1;

    const targetIdx = currentMsgs.findIndex(m => m.id === targetId);
    if (targetIdx === -1) return;

    if (currentMsgs[targetIdx].role === 'user') {
      userMsgIdx = targetIdx;
    } else if (targetIdx > 0 && currentMsgs[targetIdx - 1].role === 'user') {
      userMsgIdx = targetIdx - 1;
    }

    if (userMsgIdx === -1) return;

    const userMsg = currentMsgs[userMsgIdx];
    const historyBefore = currentMsgs.slice(0, userMsgIdx);
    const msgsWithUser = [...historyBefore, userMsg];

    updateMessagesAndNotify(msgsWithUser);
    setIsLoading(true);
    showToast("Regenerating response...", "info");

    try {
      const responseText = await sendChatMessage(userMsg.content, historyBefore);
      const newAssistantMsg = {
        id: generateId(),
        role: 'assistant',
        content: responseText,
        liked: false,
        disliked: false,
        saved: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const finalMsgs = [...msgsWithUser, newAssistantMsg];
      updateMessagesAndNotify(finalMsgs);
      showToast("New response generated", "success");
    } catch (error) {
      console.error("Regenerate error:", error);
      showToast("Failed to regenerate response", "error");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, showToast, updateMessagesAndNotify]);

  const handleDeleteMessage = useCallback((messageId) => {
    const currentMsgs = messagesRef.current;
    const idx = currentMsgs.findIndex(m => m.id === messageId);
    if (idx === -1) return;

    const targetMsg = currentMsgs[idx];
    let updatedMsgs = [];

    if (targetMsg.role === 'user' && idx + 1 < currentMsgs.length && currentMsgs[idx + 1].role === 'assistant') {
      updatedMsgs = currentMsgs.filter((_, i) => i !== idx && i !== idx + 1);
    } else {
      updatedMsgs = currentMsgs.filter((_, i) => i !== idx);
    }

    updateMessagesAndNotify(updatedMsgs);
    showToast("Message deleted", "info");
  }, [showToast, updateMessagesAndNotify]);

  const handleRetryFromHere = useCallback((messageId) => {
    const currentMsgs = messagesRef.current;
    const idx = currentMsgs.findIndex(m => m.id === messageId);
    if (idx === -1) return;

    const targetMsg = currentMsgs[idx];
    const promptText = targetMsg.role === 'user' ? targetMsg.content : (idx > 0 ? currentMsgs[idx - 1].content : '');

    if (promptText) setInput(promptText);

    const historyBefore = currentMsgs.slice(0, targetMsg.role === 'user' ? idx : idx - 1);
    updateMessagesAndNotify(historyBefore);
    showToast("Prompt restored to input box", "info");
  }, [showToast, updateMessagesAndNotify]);

  const handleToggleLike = useCallback((messageId) => {
    const current = messagesRef.current;
    const updated = current.map(msg => {
      if (msg.id !== messageId) return msg;
      const nextLiked = !msg.liked;
      if (nextLiked) showToast("Feedback: Liked response", "success");
      return { ...msg, liked: nextLiked, disliked: nextLiked ? false : msg.disliked };
    });
    updateMessagesAndNotify(updated);
  }, [showToast, updateMessagesAndNotify]);

  const handleToggleDislike = useCallback((messageId) => {
    const current = messagesRef.current;
    const updated = current.map(msg => {
      if (msg.id !== messageId) return msg;
      const nextDisliked = !msg.disliked;
      if (nextDisliked) showToast("Feedback: Disliked response", "info");
      return { ...msg, disliked: nextDisliked, liked: nextDisliked ? false : msg.liked };
    });
    updateMessagesAndNotify(updated);
  }, [showToast, updateMessagesAndNotify]);

  const handleToggleSave = useCallback((messageId) => {
    const current = messagesRef.current;
    const updated = current.map(msg => {
      if (msg.id !== messageId) return msg;
      const nextSaved = !msg.saved;
      showToast(nextSaved ? "Message pinned to saved" : "Message unpinned", "success");
      return { ...msg, saved: nextSaved };
    });
    updateMessagesAndNotify(updated);
  }, [showToast, updateMessagesAndNotify]);

  const handleNewChat = useCallback(() => {
    updateMessagesAndNotify([]);
    setInput('');
    showToast("Started a new chat session", "info");
  }, [showToast, updateMessagesAndNotify]);

  return {
    messages,
    input,
    setInput,
    isLoading,
    toastMessage,
    showToast,
    clearToast,
    loadMessages,
    messagesRef,
    handleSend,
    handleEditAndRegenerate,
    handleRegenerateResponse,
    handleDeleteMessage,
    handleRetryFromHere,
    handleToggleLike,
    handleToggleDislike,
    handleToggleSave,
    handleNewChat
  };
}


