"use client";
import { ModulePageHeader } from "@/app/components/platform/ModulePageHeader";
import { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Type, Zap, Copy, History as HistoryIcon, Send, Search, Image as ImageIcon, Globe, CheckCircle2, Download, Loader2, X,
  Wand2, Smile, Briefcase, Eye, Layout, Edit3, Target
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

      if (data.error) {
        alert(data.error);
      } else {
        const { __agent, ...platformResults } = data; // <-- itt kivesszük
        setResults(platformResults);                  // csak platformok mennek a UI-ba

        // opcionális: ha később ki akarod írni a score-t
        if (__agent) {
          console.log("Agent score:", __agent.score);
        }
      }
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
      <ModulePageHeader moduleId="content" className="mb-2" />
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2 uppercase italic">
            ContentFactory <span className="text-blue-600">Studio</span>
          </h1>
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
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState(data.text || data);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'image' | 'preview'>('edit');
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentResult, setAgentResult] = useState<{ score: number, critique: string, suggestions: string[] } | null>(null);

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

  const handleAgentAnalysis = async () => {
    setAgentLoading(true);
    try {
      const res = await fetch('/api/agent-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content,
          platform: title,
          brandName: brandName
        })
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      setAgentResult(data);
    } catch (error) {
      console.error(error);
      alert("Hiba történt az elemzés során. Lehet, hogy a poszt túl rövid.");
    } finally {
      setAgentLoading(false);
    }
  };

  const handleAutoImprove = async () => {
    if (!agentResult) return;
    setAgentLoading(true);
    
    try {
      const res = await fetch('/api/improve-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content,
          critique: agentResult.critique,
          suggestions: agentResult.suggestions
        })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setContent(data.updatedText); // Kicseréljük a szöveget a feljavítottra
      setAgentResult(null); // Eltüntetjük a kártyát, hogy újra lehessen elemezni
      alert("✨ A poszt sikeresen feljavítva az AI javaslatai alapján!");
      
    } catch (error) {
      console.error(error);
      alert("Hiba történt a poszt feljavításakor.");
    } finally {
      setAgentLoading(false);
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

  const handleSchedulePost = async () => {
    if (!imageUrl) {
      alert("Kérlek, először véglegesíts egy képet!");
      return;
    }
    if (!scheduleDate) {
      alert("Kérlek, válassz egy dátumot és időpontot!");
      return;
    }

    // Átalakítjuk a naptár dátumát Unix Timestamp-re (másodpercekre), amit az Upstash kér
    const scheduledTimeUnix = Math.floor(new Date(scheduleDate).getTime() / 1000);
    const currentTimeUnix = Math.floor(Date.now() / 1000);

    if (scheduledTimeUnix <= currentTimeUnix) {
      alert("A kiválasztott időpontnak a jövőben kell lennie!");
      return;
    }

    setIsScheduling(true);
    try {
      const res = await fetch('/api/schedule-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageUrl: imageUrl, 
          caption: content,
          scheduledTime: scheduledTimeUnix
        }),
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || "Hiba történt az ütemezés során.");
      }

      alert("📅 SIKER! A poszt bekerült az ütemezőbe, és a megadott időpontban kikerül az Instagramra!");
      setShowScheduler(false);
      setShowResultModal(false); // Bezárjuk az egész ablakot
      
    } catch (error: any) {
      console.error(error);
      alert("❌ Sikertelen ütemezés:\n" + error.message);
    } finally {
      setIsScheduling(false);
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
    if (availableImages.length >= 3) { alert("Maximum 3 képet tárolhatsz! Válassz egyet!"); return; }
    setLoadingImage(true);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: data.image_prompt || content, platform: title, brandName: brandName }),
      });
      const resData = await res.json();
      if (resData.imageUrl) {
        setAvailableImages(prev => [...prev, resData.imageUrl]); // Hozzáadás a galériához
      }
    } catch (e) { console.error(e); }
    setLoadingImage(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (availableImages.length >= 3) { alert("Maximum 3 képet adhatsz hozzá!"); return; }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `upload-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error } = await supabase.storage.from('generated-images').upload(fileName, file);
      if (error) throw error;

      const { data: publicUrlData } = supabase.storage.from('generated-images').getPublicUrl(fileName);
      setAvailableImages(prev => [...prev, publicUrlData.publicUrl]); // Hozzáadás a galériához
    } catch (error) {
      console.error(error); alert("Hiba történt a kép feltöltésekor.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // Input törlése
    }
  };

  const handleFinalizeImage = async () => {
    if (selectedImageIndex === null) return;
    const finalUrl = availableImages[selectedImageIndex];
    setImageUrl(finalUrl); // Beállítjuk véglegesnek (ez oldja fel a Live Preview-t és a posztolást)
    
    // Most mentjük az adatbázisba!
    await saveToHistory(finalUrl);
    alert("✅ Kép sikeresen kiválasztva és a kampány elmentve!");
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

                        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-white/5">
                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block flex items-center gap-2">
                            <Globe className="w-3 h-3" /> Valós idejű Webes Elemzés
                          </span>
                          
                          {!agentResult ? (
                            <button 
                              onClick={handleAgentAnalysis} 
                              disabled={agentLoading} 
                              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs transition-all shadow-lg shadow-indigo-600/20"
                            >
                              {agentLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 text-yellow-300" />}
                              {agentLoading ? "A web átkutatása folyamatban..." : "Viral Score Elemzés (Élő Adatok)"}
                            </button>
                          ) : (
                            <div className="bg-slate-100 dark:bg-[#151b2b] border border-slate-200 dark:border-white/10 rounded-3xl p-6 space-y-5 relative overflow-hidden shadow-inner">
                               {/* Színes sáv a pontszám alapján */}
                               <div className={`absolute top-0 left-0 w-1.5 h-full ${agentResult.score >= 80 ? 'bg-green-500' : agentResult.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                               
                               <div className="flex items-center justify-between">
                                 <span className="font-black uppercase text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                   <Target className="w-4 h-4" /> Viral Score
                                 </span>
                                 <div className={`px-4 py-1.5 rounded-full font-black text-xl shadow-lg ${agentResult.score >= 80 ? 'bg-green-500/10 text-green-500' : agentResult.score >= 60 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {agentResult.score}/100
                                 </div>
                               </div>
                               
                               <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed italic border-l-2 border-slate-300 dark:border-slate-700 pl-4">
                                 "{agentResult.critique}"
                               </p>
                               
                               <div className="space-y-3">
                                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Adatalapú Javaslatok:</span>
                                 {agentResult.suggestions.map((sugg: string, idx: number) => (
                                   <div key={idx} className="flex gap-3 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-black/40 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5">
                                     <CheckCircle2 className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                                     <span className="leading-relaxed font-medium">{sugg}</span>
                                   </div>
                                 ))}
                               </div>
                               
                               <div className="flex flex-col gap-2 mt-6">
                                 <button 
                                   onClick={handleAutoImprove}
                                   disabled={agentLoading}
                                   className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl font-black text-xs uppercase transition-all shadow-lg shadow-green-500/30"
                                 >
                                   {agentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                   ✨ Javítsd fel a javaslatok alapján!
                                 </button>
                                 
                                 <button 
                                   onClick={() => setAgentResult(null)} 
                                   disabled={agentLoading}
                                   className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                 >
                                   Elvetés és Újraelemzés
                                 </button>
                               </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB: IMAGE GENERATION & UPLOAD */}
                    {activeTab === 'image' && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                        
                        {/* Felső gombok: Generálás vagy Feltöltés */}
                        <div className="grid grid-cols-2 gap-4">
                          <button 
                            onClick={handleGenerateImage} 
                            disabled={loadingImage || availableImages.length >= 3}
                            className={`flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-black text-xs transition-all shadow-lg ${availableImages.length >= 3 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.02] text-white shadow-blue-500/20'}`}
                          >
                            {loadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                            AI Generálás
                          </button>
                          
                          <button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={uploadingImage || availableImages.length >= 3}
                            className={`flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-black text-xs transition-all shadow-lg ${availableImages.length >= 3 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-white hover:text-blue-500'}`}
                          >
                            {uploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                            Saját Kép Feltöltése
                          </button>
                          {/* Rejtett fájlfeltöltő */}
                          <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={handleFileUpload} />
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kép galéria (Max 3)</span>
                          <span className="text-xs font-bold text-slate-400">{availableImages.length} / 3</span>
                        </div>

                        {/* Kép Galéria Rács (3 hely) */}
                        <div className="grid grid-cols-3 gap-4">
                          {[0, 1, 2].map((index) => {
                            const img = availableImages[index];
                            return img ? (
                              <div 
                                key={index} 
                                onClick={() => setSelectedImageIndex(index)}
                                className={`relative aspect-square rounded-2xl overflow-hidden cursor-pointer border-4 transition-all ${selectedImageIndex === index ? 'border-blue-500 scale-105 shadow-[0_0_20px_rgba(59,130,246,0.5)]' : 'border-transparent hover:border-slate-300'}`}
                              >
                                <img src={img} alt={`Gallery ${index}`} className="w-full h-full object-cover" />
                                {selectedImageIndex === index && (
                                  <div className="absolute top-2 right-2 bg-blue-500 text-white p-1 rounded-full shadow-lg">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div key={index} className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex flex-col items-center justify-center opacity-50">
                                <ImageIcon className="w-6 h-6 text-slate-300 mb-2" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Üres hely</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Véglegesítés Gomb */}
                        <AnimatePresence>
                          {selectedImageIndex !== null && (
                            <motion.button
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                              onClick={handleFinalizeImage}
                              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-green-500/30 mt-6"
                            >
                              <CheckCircle2 className="w-5 h-5" /> Ezt a képet választom a poszthoz!
                            </motion.button>
                          )}
                        </AnimatePresence>

                        {/* Promt javaslat, ha még nincs kép */}
                        {availableImages.length === 0 && data.image_prompt && (
                          <div className="p-6 bg-purple-600/5 border border-purple-500/10 rounded-3xl flex items-start gap-4 mt-4">
                              <Sparkles className="w-6 h-6 text-purple-500 mt-1" />
                              <div>
                                <span className="text-[10px] font-black text-purple-500 uppercase block mb-1">AI javasolt koncepciója:</span>
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
                
                {/* Ha NEM mutatjuk a naptárat, akkor az alap gombok látszanak */}
                {!showScheduler ? (
                  <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={() => setShowResultModal(false)} className="flex-1 md:flex-none px-8 py-4 bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-white rounded-2xl font-black text-xs uppercase hover:bg-red-500/10 hover:text-red-500 transition-all">
                      Bezárás
                    </button>

                    <button 
                      onClick={handleImmediatePost}
                      disabled={isPosting || !imageUrl}
                      className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 text-xs font-black uppercase rounded-2xl transition-all shadow-xl ${isPosting ? 'bg-indigo-600/50 text-white cursor-not-allowed' : !imageUrl ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'}`}
                    >
                      {isPosting ? <><Loader2 className="w-4 h-4 animate-spin" /> Posztolás...</> : <>⚡ Közzététel Most</>}
                    </button>

                    <button 
                      onClick={() => setShowScheduler(true)} 
                      disabled={!imageUrl}
                      className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-10 py-4 text-xs font-black uppercase rounded-2xl transition-all shadow-xl ${imageUrl ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30' : 'bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed'}`} 
                    >
                      🚀 Ütemezés
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto bg-white dark:bg-slate-800 p-3 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-4">
                    <input 
                      type="datetime-local" 
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="px-5 py-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                    />
                    
                    <button 
                      onClick={handleSchedulePost}
                      disabled={isScheduling}
                      className={`flex items-center justify-center gap-2 px-8 py-3 text-xs font-black uppercase rounded-2xl transition-all text-white ${isScheduling ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/30'}`}
                    >
                      {isScheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Jóváhagyás"}
                    </button>
                    
                    <button 
                      onClick={() => setShowScheduler(false)}
                      className="px-4 py-3 text-slate-400 hover:text-red-500 transition-colors font-bold text-xs uppercase"
                    >
                      Mégse
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}