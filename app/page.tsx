'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Brain, 
  BookOpen, 
  Scroll, 
  Mic, 
  Send, 
  ChevronLeft, 
  Bookmark, 
  Share2,
  Volume2,
  History,
  LogOut,
  Trash2,
  CheckCircle2,
  X,
  AlertTriangle,
  Feather,
  RefreshCw,
  Settings
} from 'lucide-react';
import { LatticeBackground } from '@/components/LatticeBackground';
import { FerdowsiAvatar } from '@/components/FerdowsiAvatar';
import { chatWithFerdowsi, chatWithFerdowsiStream, transcribeAudio, generateSpeechText, generateBackgroundInsight } from '@/lib/gemini';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  doc, 
  setDoc, 
  getDoc, 
  FirebaseUser,
  handleFirestoreError,
  OperationType
} from '@/lib/firebase';

type View = 'home' | 'chat' | 'voice';

export default function ResonanceShahnameh() {
  const [isIframe, setIsIframe] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [view, setView] = useState<View>('home');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTTSActive, setIsTTSActive] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const voiceModes = {
    aram:   { rate: 0.65, pitch: 0.68, volume: 0.95, label: "آرام (Calm)" },
    hamasi: { rate: 0.82, pitch: 0.78, volume: 0.97, label: "حماسی (Epic)" },
    hakim:  { rate: 0.75, pitch: 0.72, volume: 0.96, label: "حکیمانه (Sage)" },
    sheeri: { rate: 0.68, pitch: 0.75, volume: 0.94, label: "شاعرانه (Poetic)" },
    naghali: { rate: 0.88, pitch: 0.82, volume: 1.0, label: "نقالی (Classical)" }
  };
  const [voiceConfig, setVoiceConfig] = useState(voiceModes.hakim);
  const [backgroundInsight, setBackgroundInsight] = useState<{title: string, content: string, relatedCharacter: string} | null>(null);
  const [isExploring, setIsExploring] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string>('auto');
  const [visualizerStyle, setVisualizerStyle] = useState<'pulse' | 'bars' | 'wave' | 'ambient'>('pulse');

  const pronunciationFix: Record<string, string> = {
    "رستم": "رُسْتَمِ دَسْتان", "سهراب": "سُهْرابِ گُرْد", "اسفندیار": "اِسْفَنْدیارِ روئین‌تَن",
    "بیژن": "بیْژَن", "منیژه": "مَنیژه‌", "سیاوش": "سیاوَشِ پاک",
    "تهمینه": "تَهْمینه‌", "زال": "زالِ زَر", "رودابه": "رودابِه‌",
    "کیکاووس": "کِی‌کاووس", "کیخسرو": "کِی‌خُسرو", "کیومرث": "کَیومَرث",
    "جمشید": "جَمْشیدِ فَرّخ", "فریدون": "فِریدونِ فرخ‌زاد", "منوچهر": "مَنوچِهْر",
    "نوذر": "نَوْذَر", "گودرز": "گودَرز", "پیران": "پیرانِ ویسه‌",
    "افراسیاب": "اَفراسیابِ مکار", "سام": "سامِ نریمان", "نریمان": "نَریمان",
    "فردوسی": "فِردُوْسیِ طوسی", "ابوالقاسم": "اَبوالقاسِم",
    "شاهنامه": "شاهنامه‌یِ جاودان", "ایران": "ایران‌زَمین", "توران": "توران‌زَمین",
    "سیستان": "نیم‌روز", "مازندران": "مازَنْدَران", "زابل": "زاولُسْتان",
    "پهلوان": "پَهْلِوان", "دلاور": "دِلاوَر", "حماسه": "حَماسه‌",
    "نبرد": "نَبَرد", "رزم": "رَزم", "بزم": "بَزم", "شاعر": "سخن‌سَرای",
    "حکیم": "حکیمِ خِرَد", "ابوالقاسم فردوسی": "اَبوالقاسِم فردُوْسیِ مژده‌بخش",
    "خرد": "خِرَدِ والای", "جهان": "گیتی", "سپهر": "چرخِ گَردون", "یزدان": "ایزَدِ مِهر"
  };

  // Store utterances globally to avoid garbage collection bug in some browsers
  const utterancesRef = useRef<SpeechSynthesisUtterance[]>([]);

  const speakAsFerdowsi = (text: string, configOverrides?: { rate: number, pitch: number, volume: number }) => {
    if (typeof window === 'undefined') return;
    if (!('speechSynthesis' in window) || !isTTSActive) {
      if (isTTSActive) showNotification('مرورگر شما از قابلیت پخش صدا پشتیبانی نمی‌کند.', 'error');
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();
    stopAudioAnalysis();
    
    // Store utterances globally to prevent garbage collection bug
    const currentUtterances: SpeechSynthesisUtterance[] = [];
    utterancesRef.current = currentUtterances;

    let cleanText = text.replace(/[*#]/g, '');
    Object.keys(pronunciationFix).forEach(word => {
      const regex = new RegExp(word, 'gi');
      cleanText = cleanText.replace(regex, pronunciationFix[word]);
    });

    const sentences = cleanText.split(/[.!؟\n]/).filter(s => s.trim().length > 3);

    // Voice Selection Logic
    const getBestVoice = () => {
      const voices = synth.getVoices();
      // 1. Try to find a Persian voice (fa-IR)
      let voice = voices.find(v => v.lang.includes('fa'));
      if (voice) return voice;

      // 2. Fallback to Google Persian if available
      voice = voices.find(v => v.name.includes('Google') && v.lang.includes('fa'));
      if (voice) return voice;

      // 3. Fallback to any voice that might work, or return undefined to use default
      return voices[0]; 
    };

    const speakSentence = (index: number) => {
      if (index >= sentences.length) {
        setIsPlayingVoice(false);
        setAudioVolume(0);
        return;
      }
      if (utterancesRef.current !== currentUtterances) return; 

      const utterance = new SpeechSynthesisUtterance(sentences[index].trim());
      
      const selectedVoice = getBestVoice();
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      } else {
        utterance.lang = 'fa-IR';
      }

      utterance.rate = configOverrides?.rate || voiceConfig.rate;
      utterance.pitch = configOverrides?.pitch || voiceConfig.pitch;
      utterance.volume = configOverrides?.volume || voiceConfig.volume;

      utterance.onstart = () => {
        setIsPlayingVoice(true);
        const simulateVisuals = () => {
          if (!synth.speaking) {
            setAudioVolume(0);
            return;
          }
          setAudioVolume(Math.random() * 60 + 40); 
          animationFrameRef.current = requestAnimationFrame(simulateVisuals);
        };
        simulateVisuals();
      };

      utterance.onend = () => {
        if (utterancesRef.current === currentUtterances) {
          setTimeout(() => speakSentence(index + 1), 300);
        }
      };

      utterance.onerror = (e) => {
        console.error('Speech synthesis error', e);
        if (e.error === 'not-allowed') {
          showNotification('اجازه استفاده از بلندگو داده نشده است.', 'error');
        } else if (e.error === 'network') {
          showNotification('خطای شبکه در پخش صدا.', 'error');
        } else if (e.error === 'voice-unavailable') {
          showNotification('صدای انتخابی در دسترس نیست. از صدای پیش‌فرض استفاده می‌شود.', 'info');
        }
        setIsPlayingVoice(false);
        setAudioVolume(0);
      };

      utterancesRef.current.push(utterance);
      synth.speak(utterance);
    };

    // Chrome needs a small delay to ensure voices are loaded if it's the first time
    if (synth.getVoices().length === 0) {
      synth.onvoiceschanged = () => {
        if (sentences.length > 0) speakSentence(0);
        synth.onvoiceschanged = null;
      };
    } else {
      if (sentences.length > 0) speakSentence(0);
    }
  };

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const startMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      visualizerStreamRef.current = stream;
      startAudioAnalysis(stream);
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        setIsTranscribing(true);
        stopAudioAnalysis();
        showNotification('در حال تبدیل صدا به متن...', 'info');

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64data = (reader.result as string).split(',')[1];
            try {
              const text = await transcribeAudio(base64data, mediaRecorder.mimeType);
              if (text && text.trim()) {
                setInput(prev => prev + (prev.trim() ? ' ' : '') + text.trim());
                showNotification('صدا با موفقیت تبدیل شد.', 'success');
              } else {
                showNotification('صدایی تشخیص داده نشد.', 'info');
              }
            } catch (e) {
              console.error('Transcription error:', e);
              showNotification('خطا در ارتباط با سرور تبدیل صدا.', 'error');
            } finally {
              setIsTranscribing(false);
            }
          };
        } catch (e) {
          console.error('Blob error', e);
          setIsTranscribing(false);
          showNotification('خطا در پردازش فایل صوتی.', 'error');
        }
      };

      mediaRecorder.start();
      setIsListening(true);
      showNotification('در حال ضبط... (توسط هوش مصنوعی) برای پایان کلیک کنید.', 'info');
    } catch (err: any) {
      console.error('Mic error for fallback:', err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied') || String(err).includes('Permission denied')) {
        if (isIframe) {
          showNotification('دسترسی به میکروفون در این حالت ممکن نیست. لطفاً برنامه را در تب جدید باز کنید.', 'error');
        } else {
          showNotification('دسترسی به میکروفون رد شد. لطفاً اجازه دسترسی را در مرورگر خود صادر کنید.', 'error');
        }
      } else if (err.name === 'NotFoundError') {
        showNotification('میکروفونی در دستگاه شما یافت نشد.', 'error');
      } else {
        showNotification('خطا در دسترسی به میکروفون.', 'error');
      }
    }
  };

  const handleMicClick = async () => {
    if (isTranscribing) {
      showNotification('لطفاً صبر کنید تا صدای قبلی تبدیل شود...', 'info');
      return;
    }

    if (isListening) {
      // Stop whichever is recording
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      stopAudioAnalysis();
      setIsListening(false);
      return;
    }

    // Check if the browser natively supports SpeechRecognition
    const HasNativeRecognition = (('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window)) && !isIframe;

    if (HasNativeRecognition) {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        visualizerStreamRef.current = stream;
        startAudioAnalysis(stream);
      } catch (err) {
        console.error('Microphone permission denied', err);
        if (isIframe) {
          showNotification('دسترسی به میکروفون میسر نیست. لطفاً برنامه را در تب جدید باز کنید.', 'error');
        } else {
          showNotification('دسترسی به میکروفون داده نشده است.', 'error');
        }
        return;
      }

      if (!recognitionRef.current) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.lang = 'fa-IR';
        // false is significantly more stable on Android and avoids streaming timeouts/network errors
        recognition.interimResults = false; 
        recognition.continuous = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
          showNotification('حکیم سراپا گوش است...', 'info');
        };

        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setInput(prev => prev + (prev.trim() ? ' ' : '') + finalTranscript);
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          stopAudioAnalysis();
          
          if (event.error === 'not-allowed') {
            const isIframe = window !== window.parent;
            if (isIframe) {
              showNotification('برای استفاده از میکروفون، برنامه را در تب جدید باز کنید.', 'error');
            } else {
              showNotification('دسترسی رد شد. لطفاً اجازه دسترسی صادر کنید.', 'error');
            }
          } else if (event.error === 'network') {
            console.log('Native recognition network error, falling back to Gemini transcription...');
            // In case of native network error (common in Firefox/Brave), fallback to Gemini AI Recorder
            startMediaRecorder();
          } else if (event.error === 'no-speech') {
            showNotification('صدایی شنیده نشد.', 'info');
          } else if (event.error === 'audio-capture') {
            showNotification('میکروفونی یافت نشد یا غیرفعال است.', 'error');
          } else if (event.error !== 'aborted') {
            showNotification('خطا در شنیدن صدای شما.', 'error');
          }
        };

        recognition.onend = () => {
          // If mediaRecorder is active, we fell back, so do not set isListening to false here.
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
            stopAudioAnalysis();
            setIsListening(false);
          }
        };

        recognitionRef.current = recognition;
      }

      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error('Failed to start native recognition', e);
        stopAudioAnalysis();
      }
    } else {
      // Direct Fallback if SpeechRecognition is entirely missing
      startMediaRecorder();
    }
  };
  const saveVoiceSettings = async (config: typeof voiceConfig) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('ferdowsi_voice_settings', JSON.stringify(config));
    if (user) {
      const voicePath = `users/${user.uid}/settings/voice`;
      try {
        await setDoc(doc(db, voicePath), { ...config, updatedAt: new Date().toISOString() });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, voicePath);
        showNotification('خطا در ذخیره تنظیمات صوتی در ابر', 'error');
      }
    }
  };

  useEffect(() => {
    // Auto-save voice settings when they change
    if (mounted) {
      saveVoiceSettings(voiceConfig);
    }
  }, [voiceConfig, mounted, user]);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<string | null>(null);
  const [voiceResponse, setVoiceResponse] = useState('');
  const audioContextRef = useRef<AudioContext | null>(null);

  const [audioVolume, setAudioVolume] = useState<number>(0);
  const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(0));
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioContextRefForMic = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const visualizerStreamRef = useRef<MediaStream | null>(null);

  const startAudioAnalysis = (streamOrSource: MediaStream | AudioNode, ctx?: AudioContext) => {
    try {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      
      let analyser: AnalyserNode;
      const audioCtx = ctx || audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (streamOrSource instanceof MediaStream) {
        audioContextRefForMic.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(streamOrSource);
        analyser = audioCtx.createAnalyser();
        source.connect(analyser);
      } else {
        analyser = audioCtx.createAnalyser();
        streamOrSource.connect(analyser);
        analyser.connect(audioCtx.destination);
      }
      
      analyser.fftSize = 256;
      analyzerRef.current = analyser;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        if (!analyzerRef.current) return;
        analyzerRef.current.getByteFrequencyData(dataArray);
        setAudioData(new Uint8Array(dataArray));
        
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        setAudioVolume(average);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (e) {
      console.error("Audio analysis failed", e);
    }
  };

  const stopAudioAnalysis = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRefForMic.current && audioContextRefForMic.current.state !== 'closed') {
      audioContextRefForMic.current.close().catch(() => {});
      audioContextRefForMic.current = null;
    }
    if (visualizerStreamRef.current) {
      visualizerStreamRef.current.getTracks().forEach(t => t.stop());
      visualizerStreamRef.current = null;
    }
    analyzerRef.current = null;
    setAudioVolume(0);
    setAudioData(new Uint8Array(0));
  };

  const playPcmAudio = async (base64Audio: string) => {
    try {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      const binaryString = window.atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;
      
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const audioBuffer = audioCtx.createBuffer(1, pcm16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768.0;
      }
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = voiceConfig.rate;
      
      // Hook up visualizer for playback
      startAudioAnalysis(source, audioCtx);
      
      source.onended = () => {
        setIsPlayingVoice(false);
        stopAudioAnalysis();
      };
      source.start();
      setIsPlayingVoice(true);
    } catch (e) {
      console.error("Failed to play audio", e);
      setIsPlayingVoice(false);
      stopAudioAnalysis();
    }
  };

  const handleSpeak = async (text: string, id: string = 'global') => {
    if (isPlayingVoice) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      setIsPlayingVoice(false);
      stopAudioAnalysis();
      return;
    }
    
    setIsGeneratingAudio(id);
    try {
      const audioBase64 = await generateSpeechText(text, 'Charon');
      if (audioBase64) {
        await playPcmAudio(audioBase64);
      } else {
        speakAsFerdowsi(text);
      }
    } catch (e) {
      console.error(e);
      speakAsFerdowsi(text);
    } finally {
      setIsGeneratingAudio(null);
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auth Listener
  useEffect(() => {
    setMounted(true);
    setIsIframe(window !== window.parent);
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Sync voice settings
        const voicePath = `users/${u.uid}/settings/voice`;
        getDoc(doc(db, voicePath)).then(snap => {
          if (snap.exists()) {
            setVoiceConfig(snap.data() as any);
          } else {
             const local = localStorage.getItem('ferdowsi_voice_settings');
             if (local) setVoiceConfig(JSON.parse(local));
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000); // 4000ms helps read long error messages
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showNotification('خوش آمدید ای پهلوان');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/popup-blocked') {
        showNotification('مرورگر از باز شدن پنجره ورود جلوگیری کرد. لطفا برنامه را در برگه جدید باز کنید.', 'error');
      } else if (error.code === 'auth/internal-error') {
        if (isIframe) {
          showNotification('ورود در حالت پیش‌نمایش یا محیط ایزوله امکان‌پذیر نیست. لطفا از دکمه فلش بالا سمت راست برای باز کردن در برگه جدید استفاده کنید.', 'error');
        } else {
          showNotification('خطای داخلی سیستم ورود. لطفا کش مرورگر را پاک کرده یا دوباره تلاش کنید.', 'error');
        }
      } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        showNotification('عملیات ورود لغو شد.', 'info');
      } else {
        showNotification('خطا در ورود به دربار. لطفا دوباره تلاش کنید.', 'error');
      }
    }
  };

  const syncVoiceSettings = async (config: typeof voiceModes.hakim) => {
    if (!user) {
      localStorage.setItem('ferdowsi_voice_settings', JSON.stringify(config));
      return;
    }
    const path = `users/${user.uid}/settings/voice`;
    try {
      await setDoc(doc(db, path), { ...config, updatedAt: new Date().toISOString() });
    } catch (error) {
      console.error("Failed to sync voice settings:", error);
    }
  };

  useEffect(() => {
    if (voiceConfig) syncVoiceSettings(voiceConfig);
  }, [voiceConfig]);

  const fetchBackgroundInsight = async (msg: string, currentHistory: any[]) => {
    setIsExploring(true);
    try {
      const insight = await generateBackgroundInsight(msg, currentHistory);
      if (insight) setBackgroundInsight(insight);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExploring(false);
    }
  };

  const handleLogout = () => {
    auth.signOut();
    setView('home');
    showNotification('به امید دیدار دوباره', 'info');
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Trigger background learning
      fetchBackgroundInsight(input, messages);

      // Create a temporary placeholder for the streaming message
      setMessages(prev => [...prev, { role: 'model', content: '' }]);
      
      const response = await chatWithFerdowsiStream(messages, input, (streamedText) => {
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = streamedText;
          return newMessages;
        });
      });
    } catch (error: any) {
      console.error("Gemini Error:", error);
      let errorMsg = 'پوزش می‌طلبم، راه ارتباطی با خرد بسته شده است.';
      
      if (error.message === "QUOTA_EXCEEDED") {
        errorMsg = 'ای پهلوان، گویی امواجِ خردِ کیهانی موقتاً فروکش کرده‌اند. اندکی درنگ کن تا این چشمه دوباره بجوشد.';
        showNotification('سهمیه ارتباط با حکیم موقتاً به پایان رسیده است.', 'error');
      } else if (error.message?.includes('xhr error') || error.status === 'UNKNOWN') {
        errorMsg = 'در ارتباط با سیمرغِ هوش مصنوعی خللی پدید آمده. لطفاً دوباره تلاش کنید.';
        showNotification('خطای شبکه در ارتباط با هوش مصنوعی.', 'error');
      }
      
      setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages[newMessages.length - 1].content === '') {
           newMessages[newMessages.length - 1].content = errorMsg;
        } else {
           newMessages.push({ role: 'model', content: errorMsg });
        }
        return newMessages;
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleVoiceMessage = async (text: string) => {
    if (!text.trim()) return;
    setInput('');
    setVoiceResponse('');
    if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
    }
    setIsPlayingVoice(false);
    setIsTyping(true);

    try {
      // Background Learning
      fetchBackgroundInsight(text, []);

      const moodPrompt = selectedPersona === 'auto' 
        ? "در ابتدای پاسخ خود یکی از این برچسب‌ها را دقیقاً با فرمت [آرام]، [حماسی]، [حکیمانه]، یا [شاعرانه] بنویس. سپس پاسخ خود را در یک یا دو جمله کوتاه بیان کن" 
        : `پاسخ خود را با لحنی متناسب با شخصیت ${voiceModes[selectedPersona as keyof typeof voiceModes]?.label || 'حکیمانه'} در یک یا دو جمله کوتاه بیان کن`;

      const voicePrompt = `${text}\n\n[حالت صوتی: ${moodPrompt}]`;
      let response = await chatWithFerdowsi([], voicePrompt);

      let detectedMood = selectedPersona === 'auto' ? 'hakim' : selectedPersona;
      
      if (selectedPersona === 'auto') {
        if (response.includes('[آرام]')) detectedMood = 'aram';
        else if (response.includes('[حماسی]')) detectedMood = 'hamasi';
        else if (response.includes('[حکیمانه]')) detectedMood = 'hakim';
        else if (response.includes('[شاعرانه]')) detectedMood = 'sheeri';
        
        response = response.replace(/\[(آرام|حماسی|حکیمانه|شاعرانه)\]/g, '').trim();
      }

      const activeConfig = voiceModes[detectedMood as keyof typeof voiceModes] || voiceModes.hakim;
      setVoiceConfig(activeConfig);
      setVoiceResponse(response);
      
      try {
        const audioBase64 = await generateSpeechText(response, 'Charon');
        if (audioBase64) {
          playPcmAudio(audioBase64);
        } else {
          speakAsFerdowsi(response, activeConfig);
        }
      } catch (voiceError) {
        console.error('TTS Error:', voiceError);
        speakAsFerdowsi(response, activeConfig);
      }
      
      showNotification('حکیم پاسخ داد.', 'success');
    } catch (error: any) {
      console.error("Voice Gemini Error:", error);
      let errorMsg = 'خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید.';
      
      if (error.message === "QUOTA_EXCEEDED") {
         showNotification('سهمیه حکیم به پایان رسیده است.', 'error');
         errorMsg = "ای رهرو، چشمه‌ی کلام من موقتاً خشکیده است. زمانی دیگر بازآی تا دوباره سخن بگویم.";
      } else if (error.message?.includes('xhr error') || error.status === 'UNKNOWN') {
         showNotification('خطای شبکه در ارتباط با حکیم.', 'error');
         errorMsg = "در این لحظه، سیمرغِ سخن از پرواز بازمانده است. دوباره تلاش کن.";
      } else {
         showNotification('خطا در ارتباط با سرور.', 'error');
      }
      setVoiceResponse(errorMsg);
    } finally {
      setIsTyping(false);
    }
  };

  const renderVoiceSettings = () => (
    <AnimatePresence>
      {isSettingsOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSettingsOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md glass-panel p-8 rounded-3xl border border-royal-gold/30 z-[70] shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
            dir="rtl"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="gold-text font-bold text-2xl font-nastaliq">تنظیمات بانگِ حکیم</h3>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 text-royal-gold/50 hover:text-royal-gold"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-royal-turquoise text-sm font-bold block">انتخاب لحن (Mode)</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(voiceModes).map(([key, mode]) => (
                    <button
                      key={key}
                      onClick={() => setVoiceConfig({...mode})}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                        voiceConfig.label === mode.label 
                        ? 'bg-royal-gold text-royal-black border-royal-gold shadow-[0_0_15px_rgba(212,175,55,0.4)]' 
                        : 'bg-royal-gold/10 text-royal-gold border-royal-gold/20 hover:bg-royal-gold/20'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-royal-turquoise text-xs font-bold">تندیِ سخن (Rate)</span>
                    <span className="gold-text text-xs">{voiceConfig.rate}x</span>
                  </div>
                  <input 
                    type="range" min="0.5" max="1.5" step="0.05"
                    value={voiceConfig.rate}
                    onChange={(e) => setVoiceConfig({...voiceConfig, rate: parseFloat(e.target.value)})}
                    className="w-full accent-royal-gold h-2 bg-royal-black/50 rounded-full appearance-none cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-royal-turquoise text-xs font-bold">زیر و بمی (Pitch)</span>
                    <span className="gold-text text-xs">{voiceConfig.pitch}x</span>
                  </div>
                  <input 
                    type="range" min="0.5" max="1.5" step="0.05"
                    value={voiceConfig.pitch}
                    onChange={(e) => setVoiceConfig({...voiceConfig, pitch: parseFloat(e.target.value)})}
                    className="w-full accent-royal-gold h-2 bg-royal-black/50 rounded-full appearance-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-royal-gold/10">
                <p className="text-[10px] text-royal-turquoise/40 text-center">
                  تنظیمات به صورت خودکار در گنجینه‌ی شما ذخیره می‌شود.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-[90vh] space-y-8 p-4 md:p-6 pb-10">
      <div className="absolute top-4 left-4 z-50">
        <span className="text-xl md:text-2xl font-bold text-royal-gold uppercase tracking-widest font-sans drop-shadow-[0_0_10px_rgba(230,138,0,0.5)] select-none">
          AixAria
        </span>
      </div>

      <div className="absolute top-4 md:top-6 right-4 md:right-6 z-50">
        {user ? (
          <div className="flex items-center space-x-2 rtl:space-x-reverse glass-panel p-1.5 pr-3 rounded-full border border-royal-gold/30">
            <span className="gold-text text-xs font-bold hidden sm:inline">{user.displayName}</span>
            <img src={user.photoURL || ''} alt="User" className="w-7 h-7 rounded-full border border-royal-gold" />
            <button onClick={handleLogout} className="p-1.5 text-royal-turquoise hover:text-royal-gold transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button 
            onClick={handleLogin}
            className="glass-panel px-5 py-1.5 rounded-full border border-royal-gold/30 gold-text hover:bg-royal-gold/10 transition-all font-bold text-sm"
          >
            ورود به دربار
          </button>
        )}
      </div>
      
      <motion.div 
        animate={{ 
          scale: [1, 1.02, 1],
          filter: [
            "drop-shadow(0 0 20px rgba(230,138,0,0.4))", 
            "drop-shadow(0 0 60px rgba(26,63,37,0.7))", 
            "drop-shadow(0 0 20px rgba(230,138,0,0.4))"
          ]
        }} 
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="relative quantum-ring p-2 mt-8 md:mt-0"
      >
        <div className="absolute inset-0 bg-quantum-purple/10 blur-3xl rounded-full mix-blend-screen" />
        {mounted && <FerdowsiAvatar size={isIframe ? 150 : 200} audioVolume={audioVolume} />}
      </motion.div>

      <div className="text-center space-y-8">
        <h1 className="text-5xl md:text-7xl font-bold quantum-glow tracking-widest font-nastaliq leading-snug">
          رزونانس شاهنامه
        </h1>
        <p className="text-royal-turquoise/90 text-md md:text-xl font-medium tracking-widest quantum-data opacity-90 pb-4">
          [ کوانتومِ حکمتِ باستان در کالبدِ سیلیکون ]
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full max-w-lg px-2">
        <MenuButton 
          icon={<MessageSquare className="w-5 h-5 md:w-6 md:h-6" />} 
          label="پیکِ خرد (گفتگو با حکیم)" 
          onClick={() => setView('chat')} 
        />
        <MenuButton 
          icon={<Mic className="w-5 h-5 md:w-6 md:h-6" />} 
          label="بانگِ پارسی (تجربه صوتی)" 
          onClick={() => setView('voice')} 
        />
      </div>

      <div className="mt-8 text-center px-4 w-full max-w-lg">
        <p className="inline-block glass-panel px-6 py-2 rounded-full border-royal-turquoise/20 text-royal-turquoise/90 text-sm md:text-base leading-relaxed tracking-wide font-amiri font-bold drop-shadow-md">
          این برنامه توسط <strong className="text-royal-gold">آریا فانی</strong> برای آگاهی بخشیدن در مورد تمدن ایران و آریایی ساخته شده است
        </p>
      </div>
    </div>
  );

  const renderChat = () => (
    <div className="flex flex-col h-[90vh] p-4 relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          <button onClick={() => setView('home')} className="p-2 hover:bg-quantum-purple/20 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-quantum-purple" />
          </button>
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <FerdowsiAvatar size={40} audioVolume={audioVolume} />
            <span className="quantum-glow font-bold font-nastaliq text-xl">حکیم ابوالقاسم فردوسی</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
           <button 
             onClick={() => setIsSettingsOpen(true)}
             className="p-3 bg-royal-gold/10 rounded-full border border-royal-gold/20 text-royal-gold hover:bg-royal-gold/20 transition-all shadow-lg"
           >
             <Settings className="w-5 h-5" />
           </button>
        </div>
      </div>

      {renderVoiceSettings()}

      <div className="flex-1 overflow-y-auto space-y-4 mb-4 px-2 custom-scrollbar scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
        <AnimatePresence>
          {backgroundInsight && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 glass-panel border border-royal-turquoise/40 rounded-2xl bg-royal-turquoise/5 relative overflow-hidden group shadow-[0_10px_30px_rgba(0,240,255,0.05)]"
            >
              <div className="absolute top-0 right-0 p-2 text-[8px] gold-text opacity-40 uppercase tracking-[0.2em] font-sans">Deep Learning Insight</div>
              <div className="flex items-start space-x-3 rtl:space-x-reverse">
                <div className="p-2 bg-royal-gold/10 rounded-lg shrink-0">
                  <Brain className="w-5 h-5 gold-text" />
                </div>
                <div>
                  <h4 className="gold-text font-bold text-sm mb-1 font-nastaliq">{backgroundInsight.title}</h4>
                  <p className="text-royal-turquoise/80 text-xs leading-relaxed font-amiri">{backgroundInsight.content}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isExploring && !backgroundInsight && (
           <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center space-x-2 rtl:space-x-reverse mb-6 opacity-40 px-4"
          >
            <RefreshCw className="w-3 h-3 animate-spin text-royal-gold" />
            <span className="text-[10px] gold-text">در حال کاوش در اعماقِ تاریخ...</span>
          </motion.div>
        )}
        {messages.length === 0 && (
          <div className="text-center text-royal-turquoise/50 mt-20 italic quantum-data">
            &quot;بپرس از من هر آنچه در دل داری، ای جوینده‌ی خرد...&quot;
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-5 rounded-2xl text-xl leading-relaxed relative group backdrop-blur-md ${
              m.role === 'user' 
                ? 'bg-quantum-purple/10 border border-quantum-purple/30 text-white shadow-[0_0_15px_rgba(157,0,255,0.2)]' 
                : 'bg-royal-gold/5 border border-royal-turquoise/30 text-royal-turquoise shadow-[0_0_20px_rgba(0,240,255,0.15)]'
            }`}>
              {m.content}
              {m.role === 'model' && (
                <div className="absolute -left-12 bottom-2 flex flex-col space-y-2">
                   <button 
                    onClick={() => handleSpeak(m.content, `chat-${i}`)}
                    className={`p-3 rounded-full glass-panel border border-royal-turquoise/30 hover:bg-royal-turquoise/10 transition-all shadow-lg ${
                      isGeneratingAudio === `chat-${i}` ? 'animate-spin' : ''
                    }`}
                  >
                    <Volume2 className={`w-5 h-5 ${isGeneratingAudio === `chat-${i}` ? 'text-royal-turquoise' : 'text-royal-turquoise/70'}`} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-royal-gold/5 border border-royal-turquoise/30 p-4 rounded-2xl animate-pulse text-royal-turquoise/50 quantum-data">
              ...دریافتِ اسرارِ زمان...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="relative flex items-center space-x-2 rtl:space-x-reverse mt-2">
        <motion.button
          whileHover={{ scale: 1.1, backgroundColor: isListening ? '#ef4444' : 'rgba(230,138,0,0.1)' }}
          whileTap={{ scale: 0.9 }}
          onClick={handleMicClick}
          className={`p-4 rounded-full border transition-all ${
            isListening 
              ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' 
              : 'glass-panel border-royal-gold/30 text-royal-gold'
          }`}
        >
          {isTranscribing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
        </motion.button>
        <motion.input
          whileFocus={{ scale: 1.01, borderColor: '#e68a00', boxShadow: '0 0 20px rgba(230, 138, 0, 0.2)' }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="سخنی بگو..."
          className="flex-1 bg-royal-black/50 border border-quantum-purple/40 rounded-full py-4 px-6 focus:outline-none text-white transition-all font-amiri text-lg backdrop-blur-md placeholder-quantum-purple/40 shadow-inner"
          dir="rtl"
        />
        <motion.button 
          whileHover={{ scale: 1.1, backgroundColor: '#e68a00', boxShadow: '0 0 20px rgba(230,138,0,0.8)' }}
          whileTap={{ scale: 0.9 }}
          onClick={handleSendMessage} 
          className="p-4 bg-quantum-purple rounded-full text-white hover:bg-quantum-purple/80 transition-all shadow-[0_0_20px_rgba(26,63,37,0.6)]"
        >
          <Send className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );

  const renderVoice = () => (
    <div className="flex flex-col h-[90vh] p-4 text-center">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4 rtl:space-x-reverse mb-8">
          <button onClick={() => setView('home')} className="p-2 hover:bg-royal-gold/10 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 gold-text" />
          </button>
          <div className="flex space-x-2 rtl:space-x-reverse gold-text text-xs">
            <button 
              onClick={() => setVisualizerStyle('pulse')} 
              className={`px-3 py-1 rounded-full border border-royal-gold/30 transition-all ${visualizerStyle === 'pulse' ? 'bg-royal-gold text-royal-black shadow-[0_0_10px_rgba(212,175,55,0.5)]' : 'hover:bg-royal-gold/10'}`}
            >تپش</button>
            <button 
              onClick={() => setVisualizerStyle('bars')} 
              className={`px-3 py-1 rounded-full border border-royal-gold/30 transition-all ${visualizerStyle === 'bars' ? 'bg-royal-gold text-royal-black shadow-[0_0_10px_rgba(212,175,55,0.5)]' : 'hover:bg-royal-gold/10'}`}
            >میله</button>
            <button 
              onClick={() => setVisualizerStyle('wave')} 
              className={`px-3 py-1 rounded-full border border-royal-gold/30 transition-all ${visualizerStyle === 'wave' ? 'bg-royal-gold text-royal-black shadow-[0_0_10px_rgba(212,175,55,0.5)]' : 'hover:bg-royal-gold/10'}`}
            >موج</button>
            <button 
              onClick={() => setVisualizerStyle('ambient')} 
              className={`px-3 py-1 rounded-full border border-royal-gold/30 transition-all ${visualizerStyle === 'ambient' ? 'bg-royal-gold text-royal-black shadow-[0_0_10px_rgba(212,175,55,0.5)]' : 'hover:bg-royal-gold/10'}`}
            >هاله</button>
          </div>
        </div>
        <span className="gold-text font-bold text-lg font-nastaliq">کلامی از حکیم</span>
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
           <button 
             onClick={() => setIsSettingsOpen(true)}
             className="p-3 bg-royal-gold/10 rounded-full border border-royal-gold/20 text-royal-gold hover:bg-royal-gold/20 transition-all shadow-lg"
           >
             <Settings className="w-5 h-5" />
           </button>
        </div>
      </div>

      {renderVoiceSettings()}

      <div className="flex-1 flex flex-col items-center justify-center space-y-12">
          <div className="relative rounded-full">
            {(isListening || isPlayingVoice) && (
              <>
                {visualizerStyle === 'pulse' && (
                  <motion.div 
                    animate={{ 
                      opacity: 0.3 + (audioVolume / 255) * 0.7, 
                      filter: `blur(${10 + (audioVolume/255)*20}px)`,
                      scale: 1 + (audioVolume / 255) * 0.3
                    }}
                    className="absolute inset-0 bg-royal-gold rounded-full blur-xl -z-10"
                  />
                )}
                
                {visualizerStyle === 'bars' && audioData.length > 0 && (isListening || isPlayingVoice) && (
                   <div className="absolute inset-x-0 -bottom-12 flex justify-center items-end space-x-1 h-12 pointer-events-none">
                      {Array.from(audioData).filter((_, i) => i % 4 === 0).map((v, i) => (
                        <motion.div 
                          key={i}
                          animate={{ height: `${(v / 255) * 100}%` }}
                          className="w-1 bg-royal-gold rounded-t-full shadow-[0_0_8px_rgba(212,175,55,0.5)]"
                        />
                      ))}
                   </div>
                )}

                {visualizerStyle === 'wave' && (isListening || isPlayingVoice) && (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute -inset-8 pointer-events-none -z-10"
                  >
                    <svg viewBox="0 0 100 100" className="w-full h-full opacity-30">
                      <motion.circle 
                        cx="50" cy="50" 
                        animate={{ r: 40 + (audioVolume / 255) * 10 }}
                        className="fill-none stroke-royal-turquoise stroke-[0.5]"
                      />
                      <motion.circle 
                        cx="50" cy="50" 
                        animate={{ r: 45 + (audioVolume / 255) * 5 }}
                        className="fill-none stroke-royal-turquoise stroke-[0.2]"
                      />
                    </svg>
                  </motion.div>
                )}

                {visualizerStyle === 'ambient' && (isListening || isPlayingVoice) && (
                  <div className="absolute -inset-10 -z-10 flex items-center justify-center pointer-events-none">
                    <motion.div 
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.3, 0.1],
                        rotate: [0, 90, 180, 270, 360]
                      }}
                      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                      className="w-full h-full bg-gradient-to-r from-royal-gold/20 via-royal-turquoise/20 to-royal-gold/20 rounded-full blur-3xl"
                    />
                  </div>
                )}
              </>
            )}
            <FerdowsiAvatar size={200} audioVolume={audioVolume} />
          </div>

        <div className="h-24 w-full flex items-center justify-center">
          {input.trim() ? (
            <p className="text-royal-turquoise text-lg italic bg-royal-turquoise/10 p-4 rounded-xl border border-royal-turquoise/30 max-w-lg w-full shadow-inner">
              &quot;{input}&quot;
            </p>
          ) : (
            <p className="text-royal-turquoise/50 text-sm">
              بر روی میکروفون کلیک کنید و با حکیم سخن بگویید...
            </p>
          )}
        </div>

        <div className="flex items-center justify-center space-x-4 rtl:space-x-reverse relative">
          {isListening && (
            <motion.div 
              className="absolute inset-0 pointer-events-none flex justify-center items-center"
              animate={{ opacity: 0.5 + (audioVolume / 255) * 0.5 }}
            >
              <div className="w-16 h-16 rounded-full border-2 border-royal-gold/50 absolute" style={{ transform: `scale(${1 + (audioVolume / 100)})` }}></div>
              <div className="w-16 h-16 rounded-full border border-royal-gold/30 absolute" style={{ transform: `scale(${1.2 + (audioVolume / 80)})` }}></div>
            </motion.div>
          )}
          
          <motion.button 
            whileHover={!isListening ? { scale: 1.1, borderColor: '#00ced1', backgroundColor: 'rgba(0, 206, 209, 0.1)' } : {}}
            whileTap={{ scale: 0.9 }}
            onClick={handleMicClick}
            className={`p-6 border-2 rounded-full transition-all relative z-10 ${
              isListening ? 'bg-royal-gold/20 border-royal-gold text-royal-gold shadow-[0_0_30px_rgba(212,175,55,0.5)]' 
              : isTranscribing ? 'bg-royal-gold/20 border-royal-gold text-royal-gold opacity-50 cursor-wait shadow-[0_0_20px_rgba(212,175,55,0.3)]'
              : 'glass-panel border-royal-turquoise/50 text-royal-turquoise hover:shadow-[0_0_20px_rgba(0,206,209,0.2)]'
            }`}
          >
            {isTranscribing ? <Brain className="w-10 h-10 animate-pulse" /> : <Mic className="w-10 h-10" />}
          </motion.button>

          <AnimatePresence>
            {input.trim() && !isTranscribing && !isTyping && (
              <motion.button 
                initial={{ opacity: 0, scale: 0.5, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.5, x: 20 }}
                whileHover={{ scale: 1.1, backgroundColor: '#f9e297' }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleVoiceMessage(input)} 
                className="p-5 bg-royal-gold rounded-full text-royal-black hover:bg-royal-gold/80 transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)]"
              >
                <Send className="w-8 h-8" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {isTyping && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-royal-gold/70 animate-pulse font-nastaliq text-xl"
          >
            حکیم در حال تأمل است...
          </motion.div>
        )}

        {voiceResponse && !isTyping && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-royal-gold/10 border border-royal-gold/30 rounded-3xl p-10 relative overflow-hidden shadow-[0_0_40px_rgba(212,175,55,0.2)]"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-royal-gold/5 rounded-full blur-3xl"></div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="flex items-center space-x-3 rtl:space-x-reverse mb-8">
                <motion.div
                  animate={isPlayingVoice ? { scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] } : {}}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <Volume2 className={`w-10 h-10 ${isPlayingVoice ? 'text-royal-turquoise' : 'text-royal-gold/50'}`} />
                </motion.div>
                <span className="gold-text font-bold text-3xl font-nastaliq">پاسخِ حکیمانه‌ی فردوسی</span>
              </div>
              <p className="text-royal-turquoise text-3xl leading-relaxed font-amiri whitespace-pre-wrap text-center">
                {voiceResponse}
              </p>

              {backgroundInsight && (
                 <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 p-4 bg-royal-turquoise/5 border border-royal-turquoise/20 rounded-xl text-right w-full"
                >
                  <div className="flex items-center space-x-2 rtl:space-x-reverse mb-2 opacity-60">
                    <Brain className="w-3.5 h-3.5 gold-text" />
                    <span className="text-[10px] gold-text font-bold uppercase">{backgroundInsight.title}</span>
                  </div>
                  <p className="text-royal-turquoise/70 text-xs leading-relaxed">{backgroundInsight.content}</p>
                </motion.div>
              )}
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleSpeak(voiceResponse, 're-play')}
                className="mt-8 p-3 glass-panel border border-royal-gold/30 rounded-full text-royal-gold hover:bg-royal-gold/10 transition-all flex items-center space-x-2 rtl:space-x-reverse"
              >
                <Volume2 className="w-5 h-5" />
                <span className="text-sm font-bold">شنیدنِ دوباره</span>
              </motion.button>
            </div>
            
            {/* Visualizer bars */}
            {isPlayingVoice && (
              <div className="absolute bottom-0 left-0 right-0 h-1/3 opacity-20 pointer-events-none flex items-end justify-center space-x-1 rtl:space-x-reverse">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 bg-royal-turquoise rounded-t-sm"
                    animate={{ height: ["10%", "100%", "20%"] }}
                    transition={{
                      duration: 0.5 + Math.random() * 0.5,
                      repeat: Infinity,
                      repeatType: "reverse",
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );

  return (
    <main className="relative min-h-screen bg-royal-black text-foreground overflow-hidden font-amiri" dir="rtl">
      <LatticeBackground />
      
      {/* Notification Banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4"
          >
            <div className={`glass-panel p-4 rounded-2xl border ${
              notification.type === 'success' ? 'border-royal-gold shadow-[0_0_20px_rgba(212,175,55,0.3)]' :
              notification.type === 'error' ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' :
              'border-royal-turquoise shadow-[0_0_20px_rgba(0,206,209,0.2)]'
            } flex items-center justify-between`}>
              <div className="flex items-center space-x-3 rtl:space-x-reverse">
                {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 gold-text" />}
                {notification.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                {notification.type === 'info' && <Brain className="w-5 h-5 text-royal-turquoise" />}
                
                <span className={`font-bold text-sm ${
                  notification.type === 'success' ? 'gold-text' : 
                  notification.type === 'error' ? 'text-red-400' :
                  'text-royal-turquoise'
                }`}>
                  {notification.message}
                </span>
              </div>
              <button onClick={() => setNotification(null)} className={`hover:scale-110 transition-transform ${
                notification.type === 'error' ? 'text-red-400/70 hover:text-red-400' : 'text-royal-gold/50 hover:text-royal-gold'
              }`}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Images Layer: Epic Scenes of Shahnameh */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Dimensional Overlays for Mood */}
        <div className="absolute inset-0 bg-royal-black/60 z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-b from-royal-black via-transparent to-royal-black z-[2]" />
        <div className="absolute inset-0 bg-gradient-to-r from-royal-black/80 via-transparent to-royal-black/80 z-[2]" />
        
        {/* Epic Scenes */}
        <div className="absolute inset-0 flex items-center justify-center opacity-15">
          {/* Cybernetic Persian Theme */}
          <motion.img 
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 5, ease: "easeOut" }}
            src="https://picsum.photos/seed/cyber-ancient-persia/1920/1080?blur=4" 
            alt=""
            className="w-full h-full object-cover grayscale sepia brightness-75 contrast-125 mix-blend-screen"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Side Accents: Rostam (The Hero) and Ferdowsi (The Creator) */}
        <motion.div 
          animate={{ opacity: [0.05, 0.15, 0.05], filter: ["blur(4px)", "blur(2px)", "blur(4px)"] }}
          transition={{ duration: 6, repeat: Infinity }}
          className="absolute -left-10 top-0 h-full w-1/3 opacity-10"
        >
           <img 
            src="https://picsum.photos/seed/hologram-warrior/600/1200" 
            alt=""
            className="h-full w-full object-cover grayscale mix-blend-screen"
            referrerPolicy="no-referrer"
          />
        </motion.div>
        <motion.div 
          animate={{ opacity: [0.05, 0.15, 0.05], filter: ["blur(4px)", "blur(2px)", "blur(4px)"] }}
          transition={{ duration: 6, repeat: Infinity, delay: 3 }}
          className="absolute -right-10 top-0 h-full w-1/3 opacity-10"
        >
           <img 
            src="https://picsum.photos/seed/quantum-sage/600/1200" 
            alt=""
            className="h-full w-full object-cover grayscale mix-blend-screen"
            referrerPolicy="no-referrer"
          />
        </motion.div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-0">
        <AnimatePresence mode="wait">
          {view === 'home' && <motion.div key="home" initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>{renderHome()}</motion.div>}
          {view === 'chat' && <motion.div key="chat" initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, x: -20, filter: 'blur(10px)' }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>{renderChat()}</motion.div>}
          {view === 'voice' && <motion.div key="voice" initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>{renderVoice()}</motion.div>}
        </AnimatePresence>
      </div>

      {/* Confetti Effect Placeholder */}
      <div id="confetti-container" className="fixed inset-0 pointer-events-none z-50" />
    </main>
  );
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.01, boxShadow: '0 10px 40px rgba(230, 138, 0, 0.4), inset 0 0 15px rgba(26, 63, 37, 0.4)' }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={onClick}
      className="relative flex flex-col items-center justify-center p-4 md:p-6 glass-panel rounded-[1.5rem] md:rounded-[2rem] border border-royal-turquoise/20 space-y-2 md:space-y-3 transition-opacity group overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-quantum-purple/10 to-royal-turquoise/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-l from-transparent via-royal-turquoise to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-royal-gold to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="text-royal-turquoise group-hover:text-royal-gold transition-colors duration-300 relative z-10 filter drop-shadow-[0_0_8px_rgba(230,138,0,0.6)] mix-blend-screen">
        {icon}
      </div>
      <span className="text-white/90 group-hover:text-white font-bold text-xs md:text-sm tracking-wide whitespace-nowrap relative z-10 filter drop-shadow-[0_0_5px_rgba(255,255,255,0.3)] transition-colors duration-300">{label}</span>
    </motion.button>
  );
}
