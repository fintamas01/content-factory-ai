"use client";
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { History, Trash2, ExternalLink, Calendar, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const deleteItem = async (id: string) => {
    if (!confirm("Biztosan törölni szeretnéd ezt a generálást?")) return;
    const { error } = await supabase.from('generations').delete().eq('id', id);
    if (!error) {
      setHistory(history.filter(item => item.id !== id));
    }
  };

  return (
    <div className="p-8 md:p-12 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-12">
        <div className="p-3 bg-blue-600/10 rounded-2xl">
          <History className="w-8 h-8 text-blue-600" />
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tighter">Archives</h1>
          <p className="text-slate-500 font-medium">A korábbi generálásaid gyűjteménye.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-slate-100 dark:bg-white/5 animate-pulse rounded-[32px]" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-20 bg-slate-100 dark:bg-white/5 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-white/10">
          <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-bold">Még nincs mentett generálásod.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          <AnimatePresence mode='popLayout'>
            {history.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-6 rounded-[32px] hover:border-blue-500/50 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-blue-600/10 text-blue-600 text-[10px] font-black uppercase rounded-full">
                      {item.tone}
                    </span>
                    <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 font-medium line-clamp-1 italic">
                    "{item.original_content}"
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => { /* Itt megnyithatnál egy modalt a részletekkel */ }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 dark:bg-white/10 hover:bg-blue-600 hover:text-white rounded-2xl text-sm font-bold transition-all"
                  >
                    View <ExternalLink className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => deleteItem(item.id)}
                    className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}