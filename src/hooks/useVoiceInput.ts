import { useCallback, useEffect, useRef, useState } from 'react';
import type { RecurrenceRule, TaskPriority } from '../types';

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

export interface ParsedVoiceTask {
  title: string;
  priority?: TaskPriority;
  recurrence?: RecurrenceRule;
}

export function parseVoiceTranscript(raw: string): ParsedVoiceTask {
  let cleaned = raw.trim();
  let priority: TaskPriority | undefined;
  let recurrence: RecurrenceRule | undefined;

  if (/\b(urgent|high priority|important)\b/i.test(cleaned)) {
    priority = 'high';
    cleaned = cleaned.replace(/\b(urgent|high priority|important)\b/gi, '').trim();
  } else if (/\b(low priority)\b/i.test(cleaned)) {
    priority = 'low';
    cleaned = cleaned.replace(/\b(low priority)\b/gi, '').trim();
  }

  if (/\b(every weekday|weekdays)\b/i.test(cleaned)) {
    recurrence = 'weekdays';
    cleaned = cleaned.replace(/\b(every weekday|weekdays)\b/gi, '').trim();
  } else if (/\b(every day|daily)\b/i.test(cleaned)) {
    recurrence = 'daily';
    cleaned = cleaned.replace(/\b(every day|daily)\b/gi, '').trim();
  } else if (/\b(every week|weekly)\b/i.test(cleaned)) {
    recurrence = 'weekly';
    cleaned = cleaned.replace(/\b(every week|weekly)\b/gi, '').trim();
  } else if (/\b(every month|monthly)\b/i.test(cleaned)) {
    recurrence = 'monthly';
    cleaned = cleaned.replace(/\b(every month|monthly)\b/gi, '').trim();
  }

  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/^[,.\-:\s]+|[,.\-:\s]+$/g, '');
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return { title: cleaned, priority, recurrence };
}

export function useVoiceInput(onTranscript: (parsed: ParsedVoiceTask) => void) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    Boolean(
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
        (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
          .webkitSpeechRecognition
    );

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore stop errors
      }
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    setVoiceError(null);
    if (!isSupported) {
      setVoiceError('Voice recognition is unavailable in this browser. Type your task below instead.');
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechCtor) {
      setVoiceError('Voice recognition is unavailable in this browser.');
      return;
    }

    try {
      const recognition = new SpeechCtor();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let finalStr = '';
        let interimStr = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? '';
          if (result.isFinal) {
            finalStr += text + ' ';
          } else {
            interimStr += text;
          }
        }
        setInterimText(interimStr.trim());
        if (finalStr.trim()) {
          setInterimText('');
          onTranscript(parseVoiceTranscript(finalStr));
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoiceError('Microphone access was blocked. Allow microphone permission or type manually.');
        } else if (event.error === 'no-speech') {
          setVoiceError('No speech detected. Tap the microphone again when ready.');
        } else {
          setVoiceError('Voice capture interrupted. You can type your task directly.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceError('Could not start voice capture. Type your task manually.');
    }
  }, [isSupported, onTranscript]);

  return {
    isSupported,
    isListening,
    interimText,
    voiceError,
    clearVoiceError: () => setVoiceError(null),
    startListening,
    stopListening,
  };
}
