"use client";
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Calendar, Search, ChevronRight, Copy, Check, X, Clock, FileText } from 'lucide-react';

// Típusok definiálása
interface MatrixItem {
  day: string;
  title: string;
  platform: string;
  outline: string;
  content: string;
}

interface HistoryItem {
  id: string;
  brand_name: string;
  created_at: string;
  generation_data: {
    days: MatrixItem[];
  };
}

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedGen, setSelectedGen] = useState<HistoryItem | null>(null);
  
  // Modal állapotok (View Mode)
  const [viewPost, setViewPost] = useState<MatrixItem | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
  );

  useEffect(() => {
    async function getHistory() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('matrix_generations')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }); // Legfrissebb elől
        
        if (data) setHistory(data);
      }
      setLoading(false);
    }
    getHistory();
  }, [supabase]);

  const handleCopy = () => {
    if (viewPost) {
      navigator.clipboard.writeText(viewPost.content || viewPost.outline);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Előzmények betöltése...</div>;

  return (
    <div className="p-8 bg-slate-950 min-h-screen text-white">
      <header className="mb-10">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
          <Clock className="text-blue-500" /> Előzmények
        </h1>
        <p className="text-slate-400">Itt találod az összes korábban generált stratégiádat.</p>
      </header>

      {history.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/50 rounded-3xl border border-white/5">
          <FileText className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-300">Még nincsenek előzmények</h3>
          <p className="text-slate-500 mt-2">Generálj egyet a Smart Matrix menüben!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {history.map((item) => (
            <div key={item.id} className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 hover:border-blue-500/30 transition-all group">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Bal oldal: Infók */}
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-blue-400 font-bold text-lg">{item.brand_name}</span>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full">
                      {new Date(item.created_at).toLocaleDateString('hu-HU')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">
                    {item.generation_data?.days?.length || 0} napos stratégia
                  </p>
                </div>

                {/* Jobb oldal: Műveletek */}
                <button 
                  onClick={() => setSelectedGen(selectedGen?.id === item.id ? null : item)}
                  className="px-4 py-2 bg-slate-800 hover:bg-blue-600 rounded-xl font-medium transition-colors flex items-center gap-2 text-sm"
                >
                  Részletek mutatása <ChevronRight className={`w-4 h-4 transition-transform ${selectedGen?.id === item.id ? 'rotate-90' : ''}`} />
                </button>
              </div>

              {/* LENYÍLÓ TARTALOM (Accordion) */}
              {selectedGen?.id === item.id && (
                <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-5 gap-3 animate-in slide-in-from-top-2">
                  {item.generation_data?.days?.map((day, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setViewPost(day)}
                      className="p-4 rounded-xl bg-slate-950 border border-white/5 hover:border-blue-500/50 cursor-pointer transition-all"
                    >
                      <span className="text-xs font-bold text-blue-500 uppercase">{day.day}</span>
                      <h4 className="text-sm font-bold text-white mt-1 line-clamp-2">{day.title}</h4>
                      <p className="text-[10px] text-slate-500 mt-2 uppercase">{day.platform}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* --- POST VIEWER MODAL (Ugyanaz, mint a fő oldalon) --- */}
      {viewPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setViewPost(null)} />
          <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div>
                <span className="text-blue-500 font-bold uppercase text-xs">{viewPost.day} • {viewPost.platform}</span>
                <h3 className="text-xl font-bold text-white mt-1">{viewPost.title}</h3>
              </div>
              <button onClick={() => setViewPost(null)} className="p-2 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="mb-6 bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Stratégia</label>
                <p className="text-sm text-slate-300 italic">{viewPost.outline}</p>
              </div>

              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Poszt Tartalom</label>
              <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                {viewPost.content}
              </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-slate-900/50 rounded-b-2xl flex justify-end">
               <button 
                 onClick={handleCopy}
                 className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all ${isCopied ? 'bg-green-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
               >
                 {isCopied ? <><Check className="w-4 h-4" /> Másolva</> : <><Copy className="w-4 h-4" /> Másolás</>}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}