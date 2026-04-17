"use client";

import { useMemo, useState } from "react";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { Page, PageHero } from "@/app/components/ui/Page";
import { Card } from "@/app/components/ui/Card";
import { Input } from "@/app/components/ui/Input";
import { Textarea } from "@/app/components/ui/Textarea";
import { Button } from "@/app/components/ui/Button";

type FormState = {
  headline: string;
  subheadline: string;
  body: string;
  image_top: string;
  image_middle: string;
  image_bottom: string;
};

type ApiOk = { success: true; url: string };
type ApiErr = { success: false; error: string; details?: unknown };
type ApiResponse = ApiOk | ApiErr | Record<string, unknown>;

export default function SocialPostsPage() {
  const [form, setForm] = useState<FormState>({
    headline: "",
    subheadline: "",
    body: "",
    image_top: "",
    image_middle: "",
    image_bottom: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return (
      form.headline.trim() &&
      form.subheadline.trim() &&
      form.body.trim() &&
      form.image_top.trim() &&
      form.image_middle.trim() &&
      form.image_bottom.trim()
    );
  }, [form]);

  const handleSubmit = async (
    e?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>
  ) => {
    e?.preventDefault();
    setError(null);
    setUrl(null);
    setLoading(true);
    try {
      const payload = {
        headline: form.headline,
        subheadline: form.subheadline,
        body: form.body,
        image_top: form.image_top,
        image_middle: form.image_middle,
        image_bottom: form.image_bottom,
      };

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

  return (
    <Page>
      <PageHero
        icon={<ImageIcon className="h-5 w-5" aria-hidden />}
        eyebrow="Creatomate"
        title="Social post image generator"
        description="Fill in the template fields and generate an image via your Creatomate template."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                Inputs
              </p>
              <p className="mt-2 text-sm text-white/60">
                Uses <span className="font-mono">/api/creatomate/render-image</span>.
              </p>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-white/60">Headline</label>
                <Input
                  value={form.headline}
                  onChange={(e) => setForm((p) => ({ ...p, headline: e.target.value }))}
                  placeholder="Your main headline…"
                  className="mt-1.5 rounded-2xl"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60">Subheadline</label>
                <Input
                  value={form.subheadline}
                  onChange={(e) => setForm((p) => ({ ...p, subheadline: e.target.value }))}
                  placeholder="Supporting line…"
                  className="mt-1.5 rounded-2xl"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-white/60">Body</label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                placeholder="Main body copy…"
                className="mt-1.5 min-h-[120px] rounded-2xl"
                disabled={loading}
              />
            </div>

            <div className="grid gap-4">
              <div>
                <label className="text-xs font-semibold text-white/60">Image (top)</label>
                <Input
                  value={form.image_top}
                  onChange={(e) => setForm((p) => ({ ...p, image_top: e.target.value }))}
                  placeholder="https://…"
                  className="mt-1.5 rounded-2xl"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60">Image (middle)</label>
                <Input
                  value={form.image_middle}
                  onChange={(e) => setForm((p) => ({ ...p, image_middle: e.target.value }))}
                  placeholder="https://…"
                  className="mt-1.5 rounded-2xl"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60">Image (bottom)</label>
                <Input
                  value={form.image_bottom}
                  onChange={(e) => setForm((p) => ({ ...p, image_bottom: e.target.value }))}
                  placeholder="https://…"
                  className="mt-1.5 rounded-2xl"
                  disabled={loading}
                />
              </div>
            </div>

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
                  setForm({
                    headline: "",
                    subheadline: "",
                    body: "",
                    image_top: "",
                    image_middle: "",
                    image_bottom: "",
                  });
                }}
              >
                Reset
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
            Preview
          </p>
          <p className="mt-2 text-sm text-white/60">
            The generated image will appear here.
          </p>

          {url ? (
            <div className="mt-5 space-y-3">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                {/* Use <img> to avoid Next/Image remote domain config during early testing. */}
                <img
                  src={url}
                  alt="Generated post"
                  className="w-full h-auto block"
                  loading="lazy"
                />
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                  Image URL
                </p>
                <p className="mt-1 break-all text-sm font-mono text-white/70 leading-snug">
                  {url}
                </p>
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

