import { characters, glossary, openingVerses, stories, themes } from './shahnameh';

export type VoiceModeKey = 'aram' | 'hamasi' | 'hakim' | 'sheeri' | 'naghali';

export const voiceModes: Record<VoiceModeKey, { label: string; short: string; rate: number; pitch: number; volume: number; studioStyle: string }> = {
  aram: {
    label: 'آرام',
    short: 'کم‌شتاب و نرم',
    rate: 0.68,
    pitch: 0.72,
    volume: 0.95,
    studioStyle: 'Persian male narrator, calm, low and warm, unhurried, restrained emotion, clear classical diction.',
  },
  hamasi: {
    label: 'حماسی',
    short: 'کوبنده و پرتوان',
    rate: 0.86,
    pitch: 0.76,
    volume: 1,
    studioStyle: 'Persian epic storyteller, resonant mature voice, commanding but not theatrical, measured intensity, clean pauses.',
  },
  hakim: {
    label: 'حکیمانه',
    short: 'سنگین و سنجیده',
    rate: 0.76,
    pitch: 0.7,
    volume: 0.97,
    studioStyle: 'Mature Persian sage, deep steady timbre, deliberate pacing, dignified and intimate, precise pronunciation.',
  },
  sheeri: {
    label: 'شاعرانه',
    short: 'آهنگین و نرم',
    rate: 0.7,
    pitch: 0.77,
    volume: 0.94,
    studioStyle: 'Persian literary recitation, musical cadence without singing, warm breath control, reflective and elegant.',
  },
  naghali: {
    label: 'نقالی',
    short: 'روایی و صحنه‌ای',
    rate: 0.9,
    pitch: 0.8,
    volume: 1,
    studioStyle: 'Traditional Persian naqqal-inspired narration, vivid storytelling, strong consonants, dynamic pauses, dignified rather than exaggerated.',
  },
};

const pronunciationFix: Record<string, string> = {
  'رستم': 'رُسْتَم',
  'سهراب': 'سُهْراب',
  'اسفندیار': 'اِسْفَنْدیار',
  'بیژن': 'بیْژَن',
  'منیژه': 'مَنیژه',
  'سیاوش': 'سیاوَش',
  'تهمینه': 'تَهْمینه',
  'زال': 'زال',
  'رودابه': 'رودابِه',
  'کیکاووس': 'کِی‌کاووس',
  'کیخسرو': 'کِی‌خُسرو',
  'کیومرث': 'کَیومَرث',
  'جمشید': 'جَمْشید',
  'فریدون': 'فِریدون',
  'منوچهر': 'مَنوچِهْر',
  'افراسیاب': 'اَفراسیاب',
  'فردوسی': 'فِردوسی',
  'شاهنامه': 'شاهنامه',
  'ایران': 'ایران‌زمین',
  'توران': 'توران‌زمین',
  'خرد': 'خِرَد',
  'فرّه': 'فَرّه',
  'پهلوان': 'پَهْلَوان',
};

