"use client";

import { useState } from "react";
import { Wrench, Loader2, Lock } from "lucide-react";

export default function MaintenancePage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/maintenance-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Invalid credentials or server error."
        );
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#020617] px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center space-y-4 mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <Wrench className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase italic tracking-tight">
            Maintenance mode
          </h1>
          <p className="text-slate-600 dark:text-slate-400 font-medium text-sm leading-relaxed">
            This site is temporarily unavailable to the public. Enter the
            maintenance credentials to continue.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-8 shadow-xl shadow-slate-900/5 dark:shadow-black/40 space-y-5"
        >
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <Lock className="h-3.5 w-3.5" />
            Staff access
          </div>

          <div>
            <label
              htmlFor="maint-username"
              className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2"
            >
              Email / username
            </label>
            <input
              id="maint-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/40"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label
              htmlFor="maint-password"
              className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2"
            >
              Password
            </label>
            <input
              id="maint-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/40"
              disabled={loading}
              required
            />
          </div>

          {error && (
            <div
              className="rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-6 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-amber-600/25 hover:bg-amber-500 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Continue to app"
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-[11px] text-slate-400 dark:text-slate-600">
          Supabase user login still applies inside the app after you pass this
          gate.
        </p>
      </div>
    </div>
  );
}
