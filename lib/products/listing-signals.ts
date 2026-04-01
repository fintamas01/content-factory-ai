/**
 * Deterministic heuristics passed to the LLM as *signals* (not facts about the product).
 * Helps the model spot thin copy, redundancy, and SEO surface issues without inventing data.
 */

export type ListingSignalsForPrompt = {
  titleCharCount: number;
  shortCharCount: number;
  shortWordCount: number;
  longWordCount: number;
  heuristics: {
    longCopyLikelyThin: boolean;
    shortCopyLikelyThin: boolean;
    titleAndShortHighlyRedundant: boolean;
    openingRepeatsTitle: boolean;
    titleMayBeOverStuffed: boolean;
  };
  /** 2–4 short hints for the model (English). */
  notesForModel: string[];
};

function stripHtmlPlain(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function significantTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

export function buildListingSignalsForPrompt(args: {
  title: string;
  shortDescription: string;
  longDescriptionHtml: string;
}): ListingSignalsForPrompt {
  const title = (args.title ?? "").trim();
  const shortPlain = stripHtmlPlain(args.shortDescription ?? "");
  const longPlain = stripHtmlPlain(args.longDescriptionHtml ?? "");

  const titleCharCount = title.length;
  const shortCharCount = shortPlain.length;
  const shortWordCount = wordCount(shortPlain);
  const longWordCount = wordCount(longPlain);

  const titleTok = significantTokens(title);
  const shortTok = significantTokens(shortPlain);
  const longOpen = longPlain.slice(0, 320);
  const openTok = significantTokens(longOpen);

  const titleAndShortHighlyRedundant =
    shortPlain.length > 20 && jaccard(titleTok, shortTok) >= 0.55;

  let openingRepeatsTitle = false;
  if (titleTok.size >= 2 && longOpen.length > 15) {
    let hit = 0;
    for (const t of titleTok) {
      if (openTok.has(t)) hit += 1;
    }
    openingRepeatsTitle = hit / titleTok.size >= 0.65;
  }

  const longCopyLikelyThin = longWordCount > 0 && longWordCount < 45;
  const shortCopyLikelyThin = shortCharCount > 0 && (shortCharCount < 90 || shortWordCount < 14);

  const words = title.toLowerCase().split(/\s+/).filter(Boolean);
  const freq = new Map<string, number>();
  for (const w of words) {
    const k = w.replace(/[^a-z0-9]/g, "");
    if (k.length < 3) continue;
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  const maxRep = [...freq.values()].reduce((a, b) => Math.max(a, b), 0);
  const commaCount = (title.match(/,/g) ?? []).length;
  const titleMayBeOverStuffed = commaCount >= 4 || maxRep >= 3;

  const notesForModel: string[] = [];
  if (longCopyLikelyThin) notesForModel.push("Long description is short vs. typical PDP depth (heuristic).");
  if (shortCopyLikelyThin) notesForModel.push("Short description may be too thin for above-the-fold conversion (heuristic).");
  if (titleAndShortHighlyRedundant) notesForModel.push("Title and short description overlap heavily — shoppers may see repeated ideas.");
  if (openingRepeatsTitle) notesForModel.push("Opening of long description may restate the title instead of adding new value.");
  if (titleMayBeOverStuffed) notesForModel.push("Title may be crowded with attributes — clarity and mobile truncation risk.");

  return {
    titleCharCount,
    shortCharCount,
    shortWordCount,
    longWordCount,
    heuristics: {
      longCopyLikelyThin,
      shortCopyLikelyThin,
      titleAndShortHighlyRedundant,
      openingRepeatsTitle,
      titleMayBeOverStuffed,
    },
    notesForModel: notesForModel.slice(0, 4),
  };
}
