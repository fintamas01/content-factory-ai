"use client";
import { useState, useEffect } from 'react';
import { Lock, Sparkles, Loader2, Calendar, Copy, X, Check, Edit3, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

interface MatrixItem {
  day: string;
  title: string;
  platform: string;
  outline: string;
  content: string; // Új mező a teljes szövegnek!
}

export default function ContentMatrix() {
  const [userPlan, setUserPlan] = useState('free');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // Modal állapotok
  const [selectedPost, setSelectedPost] = useState<MatrixItem | null>(null);
  const [isCopied, setIsCopied] = useState(false);

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
        
        // Itt cseréld ki a saját Price ID-idra a .env-ből vagy a plan-limits-ből!
        // Egyszerűsítve: ha van price_id, akkor nem free.
        if (sub?.price_id) setUserPlan('pro'); 
        else setUserPlan('free');
      }
      setLoading(false);
    }
    getUserData();
  }, [supabase]);

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

      if (res.status === 403) {
        alert("Elérted a havi limitedet! Válts nagyobb csomagra.");
        router.push('/billing');
        return;
      }

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

      {/* INPUT MEZŐK - Most már Tone of Voice választóval */}
      <div className="mb-10 bg-slate-900/40 p-6 rounded-2xl border border-white/5 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <input 
            placeholder="Márka neve (pl. ContentFactory)" 
            className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 text-white"
            value={formData.brand}
            onChange={(e) => setFormData({...formData, brand: e.target.value})}
          />
          <input 
            placeholder="Célközönség (pl. Marketingesek)" 
            className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 text-white"
            value={formData.audience}
            onChange={(e) => setFormData({...formData, audience: e.target.value})}
          />
          <input 
            placeholder="Téma (pl. Fekete Péntek)" 
            className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 text-white"
            value={formData.topic}
            onChange={(e) => setFormData({...formData, topic: e.target.value})}
          />
          
          {/* TONE OF VOICE SELECTOR */}
          <div className="relative">
            <select 
              className="w-full appearance-none bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none transition-all text-white cursor-pointer"
              value={formData.tone}
              onChange={(e) => setFormData({...formData, tone: e.target.value})}
            >
              {tones.map((t) => (
                <option key={t.id} value={t.value} className="bg-slate-900">
                  {t.label}
                </option>
              ))}
            </select>
            {/* Kis nyíl ikon a select végére */}
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
        
        {/* PAYWALL (Ha nincs Pro) */}
        {!isPro && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm rounded-2xl border border-white/10">
            <div className="bg-slate-900 p-8 rounded-3xl border border-white/10 shadow-2xl text-center max-w-sm">
              <Lock className="w-12 h-12 text-blue-500 mb-4 mx-auto" />
              <h2 className="text-2xl font-bold mb-2">Pro Funkció</h2>
              <p className="text-slate-400 mb-6 text-sm">
                Generálj komplett heti terveket és kész posztokat másodpercek alatt.
              </p>
              <button 
                onClick={() => router.push('/billing')} 
                className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold transition-all"
              >
                Upgrade Most
              </button>
            </div>
          </div>
        )}

        {/* KÁRTYÁK */}
        {matrixData.length > 0 ? (
          matrixData.map((item, index) => (
            <div 
              key={index} 
              onClick={() => setSelectedPost(item)}
              className="group cursor-pointer p-5 rounded-2xl border border-white/5 bg-slate-900 hover:border-blue-500/50 hover:bg-slate-800 transition-all flex flex-col h-full relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="flex justify-between items-center mb-4">
                <span className="text-blue-400 font-bold uppercase text-[10px] tracking-widest">{item.day}</span>
                <span className="bg-white/5 text-[10px] px-2 py-1 rounded text-slate-300 font-medium">{item.platform}</span>
              </div>
              
              <h3 className="text-sm font-bold mb-3 leading-tight text-white group-hover:text-blue-200 transition-colors">{item.title}</h3>
              <p className="text-xs text-slate-400 line-clamp-4 mb-4">{item.outline}</p>
              
              <div className="mt-auto flex items-center gap-2 text-xs font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0 duration-300">
                <Edit3 className="w-3 h-3" /> Szerkesztés
              </div>
            </div>
          ))
        ) : (
          // Üres állapot (Skeleton)
          mockDays.map((day) => (
            <div key={day} className={`p-5 rounded-2xl border border-slate-800 bg-slate-900/30 ${!isPro ? 'blur-sm select-none' : ''}`}>
              <span className="text-slate-600 font-bold text-[10px] uppercase tracking-widest">{day}</span>
              <div className="mt-4 space-y-3">
                <div className="h-2 w-full bg-slate-800 rounded animate-pulse" />
                <div className="h-2 w-3/4 bg-slate-800 rounded animate-pulse" />
                <div className="h-20 w-full bg-slate-800/50 rounded-lg mt-4" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- EDIT MODAL (Szerkesztő Ablak) --- */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Háttér sötétítés */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedPost(null)} 
          />
          
          {/* Modal Doboz */}
          <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            
            {/* Fejléc */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div>
                <div className="flex items-center gap-3 mb-1">
                    <span className="text-blue-500 font-bold uppercase tracking-widest text-xs">{selectedPost.day}</span>
                    <span className="text-slate-500 text-xs">•</span>
                    <span className="text-slate-400 text-xs uppercase">{selectedPost.platform}</span>
                </div>
                <h3 className="text-xl font-bold text-white">{selectedPost.title}</h3>
              </div>
              <button onClick={() => setSelectedPost(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Tartalom (Scrollolható) */}
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Stratégiai Cél (Outline)</label>
              <p className="text-sm text-slate-400 mb-6 p-3 bg-white/5 rounded-lg border border-white/5 italic">
                {selectedPost.outline}
              </p>

              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Poszt Szövege</label>
              <textarea 
                className="w-full h-64 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 focus:border-blue-500 outline-none resize-none leading-relaxed font-mono text-sm"
                value={selectedPost.content || "Generálj újra a tartalom megjelenítéséhez..."}
                onChange={(e) => setSelectedPost({...selectedPost, content: e.target.value})}
              />
            </div>

            {/* Lábléc */}
            <div className="p-6 border-t border-white/5 bg-slate-900/50 rounded-b-2xl flex justify-end gap-3">
               <button 
                 onClick={() => setSelectedPost(null)}
                 className="px-5 py-2.5 rounded-xl text-slate-300 font-bold hover:bg-white/5 transition-colors"
               >
                 Bezárás
               </button>
               <button 
                 onClick={handleCopy}
                 className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all ${isCopied ? 'bg-green-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'}`}
               >
                 {isCopied ? <><Check className="w-4 h-4" /> Másolva</> : <><Copy className="w-4 h-4" /> Szöveg Másolása</>}
               </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}