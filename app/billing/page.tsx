"use client";
import { useState, useEffect } from 'react';
import { Check, Zap, Settings, Loader2, Calendar, CreditCard, Shield, Star, X, Sparkles } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

// --- KONFIGURÁCIÓ ---
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

const STRIPE_PRICES = {
  BASIC: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC,
  PRO: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
};

// --- KOMPONENS ---
export default function BillingPage() {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .single();
        setSubscription(data);
      }
      setLoading(false);
    };
    getData();
  }, []);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert("Hiba: " + (data.error || "Ismeretlen hiba történt."));
    } catch (error) { console.error(error); } 
    finally { setPortalLoading(false); }
  };

  const handleSubscription = async (priceId: string) => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error) { console.error(error); }
  };

  const getPlanDetails = () => {
    if (subscription?.price_id === STRIPE_PRICES.PRO) {
      return {
        name: "Pro Plan",
        color: "from-blue-600 to-indigo-600",
        features: ["Korlátlan AI generálás", "Smart Matrix hozzáférés (10 márka)", "GPT-4o prioritás", "4K kép exportálás", "Dedikált support"]
      };
    }
    return {
      name: "Basic Plan",
      color: "from-slate-700 to-slate-900",
      features: ["50 generálás havonta", "Smart Matrix (2 márka)", "Standard sebesség", "Közösségi support"]
    };
  };

  const currentPlan = getPlanDetails();

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden text-white p-6 md:p-12 font-sans selection:bg-blue-500/30">
      {/* Háttér effekt */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">
        <header className="mb-12 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
            Előfizetés <span className="text-blue-500">&</span> Számlázás
          </h1>
          <p className="text-slate-400 text-lg">Kezeld a tagságodat és oldd fel a ContentFactory teljes erejét.</p>
        </header>

        {subscription?.status === 'active' ? (
          // --- AKTÍV ELŐFIZETÉS NÉZET (VIP Kártya stílus) ---
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            
            {/* A Kártya */}
            <div className={`relative aspect-[1.586/1] rounded-3xl p-8 flex flex-col justify-between shadow-2xl overflow-hidden group bg-gradient-to-br ${currentPlan.color}`}>
              {/* Kártya Shine effekt */}
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent opacity-30 pointer-events-none" />
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />

              <div className="flex justify-between items-start relative z-10">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-widest text-white/60">Aktív csomag</span>
                  <h2 className="text-3xl font-black tracking-tight text-white">{currentPlan.name}</h2>
                </div>
                <Zap className="w-8 h-8 text-yellow-300 fill-yellow-300 drop-shadow-[0_0_10px_rgba(253,224,71,0.5)]" />
              </div>

              <div className="space-y-6 relative z-10 mt-auto">
                <div className="flex items-center gap-4 text-sm font-medium text-white/80">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white/20 rounded-md backdrop-blur-sm"><Shield className="w-3 h-3" /></div>
                    <span>Stripe Secured</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white/20 rounded-md backdrop-blur-sm"><Calendar className="w-3 h-3" /></div>
                    <span>Megújul: {new Date(subscription.current_period_end).toLocaleDateString('hu-HU')}</span>
                  </div>
                </div>
                
                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                
                <div className="flex justify-between items-end">
                   <div className="text-xs text-white/50 font-mono">ID: {subscription.id.slice(0, 8)}...</div>
                   <div className="text-lg font-bold tracking-widest">**** 4242</div>
                </div>
              </div>
            </div>

            {/* Kezelőgombok */}
            <div className="space-y-6">
               <div className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-3xl p-8">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-blue-400" /> Csomag előnyei
                  </h3>
                  <p className="text-slate-400 mb-6">
                    Jelenleg élvezed a <span className="text-white font-bold">{currentPlan.name}</span> minden előnyét. 
                    Kattints a részletekért vagy kezeld a számlázást.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                      onClick={() => setShowDetailsModal(true)}
                      className="flex-1 py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all border border-slate-700"
                    >
                      Mit tartalmaz?
                    </button>
                    <button 
                      onClick={handleManageBilling}
                      disabled={portalLoading}
                      className="flex-1 py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                    >
                      {portalLoading ? <Loader2 className="animate-spin w-4 h-4"/> : <Settings className="w-4 h-4"/>}
                      Beállítások
                    </button>
                  </div>
               </div>
            </div>
          </div>
        ) : (
          // --- NINCS ELŐFIZETÉS (Pricing Tables) ---
          <div className="grid md:grid-cols-2 gap-8 items-start">
            
            {/* Basic Card */}
            <div className="p-8 rounded-[32px] bg-slate-900/40 backdrop-blur-md border border-white/5 hover:border-white/10 transition-all group">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-300">Basic Plan</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">$10</span>
                  <span className="text-slate-500">/hó</span>
                </div>
                <p className="text-slate-400 text-sm mt-2">Induló vállalkozásoknak és hobbi tartalomgyártóknak.</p>
              </div>
              <ul className="space-y-4 mb-8">
                {["50 AI generálás / hó", "Smart Matrix (2 márka)", "Alap sebesség", "Email support"].map((feat, i) => (
                   <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                     <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>
                     {feat}
                   </li>
                ))}
              </ul>
              <button 
                onClick={() => handleSubscription(STRIPE_PRICES.BASIC!)}
                className="w-full py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all border border-slate-700"
              >
                Kiválasztás
              </button>
            </div>

            {/* Pro Card (Highlighted) */}
            <div className="relative p-8 rounded-[32px] bg-slate-900/80 backdrop-blur-xl border border-blue-500/30 shadow-[0_0_50px_rgba(37,99,235,0.15)] group hover:scale-[1.02] transition-transform duration-300">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
              <div className="absolute -top-3 left-8 bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-blue-500/40">
                Ajánlott
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  Pro Plan <Sparkles className="w-4 h-4 text-blue-400 fill-blue-400" />
                </h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">$19</span>
                  <span className="text-slate-500">/hó</span>
                </div>
                <p className="text-blue-200/60 text-sm mt-2">Komoly ügynökségeknek és profi marketingeseknek.</p>
              </div>
              <ul className="space-y-4 mb-8">
                {[
                  "Korlátlan AI generálás", 
                  "Smart Matrix (10 márka)", 
                  "GPT-4o prioritás", 
                  "Multi-platform export",
                  "Dedikált support"
                ].map((feat, i) => (
                   <li key={i} className="flex items-center gap-3 text-sm font-medium text-white">
                     <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/50"><Check className="w-3 h-3 text-white" /></div>
                     {feat}
                   </li>
                ))}
              </ul>
              <button 
                onClick={() => handleSubscription(STRIPE_PRICES.PRO!)}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black shadow-lg shadow-blue-500/25 transition-all"
              >
                Upgrade to Pro
              </button>
            </div>

          </div>
        )}
      </div>

      {/* --- DETAILS MODAL (Csak ha aktív) --- */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDetailsModal(false)} />
          <div className="relative bg-slate-900 border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setShowDetailsModal(false)}
              className="absolute top-4 right-4 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
            
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${currentPlan.color} flex items-center justify-center mb-6`}>
              <Zap className="w-6 h-6 text-white" />
            </div>

            <h3 className="text-2xl font-bold mb-2">{currentPlan.name} csomagod van</h3>
            <p className="text-slate-400 mb-6 text-sm">
              Következő fordulónap: <span className="text-white font-medium">{new Date(subscription.current_period_end).toLocaleDateString('hu-HU')}</span>
            </p>

            <div className="space-y-3 mb-8">
              {currentPlan.features.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setShowDetailsModal(false)}
              className="w-full py-3 rounded-xl bg-white text-black font-bold hover:bg-slate-200 transition-colors"
            >
              Rendben, értem
            </button>
          </div>
        </div>
      )}
    </div>
  );
}