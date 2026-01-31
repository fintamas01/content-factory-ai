"use client";
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Trash2, Plus, Building2, ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<string>('free');
  
  // Új márka form
  const [newBrand, setNewBrand] = useState({ name: '', desc: '', audience: '' });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
  );

  const getLimit = () => {
    if (subscription === 'pro') return 10;
    if (subscription === 'basic') return 3;
    return 1;
  };

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        // Előfizetés lekérése (példa logika)
        const { data: sub } = await supabase.from('subscriptions').select('price_id').eq('user_id', user.id).single();
        if (sub?.price_id === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO) setSubscription('pro');
        else if (sub?.price_id === process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC) setSubscription('basic');

        // Márkák lekérése
        const { data: brandList } = await supabase.from('brand_profiles').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        setBrands(brandList || []);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const addBrand = async () => {
    if (brands.length >= getLimit()) {
      alert("Elérted a csomagod limitjét! Frissíts a bővítéshez.");
      return;
    }
    const { data, error } = await supabase.from('brand_profiles').insert([{
      user_id: user.id,
      brand_name: newBrand.name,
      description: newBrand.desc,
      target_audience: newBrand.audience
    }]).select();

    if (!error) {
      setBrands([data[0], ...brands]);
      setNewBrand({ name: '', desc: '', audience: '' });
    }
  };

  const deleteBrand = async (id: string) => {
    const { error } = await supabase.from('brand_profiles').delete().eq('id', id);
    if (!error) setBrands(brands.filter(b => b.id !== id));
  };

  if (loading) return <div className="p-20 text-center">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto p-10 space-y-12 pb-32">
      <header>
        <h1 className="text-4xl font-black italic uppercase tracking-tighter">Settings</h1>
        <div className="flex items-center gap-2 mt-2 text-blue-500 font-bold text-sm uppercase">
          <ShieldCheck className="w-4 h-4" />
          Current Plan: {subscription.toUpperCase()} ({brands.length} / {getLimit()} Brands)
        </div>
      </header>

      {/* ÚJ MÁRKA HOZZÁADÁSA */}
      {brands.length < getLimit() && (
        <section className="bg-white/5 border border-white/10 rounded-[40px] p-8 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-500" /> Új ügyfél / márka hozzáadása
          </h2>
          <div className="grid gap-4">
            <input 
              placeholder="Márkanév..." 
              className="bg-black/20 border border-white/10 p-4 rounded-2xl outline-none focus:border-blue-500 transition-all"
              value={newBrand.name}
              onChange={e => setNewBrand({...newBrand, name: e.target.value})}
            />
            <textarea 
              placeholder="Márka leírása, stílusa..." 
              className="bg-black/20 border border-white/10 p-4 rounded-2xl outline-none focus:border-blue-500 min-h-[100px]"
              value={newBrand.desc}
              onChange={e => setNewBrand({...newBrand, desc: e.target.value})}
            />
            <input 
              placeholder="Célközönség..." 
              className="bg-black/20 border border-white/10 p-4 rounded-2xl outline-none focus:border-blue-500"
              value={newBrand.audience}
              onChange={e => setNewBrand({...newBrand, audience: e.target.value})}
            />
            <button onClick={addBrand} className="bg-blue-600 py-4 rounded-2xl font-black uppercase hover:bg-blue-500 transition-all">
              Mentés
            </button>
          </div>
        </section>
      )}

      {/* MÁRKÁK LISTÁJA */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Mentett márkák</h2>
        <div className="grid gap-4">
          {brands.map(brand => (
            <div key={brand.id} className="flex justify-between items-center bg-white/5 border border-white/5 p-6 rounded-3xl hover:border-blue-500/30 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center">
                  <Building2 className="text-blue-500 w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{brand.brand_name}</h3>
                  <p className="text-xs text-slate-500 truncate max-w-xs">{brand.description}</p>
                </div>
              </div>
              <button onClick={() => deleteBrand(brand.id)} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}