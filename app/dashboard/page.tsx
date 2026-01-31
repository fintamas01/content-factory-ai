"use client";
import { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Type, Zap, Copy, History as HistoryIcon, Send 
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { motion, AnimatePresence } from 'framer-motion';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

const adminEmail = "fintatamas68@gmail.com"; // Admin e-mail fixálva

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

const allPlatforms = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'x_twitter', label: 'X (Twitter)' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'tiktok_script', label: 'TikTok Script' },
];

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [input, setInput] = useState('');
  const [tone, setTone] = useState('szakmai');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('hu');
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [isBasic, setIsBasic] = useState(false);
  const [genCount, setGenCount] = useState(0);
  const [buttonPos, setButtonPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const [brandProfile, setBrandProfile] = useState({
    name: '',
    desc: '',
    audience: ''
  });

  useEffect(() => {
    const fetchBrand = async () => {
      if (user) {
        const { data } = await supabase.from('brand_profiles').select('*').eq('user_id', user.id).single();
        if (data) setBrandProfile({ name: data.brand_name, desc: data.description, audience: data.target_audience });
      }
    };
    fetchBrand();
  }, [user]);

  useEffect(() => {
    setMounted(true);
    const checkStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        const { data: sub } = await supabase.from('subscriptions').select('*').eq('user_id', user.id).single();
        if (sub?.status === 'active') {
          if (sub.price_id === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO) setIsPro(true);
          else setIsBasic(true);
        }
        const { count } = await supabase.from('generations').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
        setGenCount(count || 0);
      }
    };
    checkStatus();
  }, []);

  const handleButtonMove = (e: React.MouseEvent) => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    setButtonPos({ x: x * 0.2, y: y * 0.2 });
  };

  const generateAll = async () => {
    if (!input || selectedPlatforms.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: input, 
          tone, 
          lang, 
          templatePrompt: selectedTemplate.prompt, 
          platforms: selectedPlatforms 
        }),
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else setResults(data);
    } catch (e) {
      console.error("Error:", e);
    }
    setLoading(false);
  };

  const togglePlatform = (id: string) => {
    const limit = isPro ? 5 : isBasic ? 2 : 1;
    if (selectedPlatforms.includes(id)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== id));
    } else if (selectedPlatforms.length < limit) {
      setSelectedPlatforms([...selectedPlatforms, id]);
    } else {
      alert(`A jelenlegi csomagod limitje: ${limit} platform.`);
    }
  };

  // 1. Lépés: Hydration védelem
  if (!mounted) return null;

  // 2. Lépés: User adat betöltésének ellenőrzése
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  // 3. Lépés: Biztonságos admin ellenőrzés
  if (user.email !== adminEmail) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white/5 backdrop-blur-3xl rounded-[40px] border border-white/10 m-8">
        <Sparkles className="w-16 h-16 text-blue-500 mb-6 opacity-20" />
        <h2 className="text-4xl font-black mb-4 italic text-white uppercase tracking-tighter">Zárt Béta Fázis</h2>
        <p className="text-slate-500 max-w-md font-medium leading-relaxed">
          Szia! A rendszer jelenleg fejlesztés alatt áll. Jelenleg csak <strong>{adminEmail}</strong> férhet hozzá a funkciókhoz.
        </p>
      </div>
    );
  }

  // 4. Lépés: A tényleges tartalom renderelése
  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20 p-8">
      <header>
        <h1 className="text-4xl font-black tracking-tight mb-2 uppercase italic">Neural <span className="text-blue-600">Workspace</span></h1>
        <p className="text-slate-500 font-medium">Hozd létre a következő kampányodat másodpercek alatt.</p>
      </header>

      {/* Input Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative bg-white/50 dark:bg-[#0f172a]/40 backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-[40px] p-10 shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center mb-8">
           <div className="flex items-center gap-3 text-slate-500 uppercase text-[10px] font-black tracking-widest">
              <Type className="w-5 h-5" /> Content Source
           </div>
           <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-[10px] font-black uppercase px-4 py-2 rounded-xl outline-none"
            >
              {languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
        </div>

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
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">Célplatformok</span>
              <div className="flex flex-wrap gap-3">
                {allPlatforms.map(p => (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                      selectedPlatforms.includes(p.id) 
                      ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20' 
                      : 'bg-white/5 border-white/10 text-slate-500 hover:border-blue-500/50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="pt-4 border-t border-white/5">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">Sablon Motor</span>
              <div className="flex flex-wrap gap-2">
                {templates.map(t => (
                  <button 
                    key={t.id} onClick={() => setSelectedTemplate(t)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all border ${selectedTemplate.id === t.id ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-200 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-500 hover:text-blue-600'}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
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

            <div className="bg-blue-600/5 border border-blue-500/20 rounded-3xl p-6 mb-10">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Smart Brand Voice</span>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <input 
                  type="text" 
                  placeholder="Márkanév..."
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                  value={brandProfile.name}
                  onChange={(e) => setBrandProfile({...brandProfile, name: e.target.value})}
                />
                <input 
                  type="text" 
                  placeholder="Márka leírása (stílus, értékek)..."
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                  value={brandProfile.desc}
                  onChange={(e) => setBrandProfile({...brandProfile, desc: e.target.value})}
                />
                <input 
                  type="text" 
                  placeholder="Célközönség..."
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                  value={brandProfile.audience}
                  onChange={(e) => setBrandProfile({...brandProfile, audience: e.target.value})}
                />
              </div>
            </div>

            <motion.button 
              ref={btnRef}
              onMouseMove={handleButtonMove}
              onMouseLeave={() => setButtonPos({ x: 0, y: 0 })}
              animate={{ x: buttonPos.x, y: buttonPos.y }}
              onClick={generateAll}
              disabled={loading || selectedPlatforms.length === 0}
              className="relative group w-full bg-[#020617] p-[2px] rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(37,99,235,0.1)] active:scale-95 transition-transform disabled:opacity-50"
            >
              <div className={`absolute inset-0 z-0 transition-opacity duration-500 ${loading ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250%] h-[250%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_300deg,#3b82f6_360deg)] animate-spin" />
              </div>
              <div className="relative z-10 bg-[#020617] py-5 rounded-2xl flex items-center justify-center gap-4 text-white font-black text-lg group-hover:bg-blue-600/10 transition-colors">
                {loading ? <span className="tracking-[0.2em] animate-pulse text-sm uppercase">Neural Processing...</span> : <span>KAMPÁNY GENERÁLÁSA <Zap className="w-5 h-5 text-blue-500" /></span>}
              </div>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Results Section */}
      {results && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Object.entries(results).map(([key, data]: any) => (
            <ResultCard 
              key={key} 
              title={key.replace(/_/g, ' ')} 
              content={typeof data === 'object' ? data.content : data} 
              lang={lang}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

function ResultCard({ title, content: initialContent, lang }: any) {
  const [content, setContent] = useState(initialContent);
  const [showModal, setShowModal] = useState(false); // Modal állapota
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleMagicEdit = async (action: string) => {
    setLoading(true);
    const finalAction = action === 'custom' ? customPrompt : action;
    try {
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, action: finalAction, lang }),
      });
      const data = await res.json();
      if (data.updatedText) {
        setContent(data.updatedText);
        setCustomPrompt('');
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <>
      <div className="relative h-full bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-[40px] p-8 transition-all hover:border-blue-500/50 flex flex-col group shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black tracking-[0.3em] text-blue-600 uppercase">{title}</span>
            <button 
              onClick={() => setShowModal(true)}
              className="text-[9px] font-black uppercase px-3 py-1 bg-blue-600/10 text-blue-600 rounded-full hover:bg-blue-600 hover:text-white transition-all border border-blue-600/20"
            >
              📱 Live Preview
            </button>
          </div>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
             <button onClick={() => setContent(initialContent)} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:text-orange-500" title="Visszaállítás">
               <HistoryIcon className="w-4 h-4" />
             </button>
             <button onClick={() => navigator.clipboard.writeText(content)} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:text-blue-500">
               <Copy className="w-4 h-4" />
             </button>
          </div>
        </div>

        {/* SZERKESZTŐ INTERFÉSZ */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[{id:'shorten', l:'✂️ Rövidebb'}, {id:'emoji', l:'✨ Emojik'}, {id:'professional', l:'💼 Profi'}].map(btn => (
            <button key={btn.id} onClick={() => handleMagicEdit(btn.id)} disabled={loading} className="text-[9px] font-black uppercase px-3 py-1.5 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-lg hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50">{btn.l}</button>
          ))}
        </div>

        <div className="flex gap-2 mb-6">
          <input type="text" value={customPrompt} onChange={(e)=>setCustomPrompt(e.target.value)} placeholder="Saját kérés..." className="flex-1 bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2 text-[11px] outline-none focus:ring-1 focus:ring-blue-500 transition-all text-white" />
          <button onClick={() => handleMagicEdit('custom')} disabled={!customPrompt || loading} className="p-2 bg-blue-600 text-white rounded-xl disabled:opacity-50 hover:bg-blue-700 transition-colors"><Send className="w-4 h-4" /></button>
        </div>

        <div className="flex-grow">
          {loading ? (
            <div className="space-y-2 animate-pulse"><div className="h-4 bg-slate-200 dark:bg-white/5 rounded w-full"></div><div className="h-4 bg-slate-200 dark:bg-white/5 rounded w-5/6"></div></div>
          ) : (
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed font-medium whitespace-pre-wrap">{content}</p>
          )}
        </div>
      </div>

      {/* LIVE PREVIEW MODAL */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative z-10 w-full max-w-sm"
            >
              {/* TELEFON KERET (Mockup) */}
              <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-xl overflow-hidden">
                <div className="w-[148px] h-[18px] bg-gray-800 top-0 left-1/2 -translate-x-1/2 absolute rounded-b-[1rem] z-20"></div>
                <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[124px] rounded-l-lg"></div>
                <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[178px] rounded-l-lg"></div>
                <div className="h-[64px] w-[3px] bg-gray-800 absolute -right-[17px] top-[142px] rounded-r-lg"></div>
                
                {/* TELEFON KIJELZŐ TARTALMA */}
                <div className="h-full w-full bg-white dark:bg-[#1c1f26] overflow-y-auto pt-8">
                  <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 p-[2px]">
                      <div className="w-full h-full rounded-full bg-white dark:bg-black" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-3 w-24 bg-slate-200 dark:bg-white/10 rounded-full" />
                      <div className="h-2 w-16 bg-slate-100 dark:bg-white/5 rounded-full" />
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <p className="text-[13px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-medium animate-in fade-in slide-in-from-bottom-4 duration-700">
                      {content}
                    </p>
                  </div>
                  
                  {/* Alsó interakciós sáv imitáció */}
                  <div className="mt-4 px-6 flex justify-between opacity-30">
                    <div className="h-4 w-4 rounded bg-slate-400" />
                    <div className="h-4 w-4 rounded bg-slate-400" />
                    <div className="h-4 w-4 rounded bg-slate-400" />
                  </div>
                </div>
              </div>
              
              {/* BEZÁRÁS GOMB A MODAL ALATT */}
              <button 
                onClick={() => setShowModal(false)}
                className="mt-8 mx-auto block px-6 py-2 bg-white/10 text-white rounded-full text-sm font-bold hover:bg-white/20 transition-all border border-white/10"
              >
                Bezárás
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}