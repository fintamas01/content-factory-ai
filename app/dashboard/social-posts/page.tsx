"use client";

import Link from "next/link";
import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { Page, PageHero } from "@/app/components/ui/Page";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { SimpleModal } from "@/app/components/ui/SimpleModal";
import {
  SOCIAL_POST_TEMPLATES,
  type SocialPostTemplateDefinition,
} from "@/lib/creatomate/social-post-templates";
import { cn } from "@/app/lib/cn";

export default function SocialPostsTemplatePickerPage() {
  const [previewTemplate, setPreviewTemplate] =
    useState<SocialPostTemplateDefinition | null>(null);

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
              <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-full rounded-2xl"
                  onClick={() => setPreviewTemplate(t)}
                >
                  View
                </Button>
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

      <SimpleModal
        title={previewTemplate?.name ?? "Template preview"}
        open={Boolean(previewTemplate)}
        onClose={() => setPreviewTemplate(null)}
        maxWidthClass="max-w-4xl"
      >
        {previewTemplate ? (
          <div className="space-y-5">
            <div className="flex min-h-[min(52vh,480px)] items-center justify-center rounded-2xl border border-white/[0.08] bg-black/35 p-4 sm:p-6 md:min-h-[min(70vh,720px)] md:p-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewTemplate.previewImage}
                alt={`${previewTemplate.name} preview`}
                className="max-h-[min(65vh,680px)] w-full max-w-full object-contain md:max-h-[min(70vh,720px)]"
                loading="eager"
              />
            </div>
            <p className="text-sm leading-relaxed text-white/65">{previewTemplate.description}</p>
          </div>
        ) : null}
      </SimpleModal>
    </Page>
  );
}
