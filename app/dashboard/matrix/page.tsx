"use client";
import { useState } from 'react';
import { Lock } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

export default function ContentMatrix() {
  const [isPro, setIsPro] = useState(false); // Ezt majd a backendből kapjuk

  const mockDays = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek"];

  const router = useRouter();

  return (
    <div className="p-8 bg-slate-950 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-6">Smart Content Matrix</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
        {/* Ha nem Pro, rátesszük az Overlat-t */}
        {!isPro && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md rounded-xl border border-blue-500/30">
            <Lock className="w-12 h-12 text-blue-400 mb-4" />
            <h2 className="text-2xl font-bold">Pro Funkció</h2>
            <p className="text-slate-300 mb-6 text-center max-w-xs">
              Oldd fel a teljes heti stratégiát és a multi-platform generálást!
            </p>
            <button onClick={() => router.push('/billing')} className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-full font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              Upgrade Most
            </button>
          </div>
        )}

        {/* Naptár kártyák (amik blurred lesznek) */}
        {mockDays.map((day) => (
          <div key={day} className={`p-4 rounded-xl border border-slate-800 bg-slate-900/50 ${!isPro ? 'blur-sm select-none' : ''}`}>
            <span className="text-blue-400 font-bold">{day}</span>
            <div className="mt-4 space-y-3">
              <div className="h-2 w-full bg-slate-700 rounded" />
              <div className="h-2 w-3/4 bg-slate-700 rounded" />
              <div className="h-10 w-full bg-slate-800 rounded mt-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}