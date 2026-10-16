'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Compass,
  Copy,
  Feather,
  KeyRound,
  Menu,
  MessageCircle,
  Search,
  Send,
  Settings,
  Shield,
  Shuffle,
  Volume2,
  X,
} from 'lucide-react';
import { askShahnameh, type ConversationMessage } from '@/lib/gemini';
import { answerLocally, generateStudioVoice, speakLocally, stopLocalSpeech, voiceModes, type VoiceModeKey } from '@/lib/ferdowsi';
import { characters, glossary, openingVerses, searchable, stories, themes, type Character, type Story } from '@/lib/shahnameh';

const eraOrder = ['اساطیری', 'پهلوانی', 'تاریخی'] as const;
const quickQuestions = [
  'تفاوت نگاه شاهنامه به داد و فرمان چیست؟',
  'چرا داستان رستم و سهراب تراژیک است؟',
  'نقش سیاوش در منطق اخلاقی شاهنامه چیست؟',
];

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 4 39 12v16c0 8-6.1 13.3-15 16-8.9-2.7-15-8-15-16V12Z" />
      <path d="M16 18c5.5-4 10.5-4 16 0M15 25c6-3 12-3 18 0M19 32c3.3-1 6.7-1 10 0" />
      <circle cx="24" cy="12.5" r="1.7" />
    </svg>
  );
}

function SectionHead({ index, eyebrow, title, copy }: { index: string; eyebrow: string; title: string; copy: string }) {
  return (
    <div className="section-head">
      <div className="section-index" aria-hidden="true">{index}</div>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <p>{copy}</p>
    </div>
  );
}

function StoryDrawer({ story, onClose }: { story: Story | null; onClose: () => void }) {
  if (!story) return null;
  return (
    <div className="overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <article className="drawer" role="dialog" aria-modal="true" aria-labelledby="story-drawer-title">
        <button className="icon-button drawer-close" onClick={onClose} aria-label="بستن"><X size={18} /></button>
        <p className="eyebrow">{story.era} / روایت</p>
        <h3 id="story-drawer-title">{story.title}</h3>
        <p className="drawer-subtitle">{story.subtitle}</p>
        <p className="drawer-body">{story.summary}</p>
        <dl className="drawer-meta">
          <div><dt>درون‌مایه‌ها</dt><dd>{story.themes.join(' · ')}</dd></div>
          <div><dt>چهره‌ها</dt><dd>{story.figures.join(' · ')}</dd></div>
        </dl>
        <a className="text-action" href="#ask" onClick={onClose}>پرسش دربارهٔ این روایت <ArrowLeft size={16} /></a>
      </article>
    </div>
  );
}

function CharacterDrawer({ character, onClose }: { character: Character | null; onClose: () => void }) {
  if (!character) return null;
  return (
    <div className="overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <article className="drawer character-drawer" role="dialog" aria-modal="true" aria-labelledby="character-drawer-title">
        <button className="icon-button drawer-close" onClick={onClose} aria-label="بستن"><X size={18} /></button>
        <p className="eyebrow">چهره / {character.epithet}</p>
        <h3 id="character-drawer-title">{character.name}</h3>
        <p className="drawer-subtitle">{character.role}</p>
        <p className="drawer-body">{character.arc}</p>
        <div className="tag-row">{character.traits.map(item => <span key={item}>{item}</span>)}</div>
        <dl className="drawer-meta"><div><dt>روایت‌های مهم</dt><dd>{character.stories.join(' · ')}</dd></div></dl>
      </article>
    </div>
  );
}

