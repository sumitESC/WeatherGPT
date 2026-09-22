import { useState, useEffect, useCallback } from 'react';
import { checkBackendHealth, API_BASE_URL } from '../services/api';

export function useBackendStatus() {
  const [status, setStatus] = useState('connecting');
  const [retryCount, setRetryCount] = useState(0);

  const pingBackend = useCallback(async () => {
    setStatus('connecting');

    const wakeupTimer = setTimeout(() => {
      setStatus((prev) => (prev === 'connecting' ? 'waking_up' : prev));
    }, 2500);

    const result = await checkBackendHealth();
    clearTimeout(wakeupTimer);

    if (result.online) {
      setStatus('online');
    } else {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    pingBackend();
  }, [pingBackend, retryCount]);

  const retry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
  }, []);

  return {
    status, // 'connecting' | 'waking_up' | 'online' | 'error'
    isOnline: status === 'online',
    isWakingUp: status === 'waking_up',
    isConnecting: status === 'connecting' || status === 'waking_up',
    apiBaseUrl: API_BASE_URL,
    retry
  };
}
