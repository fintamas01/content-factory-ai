"use client";
import { Sparkles, Zap, Shield, Globe, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

export default function LandingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard' },
    });
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 overflow-hidden">
      {/* Background Glows */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-32 pb-20">
        <div className="text-center space-y-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-widest"
          >
            <Sparkles className="w-4 h-4" /> Powered by GPT-4o Neural Engine
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-7xl md:text-9xl font-black tracking-tighter leading-[0.85]"
          >
            Create <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-blue-300">Faster.</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl mx-auto text-slate-400 text-lg md:text-xl font-medium"
          >
            Az első AI platform, ami valódi közösségi média kampányokat generál egyetlen ötletből. Felejtsd el a manuális posztolást.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col md:flex-row items-center justify-center gap-4 pt-8"
          >
            {user ? (
              <button 
                onClick={() => router.push('/dashboard')}
                className="group bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-2xl font-black text-xl transition-all flex items-center gap-3 shadow-[0_0_30px_rgba(37,99,235,0.4)]"
              >
                Go to Dashboard <ArrowRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <button 
                onClick={handleLogin}
                className="group bg-white text-black px-10 py-5 rounded-2xl font-black text-xl hover:bg-slate-100 transition-all flex items-center gap-3"
              >
                Start Creating Free <Zap className="w-6 h-6 fill-black" />
              </button>
            )}
          </motion.div>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-40">
          {[
            { icon: Shield, title: "Enterprise Security", desc: "Minden generálásod biztonságban és titkosítva van." },
            { icon: Globe, title: "Multi-Language", desc: "Generálj tartalmat 6 különböző nyelven azonnal." },
            { icon: Zap, title: "Instant Sync", desc: "Azonnali exportálás minden fontos közösségi platformra." }
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="p-8 rounded-[40px] bg-white/[0.03] border border-white/10 backdrop-blur-3xl"
            >
              <feature.icon className="w-10 h-10 text-blue-500 mb-6" />
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}