"use client";
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { History, Trash2, X, Calendar, MessageSquare, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setHistory(data || []);
    }
    setLoading(false);
  };

  const deleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Biztosan törölni szeretnéd?")) return;
    const { error } = await supabase.from('generations').delete().eq('id', id);
    if (!error) {
      setHistory(history.filter(item => item.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="p-8 md:p-12 max-w-6xl mx-auto min-h-screen">
      <div className="flex items-center gap-4 mb-12">
        <div className="p-3 bg-blue-600/10 rounded-2xl">
          <History className="w-8 h-8 text-blue-600" />
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tighter">Archives</h1>
          <p className="text-slate-500 font-medium">A korábbi kampányaid és generálásaid.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-white/5 animate-pulse rounded-[24px]" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-20 bg-slate-100 dark:bg-white/5 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-white/10">
          <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-bold">Még nincs mentett generálásod.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {history.map((item) => (
            <motion.div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group cursor-pointer bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-[24px] hover:border-blue-500/50 hover:shadow-xl transition-all flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="px-2 py-0.5 bg-blue-600/10 text-blue-600 text-[9px] font-black uppercase rounded-md tracking-wider">
                    {item.tone}
                  </span>
                  <span className="text-slate-400 text-[10px] flex items-center gap-1 font-bold">
                    <Calendar className="w-3 h-3" /> {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 font-bold truncate">
                  {item.original_content}
                </p>
              </div>
              <button 
                onClick={(e) => deleteItem(item.id, e)}
                className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* DETAIL MODAL */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-slate-50 dark:bg-[#0f172a] rounded-[40px] shadow-3xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-white dark:bg-black/20">
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Campaign Details</h2>
                  <p className="text-sm text-slate-500 font-medium truncate max-w-md italic">"{selectedItem.original_content}"</p>
                </div>
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="p-3 bg-slate-100 dark:bg-white/10 rounded-2xl hover:bg-red-500 hover:text-white transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {Object.entries(selectedItem.results || {}).map(([platform, data]: any) => (
                  <div key={platform} className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-3xl p-6 relative group">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">{platform.replace(/_/g, ' ')}</h3>
                      <button 
                        onClick={() => copyToClipboard(typeof data === 'object' ? data.content : data, platform)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all"
                      >
                        {copiedKey === platform ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        {copiedKey === platform ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                      {typeof data === 'object' ? data.content : data}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}