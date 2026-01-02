import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, User, Word, QuizState, DailyProgress } from './types';
import { Layout } from './components/Layout';
import { Mascot, MascotMood } from './components/Mascot';
import { processWords } from './services/gemini';
import { Volume2, Plus, Trash2, CheckCircle2, XCircle, Search, Star, Mic, RotateCcw, ChevronDown, ChevronUp, Shuffle, Brain } from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  doc, 
  query, 
  onSnapshot, 
  setDoc, 
  getDoc 
} from 'firebase/firestore';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authData, setAuthData] = useState({ email: '', password: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [bunsieMood, setBunsieMood] = useState<MascotMood>('neutral');
  const [bunsieMsg, setBunsieMsg] = useState('Welcome back, friend!');
  const [showConfetti, setShowConfetti] = useState(false);
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());

  // Refs for Audio (Tier 3 Fallback)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Speaking Practice State
  const [speakingWord, setSpeakingWord] = useState<Word | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState<{ text: string; correct: boolean; feedback?: string } | null>(null);

  // Management View State
  const [wordInput, setWordInput] = useState('');
  const [tagInput, setTagInput] = useState('General');

  // Quiz State
  const [quizState, setQuizState] = useState<QuizState>({
    currentWord: null,
    userInput: { pos: '', vietnamese: '', example: '' },
    isChecking: false,
    isCorrect: undefined
  });

  const getTodayString = () => new Date().toISOString().split('T')[0];

  // --- AUDIO INITIALIZATION (For Tier 3 Fallback) ---
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        voicesRef.current = voices;
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // --- FIREBASE AUTH & DATA SYNC ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        let userData: any = { 
          id: firebaseUser.uid, 
          email: firebaseUser.email, 
          wordList: [], 
          dailyGoal: 5,
          progress: { date: getTodayString(), uniqueCorrectWords: [], quizzesDone: 0 } 
        };

        if (userSnap.exists()) {
          const data = userSnap.data();
          userData = { ...userData, ...data };
          if (data.progress?.date !== getTodayString()) {
             userData.progress = { date: getTodayString(), uniqueCorrectWords: [], quizzesDone: 0 };
             await updateDoc(userRef, { progress: userData.progress });
          }
        } else {
          await setDoc(userRef, userData);
        }

        setCurrentUser(userData);
        setActiveView('manage');

        const wordsQuery = query(collection(db, 'users', firebaseUser.uid, 'words'));
        const unsubscribeWords = onSnapshot(wordsQuery, (snapshot) => {
          const words = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Word));
          setCurrentUser(prev => prev ? { ...prev, wordList: words } : null);
        });

        return () => unsubscribeWords();
      } else {
        setCurrentUser(null);
        setActiveView('login');
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);
  
  const sayBunsie = (msg: string, mood: MascotMood = 'neutral', duration = 3000) => {
    setBunsieMsg(msg);
    setBunsieMood(mood);
    setTimeout(() => setBunsieMood('neutral'), duration);
  };

  /**
   * --- 3-LAYER AUDIO SYSTEM ---
   * 1. Dictionary API (Human MP3)
   * 2. Google Translate TTS (High Quality AI)
   * 3. Browser SpeechSynthesis (Offline Robot)
   * [Restored EXACT logic from your working file]
   */
  const playAudio = useCallback(async (text: string) => {
    if (!text) return;
    const cleanText = text.trim();

    // --- TIER 1: Dictionary API (Real Human Audio) ---
    // Improved: Scans ALL definitions, not just the first one.
    // This fixes words like "actress" where audio is often in the second entry.
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanText}`);
      if (response.ok) {
        const data = await response.json();
        const audioEntry = data
          .flatMap((entry: any) => entry.phonetics || []) // Collect all audio options
          .find((p: any) => p.audio && p.audio !== '');   // Find the first valid one
        
        if (audioEntry && audioEntry.audio) {
          const audio = new Audio(audioEntry.audio);
          await audio.play();
          return; // Success! We stop here.
        }
      }
    } catch (e) {
      // API failed or word not found (e.g. "self-paced"), continue to next tier.
    }

    // --- TIER 2: Google Translate TTS (The "Hack") ---
    // We try this, but we expect it might fail on Vercel/Firebase.
    try {
      const googleAudioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=en&client=tw-ob`;
      const audio = new Audio(googleAudioUrl);
      await audio.play();
      return; // Success! We stop here.
    } catch (e) {
      console.warn("Google TTS failed (likely blocked by Vercel/Firebase). Switching to System Voice.");
    }

    // --- TIER 3: Browser Fallback (Reliable Robot) ---
    // This is what will save you on Vercel when Google blocks the request.
    if (!('speechSynthesis' in window)) return;

    // 1. Cancel any previous speech to avoid overlap
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // 2. CRITICAL FIX for iPad/Mac: 
    // We grab the voices *right now*. If the list is empty, we ask for them again.
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
       // Sometimes needed for Safari to wake up the voice engine
       voices = window.speechSynthesis.getVoices(); 
    }

    // 3. Select a voice that actually exists on Mac/iOS
    // "Samantha" is the default high-quality Mac voice.
    const preferredVoice = 
      voices.find(v => v.name === "Samantha") || 
      voices.find(v => v.name.includes('Google') && v.lang.includes('en')) ||
      voices.find(v => v.lang === 'en-US');

    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.lang = 'en-US';
    utterance.rate = 0.9; // Slightly slower is better for learning
    
    // 4. Speak
    utteranceRef.current = utterance; // Keep a reference so the browser doesn't delete it mid-sentence
    window.speechSynthesis.speak(utterance);
    
    // 5. iOS Safari Fix: If it starts "paused", force it to resume.
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();

  }, []);

  const analyzePronunciation = (target: string, transcript: string): string => {
    const t = target.toLowerCase();
    const s = transcript.toLowerCase();
    if (s.length < t.length * 0.5) return "Too short! Did you pronounce all the syllables?";
    if (t.includes('p') && s.replace(/b/g, 'p') === t) return "Watch your 'P' sound! It sounded like a 'B'. Add a puff of air!";
    if (t.includes('b') && s.replace(/p/g, 'b') === t) return "Careful! 'B' should be voiced. It sounded like 'P'.";
    if (t.includes('t') && s.replace(/d/g, 't') === t) return "Too soft! It sounded like a 'D' instead of 'T'.";
    if (t.includes('d') && s.replace(/t/g, 'd') === t) return "Too hard! It sounded like a 'T' instead of 'D'.";
    if (t.includes('th') && (s.includes('s') || s.includes('f') || s.includes('d'))) return "Focus on the 'TH' sound!";
    if (t.endsWith('s') && !s.endsWith('s')) return "Don't forget the 'S' sound at the end!";
    if (t.endsWith('ed') && !s.endsWith('ed') && !s.endsWith('t') && !s.endsWith('d')) return "Pronounce the past tense ending clearly.";
    return "Close, but not quite perfect. Listen again!";
  };

  // --- FIREBASE HANDLERS ---
  const handleAuth = async (type: 'login' | 'register') => {
    setIsLoading(true);
    try {
      if (type === 'login') {
        await signInWithEmailAndPassword(auth, authData.email, authData.password);
        sayBunsie("I missed you! Ready to learn?", "happy");
      } else {
        await createUserWithEmailAndPassword(auth, authData.email, authData.password);
        sayBunsie("Nice to meet you! I'm Bunsie.", "excited");
      }
    } catch (error: any) {
      alert("Login Error: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleProcessWords = async () => {
    if (!wordInput.trim() || !currentUser) return;
    setIsLoading(true);
    try {
      const results = await processWords(wordInput);
      const promises = results.map(res => {
        const newWord: Omit<Word, 'id'> = {
          english: res.english,
          vietnamese: res.vietnamese,
          pos: res.pos,
          examples: res.examples,
          theme: tagInput || 'General',
          timesQuizzed: 0,
          correctCount: 0,
          createdAt: Date.now(),
          isStarred: false
        };
        return addDoc(collection(db, 'users', currentUser.id, 'words'), newWord);
      });
      await Promise.all(promises);
      setWordInput('');
      sayBunsie(`Added ${results.length} new words!`, "excited");
    } catch (e) {
      console.error("Gemini error:", e);
      sayBunsie("Something went wrong.", "confused");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteWord = async (id: string) => {
    if (!currentUser) return;
    await deleteDoc(doc(db, 'users', currentUser.id, 'words', id));
  };

  const toggleStar = async (word: Word) => {
    if (!currentUser) return;
    const wordRef = doc(db, 'users', currentUser.id, 'words', word.id);
    await updateDoc(wordRef, { isStarred: !word.isStarred });
  };

  const handleSelfGrade = async (isCorrect: boolean) => {
    if (!currentUser || !quizState.currentWord) return;
    const word = quizState.currentWord;
    const wordRef = doc(db, 'users', currentUser.id, 'words', word.id);
    const userRef = doc(db, 'users', currentUser.id);

    await updateDoc(wordRef, {
      timesQuizzed: (word.timesQuizzed || 0) + 1,
      correctCount: isCorrect ? (word.correctCount || 0) + 1 : (word.correctCount || 0),
      lastQuizzed: Date.now()
    });

    const today = getTodayString();
    let newProgress = { ...currentUser.progress };
    if (newProgress.date !== today) newProgress = { date: today, uniqueCorrectWords: [], quizzesDone: 0 };

    newProgress.quizzesDone += 1;
    if (isCorrect && !newProgress.uniqueCorrectWords.includes(word.id)) {
      newProgress.uniqueCorrectWords.push(word.id);
      if (newProgress.uniqueCorrectWords.length === currentUser.dailyGoal) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }
    }
    await updateDoc(userRef, { progress: newProgress });
    if (isCorrect) sayBunsie("Amazing! Keep it up!", "happy");
    else sayBunsie("It's okay, learning takes time!", "neutral");
    setQuizState({ ...quizState, currentWord: null, isChecking: false });
  };

  const toggleThemeExpansion = (theme: string) => {
    setExpandedThemes(prev => {
      const next = new Set(prev);
      if (next.has(theme)) next.delete(theme); else next.add(theme);
      return next;
    });
  };

  const startQuiz = (mode: 'smart' | 'random' = 'smart') => {
    if (!currentUser || currentUser.wordList.length === 0) {
      sayBunsie("Add some words first!", "confused");
      return;
    }
    let candidate: Word;
    if (mode === 'random') {
      candidate = currentUser.wordList[Math.floor(Math.random() * currentUser.wordList.length)];
    } else {
      const sorted = [...currentUser.wordList].sort((a, b) => (a.timesQuizzed || 0) - (b.timesQuizzed || 0));
      candidate = sorted[Math.floor(Math.random() * Math.min(5, sorted.length))];
    }
    setQuizState({ currentWord: candidate, userInput: { pos: '', vietnamese: '', example: '' }, isChecking: false, isCorrect: undefined });
    setActiveView('quiz');
  };

  const startSpeakingPractice = (word?: Word) => {
    setRecognitionResult(null);
    if (word) { setSpeakingWord(word); } 
    else if (currentUser && currentUser.wordList.length > 0) {
      const randomWord = currentUser.wordList[Math.floor(Math.random() * currentUser.wordList.length)];
      setSpeakingWord(randomWord);
    }
    sayBunsie("Listen closely to the intonation!", "neutral");
  };

  const handleSpeechRecognition = () => {
    if (!speakingWord) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Speech recognition is not supported in this browser. Try Chrome."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsRecording(true);
    setRecognitionResult(null);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      const target = speakingWord.english.toLowerCase().trim();
      const isMatch = transcript === target;
      let feedback = isMatch ? "Perfect pronunciation!" : analyzePronunciation(target, transcript);
      setRecognitionResult({ text: transcript, correct: isMatch, feedback });
      sayBunsie(isMatch ? "Wow! You sounded like a native speaker!" : "Not quite. Check the feedback below!", isMatch ? "excited" : "confused");
    };
    recognition.onerror = (e: any) => { setIsRecording(false); if(e.error !== 'no-speech') sayBunsie("Microphone error. Check permissions.", "sad"); };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const filteredWords = useMemo(() => {
    if (!currentUser) return [];
    let list = currentUser.wordList;
    if (activeView === 'starred') list = list.filter(w => w.isStarred);
    if (!searchQuery) return list;
    const query = searchQuery.toLowerCase();
    return list.filter(w => w.english.toLowerCase().includes(query) || w.vietnamese.toLowerCase().includes(query) || w.theme.toLowerCase().includes(query));
  }, [currentUser, searchQuery, activeView]);

  const wordsByTheme = useMemo(() => {
    return filteredWords.reduce((acc, word) => {
      if (!acc[word.theme]) acc[word.theme] = [];
      acc[word.theme].push(word);
      return acc;
    }, {} as Record<string, Word[]>);
  }, [filteredWords]);

  // --- RENDERERS ---
  const renderLogin = () => (
    <div className="flex flex-col items-center justify-center py-10 sm:py-20 animate-in fade-in zoom-in duration-700">
      <div className={`p-8 kawaii-card kawaii-shadow w-full max-w-md ${isDarkMode ? 'bg-[#16213E] border border-white/10' : 'bg-white'}`}>
        <div className="flex justify-center mb-8"><Mascot size="w-32 h-32" mood="happy" className="animate-bounce" /></div>
        <h2 className={`text-3xl font-bold text-center mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{activeView === 'login' ? 'Welcome Back!' : 'Join the Hutch!'}</h2>
        <div className="space-y-4">
          <input type="email" placeholder="Email" className={`w-full p-4 rounded-2xl border-2 outline-none ${isDarkMode ? 'bg-[#1A1A2E] border-white/10 text-white focus:border-pink-500' : 'bg-gray-50 border-gray-100 focus:border-pink-300'}`} value={authData.email} onChange={(e) => setAuthData({...authData, email: e.target.value})} />
          <input type="password" placeholder="Password" className={`w-full p-4 rounded-2xl border-2 outline-none ${isDarkMode ? 'bg-[#1A1A2E] border-white/10 text-white focus:border-pink-500' : 'bg-gray-50 border-gray-100 focus:border-pink-300'}`} value={authData.password} onChange={(e) => setAuthData({...authData, password: e.target.value})} />
          <button onClick={() => handleAuth(activeView as 'login' | 'register')} disabled={isLoading} className="w-full bg-pink-500 text-white font-bold p-5 rounded-2xl shadow-lg hover:bg-pink-600 transition-all">{isLoading ? 'Loading...' : (activeView === 'login' ? 'Log In' : 'Sign Up')}</button>
          <p className={`text-center text-sm mt-6 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}><button onClick={() => setActiveView(activeView === 'login' ? 'register' : 'login')} className="text-pink-500 font-bold hover:underline">{activeView === 'login' ? 'Sign Up' : 'Log In'}</button></p>
        </div>
      </div>
    </div>
  );

  const renderWordList = () => (
    <div className="py-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-6 bg-white/30 dark:bg-[#16213E]/60 p-4 rounded-3xl border border-white/20">
        <Mascot size="w-16 h-16" mood={bunsieMood} />
        <div className={`p-3 rounded-2xl relative kawaii-shadow ${isDarkMode ? 'bg-[#1A1A2E] text-white' : 'bg-white text-gray-800'}`}><p className="text-sm font-medium"><strong>Bunsie:</strong> {bunsieMsg}</p></div>
      </div>
      {activeView === 'manage' && (
        <div className={`p-6 kawaii-card kawaii-shadow mb-8 ${isDarkMode ? 'bg-[#16213E] border border-white/10' : 'bg-white'}`}>
          <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}><Plus className="text-pink-500" /> Add New Words</h3>
          <textarea placeholder="e.g. apple, banana" className={`w-full h-24 p-4 rounded-2xl mb-4 border-2 outline-none ${isDarkMode ? 'bg-[#1A1A2E] border-white/10 text-white focus:border-pink-500' : 'bg-gray-50 border-gray-100 focus:border-pink-300'}`} value={wordInput} onChange={(e) => setWordInput(e.target.value)} />
          <div className="flex flex-col sm:flex-row gap-4">
            <input type="text" placeholder="Theme..." className={`flex-1 p-4 rounded-2xl border-2 outline-none ${isDarkMode ? 'bg-[#1A1A2E] border-white/10 text-white focus:border-pink-500' : 'bg-gray-50 border-gray-100 focus:border-pink-300'}`} value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
            <button onClick={handleProcessWords} disabled={isLoading} className="bg-pink-500 text-white font-bold px-8 py-4 rounded-2xl">{isLoading ? 'Wait...' : 'Process'}</button>
          </div>
        </div>
      )}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder={`Search ${activeView === 'starred' ? 'starred ' : ''}words...`} className={`w-full p-4 pl-12 rounded-2xl border-2 outline-none ${isDarkMode ? 'bg-[#16213E] border-white/10 text-white focus:border-pink-500' : 'bg-white border-pink-50 focus:border-pink-300'} kawaii-shadow`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>
      <div className="space-y-4">
        {Object.entries(wordsByTheme).map(([theme, words]) => (
            <div key={theme} className={`rounded-3xl border transition-all ${isDarkMode ? 'bg-[#16213E]/40 border-white/5' : 'bg-white/40 border-pink-100/50'}`}>
              <button onClick={() => toggleThemeExpansion(theme)} className="w-full flex justify-between p-4 px-6 text-left hover:bg-pink-500/5">
                <h4 className={`text-lg font-bold uppercase tracking-widest ${isDarkMode ? 'text-cyan-400' : 'text-pink-500'}`}>{theme} ({(words as Word[]).length})</h4>
                {expandedThemes.has(theme) ? <ChevronUp className={isDarkMode ? 'text-white' : 'text-gray-600'} /> : <ChevronDown className={isDarkMode ? 'text-white' : 'text-gray-600'} />}
              </button>
              {expandedThemes.has(theme) && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(words as Word[]).map(word => (
                    <div key={word.id} className={`p-5 kawaii-card shadow-sm flex flex-col border ${isDarkMode ? 'bg-[#16213E] border-white/5 text-white' : 'bg-white border-gray-100 text-gray-800'}`}>
                      <div className="flex justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1"><span className="text-xl font-bold">{word.english}</span><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${isDarkMode ? 'bg-cyan-500/20 text-cyan-300' : 'bg-pink-100 text-pink-500'}`}>{word.pos}</span></div>
                          <p className={`text-sm italic ${isDarkMode ? 'text-pink-200' : 'text-gray-500'}`}>{word.vietnamese}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => toggleStar(word)} className={`p-2 rounded-xl transition-all ${word.isStarred ? 'text-yellow-400 scale-110' : 'text-gray-300'}`}><Star size={20} fill={word.isStarred ? "currentColor" : "none"} /></button>
                          <button onClick={() => playAudio(word.english)} className={`p-4 rounded-xl hover:scale-110 ${isDarkMode ? 'bg-cyan-900/40 text-cyan-300' : 'bg-pink-50 text-pink-500'}`}><Volume2 size={24} /></button>
                          <button onClick={() => deleteWord(word.id)} className="text-gray-400 hover:text-red-400 p-2"><Trash2 size={20} /></button>
                        </div>
                      </div>
                      <div className="mt-2 space-y-2 border-t border-white/10 pt-4">{word.examples.map((ex, i) => (<p key={i} className={`text-sm leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-600'}`}><span className="text-pink-400 mr-2">•</span>{ex}</p>))}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
        ))}
      </div>
    </div>
  );

  const renderSpeakingView = () => (
    <div className="py-6 animate-in fade-in duration-500">
      <div className={`p-8 kawaii-card kawaii-shadow mb-8 text-center border-2 ${isDarkMode ? 'bg-[#16213E] border-cyan-400/20' : 'bg-white border-pink-100'}`}>
        {!speakingWord ? (
          <div className="py-12">
            <h2 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Start Speaking Practice</h2>
            <button onClick={() => startSpeakingPractice()} className="bg-cyan-500 text-white font-bold px-10 py-4 rounded-2xl shadow-xl flex items-center gap-2 mx-auto"><RotateCcw size={20} /> Pick a Random Word</button>
          </div>
        ) : (
          <div className="animate-in zoom-in duration-300">
            <h2 className={`text-6xl font-black mb-10 tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{speakingWord.english}</h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-10">
              <button onClick={() => playAudio(speakingWord.english)} className={`flex flex-col items-center gap-2 p-6 rounded-3xl hover:scale-105 ${isDarkMode ? 'bg-cyan-500/10 text-cyan-400' : 'bg-pink-50 text-pink-500'}`}><Volume2 size={32} /><span className="text-xs font-bold uppercase">Listen</span></button>
              <button onClick={handleSpeechRecognition} disabled={isRecording} className={`flex flex-col items-center gap-2 p-6 rounded-3xl hover:scale-105 ${isRecording ? 'animate-pulse bg-red-500 text-white' : 'bg-indigo-600 text-white'}`}><Mic size={32} /><span className="text-xs font-bold uppercase">{isRecording ? 'Listening...' : 'Speak'}</span></button>
            </div>
            {recognitionResult && (
              <div className={`p-6 rounded-3xl animate-in slide-in-from-bottom duration-500 ${recognitionResult.correct ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <div className="flex items-center justify-center gap-3 mb-2">{recognitionResult.correct ? <CheckCircle2 className="text-green-500" /> : <XCircle className="text-red-500" />}<span className={`text-xl font-bold ${recognitionResult.correct ? 'text-green-500' : 'text-red-500'}`}>{recognitionResult.correct ? 'Perfect!' : 'Not Quite!'}</span></div>
                {recognitionResult.feedback && <p className="text-sm font-bold text-red-400 mb-1">{recognitionResult.feedback}</p>}
                {!recognitionResult.correct && <p className={`opacity-60 text-sm italic ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>You said: <span className="font-bold">"{recognitionResult.text || "..."}"</span></p>}
              </div>
            )}
            <div className="mt-8 pt-8 border-t border-white/5">
              <select className={`w-full max-w-xs p-3 rounded-xl border-2 outline-none ${isDarkMode ? 'bg-[#1A1A2E] border-white/10 text-white' : 'bg-gray-50 border-gray-200'}`} value={speakingWord.id} onChange={(e) => startSpeakingPractice(currentUser?.wordList.find(w => w.id === e.target.value))}>{currentUser?.wordList.map(w => (<option key={w.id} value={w.id}>{w.english}</option>))}</select>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderStats = () => {
    const words: Word[] = (currentUser?.wordList || []) as Word[];
    const progress: DailyProgress = (currentUser?.progress || { date: getTodayString(), uniqueCorrectWords: [], quizzesDone: 0 }) as DailyProgress;
    const goal = currentUser?.dailyGoal || 5;
    const totalQuizzed = words.reduce((acc, w) => acc + (w.timesQuizzed || 0), 0);
    
    // NEW MASTERY CALCULATION: Sum of all word accuracies / Total Words
    const totalWords = words.length;
    const sumAccuracy = words.reduce((acc, w) => {
        const wordAcc = w.timesQuizzed && w.timesQuizzed > 0 ? (w.correctCount / w.timesQuizzed) : 0;
        return acc + wordAcc;
    }, 0);
    const mastery = totalWords > 0 ? Math.round((sumAccuracy / totalWords) * 100) : 0;

    const goalPercent = Math.min(100, (progress.uniqueCorrectWords.length / goal) * 100);
    const isGoalReached = progress.uniqueCorrectWords.length >= goal;

    return (
      <div className="py-6 animate-in fade-in duration-500">
        <div className={`p-8 kawaii-card shadow-lg mb-8 border-2 ${isDarkMode ? 'bg-[#16213E] border-white/10' : 'bg-white border-pink-100'}`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="relative w-24 h-24">
                <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 36 36">
                  <path className={`${isDarkMode ? 'text-gray-800' : 'text-gray-100'}`} strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className={`${isGoalReached ? 'text-green-400' : 'text-pink-500'} transition-all duration-1000`} strokeWidth="3" strokeDasharray={`${goalPercent}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{progress.uniqueCorrectWords.length}</span>
                  <span className="text-[10px] uppercase font-bold opacity-50">Words</span>
                </div>
              </div>
              <div>
                <h3 className={`text-2xl font-bold mb-1 flex items-center gap-2 ${isGoalReached ? 'text-green-400' : isDarkMode ? 'text-white' : 'text-pink-500'}`}>Daily Learning Goal {isGoalReached && '✨'}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {[5, 10, 15, 20].map(v => (
                    <button key={v} onClick={() => {
                      const users = getStoredUsers();
                      const idx = users.findIndex(u => u.id === currentUser?.id);
                      if (idx > -1) { users[idx].dailyGoal = v; saveUsers(users); setCurrentUser(users[idx]); }
                    }} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${goal === v ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-400 dark:bg-white/5'}`}>{v}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          <div className={`p-6 kawaii-card shadow-sm text-center ${isDarkMode ? 'bg-[#16213E] text-white border border-white/5' : 'bg-white'}`}><p className="text-xs font-bold opacity-50 uppercase mb-1">Total Words</p><p className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-pink-500'}`}>{words.length}</p></div>
          <div className={`p-6 kawaii-card shadow-sm text-center ${isDarkMode ? 'bg-[#16213E] text-white border border-white/5' : 'bg-white'}`}><p className="text-xs font-bold opacity-50 uppercase mb-1">Total Quizzes</p><p className="text-4xl font-bold text-indigo-400">{totalQuizzed}</p></div>
          <div className={`p-6 kawaii-card shadow-sm text-center ${isDarkMode ? 'bg-[#16213E] text-white border border-white/5' : 'bg-white'}`}><p className="text-xs font-bold opacity-50 uppercase mb-1">Mastery</p><p className="text-4xl font-bold text-green-400">{mastery}%</p></div>
        </div>

        <div className={`p-6 kawaii-card shadow-md overflow-hidden ${isDarkMode ? 'bg-[#16213E] text-white border border-white/5' : 'bg-white'}`}>
          <h3 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            Progress Level Table
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={`text-xs uppercase font-bold tracking-widest ${isDarkMode ? 'text-white border-b border-white/10' : 'opacity-50 text-gray-500'}`}>
                  <th className="pb-4 px-4">Word</th>
                  <th className="pb-4 px-4">Times Quizzed</th>
                  <th className="pb-4 px-4 text-right">Avg. Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {words.map(w => {
                  const acc = w.timesQuizzed > 0 ? Math.round(w.correctCount / w.timesQuizzed * 100) : 0;
                  return (
                    <tr key={w.id} className={`border-t border-white/5 transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-50'}`}>
                      <td className="py-4 px-4">
                        <span className={`font-bold text-lg ${isDarkMode ? 'text-white drop-shadow-sm' : 'text-gray-800'}`}>{w.english}</span>
                        <br/><span className={`text-[10px] uppercase font-bold ${isDarkMode ? 'text-cyan-300' : 'opacity-40 text-gray-500'}`}>{w.theme}</span>
                      </td>
                      <td className={`py-4 px-4 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-600'}`}>
                        {w.timesQuizzed || 0}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${acc > 85 ? 'text-green-400 bg-green-400/10' : acc > 50 ? 'text-yellow-400 bg-yellow-400/10' : 'text-red-400 bg-red-400/10'}`}>
                          {acc}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout activeView={activeView} onViewChange={setActiveView} onLogout={handleLogout} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode}>
      {showConfetti && <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"><h2 className="text-4xl font-black text-pink-500">GOAL REACHED! 🎉</h2></div>}
      {activeView === 'login' || activeView === 'register' ? renderLogin() : null}
      {(activeView === 'manage' || activeView === 'starred') && renderWordList()}
      {activeView === 'speaking' && renderSpeakingView()}
      {activeView === 'quiz' && quizState.currentWord ? (
        <div className="py-10 max-w-2xl mx-auto">
          <div className={`p-8 kawaii-card shadow-2xl ${isDarkMode ? 'bg-[#16213E]' : 'bg-white'}`}>
            <div className="text-center mb-10">
              <h2 className={`text-6xl font-black mb-6 tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{quizState.currentWord.english}</h2>
              <button onClick={() => playAudio(quizState.currentWord!.english)} className={`p-4 rounded-3xl transition-all active:scale-110 ${isDarkMode ? 'bg-cyan-500 text-white' : 'bg-pink-100 text-pink-500'}`}><Volume2 size={32} /></button>
            </div>
            <div className="space-y-6">
              <input disabled={quizState.isChecking} placeholder="POS" className={`w-full p-4 rounded-2xl border-2 outline-none ${isDarkMode ? 'bg-[#1A1A2E] border-white/10 text-white focus:border-cyan-500' : 'bg-gray-50 border-gray-100 focus:border-pink-300'}`} value={quizState.userInput.pos} onChange={e => setQuizState({...quizState, userInput: {...quizState.userInput, pos: e.target.value}})} />
              <input disabled={quizState.isChecking} placeholder="Vietnamese" className={`w-full p-4 rounded-2xl border-2 outline-none ${isDarkMode ? 'bg-[#1A1A2E] border-white/10 text-white focus:border-cyan-500' : 'bg-gray-50 border-gray-100 focus:border-pink-300'}`} value={quizState.userInput.vietnamese} onChange={e => setQuizState({...quizState, userInput: {...quizState.userInput, vietnamese: e.target.value}})} />
              <textarea disabled={quizState.isChecking} placeholder="Use it in a sentence..." className={`w-full h-24 p-4 rounded-2xl border-2 outline-none ${isDarkMode ? 'bg-[#1A1A2E] border-white/10 text-white focus:border-cyan-500' : 'bg-gray-50 border-gray-100 focus:border-pink-300'}`} value={quizState.userInput.example} onChange={e => setQuizState({...quizState, userInput: {...quizState.userInput, example: e.target.value}})} />
              {!quizState.isChecking ? (<button onClick={() => setQuizState({...quizState, isChecking: true})} className={`w-full text-white font-bold p-5 rounded-2xl shadow-xl ${isDarkMode ? 'bg-cyan-500' : 'bg-pink-500'}`}>Check My Answer!</button>) : (
                <div className="animate-in slide-in-from-bottom duration-500 border-t border-white/10 pt-8">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                      <div className={`p-5 rounded-3xl ${isDarkMode ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50'}`}><p className="text-[10px] font-bold opacity-50 uppercase">Your Guess</p><p className="font-bold text-lg">{quizState.userInput.vietnamese || '---'}</p></div>
                      <div className={`p-5 rounded-3xl ${isDarkMode ? 'bg-green-500/10 border-green-500/20' : 'bg-green-50'}`}><p className="text-[10px] font-bold opacity-50 uppercase">Correct Data</p><p className="font-bold text-lg">{quizState.currentWord.vietnamese}</p><p className="text-xs italic opacity-60">{quizState.currentWord.pos}</p></div>
                   </div>
                   <div className={`p-5 rounded-3xl mb-8 ${isDarkMode ? 'bg-white/5' : 'bg-indigo-50'}`}>
                      <p className="text-[10px] font-bold opacity-50 uppercase mb-3">Context & Examples</p>
                      {quizState.currentWord.examples.map((ex, i) => (<p key={i} className="text-xs italic mb-2"><span className="text-pink-500 font-bold mr-2">•</span>{ex}</p>))}
                   </div>
                   <div className="flex gap-4"><button onClick={() => handleSelfGrade(false)} className={`flex-1 p-5 rounded-2xl font-bold ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`}>I was Wrong</button><button onClick={() => handleSelfGrade(true)} className="flex-1 bg-green-500 text-white p-5 rounded-2xl font-bold shadow-lg">I was Right!</button></div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeView === 'quiz' ? (
        <div className="text-center py-20 animate-in fade-in duration-1000">
           <Mascot size="w-40 h-40" className="mx-auto mb-10" mood="happy" />
           <h2 className={`text-4xl font-black mb-4 tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Spaced Repetition Review</h2>
           <p className="opacity-60 mb-10">Bunsie organized a smart session for you!</p>
           <div className="flex flex-col sm:flex-row gap-4 justify-center">
             <button onClick={() => startQuiz('smart')} className={`text-white font-bold px-12 py-5 rounded-3xl shadow-2xl transition-all text-xl flex items-center gap-2 ${isDarkMode ? 'bg-cyan-500' : 'bg-pink-500'}`}><Brain size={24} /> Hop into Practice!</button>
             <button onClick={() => startQuiz('random')} className={`font-bold px-12 py-5 rounded-3xl shadow-xl transition-all text-xl flex items-center gap-2 ${isDarkMode ? 'bg-white/5 text-white border border-white/10 hover:bg-white/10' : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'}`}><Shuffle size={24} /> Surprise Me!</button>
           </div>
        </div>
      ) : null}
      {activeView === 'stats' && renderStats()}
    </Layout>
  );
};

export default App;