"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, History, CreditCard, Settings, LogOut, Sparkles, LayoutGrid } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import Image from 'next/image';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: LayoutDashboard, label: 'Smart Matrix', href: '/dashboard/matrix' },
  { icon: LayoutGrid, label: 'Poster Studio', href: '/dashboard/poster' },
  { icon: History, label: 'Archives', href: '/history' },
  { icon: CreditCard, label: 'Billing', href: '/billing' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/') return null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/'); // Kijelentkezés után vissza a főoldalra
    router.refresh();
  };

  return (
    <aside className="w-64 bg-white dark:bg-[#020617] border-r border-slate-200 dark:border-white/10 flex flex-col h-screen sticky top-0 z-50">
      <div className="flex items-center gap-2 px-4 py-6">
        <Image 
          src="/CF_logo.png" 
          alt="CFAI Logo" 
          width={100} 
          height={100} 
          className="object-contain"
        />
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm cursor-pointer ${
                isActive 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}>
                <item.icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
  
                {/* PRO Badge a Matrix mellé */}
                {item.label === 'Smart Matrix' && (
                  <span className="text-[10px] bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                    PRO
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-slate-200 dark:border-white/10">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 font-bold text-sm hover:text-red-500 transition-colors cursor-pointer"
        >
          <LogOut className="w-5 h-5" /> Logout
        </button>
      </div>
    </aside>
  );
}