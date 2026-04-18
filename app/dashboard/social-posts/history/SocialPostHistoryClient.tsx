"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Copy, Check, ExternalLink, RotateCcw } from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import {
  SOCIAL_POST_REUSE_SESSION_KEY,
  type SocialPostReusePayload,
} from "@/lib/creatomate/social-post-templates";

export type SocialPostHistoryItem = {
  id: string;
  template_id: string | null;
  template_name: string;
  values: Record<string, unknown> | null;
  output_url: string;
  created_at: string;
  headline: string | null;
};

function displayTitle(row: SocialPostHistoryItem): string {
  const h = typeof row.headline === "string" ? row.headline.trim() : "";
  if (h) return h;
  const v = row.values;
  if (v && typeof v === "object") {
    if (typeof v.headline === "string" && v.headline.trim()) return v.headline.trim();
    if (typeof v.title === "string" && v.title.trim()) return v.title.trim();
  }
  return row.template_name;
}

export function SocialPostHistoryClient({ items }: { items: SocialPostHistoryItem[] }) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyUrl = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* ignore */
    }
  };

  const onReuse = (row: SocialPostHistoryItem) => {
    if (!row.template_id) return;
    const payload: SocialPostReusePayload = {
      templateId: row.template_id,
      values: row.values && typeof row.values === "object" ? row.values : {},
    };
    sessionStorage.setItem(SOCIAL_POST_REUSE_SESSION_KEY, JSON.stringify(payload));
    router.push(`/dashboard/social-posts/${row.template_id}?reuse=1`);
  };

  if (items.length === 0) {
    return (
      <Card className="border-dashed border-white/15 bg-black/20 p-10 text-center">
        <p className="text-sm font-medium text-white/75">No generations yet</p>
        <p className="mt-2 text-sm text-white/45">
          Generate a social post image from a template — it will show up here automatically.
        </p>
        <Link
          href="/dashboard/social-posts"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl border border-cyan-400/25 bg-gradient-to-r from-cyan-500/20 via-violet-500/15 to-transparent px-6 text-[12px] font-semibold text-white shadow-[0_0_32px_-18px_rgba(34,211,238,0.55)] transition hover:border-cyan-300/35 hover:bg-white/[0.06]"
        >
          Browse templates
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((row) => (
        <Card key={row.id} className="flex flex-col overflow-hidden p-0">
          <div className="relative aspect-square w-full bg-black/35">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={row.output_url}
              alt=""
              className="h-full w-full object-contain"
              loading="lazy"
            />
          </div>
          <div className="flex flex-1 flex-col gap-3 p-5">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                {row.template_name}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-white">
                {displayTitle(row)}
              </p>
              <p className="mt-2 text-[11px] font-mono text-white/40">
                {new Date(row.created_at).toLocaleString()}
              </p>
            </div>
            <div className="mt-auto flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => void copyUrl(row.id, row.output_url)}
                >
                  {copiedId === row.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      Copy URL
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-xl"
                  disabled={!row.template_id}
                  onClick={() => onReuse(row)}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Reuse
                </Button>
              </div>
              <a
                href={row.output_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-gradient-to-r from-cyan-500/20 via-violet-500/15 to-transparent px-4 text-[12px] font-semibold text-white shadow-[0_0_24px_-18px_rgba(34,211,238,0.55)] transition hover:border-cyan-300/35 hover:bg-white/[0.06]"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Open image
              </a>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
