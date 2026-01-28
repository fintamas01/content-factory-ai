"use client";
import { useState, useEffect, useRef } from 'react';
import { 
  Copy, Sparkles, Send, Layout, Type, History, X, Sun, Moon, 
  Check, FileText, Zap, ChevronRight, Share2 
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { motion, AnimatePresence } from 'framer-motion';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

const languages = [
  { code: 'en', name: 'English' },
  { code: 'hu', name: 'Magyar' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
];

const templates = [
  { id: 'custom', name: '✨ Pro Content Gen', prompt: '' },
  { id: 'blog', name: '📝 Blog to Viral Post', prompt: 'Kivonatosítsd a lényeget és csinálj belőle figyelemfelkeltő összefoglalót.' },
  { id: 'product', name: '🚀 Product Launch', prompt: 'Fókuszálj az előnyökre és a problémamegoldásra, használj erős CTA.t.' },
  { id: 'event', name: '📅 Esemény meghívó', prompt: 'Emeld ki a dátumot, helyszínt és a részvétel okait.' }
];

export default function Home() {
  const [input, setInput] = useState('');
  const [tone, setTone] = useState('szakmai');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState('hu');
  const [user, setUser] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [buttonPos, setButtonPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const [isPro, setIsPro] = useState(false);

  const adminEmail = "fintatamas68@gmail.com"

  const handleButtonMove = (e: React.MouseEvent) => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    setButtonPos({ x: x * 0.2, y: y * 0.2 }); // 20%-os elmozdulás
  };

  useEffect(() => {
    const checkSub = async () => {
      if (user) {
        const { data } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();
        
        if (data) setIsPro(true);
      }
    };
    checkSub();
  }, [user]);

  useEffect(() => {
    setMounted(true);
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : '' },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setResults(null);
  };

  const generateAll = async () => {
    if (!input) return;
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input, tone, lang, templatePrompt: selectedTemplate.prompt }),
      });
      const data = await res.json();
      setResults(data);
    } catch (e) {
      console.error("Error:", e);
    }
    setLoading(false);
  };

  const handleSubscription = async (priceId: string) => {
    if (!user) {
      handleLogin();
      return;
    }

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Fizetési hiba:", error);
    }
  };

  const getCharLimit = (title: string) => {
    if (title.includes('X_TWITTER')) return 280;
    if (title.includes('INSTAGRAM')) return 2200;
    if (title.includes('LINKEDIN')) return 3000;
    return null;
  };

  const copyAllToClipboard = () => {
    if (!results) return;
    const allText = Object.entries(results)
      .map(([key, data]: any) => `${key.toUpperCase()}:\n${typeof data === 'object' ? data.content : data}`)
      .join('\n\n---\n\n');
    navigator.clipboard.writeText(allText);
  };

  const exportToTxt = () => {
    if (!results) return;
    const allText = Object.entries(results)
      .map(([key, data]: any) => `${key.toUpperCase()}:\n${typeof data === 'object' ? data.content : data}`)
      .join('\n\n====================\n\n');
    const element = document.createElement("a");
    const file = new Blob([allText], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `content-factory-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
  };

  const fetchHistory = async () => {
    setShowHistory(true);
    const { data } = await supabase.from('generations').select('*').order('created_at', { ascending: false });
    setHistory(data || []);
  };

  const deleteGen = async (id: string, e: any) => {
    e.stopPropagation();
    if (!confirm("Biztosan törlöd?")) return;
    await supabase.from('generations').delete().eq('id', id);
    setHistory(history.filter(h => h.id !== id));
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen transition-colors duration-500 bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-500/30">
      
      {/* 2026 DYNAMIC GLOW BACKDROP */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none opacity-40 transition-opacity duration-1000"
        style={{
          background: `radial-gradient(800px circle at ${mousePos.x}px ${mousePos.y}px, rgba(37, 99, 235, 0.1), transparent 80%)`
        }}
      />

      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-black/40 border-b border-slate-200 dark:border-white/10 py-5">
        <div className="max-w-7xl mx-auto px-8 flex justify-between items-center">
          <motion.div whileHover={{ scale: 1.02 }} className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)]">
               <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-black tracking-tighter">ContentFactory<span className="text-blue-600">.AI</span></span>
          </motion.div>

          <div className="flex items-center gap-6">
            {user ? (
              <div className="flex items-center gap-3 bg-slate-200 dark:bg-white/5 p-1 pr-4 rounded-full border border-slate-300 dark:border-white/10">
                <img src={user.user_metadata.avatar_url} className="w-8 h-8 rounded-full" alt="User" />
                <button onClick={handleLogout} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-red-500 transition-colors">Logout</button>
              </div>
            ) : (
              <button onClick={handleLogin} className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg shadow-blue-500/30">Login</button>
            )}
            
            <button onClick={fetchHistory} className="p-2.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-all"><History className="w-5 h-5" /></button>
            
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-[10px] font-black uppercase p-2.5 rounded-xl outline-none"
            >
              {languages.map(l => <option key={l.code} value={l.code} className="bg-white dark:bg-[#020617]">{l.name}</option>)}
            </select>

            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
              className="p-2.5 bg-slate-200 dark:bg-white/5 rounded-xl border border-slate-300 dark:border-white/10"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-blue-600" />}
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-8 py-16">
        {!user ? (
          /* 1. ESET: NINCS BEJELENTKEZVE */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-32 bg-white/40 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-[60px] backdrop-blur-3xl shadow-3xl">
            <h1 className="text-8xl font-black mb-8 tracking-tight leading-[0.9]">Create <br/><span className="text-blue-600">Faster.</span></h1>
            <button onClick={handleLogin} className="bg-blue-600 text-white px-12 py-5 rounded-[24px] font-black text-xl hover:scale-105 transition-all">Get Started</button>
          </motion.div>
        ) : user.email === adminEmail ? (
          /* 2. ESET: TE VAGY AZ ADMIN - MINDENT LÁTSZ */
          <div className="space-y-12">
            {/* Ide jön a teljes meglévő kódod: PRICING SECTION, INPUT CORE, RESULTS PLATFORM */}
            {/* ... (a jelenlegi kódod folytatása) ... */}

            {!user ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-32 bg-white/40 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-[60px] backdrop-blur-3xl shadow-3xl">
             <h1 className="text-8xl font-black mb-8 tracking-tight leading-[0.9]">Create <br/><span className="text-blue-600">Faster.</span></h1>
             <button onClick={() => handleSubscription(process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO!)} className="bg-blue-600 text-white px-12 py-5 rounded-[24px] font-black text-xl hover:scale-105 transition-all">Get Started</button>
          </motion.div>
        ) : (
          <div className="space-y-12">
            
            {/* INPUT CORE */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative bg-white/50 dark:bg-[#0f172a]/40 backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-[40px] p-10 shadow-2xl overflow-hidden">
              <div className="flex items-center gap-3 mb-8 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                 <Type className="w-5 h-5" /> Neural Input
              </div>

              {/* PRICING SECTION - MULTI-PLAN */}
              {!isPro && (
                <div className="grid md:grid-cols-2 gap-8 mb-20 max-w-4xl mx-auto">
                  
                  {/* BASIC PLAN */}
                  <div className="p-8 rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-3xl hover:border-blue-500/30 transition-all group">
                    <h3 className="text-xl font-bold mb-2">Basic Plan</h3>
                    <p className="text-sm opacity-50 mb-6">Ideális alkalmi tartalomgyártóknak</p>
                    <p className="text-4xl font-black mb-6">$10.00 <span className="text-sm font-normal opacity-50">/ hó</span></p>
                    <ul className="space-y-3 mb-8 text-sm opacity-70">
                      <li>• 50 generálás / hó</li>
                      <li>• Standard AI motor</li>
                      <li>• Alap sablonok</li>
                    </ul>
                    <button 
                      onClick={() => handleSubscription(process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC!)}
                      className="w-full py-4 rounded-2xl bg-white/10 font-bold hover:bg-white/20 transition-all border border-white/10"
                    >
                      Választom
                    </button>
                  </div>

                  {/* PRO PLAN */}
                  <div className="p-8 rounded-[40px] bg-blue-600 border border-blue-400 shadow-2xl shadow-blue-600/20 relative overflow-hidden transform hover:scale-[1.02] transition-all">
                    <div className="absolute top-0 right-0 bg-white text-blue-600 text-[10px] font-black px-4 py-1 rounded-bl-xl uppercase tracking-tighter">Legnépszerűbb</div>
                    <h3 className="text-xl font-bold mb-2">Pro Plan</h3>
                    <p className="text-sm text-blue-100/60 mb-6">Profi marketingeseknek és ügynökségeknek</p>
                    <p className="text-4xl font-black mb-6">$29.99 <span className="text-sm font-normal text-blue-100/50">/ hó</span></p>
                    <ul className="space-y-3 mb-8 text-sm text-blue-100">
                      <li>• Korlátlan generálás</li>
                      <li>• GPT-4o Neural Engine</li>
                      <li>• Minden prémium sablon</li>
                      <li>• Prioritásos támogatás</li>
                    </ul>
                    <button 
                      onClick={() => handleSubscription(process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO!)}
                      className="w-full py-4 rounded-2xl bg-white text-blue-600 font-black shadow-xl hover:bg-blue-50 transition-all"
                    >
                      Upgrade to Pro
                    </button>
                  </div>
                </div>
              )}

              <div className="relative">
                {loading && (
                  <motion.div 
                    initial={{ top: 0 }}
                    animate={{ top: '100%' }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent z-20 shadow-[0_0_15px_rgba(59,130,246,0.8)]"
                  />
                )}
                <textarea 
                  className="w-full bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/5 rounded-3xl p-8 text-xl outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-h-[220px]"
                  placeholder="Illessz be egy linket vagy írj le egy ötletet..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
              </div>

              

              <div className="mt-10 grid lg:grid-cols-2 gap-10">
                <div className="space-y-5">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Sablon Motor</span>
                  <div className="flex flex-wrap gap-2">
                    {templates.map(t => (
                      <button 
                        key={t.id} onClick={() => setSelectedTemplate(t)}
                        className={`px-5 py-3 rounded-2xl text-xs font-bold transition-all border ${selectedTemplate.id === t.id ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-200 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-500 hover:text-blue-600'}`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                  <div className="flex bg-slate-200 dark:bg-black/40 p-1 rounded-2xl border border-slate-300 dark:border-white/10">
                    {['szakmai', 'vicces', 'lelkesito', 'provokativ'].map(t => (
                      <button 
                        key={t} onClick={() => setTone(t)} 
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${tone === t ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xl' : 'text-slate-500'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* MAGIC BUTTON WITH CONIC GRADIENT LOADING BORDER */}
                  <motion.button 
                    ref={btnRef}
                    onMouseMove={handleButtonMove}
                    onMouseLeave={() => setButtonPos({ x: 0, y: 0 })}
                    animate={{ x: buttonPos.x, y: buttonPos.y }}
                    onClick={generateAll}
                    disabled={loading}
                    className="relative group w-full bg-[#020617] p-[2px] rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(37,99,235,0.1)] active:scale-95 transition-transform"
                  >
                    {/* FORGÓ NEON KERET */}
                    <div className={`absolute inset-0 z-0 transition-opacity duration-500 ${loading ? 'opacity-100' : 'opacity-0'}`}>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250%] h-[250%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_300deg,#3b82f6_360deg)] animate-spin" />
                    </div>

                    <div className="relative z-10 bg-[#020617] dark:bg-[#020617] py-5 rounded-2xl flex items-center justify-center gap-4 text-white font-black text-lg group-hover:bg-blue-600/10 transition-colors">
                      {loading ? (
                        <div className="flex items-center gap-3">
                          <Sparkles className="w-5 h-5 text-blue-400 animate-bounce" />
                          <span className="tracking-[0.2em] animate-pulse text-sm">NEURAL PROCESSING...</span>
                        </div>
                      ) : (
                        <span className="flex items-center gap-3 tracking-tight">KAMPÁNY INICIALIZÁLÁSA <Zap className="w-5 h-5 text-blue-500 group-hover:animate-pulse" /></span>
                      )}
                    </div>
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* NEURAL SHIMMER LOADER */}
            {loading && !results && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[1,2,3].map(i => (
                  <div key={i} className="h-64 bg-slate-200 dark:bg-white/[0.03] rounded-[40px] animate-pulse relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                  </div>
                ))}
              </div>
            )}

            {/* RESULTS PLATFORM */}
            {results && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-blue-600 p-8 rounded-[40px] shadow-3xl text-white">
                  <div className="flex items-center gap-5">
                     <div className="bg-white/20 p-4 rounded-3xl"><Sparkles className="w-8 h-8 animate-pulse" /></div>
                     <div>
                       <h2 className="text-3xl font-black tracking-tighter">Campaign Matrix Ready.</h2>
                       <p className="text-blue-100 text-sm font-medium italic">Cross-platform synchronization complete.</p>
                     </div>
                  </div>
                  <div className="flex gap-4 w-full md:w-auto">
                    <button onClick={copyAllToClipboard} className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 px-8 py-4 rounded-2xl text-sm font-black border border-white/20 transition-all">Bulk Copy</button>
                    <button onClick={exportToTxt} className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-white text-blue-600 hover:bg-blue-50 px-8 py-4 rounded-2xl text-sm font-black shadow-2xl transition-all">System Export</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {Object.entries(results).map(([key, data]: any, i) => (
                    <motion.div key={key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                      <ResultCard title={key.replace(/_/g, ' ')} content={typeof data === 'object' ? data.content : data} charLimit={getCharLimit(key.toUpperCase())} />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}
          </div>
        ) : (
          /* 3. ESET: IDEGEN VAN BENT - ELREJTJÜK A FUNKCIÓKAT */
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[40px]">
            <Sparkles className="w-16 h-16 text-blue-500 mx-auto mb-6 opacity-20" />
            <h2 className="text-4xl font-black mb-4">Zárt Béta Fázis</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-8 font-medium">
              Köszönjük az érdeklődést! Az alkalmazás jelenleg fejlesztés alatt áll és csak meghívott tesztelők számára érhető el.
            </p>
            <button onClick={handleLogout} className="text-sm font-black uppercase tracking-widest text-blue-600 hover:text-blue-400 transition-colors">Vissza a főoldalra</button>
          </motion.div>
        )}
      </main>

      

      {/* ARCHIVE DRAWER */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHistory(false)} className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30 }} className="fixed inset-y-0 right-0 w-full max-w-lg bg-slate-50 dark:bg-[#020617] z-[110] border-l border-slate-300 dark:border-white/10 p-12 shadow-3xl overflow-y-auto">
              <div className="flex justify-between items-center mb-16">
                 <h2 className="text-4xl font-black tracking-tighter flex items-center gap-4"><History className="text-blue-600 w-10 h-10" /> Archives</h2>
                 <button onClick={() => setShowHistory(false)} className="p-3 bg-slate-200 dark:bg-white/5 rounded-2xl hover:text-red-500 transition-all"><X /></button>
              </div>
              <div className="space-y-6">
                {history.map(item => (
                  <div key={item.id} onClick={() => {setResults(item.results); setInput(item.original_content); setShowHistory(false);}} className="group relative p-8 bg-slate-200 dark:bg-white/[0.02] border border-slate-300 dark:border-white/5 rounded-[32px] hover:border-blue-500/50 cursor-pointer transition-all">
                    <div className="flex justify-between mb-6 text-[10px] font-black uppercase tracking-widest text-blue-600">
                      <span>{item.tone}</span>
                      <button onClick={(e) => deleteGen(item.id, e)} className="p-2 text-slate-400 hover:text-red-500 transition-all"><X className="w-4 h-4" /></button>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm italic font-medium opacity-70 line-clamp-2">"{item.original_content}"</p>
                    <div className="mt-6 flex justify-between items-center text-[9px] font-black opacity-40">
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultCard({ title, content: init, charLimit }: any) {
  const [content, setContent] = useState(init);
  const [isEditing, setIsEditing] = useState(false);
  const isOver = charLimit && content.length > charLimit;

  useEffect(() => { setContent(init); }, [init]);

  return (
    <div className={`relative h-full bg-white dark:bg-white/[0.03] backdrop-blur-3xl border rounded-[40px] p-8 transition-all duration-700 hover:shadow-2xl flex flex-col ${isOver ? 'border-red-500/50' : 'border-slate-200 dark:border-white/10 hover:border-blue-500/50'}`}>
       <div className="flex justify-between items-center mb-8">
          <span className="text-[10px] font-black tracking-[0.3em] text-blue-600 uppercase">{title}</span>
          <div className="flex gap-2">
             <button onClick={() => setIsEditing(!isEditing)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${isEditing ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-200 dark:bg-white/5 text-slate-500'}`}>{isEditing ? 'Finish' : 'Edit'}</button>
             <button onClick={() => {navigator.clipboard.writeText(content); alert('Copied!');}} className="p-2.5 bg-slate-200 dark:bg-white/5 rounded-xl hover:text-blue-500 transition-all"><Copy className="w-4 h-4" /></button>
          </div>
       </div>

       <div className="flex-grow">
         {isEditing ? (
           <textarea className="w-full bg-slate-100 dark:bg-black/40 border border-blue-500/30 rounded-2xl p-4 text-sm min-h-[160px] outline-none" value={content} onChange={e => setContent(e.target.value)} />
         ) : (
           <p className="text-slate-600 dark:text-slate-300 text-sm leading-[1.8] font-medium opacity-90">{content}</p>
         )}
       </div>

       <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/5 flex justify-between items-center text-[10px] font-black tracking-widest">
          <span className={isOver ? 'text-red-500 animate-pulse' : 'opacity-40'}>
             {content.length} {charLimit ? `/ ${charLimit}` : ''}
          </span>
          {isOver && <span className="text-red-500 uppercase tracking-tighter">Capacity Exceeded</span>}
       </div>
    </div>
  );
}