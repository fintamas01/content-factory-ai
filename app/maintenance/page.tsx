import { Wrench } from "lucide-react";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#020617] px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <Wrench className="w-10 h-10 text-amber-500" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">
          Maintenance in progress
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          We’re making things better. Please check back later.
        </p>
      </div>
    </div>
  );
}
