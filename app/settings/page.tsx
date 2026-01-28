"use client";
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Settings, User, Mail, Shield, Zap } from 'lucide-react';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  if (!user) return null;

  return (
    <div className="p-8 md:p-12 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-12">
        <div className="p-3 bg-blue-600/10 rounded-2xl">
          <Settings className="w-8 h-8 text-blue-600" />
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tighter">Settings</h1>
          <p className="text-slate-500 font-medium">Profil és fiók kezelése.</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Profile Card */}
        <section className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[40px] p-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <User className="text-blue-600 w-5 h-5" /> Személyes adatok
          </h2>
          <div className="flex items-center gap-6 mb-8">
            <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-20 h-20 rounded-3xl border-4 border-white dark:border-white/10 shadow-xl" />
            <div>
              <p className="text-2xl font-black">{user.user_metadata.full_name}</p>
              <p className="text-slate-500 font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" /> {user.email}
              </p>
            </div>
          </div>
        </section>

        {/* Account Status */}
        <section className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[40px] p-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Shield className="text-blue-600 w-5 h-5" /> Fiók biztonság
          </h2>
          <div className="flex justify-between items-center p-6 bg-slate-50 dark:bg-white/5 rounded-3xl">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-2xl">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold">Előfizetés állapota</p>
                <p className="text-sm text-slate-500">Jelenleg az ingyenes verziót használod.</p>
              </div>
            </div>
            <button className="px-6 py-3 bg-blue-600 text-white font-black text-sm rounded-2xl shadow-lg shadow-blue-500/20 hover:scale-105 transition-all">
              Upgrade
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}