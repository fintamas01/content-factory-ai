"use client";
import { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Type, Zap, Copy, History as HistoryIcon, Send, Search, Image as ImageIcon, Globe, CheckCircle2, Download, Loader2, X,
  Wand2, Smile, Briefcase, Eye, Layout, Edit3
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(results).map(([key, data]: any) => (
            <ResultCard 
              key={key} 
              title={key.replace(/_/g, ' ')} 
              data={data}
              brandName={selectedBrand?.brand_name}
              lang={lang}
              userId={user.id}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

function ResultCard({ title, data, brandName, lang, userId }: any) {
  const [content, setContent] = useState(data.text || data);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'image' | 'preview'>('edit');
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const initialContent = data.text || data;

  const saveToHistory = async (currentImageUrl: string) => {
    try {
      const { error } = await supabase
        .from('generated_posts')
        .insert([
          {
            user_id: userId,
            brand_name: brandName,
            platform: title,
            content: content,      // Az aktuálisan megszerkesztett szöveg
            image_url: currentImageUrl // A Supabase Storage-ból kapott végleges link
          }
        ]);

      if (error) throw error;
      console.log("✅ Sikeresen mentve az előzményekbe!");
    } catch (e) {
      console.error("❌ Hiba az előzmény mentésekor:", e);
    }
  };

  const handleImmediatePost = async () => {
    // Biztonsági ellenőrzés: csak akkor engedjük posztolni, ha már van generált kép
    if (!imageUrl) {
      alert("Kérlek, először generálj egy fotót!");
      return;
    }

    setIsPosting(true);
    try {
      const res = await fetch('/api/instagram/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageUrl: imageUrl, // <--- MOST MÁR A DALL-E KÉPET KÜLDI EL!
          caption: content    // A megszerkesztett szöveg
        }),
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || "Hiba történt a szerver oldalon.");
      }

      alert("🎉 SIKER! A generált fotó kikerült az Instagramra!");
      setShowResultModal(false); 
      
    } catch (error: any) {
      console.error(error);
      alert("❌ Sikertelen posztolás:\n" + error.message);
    } finally {
      setIsPosting(false);
    }
  };

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
      if (resData.imageUrl) {
        setImageUrl(resData.imageUrl);

        console.log("Kép kész, mentés az adatbázisba...");
        await saveToHistory(resData.imageUrl);
      }
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
      {/* SUMMARY CARD ON DASHBOARD */}
      <motion.div 
        whileHover={{ y: -5 }}
        onClick={() => setShowResultModal(true)}
        className="cursor-pointer relative h-full bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-[32px] p-6 transition-all hover:border-blue-500/50 flex flex-col group shadow-sm overflow-hidden"
      >
        <div className="flex justify-between items-center mb-4">
          <span className="text-[10px] font-black tracking-widest text-blue-600 uppercase bg-blue-600/10 px-3 py-1 rounded-full">{title}</span>
          <Layout className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
        </div>
        
        <div className="flex-grow">
          <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed line-clamp-4 font-medium mb-4">
            {content}
          </p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
           <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${imageUrl ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-slate-300'}`} />
              <span className="text-[9px] font-bold text-slate-500 uppercase">{imageUrl ? 'Vizuál kész' : 'Nincs kép'}</span>
           </div>
           <span className="text-[9px] font-black text-blue-500 uppercase flex items-center gap-1 group-hover:translate-x-1 transition-transform">Megnyitás <Zap className="w-2 h-2" /></span>
        </div>
      </motion.div>

      {/* FULL SCREEN / WORKSPACE MODAL */}
      <AnimatePresence>
        {showResultModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowResultModal(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl" 
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative z-10 w-full max-w-5xl bg-white dark:bg-[#0b0f1a] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* MODAL HEADER WITH TABS */}
              <div className="flex flex-col md:flex-row items-center justify-between p-6 md:px-10 border-b border-slate-100 dark:border-white/5 gap-6">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-600/20">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase italic">{title} <span className="text-blue-600">Workspace</span></h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{brandName} Campaign</p>
                  </div>
                </div>

                {/* NAVIGATION TABS */}
                <div className="flex bg-slate-100 dark:bg-white/5 p-1.5 rounded-[20px] border border-slate-200 dark:border-white/5">
                  <button onClick={() => setActiveTab('edit')} className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase transition-all ${activeTab === 'edit' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xl' : 'text-slate-500'}`}>
                    <Edit3 className="w-4 h-4" /> Szerkesztés
                  </button>
                  <button onClick={() => setActiveTab('image')} className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase transition-all ${activeTab === 'image' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xl' : 'text-slate-500'}`}>
                    <ImageIcon className="w-4 h-4" /> Fotó gyártás
                  </button>
                  <button onClick={() => setActiveTab('preview')} className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase transition-all ${activeTab === 'preview' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xl' : 'text-slate-500'}`}>
                    <Eye className="w-4 h-4" /> Live Preview
                  </button>
                </div>

                <button onClick={() => setShowResultModal(false)} className="p-3 hover:bg-red-500/10 hover:text-red-500 rounded-full transition-all text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-6 md:p-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  
                  {/* LEFT SIDE: ALWAYS VISIBLE TEXT (Except in preview) */}
                  <div className={`${activeTab === 'preview' ? 'hidden' : 'lg:col-span-7'} space-y-6`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Type className="w-4 h-4 text-blue-500" /> A generált tartalom
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => setContent(initialContent)} className="p-2 text-slate-400 hover:text-orange-500 transition-colors"><HistoryIcon className="w-4 h-4" /></button>
                        <button onClick={handleCopy} className="p-2 text-slate-400 hover:text-blue-500 transition-colors">{isCopied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}</button>
                      </div>
                    </div>
                    <textarea 
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full h-[400px] bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-[32px] p-8 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-800 dark:text-slate-200 font-medium"
                    />
                  </div>

                  {/* RIGHT SIDE: CONTEXTUAL TOOLS */}
                  <div className={`${activeTab === 'preview' ? 'lg:col-span-12' : 'lg:col-span-5'}`}>
                    
                    {/* TAB: EDIT TOOLS */}
                    {activeTab === 'edit' && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                        <div className="space-y-4">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Gyors műveletek</span>
                          <div className="grid grid-cols-1 gap-3">
                            <button onClick={() => handleMagicEdit('shorten')} disabled={loading} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-100 dark:bg-white/5 hover:bg-blue-600/10 hover:text-blue-600 rounded-2xl font-black text-xs transition-all border border-transparent hover:border-blue-600/20">
                              <Wand2 className="w-4 h-4" /> Rövidebb verzió
                            </button>
                            <button onClick={() => handleMagicEdit('emoji')} disabled={loading} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-100 dark:bg-white/5 hover:bg-blue-600/10 hover:text-blue-600 rounded-2xl font-black text-xs transition-all border border-transparent hover:border-blue-600/20">
                              <Smile className="w-4 h-4" /> Több Emoji hozzáadása
                            </button>
                            <button onClick={() => handleMagicEdit('professional')} disabled={loading} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-100 dark:bg-white/5 hover:bg-blue-600/10 hover:text-blue-600 rounded-2xl font-black text-xs transition-all border border-transparent hover:border-blue-600/20">
                              <Briefcase className="w-4 h-4" /> Legyen professzionálisabb
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-white/5">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Egyedi finomítás</span>
                          <div className="flex gap-3">
                            <input 
                              type="text" value={customPrompt} onChange={(e)=>setCustomPrompt(e.target.value)} 
                              placeholder="Pl: 'Írd át tegeződve'..." 
                              className="flex-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 text-xs outline-none focus:ring-2 focus:ring-blue-500/50 text-white" 
                            />
                            <button onClick={() => handleMagicEdit('custom')} disabled={!customPrompt || loading} className="p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-600/20">
                              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB: IMAGE GENERATION */}
                    {activeTab === 'image' && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                        <button 
                          onClick={handleGenerateImage} 
                          disabled={loadingImage}
                          className={`w-full flex items-center justify-center gap-3 px-6 py-5 rounded-[24px] font-black text-sm transition-all shadow-xl ${imageUrl ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white' : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:scale-[1.02] shadow-green-500/20'}`}
                        >
                          {loadingImage ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImageIcon className="w-6 h-6" />}
                          {imageUrl ? 'Új Vizuál Generálása' : 'AI Fotó Generálása (DALL-E 3)'}
                        </button>

                        <div className="rounded-[32px] overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 aspect-square flex items-center justify-center relative group">
                          {imageUrl ? (
                            <>
                              <img src={imageUrl} alt="AI Generated" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="bg-white text-black px-6 py-3 rounded-2xl font-black text-xs uppercase flex items-center gap-2 shadow-2xl">
                                  <Download className="w-4 h-4" /> Kép letöltése
                                </a>
                              </div>
                            </>
                          ) : (
                            <div className="text-center p-8">
                               <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-600/20">
                                  <ImageIcon className="w-8 h-8 text-blue-500 opacity-40" />
                               </div>
                               <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Nincs generált kép</p>
                            </div>
                          )}
                        </div>

                        {!imageUrl && data.image_prompt && (
                          <div className="p-6 bg-purple-600/5 border border-purple-500/10 rounded-3xl flex items-start gap-4">
                              <Sparkles className="w-6 h-6 text-purple-500 mt-1" />
                              <div>
                                <span className="text-[10px] font-black text-purple-500 uppercase block mb-1">Javasolt vizuális koncepció:</span>
                                <p className="text-xs text-slate-400 italic leading-relaxed">"{data.image_prompt}"</p>
                              </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB: LIVE PREVIEW */}
                    {activeTab === 'preview' && (
                      <div className="flex justify-center animate-in zoom-in-95 duration-500">
                        <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[14px] rounded-[3rem] h-[750px] w-[350px] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden scale-90 md:scale-100">
                          <div className="w-[148px] h-[22px] bg-gray-800 top-0 left-1/2 -translate-x-1/2 absolute rounded-b-[1.5rem] z-20"></div>
                          
                          <div className="h-full w-full bg-white dark:bg-[#12141a] overflow-y-auto pt-10 scrollbar-hide">
                            <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 p-[2px]">
                                <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center text-xs font-black text-blue-500">
                                   {brandName?.charAt(0) || 'CF'}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="h-3 w-28 bg-slate-200 dark:bg-white/10 rounded-full" />
                                <div className="h-2 w-20 bg-slate-100 dark:bg-white/5 rounded-full" />
                              </div>
                            </div>
                            
                            {imageUrl ? (
                              <div className="w-full aspect-square overflow-hidden">
                                 <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-full aspect-square bg-slate-100 dark:bg-slate-900 flex items-center justify-center relative">
                                  <ImageIcon className="w-12 h-12 text-slate-300 dark:text-slate-800" />
                                  <span className="absolute bottom-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Image Placeholder</span>
                              </div>
                            )}

                            <div className="p-8">
                              <p className="text-[14px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-medium">
                                {content}
                              </p>
                            </div>
                            
                            <div className="mt-4 px-8 flex justify-between opacity-30 pb-12">
                              <div className="h-5 w-5 rounded-md bg-slate-400" />
                              <div className="h-5 w-5 rounded-md bg-slate-400" />
                              <div className="h-5 w-5 rounded-md bg-slate-400" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="p-8 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${imageUrl ? 'bg-green-500 animate-pulse shadow-[0_0_15px_#22c55e]' : 'bg-orange-500 shadow-[0_0_15px_#f97316]'}`} />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Státusz: {imageUrl ? 'Publikálásra kész' : 'Vizuál hiányzik'}
                  </span>
                </div>
                
                <div className="flex gap-3 w-full md:w-auto">
                  <button onClick={() => setShowResultModal(false)} className="flex-1 md:flex-none px-8 py-4 bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-white rounded-2xl font-black text-xs uppercase hover:bg-red-500/10 hover:text-red-500 transition-all">
                    Bezárás
                  </button>

                  <button 
                    onClick={handleImmediatePost}
                    disabled={isPosting}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 text-xs font-black uppercase rounded-2xl transition-all shadow-xl ${isPosting ? 'bg-indigo-600/50 text-white cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'}`}
                  >
                    {isPosting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Posztolás...</>
                    ) : (
                      <>⚡ Közzététel Most</>
                    )}
                  </button>

                  <button className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-10 py-4 text-xs font-black uppercase rounded-2xl transition-all shadow-xl ${imageUrl ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30' : 'bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed'}`} disabled={!imageUrl}>
                    🚀 Ütemezés
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}