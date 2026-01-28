"use client";
import { useState, useEffect } from 'react';
import { Check, CreditCard, Zap } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

export default function BillingPage() {
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
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

  const handleSubscription = async (priceId: string) => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error("Hiba:", error);
    }
  };

  if (loading) return <div className="p-8 italic opacity-50">Loading account data...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <header>
        <h1 className="text-4xl font-black tracking-tight mb-2 text-slate-900 dark:text-white">Billing & Plan</h1>
        <p className="text-slate-500 font-medium">Kezeld az előfizetésedet és a számlázási adataidat.</p>
      </header>

      {subscription?.status === 'active' ? (
        <div className="bg-blue-600 rounded-[32px] p-8 text-white shadow-xl shadow-blue-500/20">
          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="text-blue-100 text-xs font-black uppercase tracking-widest mb-2">Jelenlegi csomagod</p>
              <h2 className="text-3xl font-black">Pro Plan Member</h2>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl">
              <Zap className="w-6 h-6 fill-white" />
            </div>
          </div>
          <button className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors">
            Előfizetés kezelése
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
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