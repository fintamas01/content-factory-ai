"use client";
import { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Type, Zap, Copy, History as HistoryIcon, Send, Search, Image as ImageIcon, Globe, CheckCircle2, Download, Loader2, X
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { motion, AnimatePresence } from 'framer-motion';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

const adminEmail = "fintatamas68@gmail.com";

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
  { id: 'LinkedIn', label: 'LinkedIn' },
  { id: 'Instagram', label: 'Instagram' },
  { id: 'X (Twitter)', label: 'X (Twitter)' },
  { id: 'Newsletter', label: 'Newsletter' },
  { id: 'TikTok Script', label: 'TikTok Script' },
];

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [input, setInput] = useState('');
  const [tone, setTone] = useState('szakmai');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('hu');
  const [useResearch, setUseResearch] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [isBasic, setIsBasic] = useState(false);
  const [genCount, setGenCount] = useState(0);
  const [buttonPos, setButtonPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<any>(null);

  useEffect(() => {
    const fetchBrands = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('brand_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('brand_name', { ascending: true });
        
      if (data) {
        setBrands(data);
        if (!selectedBrand && data.length > 0) setSelectedBrand(data[0]);
      }
    };
    fetchBrands();
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
    if (!input || selectedPlatforms.length === 0 || !selectedBrand) {
      alert("Kérlek adj meg forrást, válassz platformot és márkaprofilt!");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: input, 
          tone, 
          lang, 
          useResearch,
          templatePrompt: selectedTemplate.prompt, 
          platforms: selectedPlatforms,
          brandProfile: {
            name: selectedBrand.brand_name,
            desc: selectedBrand.description,
            audience: selectedBrand.target_audience
          }
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

  if (!mounted) return null;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500"></div>
      </div>
    );
  }

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

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20 p-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2 uppercase italic">Neural <span className="text-blue-600">Workspace</span></h1>
          <p className="text-slate-500 font-medium">Hozd létre a következő kampányodat másodpercek alatt.</p>
        </div>
        
        <button 
          onClick={() => setUseResearch(!useResearch)}
          className={`flex items-center gap-3 px-6 py-3 rounded-2xl border transition-all ${useResearch ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-slate-500'}`}
        >
          <Search className={`w-4 h-4 ${useResearch ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-black uppercase tracking-widest">Deep Research {useResearch ? 'ON' : 'OFF'}</span>
          <div className={`w-8 h-4 rounded-full relative transition-colors ${useResearch ? 'bg-blue-500' : 'bg-slate-700'}`}>
            <motion.div animate={{ x: useResearch ? 16 : 2 }} className="absolute top-1 w-2 h-2 bg-white rounded-full" />
          </div>
        </button>
      </header>

      {/* Input Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative bg-white/50 dark:bg-[#0f172a]/40 backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-[40px] p-10 shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center mb-8">
           <div className="flex items-center gap-3 text-slate-500 uppercase text-[10px] font-black tracking-widest">
              <Type className="w-5 h-5" /> Content Source
           </div>
           <div className="flex items-center gap-4">
             {useResearch && (
               <span className="flex items-center gap-2 text-[9px] font-black text-blue-500 uppercase animate-pulse">
                 <Globe className="w-3 h-3" /> Web search enabled
               </span>
             )}
             <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-[10px] font-black uppercase px-4 py-2 rounded-xl outline-none"
              >
                {languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
           </div>
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
            placeholder={useResearch ? "Adj meg egy témát vagy linket, amit az AI alaposan körbejár a weben..." : "Illessz be egy linket vagy írj le egy ötletet..."}
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

            <div className="mb-6">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Márkaprofil kiválasztása</span>
              <select 
                value={selectedBrand?.id}
                onChange={(e) => setSelectedBrand(brands.find(b => b.id === e.target.value))}
                className="w-full bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 p-3 rounded-xl outline-none text-sm font-bold"
              >
                {brands.length === 0 && <option>Nincs mentett márka (Settings)</option>}
                {brands.map(b => <option key={b.id} value={b.id}>{b.brand_name}</option>)}
              </select>
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
                {loading ? <span className="tracking-[0.2em] animate-pulse text-sm uppercase">{useResearch ? 'Deep Analyzing...' : 'Neural Processing...'}</span> : <span>KAMPÁNY GENERÁLÁSA <Zap className="w-5 h-5 text-blue-500" /></span>}
              </div>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Results Section */}
      {results && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {Object.entries(results).map(([key, data]: any) => (
            <ResultCard 
              key={key} 
              title={key.replace(/_/g, ' ')} 
              data={data}
              brandName={selectedBrand?.brand_name}
              lang={lang}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

function ResultCard({ title, data, brandName, lang }: any) {
  const [content, setContent] = useState(data.text || data);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const initialContent = data.text || data;

  const handleMagicEdit = async (action: string) => {
    setLoading(true);
    const finalAction = action === 'custom' ? customPrompt : action;
    try {
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, action: finalAction, lang }),
      });
      const resData = await res.json();
      if (resData.updatedText) {
        setContent(resData.updatedText);
        setCustomPrompt('');
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleGenerateImage = async () => {
    setLoadingImage(true);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: data.image_prompt || content, 
          platform: title, 
          brandName: brandName 
        }),
      });
      const resData = await res.json();
      if (resData.imageUrl) setImageUrl(resData.imageUrl);
    } catch (e) { console.error(e); }
    setLoadingImage(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
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
             <button onClick={handleCopy} className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:text-blue-500">
               {isCopied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
             </button>
          </div>
        </div>

        {/* SZERKESZTŐ INTERFÉSZ */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[{id:'shorten', l:'✂️ Rövidebb'}, {id:'emoji', l:'✨ Emojik'}, {id:'professional', l:'💼 Profi'}].map(btn => (
            <button key={btn.id} onClick={() => handleMagicEdit(btn.id)} disabled={loading} className="text-[9px] font-black uppercase px-3 py-1.5 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-lg hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50">{btn.l}</button>
          ))}
          
          {/* FOTÓ GENERÁLÁSA GOMB */}
          <button 
            onClick={handleGenerateImage} 
            disabled={loadingImage} 
            className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 ${imageUrl ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20'} disabled:opacity-50`}
          >
            {loadingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
            {imageUrl ? 'Újragenerálás' : 'Fotó Generálása'}
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <input type="text" value={customPrompt} onChange={(e)=>setCustomPrompt(e.target.value)} placeholder="Saját kérés..." className="flex-1 bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2 text-[11px] outline-none focus:ring-1 focus:ring-blue-500 transition-all text-white" />
          <button onClick={() => handleMagicEdit('custom')} disabled={!customPrompt || loading} className="p-2 bg-blue-600 text-white rounded-xl disabled:opacity-50 hover:bg-blue-700 transition-colors"><Send className="w-4 h-4" /></button>
        </div>

        <div className="flex-grow space-y-6">
          {loading ? (
            <div className="space-y-2 animate-pulse"><div className="h-4 bg-slate-200 dark:bg-white/5 rounded w-full"></div><div className="h-4 bg-slate-200 dark:bg-white/5 rounded w-5/6"></div></div>
          ) : (
            <>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed font-medium whitespace-pre-wrap">{content}</p>
              
              {/* GENERÁLT KÉP MEGJELENÍTÉSE */}
              <AnimatePresence>
                {imageUrl && (
                  <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="relative group/img rounded-2xl overflow-hidden border border-white/10 shadow-lg bg-black/20">
                    <img src={imageUrl} alt="AI Generated" className="w-full h-auto object-cover max-h-80" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-xl">
                        <Download className="w-5 h-5" />
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* VIZUÁLIS TERV (Ha van prompt, de még nincs kép) */}
              {!imageUrl && data.image_prompt && (
                <div className="p-4 bg-purple-600/5 border border-purple-500/10 rounded-2xl">
                    <span className="text-[9px] font-black text-purple-500 uppercase block mb-1">Visual Concept:</span>
                    <p className="text-[11px] text-slate-400 italic">"{data.image_prompt}"</p>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* ÜTEMEZÉS ELŐKÉSZÍTÉSE */}
        <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-center">
             <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${imageUrl ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`} />
                <span className="text-[9px] font-black text-slate-500 uppercase">{imageUrl ? 'Ready to post' : 'Needs Image'}</span>
             </div>
             <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-lg shadow-blue-900/20">
                🚀 Ütemezés
             </button>
        </div>
      </div>

      {/* LIVE PREVIEW MODAL */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative z-10 w-full max-w-sm">
              <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-xl overflow-hidden">
                <div className="w-[148px] h-[18px] bg-gray-800 top-0 left-1/2 -translate-x-1/2 absolute rounded-b-[1rem] z-20"></div>
                
                <div className="h-full w-full bg-white dark:bg-[#1c1f26] overflow-y-auto pt-8">
                  <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 p-[2px]">
                      <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center text-[10px] font-bold text-slate-500">
                         {brandName?.charAt(0) || 'CF'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="h-3 w-24 bg-slate-200 dark:bg-white/10 rounded-full" />
                      <div className="h-2 w-16 bg-slate-100 dark:bg-white/5 rounded-full" />
                    </div>
                  </div>
                  
                  {/* HA VAN KÉP, ITT MUTATJUK */}
                  {imageUrl ? (
                    <div className="w-full aspect-square overflow-hidden bg-slate-900">
                       <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  ) : data.image_prompt && (
                    <div className="w-full aspect-square bg-slate-800 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-blue-500 to-purple-600" />
                        <ImageIcon className="w-12 h-12 text-white/20" />
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-[8px] text-white/70 font-bold uppercase tracking-widest">AI Visualization</div>
                    </div>
                  )}

                  <div className="p-6">
                    <p className="text-[13px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-medium">
                      {content}
                    </p>
                  </div>
                  
                  <div className="mt-4 px-6 flex justify-between opacity-30 pb-10">
                    <div className="h-4 w-4 rounded bg-slate-400" />
                    <div className="h-4 w-4 rounded bg-slate-400" />
                    <div className="h-4 w-4 rounded bg-slate-400" />
                  </div>
                </div>
              </div>
              
              <button onClick={() => setShowModal(false)} className="mt-8 mx-auto block px-6 py-2 bg-white/10 text-white rounded-full text-sm font-bold hover:bg-white/20 transition-all border border-white/10">
                Bezárás
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}