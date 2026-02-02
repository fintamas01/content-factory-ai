"use client";
import { useState, useEffect, useRef } from 'react';
import { Lock, Sparkles, Loader2, Calendar, Copy, X, Check, Edit3, Image as ImageIcon, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import html2canvas from 'html2canvas';

interface MatrixItem {
  day: string;
  title: string;
  platform: string;
  outline: string;
  content: string;
}

export default function ContentMatrix() {
  const [userPlan, setUserPlan] = useState('free');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // Modal állapotok
  const [selectedPost, setSelectedPost] = useState<MatrixItem | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  // --- ÚJ: VISUAL MODE ÁLLAPOTOK ---
  const [viewMode, setViewMode] = useState<'text' | 'visual'>('text');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<string[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const [matrixData, setMatrixData] = useState<MatrixItem[]>([]);
  const [formData, setFormData] = useState({ brand: '', audience: '', topic: '', tone: 'Professzionális' });
  
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
  );

  useEffect(() => {
    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('price_id, status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        
        if (sub?.price_id) setUserPlan('pro'); 
        else setUserPlan('free');
      }
      setLoading(false);
    }
    getUserData();
  }, [supabase]);

  // --- ÚJ: SLIDE GENERÁLÓ LOGIKA ---
  useEffect(() => {
    if (selectedPost && viewMode === 'visual') {
      // 1. Dia: Cím
      const generatedSlides = [selectedPost.title];
      
      // 2-X. Dia: Tartalom szétszedése (mondatonként/szakaszonként)
      // Egyszerű logika: felbontjuk . ! ? mentén, de összefűzzük, ha túl rövid
      const sentences = selectedPost.content.split(/(?<=[.!?])\s+/);
      let chunk = "";
      
      sentences.forEach((sentence) => {
        if ((chunk + sentence).length < 150) {
          chunk += sentence + " ";
        } else {
          generatedSlides.push(chunk);
          chunk = sentence + " ";
        }
      });
      if (chunk) generatedSlides.push(chunk);

      // Utolsó Dia: CTA
      generatedSlides.push(`Kövess minket további tartalmakért!\n@${formData.brand || 'Márkanév'}`);
      
      setSlides(generatedSlides);
      setCurrentSlide(0);
    }
  }, [selectedPost, viewMode, formData.brand]);

  const handleDownloadSlide = async () => {
    if (!carouselRef.current) return;
    setDownloading(true);
    
    try {
      // Várunk egy picit, hogy a renderelés biztosan kész legyen
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(carouselRef.current, {
        scale: 2, // Nagy felbontás
        backgroundColor: null, // Átlátszó háttér kezelése
        useCORS: true, // Képek/Ikonok biztonsági kezelése
        logging: true, // Hiba esetén többet látunk a konzolon
        allowTaint: true,
      });

      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `${formData.brand}_slide_${currentSlide + 1}.png`;
      link.click();
    } catch (err) {
      console.error("Letöltési hiba részletei:", err); // Itt látni fogjuk a pontos bajt
      alert("Hiba történt a kép generálásakor. Nyisd meg a konzolt (F12) a részletekért.");
    } finally {
      setDownloading(false);
    }
  };

  const isPro = userPlan !== 'free';
  const mockDays = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek"];
  
  const tones = [
    { id: 'professional', label: '👔 Professzionális', value: 'Professzionális, szakértői és hiteles' },
    { id: 'funny', label: '😂 Humoros / Laza', value: 'Humoros, laza, tele szlenggel és emojikkal' },
    { id: 'provocative', label: '🔥 Provokatív', value: 'Megosztó, vitaindító, figyelemfelkeltő' },
    { id: 'educational', label: '📚 Oktató', value: 'Tényszerű, segítőkész, "hogyan csináld" stílus' },
    { id: 'emotional', label: '❤️ Érzelmes', value: 'Személyes történetmesélő, inspiráló, érzelmes' },
  ];

  const handleGenerate = async () => {
    if (!formData.brand || !formData.topic) {
      alert("Kérlek töltsd ki a márka nevét és a témát!");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/matrix/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      
      // DEBUG HIBAKEZELÉS
      if (data.debug_error) {
         console.warn("API Figyelmeztetés:", data.debug_error);
      }

      setMatrixData(data.days || []);
    } catch (error) {
      console.error(error);
      alert("Hiba történt a generálás során.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (selectedPost) {
      navigator.clipboard.writeText(selectedPost.content || selectedPost.outline);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500"/></div>;

  return (
    <div className="p-6 md:p-8 bg-slate-950 min-h-screen text-white font-sans relative">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 tracking-tight">
            <Calendar className="text-blue-500" /> Smart Content Matrix
          </h1>
          <p className="text-slate-400 mt-1">Heti stratégia és kész posztok egy kattintással.</p>
        </div>
        
        {isPro && (
          <div className="bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-full flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Pro Aktív</span>
          </div>
        )}
      </div>

      {/* INPUT MEZŐK */}
      <div className="mb-10 bg-slate-900/40 p-6 rounded-2xl border border-white/5 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <input 
            placeholder="Márka neve (pl. ContentFactory)" 
            className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 text-white"
            value={formData.brand}
            onChange={(e) => setFormData({...formData, brand: e.target.value})}
          />
          <input 
            placeholder="Célközönség" 
            className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 text-white"
            value={formData.audience}
            onChange={(e) => setFormData({...formData, audience: e.target.value})}
          />
          <input 
            placeholder="Téma" 
            className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 text-white"
            value={formData.topic}
            onChange={(e) => setFormData({...formData, topic: e.target.value})}
          />
          
          <div className="relative">
            <select 
              className="w-full appearance-none bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none transition-all text-white cursor-pointer"
              value={formData.tone}
              onChange={(e) => setFormData({...formData, tone: e.target.value})}
            >
              {tones.map((t) => (
                <option key={t.id} value={t.value} className="bg-slate-900">{t.label}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={generating || !isPro}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20"
        >
          {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5" /> Stratégia Generálás</>}
        </button>
      </div>
      
      {/* MÁTRIX GRID */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative min-h-[300px]">
        {!isPro && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm rounded-2xl border border-white/10">
            <div className="bg-slate-900 p-8 rounded-3xl border border-white/10 shadow-2xl text-center max-w-sm">
              <Lock className="w-12 h-12 text-blue-500 mb-4 mx-auto" />
              <h2 className="text-2xl font-bold mb-2">Pro Funkció</h2>
              <button onClick={() => router.push('/billing')} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold mt-4">Upgrade Most</button>
            </div>
          </div>
        )}

        {matrixData.length > 0 ? (
          matrixData.map((item, index) => (
            <div 
              key={index} 
              onClick={() => { setSelectedPost(item); setViewMode('text'); }}
              className="group cursor-pointer p-5 rounded-2xl border border-white/5 bg-slate-900 hover:border-blue-500/50 hover:bg-slate-800 transition-all flex flex-col h-full relative overflow-hidden"
            >
              <div className="flex justify-between items-center mb-4">
                <span className="text-blue-400 font-bold uppercase text-[10px] tracking-widest">{item.day}</span>
                <span className="bg-white/5 text-[10px] px-2 py-1 rounded text-slate-300 font-medium">{item.platform}</span>
              </div>
              <h3 className="text-sm font-bold mb-3 leading-tight text-white group-hover:text-blue-200">{item.title}</h3>
              <p className="text-xs text-slate-400 line-clamp-4 mb-4">{item.outline}</p>
              <div className="mt-auto flex items-center gap-2 text-xs font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                <Edit3 className="w-3 h-3" /> Szerkesztés
              </div>
            </div>
          ))
        ) : (
          mockDays.map((day) => (
            <div key={day} className={`p-5 rounded-2xl border border-slate-800 bg-slate-900/30 ${!isPro ? 'blur-sm select-none' : ''}`}>
              <span className="text-slate-600 font-bold text-[10px] uppercase tracking-widest">{day}</span>
              <div className="mt-4 space-y-3">
                <div className="h-2 w-full bg-slate-800 rounded animate-pulse" />
                <div className="h-2 w-3/4 bg-slate-800 rounded animate-pulse" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- EDIT MODAL (Text & Visual) --- */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedPost(null)} />
          
          <div className="relative w-full max-w-4xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* Modal Header & Tabs */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-slate-900 z-10">
              <div className="flex items-center gap-6">
                 <div>
                    <span className="text-blue-500 font-bold uppercase tracking-widest text-xs">{selectedPost.day}</span>
                    <h3 className="text-xl font-bold text-white max-w-xs truncate">{selectedPost.title}</h3>
                 </div>
                 
                 {/* VIEW SWITCHER */}
                 <div className="flex bg-slate-800 p-1 rounded-lg">
                    <button 
                      onClick={() => setViewMode('text')}
                      className={`px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'text' ? 'bg-white text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                      <Edit3 className="w-4 h-4" /> Szöveg
                    </button>
                    <button 
                      onClick={() => setViewMode('visual')}
                      className={`px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'visual' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                      <ImageIcon className="w-4 h-4" /> Képes Poszt
                    </button>
                 </div>
              </div>
              <button onClick={() => setSelectedPost(null)} className="p-2 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Modal Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950 relative">
              
              {/* --- 1. TEXT MODE --- */}
              {viewMode === 'text' && (
                <div className="p-8">
                   <div className="mb-6 bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                    <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Stratégia</label>
                    <p className="text-sm text-slate-300 italic">{selectedPost.outline}</p>
                   </div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Poszt Szövege</label>
                   <textarea 
                    className="w-full h-96 bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-200 focus:border-blue-500 outline-none resize-none leading-relaxed font-mono text-sm shadow-inner"
                    value={selectedPost.content}
                    onChange={(e) => setSelectedPost({...selectedPost, content: e.target.value})}
                   />
                </div>
              )}

              {/* --- 2. VISUAL MODE (CAROUSEL GENERATOR) --- */}
              {viewMode === 'visual' && (
                <div className="p-8 flex flex-col items-center justify-center min-h-[500px]">
                  
                  {/* CAROUSEL PREVIEW AREA (Ez lesz lefotózva) */}
                  <div className="relative shadow-2xl shadow-blue-900/20 mb-8">
                    <div 
                      ref={carouselRef}
                      className="w-[400px] h-[500px] border border-white/10 flex flex-col p-8 relative overflow-hidden"
                      // JAVÍTÁS: Inline stílus HEX kódokkal (ezt biztosan érti a html2canvas)
                      style={{ 
                        background: 'linear-gradient(135deg, #0f172a 0%, #172554 100%)',
                        fontFamily: 'sans-serif' 
                      }}
                    >
                      {/* Háttér Díszítés (Blobok) - Szintén konkrét RGBA színekkel */}
                      <div 
                        className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10" 
                        style={{ background: 'rgba(59, 130, 246, 0.2)' }}
                      />
                      <div 
                        className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl -ml-10 -mb-10" 
                        style={{ background: 'rgba(99, 102, 241, 0.2)' }}
                      />

                      {/* Header */}
                      <div className="relative z-10 flex items-center gap-2 mb-6">
                         <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-blue-400" />
                         </div>
                         {/* A szöveg színét is explicit megadjuk */}
                         <span className="font-bold text-xs uppercase tracking-widest" style={{ color: '#94a3b8' }}>
                            {formData.brand || 'BRAND'}
                         </span>
                      </div>

                      {/* CONTENT */}
                      <div className="relative z-10 flex-1 flex flex-col justify-center">
                        {currentSlide === 0 ? (
                           // TITLE SLIDE
                           <h1 className="text-3xl font-black leading-tight drop-shadow-lg" style={{ color: '#ffffff' }}>
                             {slides[0]}
                           </h1>
                        ) : (
                           // CONTENT SLIDE
                           <p className="text-xl font-medium leading-relaxed whitespace-pre-wrap" style={{ color: '#f1f5f9' }}>
                             {slides[currentSlide]}
                           </p>
                        )}
                      </div>

                      {/* Footer / Pagination */}
                      <div className="relative z-10 mt-6 flex justify-between items-center border-t border-white/10 pt-4">
                        <span className="text-xs" style={{ color: '#64748b' }}>Lapozz tovább 👉</span>
                        <div className="flex gap-1">
                          {slides.map((_, idx) => (
                            <div 
                              key={idx} 
                              className={`h-1 rounded-full transition-all`}
                              // Itt is inline style-t használunk a biztonság kedvéért
                              style={{ 
                                width: idx === currentSlide ? '24px' : '4px',
                                background: idx === currentSlide ? '#3b82f6' : '#334155'
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CONTROLS (Ez maradhat változatlan, mert nem kerül a képre) */}
                  <div className="flex items-center gap-6">
                    <button 
                      onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                      disabled={currentSlide === 0}
                      className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 transition-all"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    
                    <span className="font-mono font-bold text-slate-400">{currentSlide + 1} / {slides.length}</span>

                    <button 
                      onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
                      disabled={currentSlide === slides.length - 1}
                      className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 transition-all"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>

                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/5 bg-slate-900/50 flex justify-end gap-3 z-10">
               {viewMode === 'text' ? (
                 <button 
                   onClick={handleCopy}
                   className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${isCopied ? 'bg-green-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
                 >
                   {isCopied ? <><Check className="w-4 h-4" /> Másolva</> : <><Copy className="w-4 h-4" /> Szöveg Másolása</>}
                 </button>
               ) : (
                 <button 
                   onClick={handleDownloadSlide}
                   disabled={downloading}
                   className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
                 >
                   {downloading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />}
                   Aktuális Dia Letöltése
                 </button>
               )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}