export default function ShahnamehPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [story, setStory] = useState<Story | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [verseIndex, setVerseIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');
  const [voiceMode, setVoiceMode] = useState<VoiceModeKey>('hakim');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [studioVoice, setStudioVoice] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = sessionStorage.getItem('shahnameh_gemini_key') || '';
      const savedVoice = localStorage.getItem('shahnameh_voice_mode') as VoiceModeKey | null;
      const savedAutoSpeak = localStorage.getItem('shahnameh_auto_speak') === '1';
      const savedStudio = localStorage.getItem('shahnameh_studio_voice') === '1';
      setApiKey(saved);
      setKeyDraft(saved);
      if (savedVoice && savedVoice in voiceModes) setVoiceMode(savedVoice);
      setAutoSpeak(savedAutoSpeak);
      setStudioVoice(Boolean(saved && savedStudio));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('shahnameh_voice_mode', voiceMode);
    localStorage.setItem('shahnameh_auto_speak', autoSpeak ? '1' : '0');
    localStorage.setItem('shahnameh_studio_voice', studioVoice ? '1' : '0');
  }, [voiceMode, autoSpeak, studioVoice]);

  useEffect(() => () => {
    stopLocalSpeech();
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src.startsWith('blob:')) URL.revokeObjectURL(audioRef.current.src);
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setSettingsOpen(false);
        setStory(null);
        setCharacter(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase('fa');
    if (q.length < 2) return [];
    return searchable
      .filter(item => `${item.title} ${item.text}`.toLocaleLowerCase('fa').includes(q))
      .slice(0, 8);
  }, [searchTerm]);

  const groupedStories = useMemo(() => eraOrder.map(era => ({ era, items: stories.filter(item => item.era === era) })), []);
  const currentVerse = openingVerses[verseIndex];

  const saveKey = () => {
    const value = keyDraft.trim();
    if (value) sessionStorage.setItem('shahnameh_gemini_key', value);
    else sessionStorage.removeItem('shahnameh_gemini_key');
    setApiKey(value);
    setSettingsOpen(false);
  };

  const clearKey = () => {
    sessionStorage.removeItem('shahnameh_gemini_key');
    setApiKey('');
    setKeyDraft('');
    setStudioVoice(false);
  };

  const stopNarration = () => {
    stopLocalSpeech();
    if (audioRef.current) {
      const src = audioRef.current.src;
      audioRef.current.pause();
      audioRef.current = null;
      if (src.startsWith('blob:')) URL.revokeObjectURL(src);
    }
    setSpeaking(false);
  };

  const playNarration = async (text: string) => {
    stopNarration();
    if (studioVoice && apiKey) {
      try {
        setSpeaking(true);
        const blob = await generateStudioVoice(apiKey, text, voiceMode);
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          setSpeaking(false);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          setSpeaking(false);
          speakLocally(text, voiceMode, setSpeaking);
        };
        await audio.play();
        return;
      } catch {
        setSpeaking(false);
      }
    }
    const started = speakLocally(text, voiceMode, setSpeaking);
    if (!started) setAskError('این مرورگر خوانش صوتی فارسی را در دسترس نگذاشته است.');
  };

  const handleSearchResult = (type: string, id: string) => {
    if (type === 'داستان') setStory(stories.find(item => item.id === id) || null);
    if (type === 'چهره') setCharacter(characters.find(item => item.id === id) || null);
    if (type === 'واژه') document.getElementById('glossary')?.scrollIntoView({ behavior: 'smooth' });
    setSearchTerm('');
  };

  const copyVerse = async () => {
    await navigator.clipboard?.writeText(`${currentVerse[0]}\n${currentVerse[1]}\n— فردوسی، شاهنامه`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  };

  const speakVerse = () => {
    if (speaking) stopNarration();
    else void playNarration(`${currentVerse[0]}. ${currentVerse[1]}`);
  };

  const submitQuestion = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = question.trim();
    if (!text || asking) return;

    setAskError('');
    setAsking(true);
    setConversation(prev => [...prev, { role: 'user', text }]);
    setQuestion('');

    try {
      let reply = '';
      if (apiKey) {
        try {
          reply = await askShahnameh(apiKey, text, conversation);
        } catch {
          reply = answerLocally(text);
          setAskError('اتصال گسترده در دسترس نبود؛ پاسخ محلی نمایش داده شد.');
        }
      } else {
        reply = answerLocally(text);
      }
      setConversation(prev => [...prev, { role: 'model', text: reply }]);
      if (autoSpeak) void playNarration(reply);
    } catch (error) {
      setAskError(error instanceof Error ? error.message : 'پاسخ دریافت نشد.');
    } finally {
      setAsking(false);
    }
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="شاهنامه، صفحهٔ آغاز">
          <BrandMark />
          <span><b>شاهنامه</b><small>خوانش · روایت · خرد</small></span>
        </a>

        <nav className="desktop-nav" aria-label="بخش‌های اصلی">
          <a href="#stories">روایت‌ها</a>
          <a href="#characters">چهره‌ها</a>
          <a href="#themes">درون‌مایه‌ها</a>
          <a href="#glossary">واژه‌نامه</a>
          <a href="#ask">پرسش</a>
        </nav>

        <div className="header-actions">
          <button className={`key-status ${apiKey ? 'is-connected' : ''}`} onClick={() => { setKeyDraft(apiKey); setSettingsOpen(true); }}>
            <KeyRound size={15} />
            <span>{apiKey ? 'اتصال گسترده' : 'حالت مستقل'}</span>
          </button>
          <button className="icon-button mobile-menu-button" onClick={() => setMenuOpen(value => !value)} aria-expanded={menuOpen} aria-label="باز کردن فهرست">
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>

        {menuOpen && (
          <nav className="mobile-nav" aria-label="فهرست موبایل">
            {[
              ['#stories', 'روایت‌ها'], ['#characters', 'چهره‌ها'], ['#themes', 'درون‌مایه‌ها'], ['#glossary', 'واژه‌نامه'], ['#ask', 'پرسش'],
            ].map(([href, label]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}<ArrowLeft size={15} /></a>)}
          </nav>
        )}
      </header>

      <section className="hero" id="top">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
        <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">شاهنامه / نسخهٔ خواندنی برای امروز</p>
          <h1>یک کتابِ هزارساله،<br /><em>زنده در دست تو.</em></h1>
          <p className="hero-lede">نه موزه، نه خلاصهٔ درسی. مسیر سریع و خوش‌ساختی برای ورود به روایت‌ها، چهره‌ها، واژه‌ها و پرسش‌های بزرگ شاهنامه.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#stories">ورود به روایت‌ها <ArrowLeft size={17} /></a>
            <a className="button button-ghost" href="#ask">پرسش از شاهنامه <MessageCircle size={17} /></a>
            <button className="button button-ghost" onClick={() => speaking ? stopNarration() : void playNarration(`${openingVerses[0][0]}. ${openingVerses[0][1]}. شاهنامه از خرد آغاز می‌شود؛ از سنجیدن پیش از تاختن.`)}>
              <Volume2 size={17} /> {speaking ? 'خاموش' : 'صدای حکیم توس'}
            </button>
          </div>
          <div className="hero-stats" aria-label="محتوای این نسخه">
            <span><b>۰۳</b> دورهٔ روایی</span>
            <span><b>۰۸</b> مسیر داستانی</span>
            <span><b>۰۶</b> چهرهٔ محوری</span>
            <span><b>بدون حساب</b> برای خواندن</span>
          </div>
        </div>

        <aside className="hero-manuscript" aria-label="آغاز شاهنامه">
          <div className="manuscript-top"><span>دفترِ نخست</span><span>آغاز کتاب</span></div>
          <blockquote>
            <span>به نام خداوند جان و خرد</span>
            <span>کزین برتر اندیشه برنگذرد</span>
          </blockquote>
          <div className="manuscript-seal" aria-hidden="true">ف</div>
          <p>فردوسی از «خرد» شروع می‌کند؛ همین، کلید خواندن بسیاری از پیروزی‌ها و شکست‌های کتاب است.</p>
        </aside>

        <a className="scroll-cue" href="#stories"><span>پایین</span><ChevronDown size={16} /></a>
      </section>

      <section className="search-band" aria-label="جست‌وجو در این نسخه">
        <div className="search-shell">
          <Search size={19} />
          <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="رستم، سیاوش، داد، فرّه..." aria-label="جست‌وجوی داستان، چهره یا واژه" />
          <span>جست‌وجوی محلی</span>
        </div>
        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map(result => (
              <button key={`${result.type}-${result.id}`} onClick={() => handleSearchResult(result.type, result.id)}>
                <small>{result.type}</small><b>{result.title}</b><ArrowLeft size={15} />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="section stories-section" id="stories">
        <SectionHead index="۰۱" eyebrow="روایت‌خانه" title="مسیر را گم نکن." copy="شاهنامه را می‌شود به سه پهنهٔ بزرگ دید: اساطیری، پهلوانی و تاریخی. این نقشه برای ورود است، نه جایگزین خود متن." />
        <div className="era-map">
          {groupedStories.map((group, groupIndex) => (
            <div className="era-column" key={group.era}>
              <div className="era-heading"><span>۰{groupIndex + 1}</span><h3>{group.era}</h3><i /></div>
              <div className="story-list">
                {group.items.map((item, index) => (
                  <button className="story-card" key={item.id} onClick={() => setStory(item)}>
                    <span className="story-number">{String(index + 1).padStart(2, '0')}</span>
                    <div><h4>{item.title}</h4><p>{item.subtitle}</p></div>
                    <ArrowLeft size={16} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section character-section" id="characters">
        <SectionHead index="۰۲" eyebrow="چهره‌ها" title="هیچ‌کس تک‌بعدی نیست." copy="قهرمان، شاه، شورشی یا قربانی؛ ارزش شخصیت‌های شاهنامه به تضادهایشان است، نه به برچسب‌های ساده." />
        <div className="character-grid">
          {characters.map((item, index) => (
            <button className="character-card" key={item.id} onClick={() => setCharacter(item)}>
              <span className="character-index">{String(index + 1).padStart(2, '0')}</span>
              <div className="character-monogram" aria-hidden="true">{item.name.slice(0, 1)}</div>
              <p>{item.epithet}</p>
              <h3>{item.name}</h3>
              <span className="character-role">{item.role}</span>
              <div className="tag-row">{item.traits.slice(0, 3).map(trait => <span key={trait}>{trait}</span>)}</div>
              <i><ArrowLeft size={16} /></i>
            </button>
          ))}
        </div>
      </section>

      <section className="section themes-section" id="themes">
        <SectionHead index="۰۳" eyebrow="درون‌مایه‌ها" title="سؤال‌های بزرگ‌تر از نبرد." copy="زیر شمشیرها و تاج‌ها، شاهنامه مدام دربارهٔ شناخت، عدالت، قدرت، نام و پیامد تصمیم حرف می‌زند." />
        <div className="themes-grid">
          {themes.map((item, index) => (
            <article key={item.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="verse-section" aria-labelledby="verse-title">
        <div className="verse-index"><Feather size={20} /><span>بیت‌نما</span></div>
        <div className="verse-copy">
          <p className="eyebrow">از آغاز شاهنامه</p>
          <h2 id="verse-title"><span>{currentVerse[0]}</span><span>{currentVerse[1]}</span></h2>
          <p>برای مکث؛ نه برای فال‌سازی یا انتسابِ بی‌منبع.</p>
        </div>
        <div className="verse-actions">
          <button className="icon-button" onClick={() => setVerseIndex(index => (index + 1) % openingVerses.length)} aria-label="بیت بعدی"><Shuffle size={18} /></button>
          <button className={`icon-button ${speaking ? 'is-speaking' : ''}`} onClick={speakVerse} aria-label={speaking ? 'توقف خوانش' : 'خواندن بیت'}><Volume2 size={18} /></button>
          <button className="icon-button" onClick={copyVerse} aria-label="کپی بیت">{copied ? <Check size={18} /> : <Copy size={18} />}</button>
        </div>
      </section>

      <section className="section glossary-section" id="glossary">
        <SectionHead index="۰۴" eyebrow="واژه‌نامهٔ کوچک" title="کلمه، بخشی از معماری روایت است." copy="چند واژهٔ پرتکرار برای این‌که متن را با معنای امروزیِ ساده‌شده اشتباه نگیریم." />
        <div className="glossary-grid">
          {glossary.map((item, index) => (
            <article key={item.term}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{item.term}</h3>
              <p>{item.definition}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section ask-section" id="ask">
        <div className="ask-intro">
          <p className="eyebrow">۰۵ / پرسش از شاهنامه</p>
          <h2>سؤال داری؟<br /><em>بپرس، اما دقیق.</em></h2>
          <p>هستهٔ این بخش هم مستقل است: پرسش‌های مربوط به روایت‌ها، چهره‌ها و مفاهیم همین نسخه بدون کلید پاسخ داده می‌شوند. Gemini فقط یک لایهٔ اختیاری برای پرسش‌های بازتر و صدای استودیویی است.</p>
          <button className="connection-card" onClick={() => { setKeyDraft(apiKey); setSettingsOpen(true); }}>
            <span className={`connection-dot ${apiKey ? 'ready' : ''}`} />
            <span><b>{apiKey ? 'حالت گسترده فعال است' : 'حالت مستقل فعال است'}</b><small>{apiKey ? 'پاسخ گسترده + صدای استودیویی اختیاری' : 'جست‌وجو، پاسخ محلی و صدا بدون سرویس بیرونی'}</small></span>
            <Settings size={17} />
          </button>
          <div className="voice-summary">
            <span><Volume2 size={14} /> لحن راوی: <b>{voiceModes[voiceMode].label}</b></span>
            <button onClick={() => { setKeyDraft(apiKey); setSettingsOpen(true); }}>تنظیم صدا</button>
          </div>
          <div className="quick-questions">
            <span>پرسش‌های پیشنهادی</span>
            {quickQuestions.map(item => <button key={item} onClick={() => setQuestion(item)}>{item}</button>)}
          </div>
        </div>

        <div className="ask-console">
          <div className="console-top"><span><Shield size={15} /> {apiKey ? 'گفت‌وگوی گسترده با پشتیبان محلی' : 'گفت‌وگوی کاملاً محلی'}</span><span>{conversation.length ? `${conversation.length} پیام` : 'آماده'}</span></div>
          <div className="messages" aria-live="polite">
            {conversation.length === 0 ? (
              <div className="empty-conversation">
                <Compass size={25} />
                <h3>از یک سؤال واقعی شروع کن.</h3>
                <p>مثلاً دربارهٔ تضاد وظیفه و عدالت، مسیر یک شخصیت، یا تفاوت دو روایت بپرس.</p>
              </div>
            ) : conversation.map((message, index) => (
              <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <div className="message-head">
                  <span>{message.role === 'user' ? 'تو' : 'حکیم توس'}</span>
                  {message.role === 'model' && (
                    <button className="message-play" onClick={() => void playNarration(message.text)} aria-label="خواندن پاسخ"><Volume2 size={13} /></button>
                  )}
                </div>
                <p>{message.text}</p>
              </div>
            ))}
            {asking && <div className="message model is-loading"><div className="message-head"><span>حکیم توس</span></div><p><i /><i /><i /></p></div>}
          </div>
          {askError && <p className="ask-error">{askError}</p>}
          <form className="ask-form" onSubmit={submitQuestion}>
            <textarea value={question} onChange={event => setQuestion(event.target.value)} placeholder="پرسشت را بنویس..." rows={3} />
            <button type="submit" disabled={!question.trim() || asking} aria-label="ارسال پرسش"><Send size={18} /></button>
          </form>
          <p className="console-note">برای نقل بیت یا ارجاع دقیق، متن چاپی معتبر را مرجع نهایی قرار بده.</p>
        </div>
      </section>

      <footer>
        <div className="footer-brand"><BrandMark /><div><b>شاهنامه</b><span>خوانش آزاد، منظم و منبع‌محور</span></div></div>
        <p>ساخته‌شده برای نزدیک‌تر شدن به متن، نه جایگزین‌کردن آن.</p>
        <a href="https://github.com/aixaria0/Shahnameh-lite" target="_blank" rel="noreferrer">مخزن پروژه <ArrowLeft size={15} /></a>
      </footer>

      {settingsOpen && (
        <div className="overlay settings-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && setSettingsOpen(false)}>
          <section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <button className="icon-button drawer-close" onClick={() => setSettingsOpen(false)} aria-label="بستن"><X size={18} /></button>
            <div className="settings-icon"><Volume2 size={22} /></div>
            <p className="eyebrow">راوی / اتصال اختیاری</p>
            <h2 id="settings-title">صدای حکیم توس را تنظیم کن.</h2>
            <p>خوانش محلی همیشه در دسترس است. حالت استودیویی و پاسخ‌های گسترده فقط در صورت واردکردن کلید Gemini فعال می‌شوند.</p>

            <div className="voice-mode-grid" role="radiogroup" aria-label="انتخاب لحن راوی">
              {(Object.entries(voiceModes) as [VoiceModeKey, (typeof voiceModes)[VoiceModeKey]][]).map(([key, mode]) => (
                <button key={key} className={voiceMode === key ? 'active' : ''} onClick={() => setVoiceMode(key)} role="radio" aria-checked={voiceMode === key}>
                  <b>{mode.label}</b><span>{mode.short}</span>
                </button>
              ))}
            </div>

            <div className="setting-toggles">
              <label className="toggle-row"><input type="checkbox" checked={autoSpeak} onChange={event => setAutoSpeak(event.target.checked)} /><span><b>خواندن خودکار پاسخ</b><small>هر پاسخ تازه با لحن انتخابی خوانده شود.</small></span></label>
              <label className={`toggle-row ${!keyDraft.trim() ? 'disabled' : ''}`}><input type="checkbox" checked={studioVoice} disabled={!keyDraft.trim()} onChange={event => setStudioVoice(event.target.checked)} /><span><b>صدای استودیویی</b><small>در صورت وجود کلید، از Gemini 3.8 Flash TTS و صدای Charon استفاده می‌کند.</small></span></label>
            </div>

            <label>
              <span>Gemini API key — اختیاری</span>
              <input type="password" value={keyDraft} onChange={event => setKeyDraft(event.target.value)} autoComplete="off" placeholder="AIza…" dir="ltr" />
            </label>
            <div className="settings-actions">
              <button className="button button-primary" onClick={saveKey}>{keyDraft.trim() ? 'ذخیره برای این نشست' : 'ذخیرهٔ تنظیمات مستقل'}</button>
              {apiKey && <button className="button button-ghost danger" onClick={clearKey}>حذف کلید</button>}
            </div>
            <p className="privacy-note"><Shield size={14} /> کلید فقط در sessionStorage همین تب می‌ماند؛ حالت مستقل هیچ کلیدی نمی‌خواهد.</p>
          </section>
        </div>
      )}

      <StoryDrawer story={story} onClose={() => setStory(null)} />
      <CharacterDrawer character={character} onClose={() => setCharacter(null)} />
    </main>
  );
}
