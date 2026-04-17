"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Image as ImageIcon, Loader2 } from "lucide-react";
import { Page, PageHero } from "@/app/components/ui/Page";
import { Card } from "@/app/components/ui/Card";
import { Input } from "@/app/components/ui/Input";
import { Textarea } from "@/app/components/ui/Textarea";
import { Button } from "@/app/components/ui/Button";
import {
  getSocialPostTemplateById,
  type SocialPostTemplateDefinition,
} from "@/lib/creatomate/social-post-templates";

type ApiOk = { success: true; url: string };
type ApiErr = { success: false; error: string; details?: unknown };
type ApiResponse = ApiOk | ApiErr | Record<string, unknown>;

function emptyValuesForTemplate(t: SocialPostTemplateDefinition): Record<string, string> {
  const v: Record<string, string> = {};
  for (const f of t.fields) v[f.key] = "";
  return v;
}

export default function SocialPostsTemplateFormPage() {
  const params = useParams();
  const templateId = typeof params?.templateId === "string" ? params.templateId : "";

  const template = useMemo(() => getSocialPostTemplateById(templateId), [templateId]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (template) setValues(emptyValuesForTemplate(template));
  }, [template]);

  const canSubmit = useMemo(() => {
    if (!template) return false;
    return template.fields.every((f) => {
      if (f.required === false) return true;
      return Boolean(values[f.key]?.trim());
    });
  }, [template, values]);

  const handleSubmit = async (
    e?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>
  ) => {
    e?.preventDefault();
    if (!template) return;
    setError(null);
    setUrl(null);
    setLoading(true);
    try {
      const payload = { templateId: template.id, values };
      console.log("Submitting Creatomate request", payload);

      const res = await fetch("/api/creatomate/render-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || (json as ApiOk | ApiErr).success !== true) {
        const err =
          typeof (json as ApiErr)?.error === "string"
            ? (json as ApiErr).error
            : "Request failed.";
        setError(err);
        return;
      }

      const ok = json as ApiOk;
      if (typeof ok.url !== "string" || !ok.url) {
        setError("Unexpected response: missing url.");
        return;
      }

      setUrl(ok.url);
    } catch (err) {
      console.error("Creatomate request failed:", err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!templateId) {
    return (
      <Page>
        <p className="text-sm text-white/60">Invalid template.</p>
      </Page>
    );
  }

  if (!template) {
    return (
      <Page>
        <PageHero
          icon={<ImageIcon className="h-5 w-5" aria-hidden />}
          eyebrow="Creatomate"
          title="Template not found"
          description="This template id is not in the registry."
        />
        <Link
          href="/dashboard/social-posts"
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-[12px] font-semibold text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/16 hover:bg-white/[0.06]"
        >
          Back to templates
        </Link>
      </Page>
    );
  }

  return (
    <Page>
      <div className="mb-4">
        <Link
          href="/dashboard/social-posts"
          className="inline-flex items-center gap-2 text-sm font-medium text-white/60 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All templates
        </Link>
      </div>

      <PageHero
        icon={<ImageIcon className="h-5 w-5" aria-hidden />}
        eyebrow="Creatomate"
        title={template.name}
        description={template.description}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Fields</p>
          <p className="mt-2 text-sm text-white/60">
            Template <span className="font-mono text-white/75">{template.id}</span>
          </p>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {template.fields.map((field) => (
              <div key={field.key}>
                <label className="text-xs font-semibold text-white/60">{field.label}</label>
                {field.type === "textarea" ? (
                  <Textarea
                    value={values[field.key] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    className="mt-1.5 min-h-[120px] rounded-2xl"
                    disabled={loading}
                    required={field.required !== false}
                  />
                ) : (
                  <Input
                    value={values[field.key] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    type={field.type === "url" ? "url" : "text"}
                    className="mt-1.5 rounded-2xl"
                    disabled={loading}
                    required={field.required !== false}
                  />
                )}
              </div>
            ))}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="rounded-2xl"
                disabled={loading || !canSubmit}
                onClick={handleSubmit}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Generating…
                  </>
                ) : (
                  "Generate Post"
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="rounded-2xl"
                disabled={loading}
                onClick={() => {
                  setError(null);
                  setUrl(null);
                  setValues(emptyValuesForTemplate(template));
                }}
              >
                Reset
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Preview</p>
          <p className="mt-2 text-sm text-white/60">Generated image appears here.</p>

          {url ? (
            <div className="mt-5 space-y-3">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Generated post" className="block h-auto w-full" loading="lazy" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                  Image URL
                </p>
                <p className="mt-1 break-all font-mono text-sm leading-snug text-white/70">{url}</p>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/15 px-4 py-6 text-sm text-white/45">
              Generate an image to see the preview.
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
