"use client";

import { useMemo, useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowLeft, Image as ImageIcon, Loader2, Sparkles, Upload } from "lucide-react";
import { Page, PageHero } from "@/app/components/ui/Page";
import { Card } from "@/app/components/ui/Card";
import { Input } from "@/app/components/ui/Input";
import { Textarea } from "@/app/components/ui/Textarea";
import { Button } from "@/app/components/ui/Button";
import {
  SOCIAL_POST_REUSE_SESSION_KEY,
  emptyTemplateValues,
  getSocialPostTemplateById,
  getTemplateTextFieldDefinitions,
  mergeAiTextValuesIntoForm,
  mergeSavedValuesIntoTemplate,
  validateTemplateValues,
  type SocialPostFieldDefinition,
  type SocialPostTemplateDefinition,
  type SocialPostReusePayload,
} from "@/lib/creatomate/social-post-templates";
import { cn } from "@/app/lib/cn";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

const STORAGE_BUCKET = "generated-images";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const TONE_OPTIONS = [
  { value: "", label: "Default (infer from brief)" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "bold", label: "Bold" },
  { value: "playful", label: "Playful" },
  { value: "urgent", label: "Urgent" },
] as const;

type ApiOk = { success: true; url: string };
type ApiErr = { success: false; error: string; details?: unknown };
type ApiResponse = ApiOk | ApiErr | Record<string, unknown>;

function fileExtension(name: string, fallback: string) {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : fallback;
}

function SocialPostsTemplateFormPageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = typeof params?.templateId === "string" ? params.templateId : "";

  const template = useMemo(() => getSocialPostTemplateById(templateId), [templateId]);
  const textFieldDefs = useMemo(() => {
    if (!template) return [];
    return getTemplateTextFieldDefinitions(template);
  }, [template]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [aiBrief, setAiBrief] = useState("");
  const [aiTone, setAiTone] = useState("");
  const [textAssistLoading, setTextAssistLoading] = useState(false);
  const [textAssistError, setTextAssistError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /** Object URLs for local preview before the public URL is available. */
  const [localImagePreviews, setLocalImagePreviews] = useState<Record<string, string>>({});
  const [uploadingField, setUploadingField] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  /** After applying history reuse, skip one init cycle so `router.replace` does not wipe the form. */
  const skipEmptyAfterReuseRef = useRef(false);

  const revokePreviews = useCallback((keys?: string[]) => {
    setLocalImagePreviews((prev) => {
      const next = { ...prev };
      const toRevoke = keys ?? Object.keys(next);
      for (const k of toRevoke) {
        if (next[k]) {
          try {
            URL.revokeObjectURL(next[k]);
          } catch {
            /* ignore */
          }
          delete next[k];
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!template) return;

    if (searchParams.get("reuse") === "1") {
      try {
        const raw =
          typeof window !== "undefined"
            ? sessionStorage.getItem(SOCIAL_POST_REUSE_SESSION_KEY)
            : null;
        if (raw) {
          const parsed = JSON.parse(raw) as SocialPostReusePayload;
          if (parsed.templateId === template.id && parsed.values) {
            setValues(mergeSavedValuesIntoTemplate(template, parsed.values));
            setFieldErrors({});
            sessionStorage.removeItem(SOCIAL_POST_REUSE_SESSION_KEY);
            skipEmptyAfterReuseRef.current = true;
            router.replace(`/dashboard/social-posts/${template.id}`, { scroll: false });
            return;
          }
        }
      } catch {
        /* ignore invalid reuse payload */
      }
    }

    if (skipEmptyAfterReuseRef.current && searchParams.get("reuse") !== "1") {
      skipEmptyAfterReuseRef.current = false;
      return;
    }

    setValues(emptyTemplateValues(template));
    setAiBrief("");
    setAiTone(template.defaultTone ?? "");
    setFieldErrors({});
    revokePreviews();
  }, [template, searchParams, router, revokePreviews]);

  useEffect(() => {
    return () => {
      setLocalImagePreviews((prev) => {
        for (const u of Object.values(prev)) {
          try {
            URL.revokeObjectURL(u);
          } catch {
            /* ignore */
          }
        }
        return {};
      });
    };
  }, []);

  const isImageUploading = useMemo(
    () => Object.values(uploadingField).some(Boolean),
    [uploadingField]
  );

  const submitDisabled = loading || isImageUploading;

  const uploadImageField = async (field: SocialPostFieldDefinition, file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Image must be ${MAX_IMAGE_BYTES / (1024 * 1024)}MB or smaller.`);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be signed in to upload images.");
      return;
    }

    const ext = fileExtension(file.name, file.type.split("/")[1] || "jpg");
    const uid =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    const objectPath = `social-post-templates/${user.id}/${template!.id}/${field.key}/${Date.now()}-${uid}.${ext}`;

    setUploadingField((prev) => ({ ...prev, [field.key]: true }));
    setError(null);

    try {
      const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(objectPath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || `image/${ext}`,
      });

      if (upErr) {
        console.error("storage upload:", upErr);
        revokePreviews([field.key]);
        setError(upErr.message || "Upload failed.");
        return;
      }

      const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);
      const publicUrl = pub.publicUrl;
      if (!publicUrl) {
        revokePreviews([field.key]);
        setError("Could not resolve public URL for upload.");
        return;
      }

      setValues((prev) => ({ ...prev, [field.key]: publicUrl }));
      setFieldErrors((prev) => {
        if (!prev[field.key]) return prev;
        const next = { ...prev };
        delete next[field.key];
        return next;
      });

      revokePreviews([field.key]);
      const input = fileInputRefs.current[field.key];
      if (input) input.value = "";
    } finally {
      setUploadingField((prev) => ({ ...prev, [field.key]: false }));
    }
  };

  const onImageFileChange = async (field: SocialPostFieldDefinition, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !template) return;

    revokePreviews([field.key]);
    const blobUrl = URL.createObjectURL(file);
    setLocalImagePreviews((prev) => ({ ...prev, [field.key]: blobUrl }));

    await uploadImageField(field, file);
  };

  const onImageUrlPaste = (field: SocialPostFieldDefinition, value: string) => {
    setFieldErrors((prev) => {
      if (!prev[field.key]) return prev;
      const next = { ...prev };
      delete next[field.key];
      return next;
    });
    setError(null);
    setValues((prev) => ({ ...prev, [field.key]: value }));
    revokePreviews([field.key]);
    const input = fileInputRefs.current[field.key];
    if (input) input.value = "";
  };

  const previewSrcForField = (fieldKey: string) => {
    const v = values[fieldKey]?.trim() ?? "";
    if (/^https?:\/\//i.test(v)) return v;
    return localImagePreviews[fieldKey] ?? "";
  };

  const handleGenerateTextWithAi = async () => {
    if (!template || textFieldDefs.length === 0) return;
    const brief = aiBrief.trim();
    if (!brief) {
      setTextAssistError("Add a short topic or brief first.");
      return;
    }
    setTextAssistError(null);
    setTextAssistLoading(true);
    try {
      const res = await fetch("/api/social-posts/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          brief,
          tone: aiTone.trim() ? aiTone.trim() : null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        values?: Record<string, unknown>;
        error?: string;
      };
      if (!res.ok || json.success !== true || !json.values || typeof json.values !== "object") {
        setTextAssistError(
          typeof json.error === "string" ? json.error : "Could not generate text."
        );
        return;
      }
      const generated = json.values;
      setValues((prev) => mergeAiTextValuesIntoForm(template, prev, generated));
    } catch {
      setTextAssistError("Network error. Please try again.");
    } finally {
      setTextAssistLoading(false);
    }
  };

  const handleSubmit = async (
    e?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>
  ) => {
    e?.preventDefault();
    if (!template) return;
    setError(null);
    setUrl(null);

    const validated = validateTemplateValues(template, values);
    if (!validated.ok) {
      setFieldErrors(validated.fieldErrors);
      setError(validated.error);
      return;
    }
    setFieldErrors({});

    setLoading(true);
    try {
      const payload = { templateId: template.id, values: validated.values };
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

      {template.category || template.recommendedUseCase ? (
        <div className="-mt-2 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {template.category ? (
              <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
                {template.category}
              </span>
            ) : null}
          </div>
          {template.recommendedUseCase ? (
            <p className="max-w-3xl text-sm leading-relaxed text-white/45">{template.recommendedUseCase}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Fields</p>
          <p className="mt-2 text-sm text-white/60">
            Template <span className="font-mono text-white/75">{template.id}</span>
          </p>

          {textFieldDefs.length > 0 ? (
            <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/25 p-4 sm:p-5">
              <div className="flex items-center gap-2 text-white/90">
                <Sparkles className="h-4 w-4 shrink-0 text-cyan-300/90" aria-hidden />
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                  AI text assist
                </p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Describe your topic; we&apos;ll suggest copy for the text fields only (images stay as
                they are).
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-white/60" htmlFor="social-ai-brief">
                    Topic / brief
                  </label>
                  <Textarea
                    id="social-ai-brief"
                    value={aiBrief}
                    onChange={(e) => setAiBrief(e.target.value)}
                    placeholder={
                      template.aiBriefHint ??
                      "e.g. Summer sale — 25% off swimwear, friendly and energetic"
                    }
                    className="mt-1.5 min-h-[88px] rounded-2xl"
                    disabled={textAssistLoading || loading}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/60" htmlFor="social-ai-tone">
                    Tone (optional)
                  </label>
                  <select
                    id="social-ai-tone"
                    value={aiTone}
                    onChange={(e) => setAiTone(e.target.value)}
                    disabled={textAssistLoading || loading}
                    className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.10] bg-black/30 px-4 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition-[border-color,box-shadow] duration-200 hover:border-white/[0.14] focus:border-white/[0.18] focus:shadow-[0_0_0_3px_var(--ring)] disabled:opacity-60"
                  >
                    {TONE_OPTIONS.map((opt) => (
                      <option key={opt.value || "default"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {textAssistError ? (
                  <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {textAssistError}
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="rounded-2xl"
                  disabled={
                    textAssistLoading ||
                    loading ||
                    !aiBrief.trim()
                  }
                  onClick={() => void handleGenerateTextWithAi()}
                >
                  {textAssistLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" aria-hidden />
                      Generate text with AI
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/45">This template has no AI-assist text fields.</p>
          )}

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {template.fields.map((field) => {
              const rawLen = values[field.key]?.length ?? 0;
              const showCounter =
                typeof field.maxLength === "number" &&
                field.maxLength > 0 &&
                (field.type === "text" || field.type === "textarea" || field.type === "url");
              const handleTextChange = (next: string) => {
                setFieldErrors((prev) => {
                  if (!prev[field.key]) return prev;
                  const nextErr = { ...prev };
                  delete nextErr[field.key];
                  return nextErr;
                });
                setError(null);
                setValues((prev) => ({ ...prev, [field.key]: next }));
              };

              return (
              <div key={field.key}>
                <div className="flex items-start justify-between gap-3">
                  <label className="text-xs font-semibold text-white/60" htmlFor={`field-${field.key}`}>
                    <span id={`label-${field.key}`}>{field.label}</span>
                    {field.required !== false ? (
                      <span className="text-red-400/90" aria-hidden>
                        {" "}
                        *
                      </span>
                    ) : null}
                    {field.required === false && field.recommended ? (
                      <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-400/75">
                        Recommended
                      </span>
                    ) : null}
                  </label>
                  {showCounter ? (
                    <span
                      className={cn(
                        "shrink-0 tabular-nums text-[11px]",
                        rawLen > (field.maxLength ?? 0) ? "text-red-300" : "text-white/35"
                      )}
                      aria-live="polite"
                    >
                      {rawLen}/{field.maxLength}
                    </span>
                  ) : null}
                </div>
                {field.type === "textarea" ? (
                  <Textarea
                    id={`field-${field.key}`}
                    aria-labelledby={`label-${field.key}`}
                    aria-invalid={Boolean(fieldErrors[field.key])}
                    value={values[field.key] ?? ""}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder={field.placeholder}
                    maxLength={field.maxLength}
                    className={cn(
                      "mt-1.5 min-h-[120px] rounded-2xl",
                      fieldErrors[field.key] &&
                        "border-red-400/45 focus:border-red-400/55 focus:shadow-[0_0_0_3px_rgba(248,113,113,0.12)]"
                    )}
                    disabled={loading}
                    required={field.required !== false}
                  />
                ) : field.type === "image" ? (
                  <div className="mt-1.5 space-y-2">
                    <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/[0.09]">
                          <Upload className="h-3.5 w-3.5 text-cyan-300/90" aria-hidden />
                          Choose file
                          <input
                            ref={(el) => {
                              fileInputRefs.current[field.key] = el;
                            }}
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            disabled={loading || Boolean(uploadingField[field.key])}
                            onChange={(e) => void onImageFileChange(field, e)}
                          />
                        </label>
                        {uploadingField[field.key] ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-white/55">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" aria-hidden />
                            Uploading…
                          </span>
                        ) : null}
                      </div>
                      {previewSrcForField(field.key) ? (
                        <div className="mt-4 flex justify-center rounded-xl border border-white/10 bg-black/40 p-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={previewSrcForField(field.key)}
                            alt=""
                            className="max-h-48 max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <p className="mt-3 text-center text-xs text-white/40">No image selected yet.</p>
                      )}
                    </div>
                    <Input
                      id={`field-${field.key}`}
                      value={values[field.key] ?? ""}
                      onChange={(e) => onImageUrlPaste(field, e.target.value)}
                      placeholder={field.placeholder ?? "Or paste an image URL…"}
                      type="url"
                      className={cn(
                        "rounded-2xl",
                        fieldErrors[field.key] &&
                          "border-red-400/45 focus:border-red-400/55 focus:shadow-[0_0_0_3px_rgba(248,113,113,0.12)]"
                      )}
                      disabled={loading || Boolean(uploadingField[field.key])}
                      aria-label={`${field.label} URL fallback`}
                      aria-invalid={Boolean(fieldErrors[field.key])}
                    />
                    <p className="text-[11px] text-white/40">
                      Upload stores the file in your workspace storage; Creatomate receives a public URL.
                    </p>
                    {field.helperText ? (
                      <p className="text-[11px] leading-snug text-white/45">{field.helperText}</p>
                    ) : null}
                    {fieldErrors[field.key] ? (
                      <p className="text-[11px] font-medium text-red-300">{fieldErrors[field.key]}</p>
                    ) : null}
                  </div>
                ) : (
                  <Input
                    id={`field-${field.key}`}
                    aria-labelledby={`label-${field.key}`}
                    aria-invalid={Boolean(fieldErrors[field.key])}
                    value={values[field.key] ?? ""}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder={field.placeholder}
                    type={field.type === "url" ? "url" : "text"}
                    maxLength={field.maxLength}
                    className={cn(
                      "mt-1.5 rounded-2xl",
                      fieldErrors[field.key] &&
                        "border-red-400/45 focus:border-red-400/55 focus:shadow-[0_0_0_3px_rgba(248,113,113,0.12)]"
                    )}
                    disabled={loading}
                    required={field.required !== false}
                  />
                )}
                {field.type !== "image" ? (
                  <div className="mt-1.5 space-y-1">
                    {field.helperText ? (
                      <p className="text-[11px] leading-snug text-white/45">{field.helperText}</p>
                    ) : null}
                    {fieldErrors[field.key] ? (
                      <p className="text-[11px] font-medium text-red-300">{fieldErrors[field.key]}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              );
            })}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="rounded-2xl"
                disabled={submitDisabled}
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
                disabled={loading || isImageUploading}
                onClick={() => {
                  setError(null);
                  setUrl(null);
                  setFieldErrors({});
                  revokePreviews();
                  setUploadingField({});
                  setValues(emptyTemplateValues(template));
                  setAiBrief("");
                  setAiTone(template.defaultTone ?? "");
                  for (const k of Object.keys(fileInputRefs.current)) {
                    const el = fileInputRefs.current[k];
                    if (el) el.value = "";
                  }
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

function SocialPostsTemplateFormFallback() {
  return (
    <Page>
      <p className="text-sm text-white/55">Loading…</p>
    </Page>
  );
}

export default function SocialPostsTemplateFormPage() {
  return (
    <Suspense fallback={<SocialPostsTemplateFormFallback />}>
      <SocialPostsTemplateFormPageInner />
    </Suspense>
  );
}
