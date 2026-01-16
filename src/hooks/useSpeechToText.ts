import { useCallback, useEffect, useRef, useState } from 'react';

export type SpeechToTextErrorCode = string;

export interface UseSpeechToTextOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

const getSpeechRecognitionConstructor = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  return (window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null) as SpeechRecognitionConstructor | null;
};

export const useSpeechToText = (options: UseSpeechToTextOptions = {}) => {
  const { lang = 'en-US', continuous = false, interimResults = true } = options;

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [supported, setSupported] = useState(() => Boolean(getSpeechRecognitionConstructor()));
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<SpeechToTextErrorCode | null>(null);

  const initRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current;
    const ctor = getSpeechRecognitionConstructor();
    if (!ctor) return null;

    const recognition = new ctor();
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setError(event.error || 'unknown');
    };

    recognition.onresult = (event) => {
      let interim = '';
      let finalChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (!transcript) continue;
        if (result.isFinal) {
          finalChunk += transcript;
        } else {
          interim += transcript;
        }
      }

      setInterimTranscript(interim.trim());

      const cleanedFinal = finalChunk.trim();
      if (cleanedFinal) {
        setFinalTranscript((prev) => (prev ? `${prev} ${cleanedFinal}` : cleanedFinal));
      }
    };

    return recognition;
  }, []);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognitionConstructor()));
    initRecognition();

    return () => {
      const recognition = recognitionRef.current;
      if (!recognition) return;
      try {
        recognition.onstart = null;
        recognition.onend = null;
        recognition.onerror = null;
        recognition.onresult = null;
        recognition.abort();
      } finally {
        recognitionRef.current = null;
      }
    };
  }, [initRecognition]);

  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
  }, [lang, continuous, interimResults]);

  const reset = useCallback(() => {
    setError(null);
    setInterimTranscript('');
    setFinalTranscript('');
  }, []);

  const start = useCallback(() => {
    const recognition = recognitionRef.current ?? initRecognition();
    if (!recognition) {
      setSupported(false);
      setError('unsupported');
      return;
    }

    setSupported(true);
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;

    setError(null);
    try {
      recognition.start();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to start voice input.';
      setError(message);
      setIsListening(false);
    }
  }, [initRecognition, lang, continuous, interimResults]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const abort = useCallback(() => {
    recognitionRef.current?.abort();
  }, []);

  return {
    supported,
    isListening,
    interimTranscript,
    finalTranscript,
    error,
    start,
    stop,
    abort,
    reset,
  };
};
