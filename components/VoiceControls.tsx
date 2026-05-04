'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, Square, Volume2, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceControlsProps {
  text: string;
  mode: 'classic' | 'mystic' | 'warrior';
  onStateChange?: (state: 'idle' | 'playing' | 'paused') => void;
  settings: VoiceSettings;
}

export interface VoiceSettings {
  rate: number;
  pitch: number;
  volume: number;
}

export const DEFAULT_SETTINGS: VoiceSettings = {
  rate: 0.9,
  pitch: 0.8,
  volume: 1.0
};

export default function VoiceControls({ text, mode, onStateChange, settings }: VoiceControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    onStateChange?.('idle');
  }, [onStateChange]);

  const speak = useCallback(() => {
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      onStateChange?.('playing');
      return;
    }

    stop();

    const utterance = new SpeechSynthesisUtterance(text);
    
    const voices = window.speechSynthesis.getVoices();
    const faVoice = voices.find(v => v.lang.startsWith('fa'));
    if (faVoice) {
      utterance.voice = faVoice;
    }
    
    utterance.lang = 'fa-IR';
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;

    if (mode === 'warrior') {
      utterance.rate = Math.min(1.2, settings.rate * 1.1);
      utterance.pitch = Math.max(0.1, settings.pitch * 0.7);
    } else if (mode === 'mystic') {
      utterance.rate = Math.max(0.1, settings.rate * 0.8);
      utterance.pitch = Math.min(2.0, settings.pitch * 1.3);
    }

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      onStateChange?.('idle');
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
      onStateChange?.('idle');
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    onStateChange?.('playing');
  }, [text, settings, mode, isPaused, stop, onStateChange]);

  const pause = useCallback(() => {
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
    onStateChange?.('paused');
  }, [onStateChange]);

  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  return (
    <div className="flex items-center gap-2">
      {!isPlaying ? (
        <button 
          onClick={speak}
          className="p-2 rounded-lg bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] transition-colors border border-[#D4AF37]/20 flex items-center justify-center"
          title="Read in Classical Tongue"
        >
          <Play className="w-4 h-4 fill-current" />
        </button>
      ) : (
        <button 
          onClick={pause}
          className="p-2 rounded-lg bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] transition-colors border border-[#D4AF37]/20 flex items-center justify-center"
          title="Silence temporarily"
        >
          <Pause className="w-4 h-4 fill-current" />
        </button>
      )}
      
      <button 
        onClick={stop}
        className="p-2 rounded-lg bg-black/20 hover:bg-black/40 text-[#E0D8D0]/40 transition-colors border border-[#2A2A2C] flex items-center justify-center"
        title="Stop narration"
      >
        <Square className="w-4 h-4 fill-current" />
      </button>
    </div>
  );
}
