"use client";
import { useState, useEffect, useRef } from 'react';
import { Lock, Sparkles, Loader2, Calendar, Copy, X, Check, Edit3, Image as ImageIcon, Download, Upload, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
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
  
  // --- VISUAL MODE ---
  const [viewMode, setViewMode] = useState<'text' | 'visual'>('text');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<string[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  
  // --- ÚJ: SAJÁT KÉP FELTÖLTÉS ---
  const [customBgImage, setCustomBgImage] = useState<string | null>(null);

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

  // Carousel logika
  useEffect(() => {
    if (selectedPost && viewMode === 'visual') {
      const generatedSlides = [selectedPost.title];
      
      const sentences = selectedPost.content.split(/(?<=[.!?])\s+/);
      let chunk = "";
      sentences.forEach((sentence) => {
        if ((chunk + sentence).length < 120) { // Kicsit rövidebb szöveg, hogy ráférjen a képre
          chunk += sentence + " ";
        } else {
          generatedSlides.push(chunk);
          chunk = sentence + " ";
        }
      });
      if (chunk) generatedSlides.push(chunk);
      generatedSlides.push(`Kövess minket!\n@${formData.brand || 'Márka'}`);
      
      setSlides(generatedSlides);
      setCurrentSlide(0);
      setCustomBgImage(null); // Reseteljük a képet új poszt nyitásakor
    }
  }, [selectedPost, viewMode, formData.brand]);

  // Képfeltöltés kezelése (Base64 konvertálás a html2canvas miatt)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomBgImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- JAVÍTOTT LETÖLTÉS ---
  const handleDownloadSlide = async () => {
    if (!carouselRef.current) return;
    setDownloading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 200)); // Kis várakozás
      const canvas = await html2canvas(carouselRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true, // Fontos a képekhez
        allowTaint: true,
      });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `${formData.brand}_post_${currentSlide + 1}.png`;
      link.click();
    } catch (err) {
      console.error(err);
      alert("Hiba a letöltéskor. Próbáld újra.");
    } finally {
      setDownloading(false);
    }
  };

  const isPro = userPlan !== 'free';
  const mockDays = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek"];
  
  const tones = [
    { id: 'professional', label: '👔 Professzionális', value: 'Professzionális' },
    { id: 'funny', label: '😂 Humoros', value: 'Humoros' },
    { id: 'provocative', label: '🔥 Provokatív', value: 'Provokatív' },
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

      {/* INPUT */}
      <div className="mb-10 bg-slate-900/40 p-6 rounded-2xl border border-white/5 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <input 
            placeholder="Márka neve" 
            className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none text-white"
            value={formData.brand}
            onChange={(e) => setFormData({...formData, brand: e.target.value})}
          />
          <input 
            placeholder="Célközönség" 
            className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none text-white"
            value={formData.audience}
            onChange={(e) => setFormData({...formData, audience: e.target.value})}
          />
          <input 
            placeholder="Téma" 
            className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none text-white"
            value={formData.topic}
            onChange={(e) => setFormData({...formData, topic: e.target.value})}
          />
          <div className="relative">
            <select 
              className="w-full appearance-none bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none text-white cursor-pointer"
              value={formData.tone}
              onChange={(e) => setFormData({...formData, tone: e.target.value})}
            >
              {tones.map((t) => <option key={t.id} value={t.value} className="bg-slate-900">{t.label}</option>)}
            </select>
          </div>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={generating || !isPro}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
        >
          {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5" /> Generálás</>}
        </button>
      </div>
      
      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative min-h-[300px]">
        {/* ... (Pro check rész maradhat ugyanaz) ... */}
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
            <div key={day} className={`p-5 rounded-2xl border border-slate-800 bg-slate-900/30 ${!isPro ? 'blur-sm select-none' : ''}`}><span className="text-slate-600 font-bold text-[10px] uppercase tracking-widest">{day}</span></div>
          ))
        )}
      </div>

      {/* --- EDIT MODAL --- */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedPost(null)} />
          
          <div className="relative w-full max-w-4xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-slate-900 z-10">
              <div className="flex items-center gap-6">
                 <div>
                    <span className="text-blue-500 font-bold uppercase tracking-widest text-xs">{selectedPost.day}</span>
                    <h3 className="text-xl font-bold text-white max-w-xs truncate">{selectedPost.title}</h3>
                 </div>
                 
                 <div className="flex bg-slate-800 p-1 rounded-lg">
                    <button onClick={() => setViewMode('text')} className={`px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'text' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'}`}>
                      <Edit3 className="w-4 h-4" /> Szöveg
                    </button>
                    <button onClick={() => setViewMode('visual')} className={`px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'visual' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                      <ImageIcon className="w-4 h-4" /> Poszt Dizájn
                    </button>
                 </div>
              </div>
              <button onClick={() => setSelectedPost(null)} className="p-2 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950 relative">
              
              {/* TEXT MODE */}
              {viewMode === 'text' && (
                <div className="p-8">
                   <div className="mb-6 bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                    <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Stratégia</label>
                    <p className="text-sm text-slate-300 italic">{selectedPost.outline}</p>
                   </div>
                   <textarea 
                    className="w-full h-96 bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-200 focus:border-blue-500 outline-none resize-none leading-relaxed font-mono text-sm shadow-inner"
                    value={selectedPost.content}
                    onChange={(e) => setSelectedPost({...selectedPost, content: e.target.value})}
                   />
                </div>
              )}

              {/* VISUAL MODE - SAJÁT FOTÓVAL */}
              {viewMode === 'visual' && (
                <div className="p-8 flex flex-col items-center justify-center min-h-[500px]">
                  
                  {/* VEZÉRLŐPULT */}
                  <div className="mb-6 flex gap-4">
                     <label className="cursor-pointer px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold flex items-center gap-2 transition-all border border-white/10">
                        <Upload className="w-4 h-4" /> Saját Fotó Feltöltése
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                     </label>
                     {customBgImage && (
                        <button onClick={() => setCustomBgImage(null)} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
                           <Trash2 className="w-4 h-4" /> Fotó Törlése
                        </button>
                     )}
                  </div>

                  {/* PREVIEW AREA (EZT FOTÓZZUK LE) */}
                  <div className="relative shadow-2xl shadow-blue-900/20 mb-8">
                    <div 
                      ref={carouselRef}
                      // JAVÍTÁS: Kivettem a 'border-white/10' Tailwind osztályt!
                      className="w-[400px] h-[500px] flex flex-col p-8 relative overflow-hidden"
                      style={{ 
                        // Háttér és Keret: Biztonságos HEX/RGBA kódok
                        backgroundColor: '#0f172a', 
                        backgroundImage: customBgImage ? `url(${customBgImage})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        fontFamily: 'sans-serif',
                        border: '1px solid rgba(255, 255, 255, 0.1)' // Tailwind helyett manualis border
                      }}
                    >
                      {/* SÖTÉTÍTŐ RÉTEG */}
                      {customBgImage && (
                        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
                      )}

                      {/* DEKORÁCIÓ (Csak ha nincs saját fotó) */}
                      {!customBgImage && (
                        <>
                          <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10" style={{ background: '#1e3a8a' }}/>
                          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl -ml-10 -mb-10" style={{ background: '#312e81' }}/>
                        </>
                      )}

                      {/* Header */}
                      <div className="relative z-10 flex items-center gap-2 mb-6">
                         {/* JAVÍTÁS: bg-white/10 helyett rgba */}
                         <div className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                            {/* JAVÍTÁS: text-blue-400 helyett hex kód */}
                            <Sparkles className="w-4 h-4" style={{ color: '#60a5fa' }} />
                         </div>
                         <span className="font-bold text-xs uppercase tracking-widest" style={{ color: '#e2e8f0' }}>
                            {formData.brand || 'BRAND'}
                         </span>
                      </div>

                      {/* CONTENT */}
                      <div className="relative z-10 flex-1 flex flex-col justify-center">
                        {currentSlide === 0 ? (
                           <h1 className="text-3xl font-black leading-tight drop-shadow-lg" style={{ color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                             {slides[0]}
                           </h1>
                        ) : (
                           <p className="text-xl font-medium leading-relaxed whitespace-pre-wrap drop-shadow-md" style={{ color: '#f8fafc', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                             {slides[currentSlide]}
                           </p>
                        )}
                      </div>

                      {/* Pagination */}
                      <div className="relative z-10 mt-6 flex justify-between items-center pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                        <span className="text-xs" style={{ color: '#cbd5e1' }}>Lapozz tovább 👉</span>
                        <div className="flex gap-1">
                          {slides.map((_, idx) => (
                            <div 
                              key={idx} 
                              className="h-1 rounded-full transition-all"
                              style={{ 
                                width: idx === currentSlide ? '24px' : '4px',
                                background: idx === currentSlide ? '#60a5fa' : '#475569'
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* VEZÉRLŐK (Ezek maradnak Tailwindesek, mert nem kerülnek a fotóra) */}
                  <div className="flex items-center gap-6">
                    <button onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0} className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 border border-white/5">
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <span className="font-mono font-bold text-slate-400">{currentSlide + 1} / {slides.length}</span>
                    <button onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1} className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 border border-white/5">
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-slate-900/50 flex justify-end gap-3 z-10">
               {viewMode === 'text' ? (
                 <button onClick={handleCopy} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${isCopied ? 'bg-green-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
                   {isCopied ? <><Check className="w-4 h-4" /> Másolva</> : <><Copy className="w-4 h-4" /> Szöveg Másolása</>}
                 </button>
               ) : (
                 <button onClick={handleDownloadSlide} disabled={downloading} className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 shadow-lg">
                   {downloading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />} Letöltés
                 </button>
               )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}