"use client";

import Link from "next/link";
import { Image as ImageIcon } from "lucide-react";
import { Page, PageHero } from "@/app/components/ui/Page";
import { Card } from "@/app/components/ui/Card";
import { SOCIAL_POST_TEMPLATES } from "@/lib/creatomate/social-post-templates";
import { cn } from "@/app/lib/cn";

export default function SocialPostsTemplatePickerPage() {
  return (
    <Page>
      <PageHero
        icon={<ImageIcon className="h-5 w-5" aria-hidden />}
        eyebrow="Creatomate"
        title="Social post images"
        description="Choose a template, then fill in the fields to generate an image."
      />

      <div className="grid gap-6 sm:grid-cols-2">
        {SOCIAL_POST_TEMPLATES.map((t) => (
          <Card key={t.id} className="flex flex-col overflow-hidden p-0">
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.previewImage}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                  Template
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">{t.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{t.description}</p>
              </div>
              <div className="mt-auto pt-2">
                <Link
                  href={`/dashboard/social-posts/${t.id}`}
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border text-[12px] font-semibold tracking-wide transition-[transform,background,border-color,box-shadow,color] duration-200 active:scale-[0.98]",
                    "h-11 px-5",
                    "border-cyan-400/25 bg-gradient-to-r from-cyan-500/20 via-violet-500/15 to-transparent text-white shadow-[0_0_32px_-18px_rgba(34,211,238,0.55)] hover:border-cyan-300/35 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--ring),0_0_32px_-18px_rgba(34,211,238,0.55)]"
                  )}
                >
                  Use template
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}
