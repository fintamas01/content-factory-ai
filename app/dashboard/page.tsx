"use client";
import { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Type, Zap, Copy 
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { motion } from 'framer-motion';

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

export default function DashboardPage() {
  const [input, setInput] = useState('');
  const [tone, setTone] = useState('szakmai');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('hu');
  const [user, setUser] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [buttonPos, setButtonPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const handleButtonMove = (e: React.MouseEvent) => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    setButtonPos({ x: x * 0.2, y: y * 0.2 });
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
      if (data.error) alert(data.error);
      else setResults(data);
    } catch (e) {
      console.error("Error:", e);
    }
    setLoading(false);
  };

  const getCharLimit = (title: string) => {
    if (title.includes('X_TWITTER')) return 280;
    if (title.includes('INSTAGRAM')) return 2200;
    if (title.includes('LINKEDIN')) return 3000;
    return null;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      <header>
        <h1 className="text-4xl font-black tracking-tight mb-2">Neural Workspace</h1>
        <p className="text-slate-500 font-medium">Hozd létre a következő virális kampányodat másodpercek alatt.</p>
      </header>

      {/* INPUT CORE */}
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

            <motion.button 
              ref={btnRef}
              onMouseMove={handleButtonMove}
              onMouseLeave={() => setButtonPos({ x: 0, y: 0 })}
              animate={{ x: buttonPos.x, y: buttonPos.y }}
              onClick={generateAll}
              disabled={loading}
              className="relative group w-full bg-[#020617] p-[2px] rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(37,99,235,0.1)] active:scale-95 transition-transform"
            >
              <div className={`absolute inset-0 z-0 transition-opacity duration-500 ${loading ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250%] h-[250%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_300deg,#3b82f6_360deg)] animate-spin" />
              </div>

              <div className="relative z-10 bg-[#020617] py-5 rounded-2xl flex items-center justify-center gap-4 text-white font-black text-lg group-hover:bg-blue-600/10 transition-colors">
                {loading ? (
                   <span className="tracking-[0.2em] animate-pulse text-sm">NEURAL PROCESSING...</span>
                ) : (
                  <span className="flex items-center gap-3 tracking-tight">KAMPÁNY GENERÁLÁSA <Zap className="w-5 h-5 text-blue-500" /></span>
                )}
              </div>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* RESULTS PLATFORM */}
      {results && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Object.entries(results).map(([key, data]: any, i) => (
              <ResultCard key={key} title={key.replace(/_/g, ' ')} content={typeof data === 'object' ? data.content : data} charLimit={getCharLimit(key.toUpperCase())} />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function ResultCard({ title, content, charLimit }: any) {
  return (
    <div className="relative h-full bg-white dark:bg-white/[0.03] backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-[40px] p-8 transition-all hover:border-blue-500/50 flex flex-col">
       <div className="flex justify-between items-center mb-8">
          <span className="text-[10px] font-black tracking-[0.3em] text-blue-600 uppercase">{title}</span>
          <button onClick={() => navigator.clipboard.writeText(content)} className="p-2.5 bg-slate-200 dark:bg-white/5 rounded-xl hover:text-blue-500 transition-all"><Copy className="w-4 h-4" /></button>
       </div>
       <p className="text-slate-600 dark:text-slate-300 text-sm leading-[1.8] font-medium opacity-90">{content}</p>
    </div>
  );
}