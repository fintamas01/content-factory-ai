"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, CornerDownLeft, Loader2, MessageSquare, Sparkles, X } from "lucide-react";
import { cn } from "@/app/lib/cn";
import type { CopilotMessage } from "@/lib/copilot/types";
import { useCopilotStore } from "@/app/components/copilot/CopilotProvider";

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const QUICK_ACTIONS: Array<{ label: string; prompt: string }> = [
  { label: "Improve this", prompt: "Improve this." },
  { label: "Make it more SEO", prompt: "Make this more SEO-focused while staying accurate." },
  { label: "Simplify this", prompt: "Simplify this for clarity without losing meaning." },
  { label: "Give alternatives", prompt: "Give me 3 strong alternatives with different angles." },
];

export function CopilotPanel({ className }: { className?: string }) {
  const { context } = useCopilotStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>(() => [
    {
      id: uid(),
      role: "assistant",
      content:
        "I’m your Live Co‑Pilot. Ask for improvements, rewrites, explanations, or next steps. I’ll use the current page context when available.",
      createdAt: Date.now(),
    },
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contextLabel = useMemo(() => {
    const bits = [];
    if (context.page) bits.push(context.page);
    bits.push(context.pathname);
    return bits.join(" · ");
  }, [context.page, context.pathname]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }, [open, messages.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setError(null);
    setLoading(true);
    setInput("");

    const userMsg: CopilotMessage = {
      id: uid(),
      role: "user",
      content: msg,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, context }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Copilot request failed.");
        return;
      }
      const assistant = typeof json.response === "string" ? json.response : "";
      if (!assistant.trim()) {
        setError("Copilot returned an empty response.");
        return;
      }
      const assistantMsg: CopilotMessage = {
        id: uid(),
        role: "assistant",
        content: assistant,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("fixed bottom-5 right-5 z-[60]", className)}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group inline-flex h-12 items-center gap-2 rounded-2xl border border-white/[0.10] bg-[#0b1220]/80 px-4 text-sm font-semibold text-white shadow-[0_24px_60px_-40px_rgba(0,0,0,0.95)] backdrop-blur-xl transition hover:border-white/[0.16] hover:bg-[#0b1220]/90 active:scale-[0.98]"
          aria-label="Open Copilot"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] shadow-inner">
            <Bot className="h-4 w-4 text-cyan-200" />
          </div>
          <span className="tracking-tight">Co‑Pilot</span>
          <span className="hidden sm:inline text-[11px] font-black uppercase tracking-[0.22em] text-white/50">
            Live
          </span>
        </button>
      ) : (
        <div className="w-[min(92vw,420px)] overflow-hidden rounded-[26px] border border-white/[0.10] bg-[#060911]/85 shadow-[0_44px_120px_-70px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-inner">
                  <Sparkles className="h-4 w-4 text-violet-200" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight text-white">
                    Live AI Co‑Pilot
                  </p>
                  <p className="truncate text-[11px] font-medium text-white/45">
                    {contextLabel}
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.10] bg-white/[0.04] text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/[0.16] hover:bg-white/[0.06] active:scale-[0.98]"
              aria-label="Close Copilot"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 pt-4">
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => send(a.prompt)}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.03] px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/70 transition hover:border-white/[0.16] hover:bg-white/[0.06] active:scale-[0.99] disabled:opacity-50"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-white/50" />
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div
            ref={scrollRef}
            className="mt-4 h-[360px] overflow-y-auto px-4 pb-4"
          >
            <div className="space-y-3">
              {messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    className={cn("flex", isUser ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm",
                        isUser
                          ? "border border-cyan-500/20 bg-cyan-500/10 text-cyan-50"
                          : "border border-white/[0.10] bg-white/[0.04] text-white/85"
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })}

              {loading ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-[13px] text-white/75">
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />
                    Thinking…
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-[13px] text-red-200">
                  {error}
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-t border-white/[0.08] p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex items-end gap-2"
            >
              <div className="flex-1">
                <label className="sr-only" htmlFor="copilot-input">
                  Message
                </label>
                <textarea
                  id="copilot-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything about this page…"
                  rows={2}
                  className="w-full resize-none rounded-2xl border border-white/[0.10] bg-black/30 px-4 py-3 text-[13px] font-medium text-white/90 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition placeholder:text-white/35 focus:border-white/[0.16] focus:shadow-[0_0_0_3px_var(--ring)]"
                  disabled={loading}
                />
                <p className="mt-2 text-[11px] font-medium text-white/35">
                  Tip: paste the exact block you want rewritten for best results.
                </p>
              </div>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-2xl bg-white text-black shadow-[0_18px_44px_-28px_rgba(255,255,255,0.45)] transition hover:bg-white/90 active:scale-[0.98] disabled:opacity-50"
                aria-label="Send"
              >
                <CornerDownLeft className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

