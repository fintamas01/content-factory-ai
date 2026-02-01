"use client";
import { useState, useEffect } from 'react';
import { Lock, Sparkles, Loader2, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

interface MatrixItem {
  day: string;
  title: string;
  platform: string;
  outline: string;
}

export default function ContentMatrix() {
  const [userPlan, setUserPlan] = useState('free');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [matrixData, setMatrixData] = useState<MatrixItem[]>([]);
  const [formData, setFormData] = useState({ brand: '', audience: '', topic: '' });
  
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
        
        // Ha van aktív előfizetés, a price_id lesz a terv, egyébként 'free'
        if (sub && sub.price_id) {
            setUserPlan(sub.price_id);
        } else {
            setUserPlan('free');
        }
        }
        setLoading(false);
    }
    getUserData();
    }, [supabase]);

    // Itt is módosítani kell a logikát:
    const isPro = userPlan !== 'free';

  const mockDays = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek"];

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
        alert("Elérted a havi limitedet! Válts nagyobb csomagra a Billing menüpontban.");
        router.push('/billing');
        return;
      }

      if (!res.ok) throw new Error("Hiba a generálás során");

      const data = await res.json();
      // Az API-tól érkező JSON szerkezetétől függően (pl. data.days)
      setMatrixData(data.days || []);
    } catch (error) {
      console.error(error);
      alert("Valami hiba történt. Próbáld újra később.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 bg-slate-950 min-h-screen text-white">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Calendar className="text-blue-500" /> Smart Content Matrix
          </h1>
          <p className="text-slate-400 mt-1">Heti stratégia és poszttervező AI segítségével</p>
        </div>
        
        {isPro && (
          <div className="bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-full flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400 uppercase tracking-wider">
              {userPlan} csomag aktív
            </span>
          </div>
        )}
      </div>

      {/* Input Szekció - Csak Pro/Basic usereknek látható jól, de mindenki láthatja a struktúrát */}
      <div className="mb-10 grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/40 p-6 rounded-2xl border border-white/5">
        <input 
          placeholder="Márka neve (pl. ContentFactory)" 
          className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none transition-all"
          value={formData.brand}
          onChange={(e) => setFormData({...formData, brand: e.target.value})}
        />
        <input 
          placeholder="Célközönség (pl. Marketingesek)" 
          className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none transition-all"
          value={formData.audience}
          onChange={(e) => setFormData({...formData, audience: e.target.value})}
        />
        <input 
          placeholder="Fő téma vagy kampány célja" 
          className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none transition-all"
          value={formData.topic}
          onChange={(e) => setFormData({...formData, topic: e.target.value})}
        />
        <button 
          onClick={handleGenerate}
          disabled={generating || !isPro}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
        >
          {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5" /> Generálás</>}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative min-h-[300px]">
        {/* Paywall Overlay */}
        {!isPro && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md rounded-xl border border-blue-500/30">
            <Lock className="w-12 h-12 text-blue-400 mb-4" />
            <h2 className="text-2xl font-bold">Pro Funkció</h2>
            <p className="text-slate-300 mb-6 text-center max-w-xs">
              Oldd fel a heti stratégiát és kezeld akár az összes márkádat egy helyen!
            </p>
            <button 
              onClick={() => router.push('/billing')} 
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-full font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]"
            >
              Csomagváltás Most
            </button>
          </div>
        )}

        {/* Naptár kártyák */}
        {matrixData.length > 0 ? (
          matrixData.map((item) => (
            <div key={item.day} className="p-5 rounded-2xl border border-blue-500/20 bg-slate-900 shadow-xl flex flex-col h-full">
              <div className="flex justify-between items-center mb-4">
                <span className="text-blue-400 font-bold uppercase text-xs tracking-widest">{item.day}</span>
                <span className="bg-slate-800 text-[10px] px-2 py-1 rounded text-slate-400 font-bold">{item.platform}</span>
              </div>
              <h3 className="text-sm font-bold mb-3 leading-tight text-white">{item.title}</h3>
              <p className="text-xs text-slate-400 line-clamp-6">{item.outline}</p>
              <div className="mt-auto pt-4 border-t border-white/5 flex gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <div className="w-2 h-2 rounded-full bg-slate-700" />
              </div>
            </div>
          ))
        ) : (
          // Üres vagy Blurred Skeleton kártyák
          mockDays.map((day) => (
            <div key={day} className={`p-5 rounded-2xl border border-slate-800 bg-slate-900/50 ${!isPro ? 'blur-sm select-none' : ''}`}>
              <span className="text-slate-600 font-bold text-xs uppercase tracking-widest">{day}</span>
              <div className="mt-4 space-y-3">
                <div className="h-2 w-full bg-slate-800 rounded animate-pulse" />
                <div className="h-2 w-3/4 bg-slate-800 rounded animate-pulse" />
                <div className="h-24 w-full bg-slate-800/50 rounded-lg mt-4" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}