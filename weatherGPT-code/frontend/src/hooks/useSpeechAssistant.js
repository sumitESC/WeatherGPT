import { useState, useRef, useEffect, useCallback } from 'react';
import { checkVoiceInterruption } from '../services/api';
const cleanMarkdownForTTS = (text) => {
  if (!text) return '';
  let cleaned = text;

  const lines = cleaned.split('\n');
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
      return '';
    }
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed
        .split('|')
        .map(c => c.trim())
        .filter(c => c.length > 0);
      if (cells.length === 2) {
        return `${cells[0]}: ${cells[1]}.`;
      } else if (cells.length > 2) {
        return cells.join(', ') + '.';
      }
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
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1');

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

  cleaned = cleaned
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, '. ')
    .replace(/\.\.+/g, '.')
    .trim();

  return cleaned;
};

export function useSpeechAssistant({ onSendMessage, onNewChat }) {
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [voiceState, setVoiceState] = useState('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');

  const recognitionRef = useRef(null);
  const isMutedRef = useRef(false);
  const isVoiceModeRef = useRef(false);
  const voiceStateRef = useRef('idle');
  const lastSpokenTextRef = useRef('');
  const lastSpokenTranscriptRef = useRef('');  // Real-time transcript accumulator
  const lastProcessedQueryRef = useRef('');     // Guard against double processing
  const isTTSPlayingRef = useRef(false);
  const ttsSafetyTimerRef = useRef(null);
  const activeUtteranceRef = useRef(null);     // Retain active utterance to prevent Chrome/Safari GC bug
  const isPermissionDeniedRef = useRef(false); // Track mic permission rejection
  const cachedVoicesRef = useRef([]);
  const restartTimerRef = useRef(null);       // Debounce guard — prevents double restarts
  const silenceTimerRef = useRef(null);       // Auto-submit speech after pause
  const speechQueueRef = useRef([]);          // Sentence-chunked speech queue
  const isSpeakingQueueRef = useRef(false);
  const onSendMessageRef = useRef(onSendMessage);
  const onNewChatRef = useRef(onNewChat);

  useEffect(() => { onSendMessageRef.current = onSendMessage; }, [onSendMessage]);
  useEffect(() => { onNewChatRef.current = onNewChat; }, [onNewChat]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isVoiceModeRef.current = isVoiceMode; }, [isVoiceMode]);

  const updateVoiceState = useCallback((newState) => {
    setVoiceState(newState);
    voiceStateRef.current = newState;
  }, []);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices() || [];
      if (voices.length > 0) cachedVoicesRef.current = voices;
    };
    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    }
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      }
    };
  }, []);

  const clearTTSKeepAlive = useCallback(() => {
    if (ttsSafetyTimerRef.current) {
      clearTimeout(ttsSafetyTimerRef.current);
      ttsSafetyTimerRef.current = null;
    }
  }, []);

  const killRecognition = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
      } catch (e) { }
      recognitionRef.current = null;
    }
  }, []);

  const stopAllSpeech = useCallback(() => {
    isTTSPlayingRef.current = false;
    activeUtteranceRef.current = null;
    clearTTSKeepAlive();
    if (window.speechSynthesis) {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
    }
  }, [clearTTSKeepAlive]);

  const startRecognitionRef = useRef(null);

  const startRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("Speech Recognition is not supported in this browser. Please use Chrome, Edge, or Brave.");
      return;
    }

    if (!isVoiceModeRef.current || isMutedRef.current || isPermissionDeniedRef.current || voiceStateRef.current !== 'listening') return;

    killRecognition();
    lastSpokenTranscriptRef.current = '';
    lastProcessedQueryRef.current = '';

    let finalTranscriptAccumulator = '';

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      recognition.onstart = () => {
        console.log("🎤 Speech recognition active & listening");
        if (voiceStateRef.current !== 'speaking' && voiceStateRef.current !== 'thinking') {
          updateVoiceState('listening');
        }
      };

      recognition.onresult = (event) => {
        let interim = '';
        let currentFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            currentFinal += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }

        if (currentFinal) {
          finalTranscriptAccumulator += (finalTranscriptAccumulator ? ' ' : '') + currentFinal.trim();
        }

        const spokenText = (finalTranscriptAccumulator + ' ' + interim).trim();
        if (!spokenText) return;
        
        if (voiceStateRef.current !== 'listening') return;

        console.log("🎤 Voice Input Detected:", { currentFinal, interim, spokenText });

        setVoiceTranscript(spokenText);
        lastSpokenTranscriptRef.current = spokenText;

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        const handleSpeechSubmit = async (transcript) => {
          if (!transcript || transcript.length < 2) return;
          if (transcript === lastProcessedQueryRef.current) return;

          console.log("🎤 Submitting speech:", transcript);
          lastProcessedQueryRef.current = transcript;
          lastSpokenTranscriptRef.current = '';
          finalTranscriptAccumulator = '';
          killRecognition();
          if (processVoiceQueryRef.current) {
            processVoiceQueryRef.current(transcript);
          }
        };

        silenceTimerRef.current = setTimeout(() => {
          silenceTimerRef.current = null;
          handleSpeechSubmit(lastSpokenTranscriptRef.current.trim());
        }, 1500);
      };

      recognition.onerror = (event) => {
        if (event.error === 'aborted') return;
        if (event.error === 'no-speech') return;

        console.warn("🎤 Recognition error:", event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          isPermissionDeniedRef.current = true;
          setVoiceError("Microphone access denied. Please click the microphone/lock icon in your browser address bar to allow microphone access.");
          return;
        }

        if (event.error === 'audio-capture') {
          isPermissionDeniedRef.current = true;
          setVoiceError("No microphone found. Please connect a microphone and try again.");
          return;
        }

        setVoiceError(`Voice notice: ${event.error}`);
      };

      recognition.onend = () => {
        console.log("🎤 Speech recognition ended cycle.");

        const pendingSpeech = lastSpokenTranscriptRef.current.trim();
        if (pendingSpeech && pendingSpeech.length >= 2 && voiceStateRef.current === 'listening' && pendingSpeech !== lastProcessedQueryRef.current) {
          console.log("🎤 Processing pending speech from onend:", pendingSpeech);
          lastProcessedQueryRef.current = pendingSpeech;
          lastSpokenTranscriptRef.current = '';
          killRecognition();
          if (processVoiceQueryRef.current) {
            processVoiceQueryRef.current(pendingSpeech);
          }
          return;
        }

        if (isVoiceModeRef.current && !isMutedRef.current && voiceStateRef.current === 'listening' && !isPermissionDeniedRef.current) {
          scheduleRestart(100);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn("Recognition start failed:", e);
      if (!isPermissionDeniedRef.current) {
        scheduleRestart(400);
      }
    }
  }, [killRecognition, clearTTSKeepAlive, updateVoiceState, stopAllSpeech]);

  startRecognitionRef.current = startRecognition;

  const scheduleRestart = useCallback((delayMs = 300) => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (isVoiceModeRef.current && !isMutedRef.current && !isPermissionDeniedRef.current && voiceStateRef.current === 'listening') {
        if (startRecognitionRef.current) startRecognitionRef.current();
      }
    }, delayMs);
  }, []);

  const speakNextChunk = useCallback(() => {
    if (!('speechSynthesis' in window)) return;

    if (speechQueueRef.current.length === 0) {
      isTTSPlayingRef.current = false;
      isSpeakingQueueRef.current = false;
      activeUtteranceRef.current = null;
      clearTTSKeepAlive();
      if (isVoiceModeRef.current) {
        updateVoiceState('listening');
        setVoiceTranscript('');
        killRecognition();
        scheduleRestart(300);
      }
      return;
    }

    const chunkText = speechQueueRef.current.shift();
    const utterance = new SpeechSynthesisUtterance(chunkText);
    activeUtteranceRef.current = utterance; // Prevent Garbage Collector cutoff

    let voices = cachedVoicesRef.current;
    if (voices.length === 0) {
      voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) cachedVoicesRef.current = voices;
    }

    const isHindi = /[\u0900-\u097F]/.test(chunkText);

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
      updateVoiceState('speaking');
      isTTSPlayingRef.current = true;
      isSpeakingQueueRef.current = true;
    };

    utterance.onend = () => {
      setTimeout(() => {
        if (isTTSPlayingRef.current) {
          speakNextChunk();
        }
      }, 40);
    };

    utterance.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      console.warn("TTS utterance chunk error:", e);
      setTimeout(() => {
        if (isTTSPlayingRef.current) {
          speakNextChunk();
        }
      }, 40);
    };

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.speak(utterance);
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }, [killRecognition, clearTTSKeepAlive, scheduleRestart, updateVoiceState]);

  const speakResponse = useCallback((text) => {
    if (!('speechSynthesis' in window)) return;

    stopAllSpeech();
    lastSpokenTextRef.current = text;

    const cleanedText = cleanMarkdownForTTS(text);
    if (!cleanedText.trim()) {
      if (isVoiceModeRef.current) {
        updateVoiceState('listening');
        scheduleRestart(200);
      }
      return;
    }

    const sentences = cleanedText
      .replace(/([.?!])\s+/g, '$1|')
      .split('|')
      .map(s => s.trim())
      .filter(Boolean);

    const chunks = [];
    let currentChunk = '';
    for (const sentence of sentences) {
      if ((currentChunk + ' ' + sentence).length > 160) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    speechQueueRef.current = chunks.length > 0 ? chunks : [cleanedText];
    isSpeakingQueueRef.current = true;
    isTTSPlayingRef.current = true;

    speakNextChunk();
  }, [clearTTSKeepAlive, scheduleRestart, speakNextChunk, stopAllSpeech, updateVoiceState]);

  const processVoiceQuery = useCallback(async (queryText) => {
    if (!queryText.trim()) return;

    const lowerQuery = queryText.toLowerCase().trim();

    stopAllSpeech();
    updateVoiceState('thinking');
    setVoiceTranscript(queryText);

    if (onSendMessageRef.current) {
      try {
        const responseText = await onSendMessageRef.current(queryText);
        if (responseText && isVoiceModeRef.current) {
          speakResponse(responseText);
        } else if (isVoiceModeRef.current) {
          updateVoiceState('listening');
          scheduleRestart(200);
        }
      } catch (err) {
        console.error("Voice query error:", err);
        if (isVoiceModeRef.current) {
          speakResponse("Sorry, I had trouble processing that. Please try again.");
        }
      }
    }
  }, [speakResponse, stopAllSpeech, updateVoiceState, scheduleRestart]);

  const processVoiceQueryRef = useRef(processVoiceQuery);
  processVoiceQueryRef.current = processVoiceQuery;

  const closeVoiceMode = useCallback(() => {
    setIsVoiceMode(false);
    isVoiceModeRef.current = false;
    isPermissionDeniedRef.current = false;
    stopAllSpeech();
    killRecognition();
    updateVoiceState('idle');
    setVoiceTranscript('');
    setVoiceError('');
  }, [killRecognition, stopAllSpeech, updateVoiceState]);

  const openVoiceMode = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices(); // Force engine init
      const unlockUtterance = new SpeechSynthesisUtterance(' ');
      window.speechSynthesis.speak(unlockUtterance);
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsVoiceMode(true);
      isVoiceModeRef.current = true;
      updateVoiceState('listening');
      setVoiceError("Speech Recognition is not supported in this browser. Please use Chrome, Edge, or Brave.");
      return;
    }

    setIsVoiceMode(true);
    isVoiceModeRef.current = true;
    setIsMuted(false);
    isMutedRef.current = false;
    isPermissionDeniedRef.current = false;
    lastSpokenTranscriptRef.current = '';
    lastProcessedQueryRef.current = '';
    setVoiceError('');
    setVoiceTranscript('');
    updateVoiceState('listening');

    if (startRecognitionRef.current) {
      startRecognitionRef.current();
    }
  }, [updateVoiceState]);

  const handleInterrupt = useCallback(() => {
    stopAllSpeech();
    setVoiceTranscript('');
    updateVoiceState('listening');
    killRecognition();
    scheduleRestart(200);
  }, [killRecognition, stopAllSpeech, scheduleRestart, updateVoiceState]);

  const toggleMute = useCallback(() => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    isMutedRef.current = nextMute;
    if (nextMute) {
      killRecognition();
      updateVoiceState('listening');
      setVoiceTranscript("Microphone muted");
    } else {
      setVoiceTranscript("");
      if (!isTTSPlayingRef.current) {
        scheduleRestart(200);
      }
    }
  }, [isMuted, killRecognition, scheduleRestart, updateVoiceState]);

  useEffect(() => {
    if (!isVoiceMode) {
      stopAllSpeech();
      killRecognition();
      updateVoiceState('idle');
    }
  }, [isVoiceMode, killRecognition, stopAllSpeech, updateVoiceState]);

  useEffect(() => {
    return () => {
      stopAllSpeech();
      killRecognition();
    };
  }, [killRecognition, stopAllSpeech]);

  return {
    isVoiceMode,
    voiceState,
    isMuted,
    voiceTranscript,
    voiceError,
    openVoiceMode,
    closeVoiceMode,
    toggleMute,
    handleInterrupt
  };
}
