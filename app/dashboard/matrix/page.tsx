"use client";
import { useState, useEffect, useRef } from 'react';
import { Lock, Sparkles, Loader2, Calendar, Copy, X, Check, Edit3, Image as ImageIcon, Download, Upload, ChevronLeft, ChevronRight, Trash2, Briefcase, History, RefreshCcw, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MatrixItem {
  day: string;
  title: string;
  platform: string;
  outline: string;
  content: string;
  generatedImageUrl?: string | null;
  slides?: string[];
  isRegenerating?: boolean;
}

interface BrandProfile {
  id: string;
  brand_name: string;
  target_audience: string;
  description: string;
}

interface HistoryItem {
  id: string;
  created_at: string;
  brand_name: string;
  generation_data: {
    days: MatrixItem[];
  };
}

export default function ContentMatrix() {
  const [userPlan, setUserPlan] = useState('free');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  const [selectedPost, setSelectedPost] = useState<MatrixItem | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'text' | 'visual' | 'image'>('text');
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<string[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [slideImages, setSlideImages] = useState<(string | null)[]>([]);
  const [imageGenerating, setImageGenerating] = useState(false);

  const [savedBrands, setSavedBrands] = useState<BrandProfile[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");

  const [matrixData, setMatrixData] = useState<MatrixItem[]>([]);
  const [formData, setFormData] = useState({ brand: '', audience: '', topic: '', tone: 'Professzionális' });

  // History states
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
  );

  useEffect(() => {
    async function loadInitialData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('price_id, status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        
        if (sub?.price_id) setUserPlan('pro'); 
        else setUserPlan('free');

        const { data: brands } = await supabase
          .from('brand_profiles')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (brands) setSavedBrands(brands as BrandProfile[]);
      }
      setLoading(false);
    }
    loadInitialData();
  }, [supabase]);

  // --- JAVÍTOTT PDF EXPORT (MAGYAR KARAKTEREKKEL) ---
  const handleExportPDF = async () => {
    if (matrixData.length === 0) return alert("Nincs mit exportálni!");

    // Betöltés jelzése (opcionális, de szép UX)
    const originalText = document.body.style.cursor;
    document.body.style.cursor = 'wait';

    try {
        const doc = new jsPDF();

        // 1. Font letöltése (Roboto - ez ismeri az ő/ű betűket)
        const fontResponse = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf');
        const fontBlob = await fontResponse.blob();
        
        // 2. Konvertálás base64-re (amit a jsPDF megért)
        const reader = new FileReader();
        reader.readAsDataURL(fontBlob);
        
        reader.onloadend = () => {
            const base64data = reader.result?.toString().split(',')[1];
            
            if (base64data) {
                // 3. Font hozzáadása a PDF-hez
                doc.addFileToVFS("Roboto-Regular.ttf", base64data);
                doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
                doc.setFont("Roboto"); // Beállítjuk aktívnak

                // Fejléc
                doc.setFontSize(18);
                doc.text(`Tartalomterv: ${formData.brand || 'Márka'}`, 14, 22);
                
                doc.setFontSize(11);
                doc.setTextColor(100);
                doc.text(`Téma: ${formData.topic} | Generálva: ${new Date().toLocaleDateString('hu-HU')}`, 14, 30);

                // Táblázat adatok
                const tableRows = matrixData.map(post => [
                    post.day,
                    post.platform,
                    post.title,
                    post.content // Itt már nem vágom le, hadd férjen ki
                ]);

                // Táblázat generálása (fontos: itt is megadjuk a fontot!)
                autoTable(doc, {
                    head: [['Nap', 'Platform', 'Cím', 'Tartalom']],
                    body: tableRows,
                    startY: 40,
                    styles: { 
                        font: "Roboto", // Fontos: a táblázat is ezt használja!
                        fontSize: 10, 
                        cellPadding: 3,
                        overflow: 'linebreak' // Sortörés, ha hosszú a szöveg
                    },
                    headStyles: { fillColor: [37, 99, 235] },
                    columnStyles: {
                        0: { cellWidth: 20 }, // Nap
                        1: { cellWidth: 20 }, // Platform
                        2: { cellWidth: 40 }, // Cím
                        3: { cellWidth: 'auto' } // Tartalom (maradék hely)
                    }
                });

                // Mentés
                doc.save(`${formData.brand}_heti_terv.pdf`);
            }
            document.body.style.cursor = originalText;
        };

    } catch (error) {
        console.error("PDF Hiba:", error);
        alert("Hiba történt a PDF generálásakor.");
        document.body.style.cursor = originalText;
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data } = await supabase
            .from('matrix_generations')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (data) setHistoryItems(data);
    }
    setLoadingHistory(false);
  };

  const loadFromHistory = (item: HistoryItem) => {
    if (confirm("Ez felülírja a jelenlegi képernyőt. Biztosan betöltöd?")) {
        setMatrixData(item.generation_data.days || []);
        setFormData(prev => ({ ...prev, brand: item.brand_name }));
        setShowHistory(false);
    }
  };

  const handleBrandSelect = (brandId: string) => {
    setSelectedBrandId(brandId);
    if (brandId === "") return; 
    const brand = savedBrands.find(b => b.id === brandId);
    if (brand) {
        setFormData(prev => ({
            ...prev,
            brand: brand.brand_name,
            audience: brand.target_audience
        }));
    }
  };

  // Carousel & Image Logic
  useEffect(() => {
    if (selectedPost && viewMode === 'visual') {
      let generatedSlides: string[] = [];
      if (selectedPost.slides && selectedPost.slides.length > 0) {
        generatedSlides = selectedPost.slides;
      } else {
        generatedSlides = [selectedPost.title, "Részletek a leírásban..."];
      }
      const lastSlide = generatedSlides[generatedSlides.length - 1];
      if (!lastSlide.includes('@')) {
         generatedSlides.push(`Kövess minket!\n@${formData.brand || 'Márka'}`);
      }
      setSlides(generatedSlides);
      setCurrentSlide(0);
      setSlideImages(new Array(generatedSlides.length).fill(null));
    }
  }, [selectedPost, viewMode, formData.brand]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImages = [...slideImages];
        newImages[currentSlide] = reader.result as string;
        setSlideImages(newImages);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    const newImages = [...slideImages];
    newImages[currentSlide] = null;
    setSlideImages(newImages);
  };

  const handleDownloadSlide = async () => {
    if (!carouselRef.current) return;
    setDownloading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      const canvas = await html2canvas(carouselRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        allowTaint: true,
      });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `${formData.brand}_slide_${currentSlide + 1}.png`;
      link.click();
    } catch (err) {
      console.error(err);
      alert("Hiba a letöltéskor.");
    } finally {
      setDownloading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!selectedPost) return;
    setImageGenerating(true);
    try {
      const promptBase = selectedPost.content || selectedPost.outline;
      const res = await fetch('/api/matrix/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptBase }),
      });
      if (!res.ok) throw new Error("API Hiba");
      const data = await res.json();
      if (data.imageUrl) {
        setSelectedPost({ ...selectedPost, generatedImageUrl: data.imageUrl });
      }
    } catch (error) {
      console.error(error);
      alert("Nem sikerült a képet legenerálni.");
    } finally {
      setImageGenerating(false);
    }
  };

  const handleDownloadAIImage = async () => {
    if (!selectedPost?.generatedImageUrl) return;
    try {
      const imageBlob = await fetch(selectedPost.generatedImageUrl).then(r => r.blob());
      const imageURL = URL.createObjectURL(imageBlob);
      const link = document.createElement("a");
      link.href = imageURL;
      link.download = `ai_image_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Használd a jobb klikk -> Mentés másként opciót.");
    }
  };

  const handleRegenerateSingle = async (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const postToRegenerate = matrixData[index];
    if (!postToRegenerate) return;

    const newData = [...matrixData];
    newData[index] = { ...postToRegenerate, isRegenerating: true };
    setMatrixData(newData);

    try {
        const res = await fetch('/api/matrix/regenerate-single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                brand: formData.brand,
                audience: formData.audience,
                topic: formData.topic,
                tone: formData.tone,
                day: postToRegenerate.day,
                platform: postToRegenerate.platform,
                currentPost: postToRegenerate
            }),
        });
        const newPost = await res.json();
        const updatedData = [...matrixData];
        updatedData[index] = { ...newPost, isRegenerating: false };
        setMatrixData(updatedData);
    } catch (error) {
        console.error(error);
        alert("Nem sikerült frissíteni a posztot.");
        const errorData = [...matrixData];
        errorData[index] = { ...postToRegenerate, isRegenerating: false };
        setMatrixData(errorData);
    }
  };

  const handleCopy = () => {
    if (selectedPost) {
      navigator.clipboard.writeText(selectedPost.content || selectedPost.outline);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const isPro = userPlan !== 'free';
  const mockDays = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek"];
  
  const tones = [
    { id: 'professional', label: '👔 Professzionális', value: 'Professzionális' },
    { id: 'funny', label: '😂 Humoros', value: 'Humoros' },
    { id: 'provocative', label: '🔥 Provokatív', value: 'Provokatív' },
  ];

  const handleGenerate = async () => {
    if (!formData.brand || !formData.topic) {
      alert("Kérlek töltsd ki a márka nevét és a témát!");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/matrix/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      setMatrixData(data.days || []);
    } catch (error) {
      console.error(error);
      alert("Hiba történt a generálás során.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500"/></div>;

  return (
    <div className="p-6 md:p-8 bg-slate-950 min-h-screen text-white font-sans relative">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 tracking-tight">
            <Calendar className="text-blue-500" /> Smart Content Matrix
          </h1>
          <p className="text-slate-400 mt-1">Heti stratégia és kész posztok egy kattintással.</p>
        </div>
        
        <div className="flex items-center gap-3">
            {/* EXPORT GOMB (Csak ha van tartalom) */}
            {matrixData.length > 0 && (
                <button 
                    onClick={handleExportPDF}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                >
                    <FileText className="w-4 h-4" /> Export (PDF)
                </button>
            )}

            <button 
                onClick={() => { setShowHistory(true); fetchHistory(); }}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-all border border-white/10"
            >
                <History className="w-4 h-4 text-slate-400" /> Előzmények
            </button>

            {isPro && (
            <div className="bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-full flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Pro Aktív</span>
            </div>
            )}
        </div>
      </div>

      {/* INPUT CONTAINER */}
      <div className="mb-10 bg-slate-900/40 p-6 rounded-2xl border border-white/5 shadow-xl space-y-4">
        
        {savedBrands.length > 0 && (
            <div className="flex items-center gap-3 bg-blue-500/5 border border-blue-500/10 p-3 rounded-xl animate-in fade-in">
                <Briefcase className="w-5 h-5 text-blue-500" />
                <select 
                    className="bg-transparent text-white outline-none w-full cursor-pointer text-sm font-medium"
                    value={selectedBrandId}
                    onChange={(e) => handleBrandSelect(e.target.value)}
                >
                    <option value="" className="bg-slate-900">-- Válassz mentett ügyfelet / márkát --</option>
                    {savedBrands.map(b => (
                        <option key={b.id} value={b.id} className="bg-slate-900">
                            {b.brand_name}
                        </option>
                    ))}
                </select>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input 
            placeholder="Márka neve" 
            className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none text-white transition-all"
            value={formData.brand}
            onChange={(e) => setFormData({...formData, brand: e.target.value})}
          />
          <input 
            placeholder="Célközönség" 
            className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none text-white transition-all"
            value={formData.audience}
            onChange={(e) => setFormData({...formData, audience: e.target.value})}
          />
          <input 
            placeholder="Téma" 
            className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none text-white transition-all"
            value={formData.topic}
            onChange={(e) => setFormData({...formData, topic: e.target.value})}
          />
          <div className="relative">
            <select 
              className="w-full appearance-none bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:border-blue-500 outline-none text-white cursor-pointer transition-all"
              value={formData.tone}
              onChange={(e) => setFormData({...formData, tone: e.target.value})}
            >
              {tones.map((t) => <option key={t.id} value={t.value} className="bg-slate-900">{t.label}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <ChevronRight className="w-4 h-4 text-slate-500 rotate-90" />
            </div>
          </div>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={generating || !isPro}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
        >
          {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5" /> Generálás</>}
        </button>
      </div>
      
      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative min-h-[300px]">
        {!isPro && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm rounded-2xl border border-white/10">
            <div className="bg-slate-900 p-8 rounded-3xl border border-white/10 shadow-2xl text-center max-w-sm">
              <Lock className="w-12 h-12 text-blue-500 mb-4 mx-auto" />
              <h2 className="text-2xl font-bold mb-2">Pro Funkció</h2>
              <button onClick={() => router.push('/billing')} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold mt-4">Upgrade Most</button>
            </div>
          </div>
        )}

        {matrixData.length > 0 ? (
          matrixData.map((item, index) => (
            <div 
              key={index} 
              onClick={() => { setSelectedPost(item); setViewMode('text'); }}
              className="group cursor-pointer p-5 rounded-2xl border border-white/5 bg-slate-900 hover:border-blue-500/50 hover:bg-slate-800 transition-all flex flex-col h-full relative overflow-hidden"
            >
              <button 
                onClick={(e) => handleRegenerateSingle(index, e)}
                disabled={item.isRegenerating}
                className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-blue-600 rounded-lg text-slate-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                title="Újragenerálás (Remix)"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${item.isRegenerating ? 'animate-spin text-blue-400' : ''}`} />
              </button>

              <div className="flex justify-between items-center mb-4">
                <span className="text-blue-400 font-bold uppercase text-[10px] tracking-widest">{item.day}</span>
                <span className="bg-white/5 text-[10px] px-2 py-1 rounded text-slate-300 font-medium">{item.platform}</span>
              </div>
              <h3 className="text-sm font-bold mb-3 leading-tight text-white group-hover:text-blue-200">
                 {item.isRegenerating ? <span className="animate-pulse">Új verzió írása... ✍️</span> : item.title}
              </h3>
              <p className="text-xs text-slate-400 line-clamp-4 mb-4">
                 {item.isRegenerating ? "Az AI éppen újragondolja ezt a posztot..." : item.outline}
              </p>
              <div className="mt-auto flex items-center gap-2 text-xs font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                <Edit3 className="w-3 h-3" /> Szerkesztés
              </div>
            </div>
          ))
        ) : (
          mockDays.map((day) => (
            <div key={day} className={`p-5 rounded-2xl border border-slate-800 bg-slate-900/30 ${!isPro ? 'blur-sm select-none' : ''}`}><span className="text-slate-600 font-bold text-[10px] uppercase tracking-widest">{day}</span></div>
          ))
        )}
      </div>

      {/* --- EDIT MODAL --- */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedPost(null)} />
          
          <div className="relative w-full max-w-4xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            <div className="flex flex-col md:flex-row items-center justify-between p-6 border-b border-white/5 bg-slate-900 z-10 gap-4">
              <div className="flex-1 min-w-0">
                  <span className="text-blue-500 font-bold uppercase tracking-widest text-xs">{selectedPost.day}</span>
                  <h3 className="text-xl font-bold text-white truncate">{selectedPost.title}</h3>
              </div>
               
               <div className="flex bg-slate-800 p-1 rounded-lg shrink-0">
                  <button onClick={() => setViewMode('text')} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'text' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'}`}>
                    <Edit3 className="w-4 h-4" /> Szöveg
                  </button>
                  <button onClick={() => setViewMode('visual')} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'visual' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'}`}>
                    <ImageIcon className="w-4 h-4" /> Poszt Dizájn
                  </button>
                  <button onClick={() => setViewMode('image')} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'image' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                    <Sparkles className="w-4 h-4" /> AI Illusztráció
                  </button>
               </div>
               
              <button onClick={() => setSelectedPost(null)} className="p-2 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950 relative">
              
              {viewMode === 'text' && (
                <div className="p-8">
                   <div className="mb-6 bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                    <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Stratégia</label>
                    <p className="text-sm text-slate-300 italic">{selectedPost.outline}</p>
                   </div>
                   <textarea 
                    className="w-full h-96 bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-200 focus:border-blue-500 outline-none resize-none leading-relaxed font-mono text-sm shadow-inner"
                    value={selectedPost.content}
                    onChange={(e) => setSelectedPost({...selectedPost, content: e.target.value})}
                   />
                </div>
              )}

              {viewMode === 'visual' && (
                <div className="p-8 flex flex-col items-center justify-center min-h-[500px]">
                  
                  <div className="mb-6 flex gap-4">
                     <label className="cursor-pointer px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold flex items-center gap-2 transition-all border border-white/10">
                        <Upload className="w-4 h-4" /> 
                        Kép feltöltése erre a diára ({currentSlide + 1}.)
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                     </label>
                     {slideImages[currentSlide] && (
                        <button onClick={handleRemoveImage} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
                           <Trash2 className="w-4 h-4" /> Törlés
                        </button>
                     )}
                  </div>

                  <div className="relative shadow-2xl shadow-blue-900/20 mb-8">
                    <div 
                      ref={carouselRef}
                      className="w-[400px] h-[500px] flex flex-col p-8 relative overflow-hidden"
                      style={{ 
                        backgroundColor: '#0f172a', 
                        backgroundImage: slideImages[currentSlide] ? `url(${slideImages[currentSlide]})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        fontFamily: 'sans-serif',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      {slideImages[currentSlide] && (
                        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
                      )}

                      {!slideImages[currentSlide] && (
                        <>
                          <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10" style={{ background: '#1e3a8a' }}/>
                          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl -ml-10 -mb-10" style={{ background: '#312e81' }}/>
                        </>
                      )}

                      <div className="relative z-10 flex items-center gap-2 mb-6">
                         <div className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                            <Sparkles className="w-4 h-4" style={{ color: '#60a5fa' }} />
                         </div>
                         <span className="font-bold text-xs uppercase tracking-widest" style={{ color: '#e2e8f0' }}>
                            {formData.brand || 'BRAND'}
                         </span>
                      </div>

                      <div className="relative z-10 flex-1 flex flex-col justify-center">
                        {currentSlide === 0 ? (
                           <h1 className="text-3xl font-black leading-tight drop-shadow-lg" style={{ color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                             {slides[0]}
                           </h1>
                        ) : (
                           <p className="text-lg font-medium leading-relaxed whitespace-pre-wrap drop-shadow-md" style={{ color: '#f8fafc', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                             {slides[currentSlide]}
                           </p>
                        )}
                      </div>

                      <div className="relative z-10 mt-6 flex justify-between items-center pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                        <span className="text-xs" style={{ color: '#cbd5e1' }}>Lapozz tovább 👉</span>
                        <div className="flex gap-1">
                          {slides.map((_, idx) => (
                            <div 
                              key={idx} 
                              className="h-1 rounded-full transition-all"
                              style={{ 
                                width: idx === currentSlide ? '24px' : '4px',
                                background: idx === currentSlide ? '#60a5fa' : '#475569'
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <button onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0} className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 border border-white/5">
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <span className="font-mono font-bold text-slate-400">{currentSlide + 1} / {slides.length}</span>
                    <button onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1} className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 border border-white/5">
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              )}

              {viewMode === 'image' && (
                <div className="p-8 flex flex-col items-center justify-center min-h-[500px]">
                  {!selectedPost.generatedImageUrl && !imageGenerating && (
                    <div className="text-center max-w-md">
                      <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Sparkles className="w-10 h-10 text-blue-500" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">AI Illusztráció</h3>
                      <p className="text-slate-400 mb-8">Generálj egyedi, jogtiszta képet a DALL-E 3 segítségével.</p>
                      <button onClick={handleGenerateImage} className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white font-bold flex items-center gap-3">
                        <ImageIcon className="w-5 h-5" /> Kép Generálása
                      </button>
                    </div>
                  )}
                  {imageGenerating && (
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                      <p className="text-slate-300">Generálás... (kb. 15 mp)</p>
                    </div>
                  )}
                  {selectedPost.generatedImageUrl && !imageGenerating && (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in">
                      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 mb-6 max-h-[450px]">
                        <img src={selectedPost.generatedImageUrl} alt="AI Generated" className="h-full w-auto object-contain" />
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="p-6 border-t border-white/5 bg-slate-900/50 flex justify-end gap-3 z-10">
               {viewMode === 'text' && (
                 <button onClick={handleCopy} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${isCopied ? 'bg-green-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
                   {isCopied ? <><Check className="w-4 h-4" /> Másolva</> : <><Copy className="w-4 h-4" /> Szöveg Másolása</>}
                 </button>
               )}
               {viewMode === 'visual' && (
                 <button onClick={handleDownloadSlide} disabled={downloading} className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 shadow-lg">
                   {downloading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />} Letöltés
                 </button>
               )}
               {viewMode === 'image' && (
                 <button onClick={handleDownloadAIImage} disabled={!selectedPost.generatedImageUrl} className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold flex items-center gap-2">
                   <Download className="w-4 h-4" /> Kép Letöltése
                 </button>
               )}
            </div>

          </div>
        </div>
      )}

      {/* --- ELŐZMÉNYEK MODAL --- */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
            
            <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in fade-in zoom-in">
                <div className="p-5 border-b border-white/5 bg-slate-900 flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <History className="w-5 h-5 text-blue-500" /> Előzmények (Smart Matrix)
                    </h2>
                    <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-white/10 rounded-full">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {loadingHistory ? (
                        <div className="text-center py-10"><Loader2 className="animate-spin text-blue-500 mx-auto" /></div>
                    ) : historyItems.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">Még nincsenek mentett mátrixaid.</div>
                    ) : (
                        historyItems.map((item) => (
                            <div 
                                key={item.id} 
                                onClick={() => loadFromHistory(item)}
                                className="bg-slate-950 border border-white/5 p-4 rounded-xl hover:border-blue-500/40 cursor-pointer transition-all flex justify-between items-center group"
                            >
                                <div>
                                    <div className="font-bold text-white mb-1">{item.brand_name}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(item.created_at).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                                <button className="bg-slate-800 text-xs px-3 py-1.5 rounded-lg text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    Betöltés
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}

    </div>
  );
}