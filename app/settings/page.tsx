"use client";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Trash2, Plus, Building2, ShieldCheck, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<string>("free");
  const [newBrand, setNewBrand] = useState({ name: "", desc: "", audience: "" });

  // ✅ Website import state-ek
  const [website, setWebsite] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importedWebsite, setImportedWebsite] = useState<string>("");
  const [importedPalette, setImportedPalette] = useState<any>(null);
  const [importedFonts, setImportedFonts] = useState<any>(null);

  // Összevontuk egyetlen állapotba a szinkronizálást
  const [isSyncing, setIsSyncing] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
  );

  const getLimit = () => {
    if (subscription === "pro") return 10;
    if (subscription === "basic") return 3;
    return 1;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsSyncing(true);
        const {
          data: { user: activeUser },
        } = await supabase.auth.getUser();
        setUser(activeUser);

        if (activeUser) {
          const [subRes, brandsRes] = await Promise.all([
            supabase
              .from("subscriptions")
              .select("price_id")
              .eq("user_id", activeUser.id)
              .maybeSingle(),
            supabase
              .from("brand_profiles")
              .select("*")
              .eq("user_id", activeUser.id),
          ]);

          if (subRes.data) {
            if (subRes.data.price_id === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO)
              setSubscription("pro");
            else if (
              subRes.data.price_id === process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC
            )
              setSubscription("basic");
          }

          setBrands(brandsRes.data || []);
        }
      } catch (error) {
        console.error("Szinkronizációs hiba:", error);
      } finally {
        setIsSyncing(false); // Ez oldja fel a zárat
      }
    };
    loadData();
  }, []);

  const importFromWebsite = async () => {
    if (!website.trim()) return alert("Adj meg egy weboldalt!");
    setIsImporting(true);

    try {
      const res = await fetch("/api/brand/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Import hiba");
        return;
      }

      // kitöltjük a formot (logo-t NEM!)
      setNewBrand((prev) => ({
        name: data.brand_name || prev.name,
        desc: data.description || prev.desc,
        audience: prev.audience, // ezt inkább kézzel
      }));

      setImportedWebsite(data.website || website);
      setImportedPalette(data.palette || null);
      setImportedFonts(data.fonts || null);
    } catch (e) {
      console.error(e);
      alert("Import hiba");
    } finally {
      setIsImporting(false);
    }
  };

  const addBrand = async () => {
    const currentLimit = getLimit();
    if (brands.length >= currentLimit) {
      alert("Hiba: Elérted a csomagodhoz tartozó maximum limitet!");
      return;
    }

    if (!newBrand.name) return alert("Márkanév megadása kötelező!");
    if (!user?.id) return alert("Nincs bejelentkezett felhasználó!");

    const payload: any = {
      user_id: user.id,
      brand_name: newBrand.name,
      description: newBrand.desc,
      target_audience: newBrand.audience,
      // ✅ új mezők:
      website: (importedWebsite || website || null) as string | null,
      palette: importedPalette,
      fonts: importedFonts,
    };

    const { data, error } = await supabase
      .from("brand_profiles")
      .insert([payload])
      .select();

    if (error) {
      console.error("Brand insert hiba:", error);
      alert("Hiba: nem sikerült menteni a márkát!");
      return;
    }

    if (data?.[0]) {
      setBrands([data[0], ...brands]);
    }

    // reset
    setNewBrand({ name: "", desc: "", audience: "" });
    setWebsite("");
    setImportedWebsite("");
    setImportedPalette(null);
    setImportedFonts(null);
  };

  const deleteBrand = async (id: string) => {
    const { error } = await supabase.from("brand_profiles").delete().eq("id", id);
    if (!error) setBrands(brands.filter((b) => b.id !== id));
  };

  const limit = getLimit();

  // Csak ezt az egy ellenőrzést hagyjuk meg a betöltéshez
  if (isSyncing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-500 font-medium animate-pulse uppercase tracking-widest text-xs">
          Márkaprofilok szinkronizálása...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-10 space-y-12 pb-32">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">
            Settings
          </h1>
          <div className="flex items-center gap-2 mt-2 text-blue-500 font-black text-[10px] uppercase tracking-[0.2em]">
            <ShieldCheck className="w-4 h-4" />
            Plan: {subscription.toUpperCase()} <span className="text-slate-600">|</span>{" "}
            {brands.length} / {limit} Brands
          </div>
        </div>
        {subscription === "free" && (
          <button className="bg-blue-600/10 text-blue-500 border border-blue-500/20 px-6 py-2 rounded-full text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all">
            Upgrade to Pro
          </button>
        )}
      </header>

      {/* ÚJ MÁRKA HOZZÁADÁSA SZAKASZ */}
      <section
        className={`transition-all duration-500 ${
          brands.length >= limit
            ? "opacity-50 grayscale pointer-events-none"
            : "opacity-100"
        }`}
      >
        <div className="bg-white/5 border border-white/10 rounded-[40px] p-8 space-y-6 backdrop-blur-3xl">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Plus className="w-5 h-5 text-blue-500" /> Új ügyfél hozzáadása
          </h2>

          <div className="grid gap-4">
            {/* ✅ Website import */}
            <input
              placeholder="Weboldal (pl. contentfactoryapp.com)..."
              className="bg-black/40 border border-white/5 p-5 rounded-2xl outline-none focus:border-blue-500 transition-all text-white placeholder:text-slate-600"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />

            <button
              onClick={importFromWebsite}
              disabled={isImporting}
              className="bg-white/5 border border-white/10 py-4 rounded-2xl font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {isImporting ? "Import..." : "Import adatok a weboldalról"}
            </button>

            {/* kis infó, ha importáltunk */}
            {(importedWebsite || importedPalette || importedFonts) && (
              <div className="bg-black/30 border border-white/10 rounded-2xl p-4 text-xs text-white/70 space-y-2">
                <div className="font-black uppercase tracking-widest text-[10px] text-blue-500">
                  Import eredmény
                </div>
                {importedWebsite && (
                  <div>
                    <span className="text-white/50">Website:</span> {importedWebsite}
                  </div>
                )}
                {importedPalette && (
                  <div className="flex items-center gap-3">
                    <span className="text-white/50">Palette:</span>
                    <div
                      className="w-5 h-5 rounded-md border border-white/10"
                      style={{ background: importedPalette.primary }}
                      title={`primary: ${importedPalette.primary}`}
                    />
                    <div
                      className="w-5 h-5 rounded-md border border-white/10"
                      style={{ background: importedPalette.secondary }}
                      title={`secondary: ${importedPalette.secondary}`}
                    />
                    <div
                      className="w-5 h-5 rounded-md border border-white/10"
                      style={{ background: importedPalette.accent }}
                      title={`accent: ${importedPalette.accent}`}
                    />
                  </div>
                )}
                {importedFonts && (
                  <div>
                    <span className="text-white/50">Fonts:</span>{" "}
                    {importedFonts.headline || "?"} / {importedFonts.body || "?"}
                  </div>
                )}
              </div>
            )}

            {/* Márka mezők */}
            <input
              placeholder="Márkanév (pl. Tesla, Starbucks)..."
              className="bg-black/40 border border-white/5 p-5 rounded-2xl outline-none focus:border-blue-500 transition-all text-white placeholder:text-slate-600"
              value={newBrand.name}
              onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })}
            />

            <textarea
              placeholder="Márka leírása, tónusa, egyedi stílusjegyei..."
              className="bg-black/40 border border-white/5 p-5 rounded-2xl outline-none focus:border-blue-500 min-h-[120px] text-white placeholder:text-slate-600"
              value={newBrand.desc}
              onChange={(e) => setNewBrand({ ...newBrand, desc: e.target.value })}
            />

            <input
              placeholder="Ki a célközönség? (pl. 25-40 év közötti vállalkozók)..."
              className="bg-black/40 border border-white/5 p-5 rounded-2xl outline-none focus:border-blue-500 text-white placeholder:text-slate-600"
              value={newBrand.audience}
              onChange={(e) =>
                setNewBrand({ ...newBrand, audience: e.target.value })
              }
            />

            <button
              onClick={addBrand}
              className="bg-blue-600 py-5 rounded-2xl font-black uppercase tracking-widest text-white shadow-xl shadow-blue-600/20 hover:bg-blue-500 active:scale-[0.98] transition-all"
            >
              Ügyfél Mentése
            </button>
          </div>
        </div>

        {brands.length >= limit && (
          <div className="mt-6 bg-blue-600/10 border border-blue-500/20 p-6 rounded-[30px] text-center">
            <p className="text-blue-500 font-bold uppercase text-xs tracking-widest">
              Limit elérve ({limit}/{limit}). Frissíts csomagot több ügyfélhez!
            </p>
          </div>
        )}
      </section>

      {/* MÁRKÁK LISTÁJA */}
      <section className="space-y-6">
        <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-500">
          Mentett Ügyfelek
        </h2>
        <div className="grid gap-4">
          {brands.length === 0 ? (
            <div className="p-10 border-2 border-dashed border-white/5 rounded-[40px] text-center">
              <p className="text-slate-600 text-sm font-medium">
                Még nincsenek mentett márkáid.
              </p>
            </div>
          ) : (
            brands.map((brand) => (
              <div
                key={brand.id}
                className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-6 rounded-[30px] hover:border-blue-500/40 transition-all group"
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-blue-600/10 rounded-[20px] flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-600/20 transition-all">
                    <Building2 className="text-blue-500 w-6 h-6" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="font-bold text-white text-lg">
                      {brand.brand_name}
                    </h3>
                    <p className="text-xs text-slate-500 truncate max-w-[200px] md:max-w-md">
                      {brand.description || "Nincs leírás megadva"}
                    </p>

                    {/* ✅ opcionális: ha van website/palette, mutatjuk */}
                    <div className="mt-2 flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/40">
                      {brand.website ? (
                        <span className="truncate max-w-[220px]">
                          {brand.website}
                        </span>
                      ) : null}

                      {brand.palette ? (
                        <span className="flex items-center gap-1">
                          <span
                            className="w-3 h-3 rounded border border-white/10"
                            style={{ background: brand.palette.primary }}
                            title={`primary: ${brand.palette.primary}`}
                          />
                          <span
                            className="w-3 h-3 rounded border border-white/10"
                            style={{ background: brand.palette.secondary }}
                            title={`secondary: ${brand.palette.secondary}`}
                          />
                          <span
                            className="w-3 h-3 rounded border border-white/10"
                            style={{ background: brand.palette.accent }}
                            title={`accent: ${brand.palette.accent}`}
                          />
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => deleteBrand(brand.id)}
                  className="p-4 bg-red-500/5 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}