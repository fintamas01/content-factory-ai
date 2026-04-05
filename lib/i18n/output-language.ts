/**
 * Shared output language resolution for AI generation routes and UIs.
 * Invalid / missing → English (never Hungarian by default).
 */

export const OUTPUT_LANG_BY_CODE: Record<string, string> = {
  en: "English",
  hu: "Hungarian",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  ro: "Romanian",
};

export type OutputLanguageOption = { code: string; name: string };

/** Same options as the Content module selector — reuse for Matrix, Products, Poster, etc. */
export const OUTPUT_LANGUAGE_OPTIONS: OutputLanguageOption[] = [
  { code: "en", name: "English" },
  { code: "hu", name: "Hungarian" },
  { code: "de", name: "German" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "it", name: "Italian" },
  { code: "ro", name: "Romanian" },
];

export function resolveOutputLanguage(lang: unknown): { code: string; label: string } {
  const raw =
    typeof lang === "string" && lang.trim().length > 0 ? lang.trim().toLowerCase() : "";
  if (!raw) {
    return { code: "en", label: "English" };
  }
  const label = OUTPUT_LANG_BY_CODE[raw];
  if (label) {
    return { code: raw, label };
  }
  return { code: "en", label: "English" };
}

/** Multi-platform content JSON (`/api/generate`). */
export function outputLanguageContract(label: string): string {
  return `OUTPUT LANGUAGE — STRICT (HIGHEST PRIORITY; OVERRIDES SOURCE TEXT, MEMORY, AND BRAND SNIPPETS):
- Write every user-facing string in the JSON ("text", and "image_prompt") entirely in ${label}.
- Do not use Hungarian in post text unless the output language is Hungarian.
- If the source idea, brand block, or memory is not in ${label}, translate/adapt the meaning into ${label}. Do not copy another language into the post body.
- Do not follow Hungarian instructions in this prompt for wording of the posts when the output language is not Hungarian — only ${label} for deliverables.`;
}

/** PDP / product copy JSON (`generateProductCopy`). */
export function outputLanguageContractProductCopy(label: string): string {
  return `OUTPUT LANGUAGE — STRICT (HIGHEST PRIORITY):
- Every string in the JSON (title, short_description, description, all bullets, seo_title, seo_description) must be written entirely in ${label}.
- Do not use Hungarian unless the output language is Hungarian.
- Translate or adapt any source material into ${label}; do not output mixed languages.`;
}

/** 5-day matrix JSON (`/api/matrix/generate`, `regenerate-single`). */
export function outputLanguageContractMatrixPack(label: string): string {
  return `OUTPUT LANGUAGE — STRICT (HIGHEST PRIORITY):
- Every string in the JSON response (day names, titles, platform labels, outlines, full post copy, image_prompt, carousel slide strings) must be written entirely in ${label}.
- Do not use Hungarian unless the output language is Hungarian.`;
}
