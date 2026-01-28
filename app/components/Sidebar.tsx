// components/Sidebar.tsx
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, History, CreditCard, Settings, LogOut, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: History, label: 'Archives', href: '/history' },
  { icon: CreditCard, label: 'Billing', href: '/billing' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  // A kezdőoldalon ne jelenjen meg a sidebar
  if (pathname === '/') return null;

  return (
    <aside className="w-64 bg-white dark:bg-[#020617] border-r border-slate-200 dark:border-white/10 flex flex-col h-screen sticky top-0">
      <div className="p-8 flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg shadow-lg">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="font-black text-xl tracking-tighter">Factory<span className="text-blue-600">.AI</span></span>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm ${
                isActive 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}>
                <item.icon className="w-5 h-5" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-slate-200 dark:border-white/10">
        <div className="p-4 bg-slate-100 dark:bg-white/5 rounded-2xl mb-4">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Aktív csomag</p>
          <p className="text-sm font-bold text-blue-600">Pro Plan Member</p>
        </div>
        <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 font-bold text-sm hover:text-red-500 transition-colors">
          <LogOut className="w-5 h-5" /> Logout
        </button>
      </div>
    </aside>
  );
}