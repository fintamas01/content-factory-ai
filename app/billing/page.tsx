"use client";
import { useState, useEffect } from 'react';
import { Check, Zap, Settings, Loader2, Calendar, CreditCard, Info } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

export default function BillingPage() {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

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
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Hiba: " + (data.error || "Ismeretlen hiba történt."));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setPortalLoading(false);
    }
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

  // Segédfüggvény a csomagnév meghatározásához
  const getPlanName = () => {
    if (subscription?.price_id === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO) return "Pro Plan";
    if (subscription?.price_id === process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC) return "Basic Plan";
    return "Aktív előfizetés";
  };

  if (loading) return <div className="p-8 italic opacity-50 text-white">Adatok betöltése...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-10 p-8">
      <header>
        <h1 className="text-4xl font-black tracking-tight mb-2 text-white italic">Billing <span className="text-blue-600">&</span> Plan</h1>
        <p className="text-slate-500 font-medium">Kezeld az előfizetésedet és tekintsd meg a csomagod részleteit.</p>
      </header>

      {subscription?.status === 'active' ? (
        <div className="space-y-8">
          {/* FŐ KÁRTYA */}
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800 rounded-[40px] p-10 text-white shadow-2xl shadow-blue-900/20">
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-4 bg-white/20 w-fit px-3 py-1 rounded-full border border-white/10">
                  <span className="text-[10px] font-black uppercase tracking-widest">Jelenlegi státusz: Aktív</span>
                </div>
                <h2 className="text-5xl font-black mb-2 tracking-tighter italic">{getPlanName()}</h2>
                <p className="text-blue-100/80 font-medium">Köszönjük, hogy a ContentFactory-t választottad!</p>
              </div>
              <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md border border-white/10">
                <Zap className="w-10 h-10 fill-white" />
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-white/10 flex flex-wrap gap-8">
               <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-blue-200" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-blue-200 opacity-60">Következő számlázás</p>
                    <p className="font-bold">{new Date(subscription.current_period_end).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-blue-200" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-blue-200 opacity-60">Fizetési mód</p>
                    <p className="font-bold">Stripe Secured</p>
                  </div>
               </div>
            </div>
          </div>

          {/* RÉSZLETEK ÉS KEZELÉS */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 p-8 rounded-[32px] space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-500" /> Csomag részletei
              </h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-slate-400">
                  <Check className="w-4 h-4 text-green-500" /> 
                  {subscription?.price_id === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ? 'Végtelen generálás' : '50 generálás havonta'}
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-400">
                  <Check className="w-4 h-4 text-green-500" /> Kiemelt AI modellek elérése
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-400">
                  <Check className="w-4 h-4 text-green-500" /> Automatikus mentés az archívumba
                </li>
              </ul>
            </div>

            <div className="bg-white/5 border border-white/10 p-8 rounded-[32px] flex flex-col justify-center text-center space-y-6">
              <p className="text-sm text-slate-500">Módosítani szeretnéd a fizetési módodat vagy lemondanád az előfizetést?</p>
              <button 
                onClick={handleManageBilling}
                disabled={portalLoading}
                className="w-full py-4 bg-white text-black rounded-2xl font-black hover:bg-slate-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {portalLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Settings className="w-5 h-5" />}
                Számlázási Portál megnyitása
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
           {/* Itt marad az eredeti ártáblázatod a Basic és Pro opciókkal */}
           {/* ... korábbi kódod ... */}
           {/* BASIC PLAN */}
          <div className="p-8 rounded-[40px] bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <h3 className="text-xl font-bold mb-6">Basic Plan</h3>
            <p className="text-4xl font-black mb-6 text-slate-900 dark:text-white">$10.00 <span className="text-sm font-normal opacity-50">/ hó</span></p>
            <ul className="space-y-4 mb-8 text-sm opacity-70">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-500" /> 50 generálás / hó</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-500" /> Standard AI motor</li>
            </ul>
            <button 
              onClick={() => handleSubscription(process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC!)}
              className="w-full py-4 rounded-2xl bg-slate-100 dark:bg-white/10 font-bold hover:bg-slate-200 dark:hover:bg-white/20 transition-all"
            >
              Választom
            </button>
          </div>

          {/* PRO PLAN */}
          <div className="p-8 rounded-[40px] bg-white dark:bg-white/5 border-2 border-blue-600 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-black px-4 py-1 rounded-bl-xl uppercase">Best Value</div>
            <h3 className="text-xl font-bold mb-6">Pro Plan</h3>
            <p className="text-4xl font-black mb-6 text-slate-900 dark:text-white">$29.99 <span className="text-sm font-normal opacity-50">/ hó</span></p>
            <ul className="space-y-4 mb-8 text-sm opacity-70">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-500" /> Korlátlan generálás</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-500" /> GPT-4o Neural Engine</li>
            </ul>
            <button 
              onClick={() => handleSubscription(process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO!)}
              className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black hover:scale-[1.02] transition-transform"
            >
              Upgrade to Pro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}