const normalize = (value: string) => value
  .toLocaleLowerCase('fa')
  .replace(/[يى]/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const stopWords = new Set(['از', 'به', 'در', 'با', 'و', 'یا', 'را', 'که', 'این', 'آن', 'یک', 'چیست', 'چرا', 'چطور', 'درباره', 'برای', 'می', 'شود', 'بود', 'است']);

function tokens(value: string) {
  return normalize(value).split(' ').filter(token => token.length > 1 && !stopWords.has(token));
}

function score(query: string[], haystack: string) {
  const normalized = normalize(haystack);
  return query.reduce((total, token) => total + (normalized.includes(token) ? (token.length > 4 ? 3 : 2) : 0), 0);
}

function openingFor(question: string) {
  const variants = [
    'ای جویندهٔ خرد،',
    'بشنو و نیک بنگر:',
    'اگر این گره را به زبان شاهنامه باز کنیم،',
    'سخن را کوتاه و روشن بگویم:',
  ];
  const hash = Array.from(question).reduce((sum, char) => (sum + char.charCodeAt(0)) % variants.length, 0);
  return variants[hash];
}

export function answerLocally(question: string): string {
  const query = tokens(question);
  if (!query.length) return 'پرسش را روشن‌تر بنویس تا بتوانم آن را در روایت‌ها، چهره‌ها و واژه‌های همین نسخه بجویم.';

  const rankedStories = stories
    .map(item => ({ item, score: score(query, `${item.title} ${item.subtitle} ${item.summary} ${item.themes.join(' ')} ${item.figures.join(' ')}`) }))
    .sort((a, b) => b.score - a.score);
  const rankedCharacters = characters
    .map(item => ({ item, score: score(query, `${item.name} ${item.epithet} ${item.role} ${item.arc} ${item.traits.join(' ')} ${item.stories.join(' ')}`) }))
    .sort((a, b) => b.score - a.score);
  const rankedThemes = themes
    .map(item => ({ item, score: score(query, `${item.title} ${item.text}`) }))
    .sort((a, b) => b.score - a.score);
  const rankedGlossary = glossary
    .map(item => ({ item, score: score(query, `${item.term} ${item.definition}`) }))
    .sort((a, b) => b.score - a.score);

  const candidates = [
    { kind: 'story' as const, score: rankedStories[0]?.score ?? 0, item: rankedStories[0]?.item },
    { kind: 'character' as const, score: rankedCharacters[0]?.score ?? 0, item: rankedCharacters[0]?.item },
    { kind: 'theme' as const, score: rankedThemes[0]?.score ?? 0, item: rankedThemes[0]?.item },
    { kind: 'glossary' as const, score: rankedGlossary[0]?.score ?? 0, item: rankedGlossary[0]?.item },
  ].sort((a, b) => b.score - a.score);

  const best = candidates[0];
  const lead = openingFor(question);

  if (!best || best.score <= 0 || !best.item) {
    return `${lead} دانشِ آفلاین این نسخه برای پاسخ دقیق به این پرسش کافی نیست. می‌توانی نام یک چهره، روایت یا مفهومی مانند «رستم»، «سیاوش»، «داد»، «فرّه» یا «رستم و اسفندیار» را بپرسی. برای پرسش‌های بازتر، اتصال اختیاری Gemini پاسخ گسترده‌تری می‌دهد.`;
  }

  if (best.kind === 'story') {
    const item = best.item as (typeof stories)[number];
    return `${lead} در روایت «${item.title}»، ${item.summary}\n\nگره اصلی این بخش میان ${item.themes.slice(0, 3).join('، ')} شکل می‌گیرد. چهره‌های محوری آن ${item.figures.join('، ')} هستند. اگر بخواهی، پرسش را روی یکی از همین چهره‌ها یا یکی از این درون‌مایه‌ها باریک‌تر کن.`;
  }

  if (best.kind === 'character') {
    const item = best.item as (typeof characters)[number];
    return `${lead} ${item.name}، ${item.epithet}، ${item.role}\n\nمسیر او چنین خوانده می‌شود: ${item.arc}\n\nبرای دنبال‌کردن این چهره، از ${item.stories.join('، ')} آغاز کن.`;
  }

  if (best.kind === 'glossary') {
    const item = best.item as (typeof glossary)[number];
    const verse = normalize(item.term).includes('خرد') ? `\n\n«${openingVerses[0][0]} / ${openingVerses[0][1]}»` : '';
    return `${lead} «${item.term}» در این خوانش یعنی ${item.definition}${verse}`;
  }

  const item = best.item as (typeof themes)[number];
  return `${lead} ${item.text}\n\nاین پرسش را بهتر است نه با یک حکم قطعی، بلکه با کنار هم گذاشتن کردار، پیامد و فرجام شخصیت‌ها خواند.`;
}

export function prepareSpeech(text: string) {
  let clean = text
    .replace(/[*#_`>]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();

  for (const [word, spoken] of Object.entries(pronunciationFix)) {
    clean = clean.replace(new RegExp(word, 'g'), spoken);
  }
  return clean;
}

function bestPersianVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  return voices.find(voice => /^fa(?:-|_)/i.test(voice.lang))
    || voices.find(voice => voice.lang.toLowerCase().includes('fa'))
    || voices.find(voice => /persian|farsi/i.test(voice.name))
    || voices[0];
}

export function stopLocalSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

export function speakLocally(text: string, mode: VoiceModeKey = 'hakim', onState?: (speaking: boolean) => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;

  const synth = window.speechSynthesis;
  const config = voiceModes[mode];
  const voice = bestPersianVoice();
  const sentences = prepareSpeech(text).split(/(?<=[.!؟])\s+|\s*[؛]\s*/).filter(Boolean).slice(0, 24);
  synth.cancel();
  const next = (index: number) => {
    if (index >= sentences.length) {
      onState?.(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(sentences[index]);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'fa-IR';
    }
    utterance.rate = config.rate;
    utterance.pitch = config.pitch;
    utterance.volume = config.volume;
    utterance.onstart = () => onState?.(true);
    utterance.onend = () => window.setTimeout(() => next(index + 1), mode === 'naghali' ? 170 : 260);
    utterance.onerror = () => onState?.(false);
    synth.speak(utterance);
  };

  next(0);
  return true;
}

export async function generateStudioVoice(apiKey: string, text: string, mode: VoiceModeKey = 'hakim') {
  const key = apiKey.trim();
  if (!key) throw new Error('کلید اتصال برای صدای استودیویی وارد نشده است.');
  const config = voiceModes[mode];
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{
          text: prepareSpeech(text),
          speech_metadata: { style: config.studioStyle },
        }],
      }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { voice: 'Charon' } },
      },
    }),
  });

  if (!response.ok) throw new Error(`صدای استودیویی با کد ${response.status} در دسترس نیست.`);
  const data = await response.json();
  const base64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64) throw new Error('دادهٔ صوتی دریافت نشد.');

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: 'audio/wav' });
}
