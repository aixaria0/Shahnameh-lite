'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SpeechToTextProps {
  onTranscript: (text: string) => void;
}

export default function SpeechToText({ onTranscript }: SpeechToTextProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      // Use queueMicrotask or setTimeout to avoid synchronous setState warning
      queueMicrotask(() => setIsSupported(true));
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'fa-IR'; // Support Persian dictation

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onTranscript(transcript);
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [onTranscript]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start recognition", e);
      }
    }
  }, [isListening]);

  if (!isSupported && typeof window !== 'undefined') {
    // If not supported, we can hide or show disabled
    return null;
  }

  return (
    <div className="relative">
      <AnimatePresence>
        {isListening && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="absolute inset-0 bg-[#D4AF37]/20 rounded-full blur-md"
          />
        )}
      </AnimatePresence>
      <button
        onClick={toggleListening}
        className={`p-3 rounded-full transition-all relative z-10 ${
          isListening 
          ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.5)]' 
          : 'bg-[#070708] border border-[#2A2A2C] text-[#E0D8D0]/40 hover:text-[#D4AF37] hover:border-[#D4AF37]/50'
        }`}
        id="stt-toggle"
        title={isListening ? "Listening..." : "Dictate your message"}
      >
        {isListening ? <Mic className="w-5 h-5 shadow-inner" /> : <MicOff className="w-5 h-5" />}
      </button>
    </div>
  );
}
