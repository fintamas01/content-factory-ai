import type { EffectiveBrandProfile } from "./merge";

/**
 * Content module (/api/generate): primary brand-instructions block for the draft system prompt.
 * Narrative guidance so the model embodies identity instead of reciting labeled fields.
 */
export function buildContentBrandSystemSectionHu(b: EffectiveBrandProfile): string {
  const name = b.name.trim();
  const parts: string[] = [];

  parts.push("MÁRKAIDENTITÁS — kövesd természetesen; ne listaszerűen „pipáld ki” a mezőket.");
  parts.push(
    `Írj úgy, mintha a(z) „${name}” kommunikációját vitnéd: emberi, konkrét, nem üres marketingfrazeológia.`
  );

  if (b.desc.trim()) {
    parts.push(`Mit képvisel a márka: ${b.desc.trim()}`);
  }
  if (b.audience.trim()) {
    parts.push(
      `Célközönség: ${b.audience.trim()} — szólítsd meg őket úgy, ahogy valóban beszélnek és gondolkodnak; kerüld a generikus „mindenkinek” hangot.`
    );
  }
  if (b.toneOfVoice?.trim()) {
    parts.push(
      `Hangnem: ${b.toneOfVoice.trim()} — éld át a szóválasztásban és a ritmusban; ne magyarázd ki újra és újra, hogy „a hangnemünk X”.`
    );
  }
  if (b.keySellingPoints?.trim()) {
    parts.push(
      `Erősítések, amelyeket orgonikusan beépíthetsz: ${b.keySellingPoints.trim()} — válassz relevánsakat platformonként; ne másold szóról szóra ugyanazt minden posztba, és ne sorold fel őket gépiesen.`
    );
  }
  if (b.websiteUrl?.trim()) {
    parts.push(
      `Ha illik a szöveghez, diszkréten utalhatsz a jelenlétre (${b.websiteUrl.trim()}); ne legyen minden második sor „webes” vagy hivatalos.`
    );
  }

  parts.push(
    `A márkanevet („${name}”) használd ott, ahol természetes: nyitás, bizalom, aláírás, CTA — ne minden mondatban, és ne ismételd ugyanúgy platformról platformra, ha elég egy erős említés.`
  );
  parts.push(
    "Ha ugyanaz a fő üzenet több platformon is megjelenne: fogalmazd át — kerüld a szó szerinti ismétlődést."
  );
  parts.push(
    'Kerüld: „márkánként…”, „brand voice-ként…”, túlzott hivatalosság, és a kulcsszavak gépies sorolását.'
  );

  return parts.join("\n\n");
}

/** Short hint for the critique pass — avoids re-pasting the full identity block. */
export function buildContentBrandCritiqueHintHu(
  b: EffectiveBrandProfile,
  tone: string,
  targetLang: string,
  platforms: string[]
): string {
  const lines = [
    `Márka: ${b.name.trim()}`,
    b.audience.trim() ? `Célközönség: ${b.audience.trim()}` : null,
    b.toneOfVoice?.trim() ? `Márka hangnem (referencia): ${b.toneOfVoice.trim()}` : null,
    `Feladat-stílus (csúszka): ${tone}`,
    `Nyelv: ${targetLang}`,
    `Platformok: ${platforms.join(", ")}`,
    "Értékeld: természetesen illeszkedik-e a márkához és a célközönséghez — nem úgy, mintha egy checklistet olvasna fel; kerüld a robotikus ismétlést.",
  ];
  return lines.filter((x): x is string => Boolean(x)).join("\n");
}

/** Compact lines appended to the rewrite system message (identity anchor without duplicating the full draft block). */
export function buildContentBrandRewriteSystemAppendixHu(b: EffectiveBrandProfile): string {
  const chunks = [
    `Ugyanaz a márka: ${b.name.trim()}.`,
    b.audience.trim() ? `Olvasó: ${b.audience.trim()}.` : null,
    b.toneOfVoice?.trim()
      ? `Hangnem: ${b.toneOfVoice.trim()} (élje át a javításban; ne címkézd újra és újra).`
      : null,
    b.keySellingPoints?.trim()
      ? `Ha a draft ismételné a kulcs üzeneteket, fogalmazd át őket — ne növeld a redundanciát.`
      : null,
  ];
  return chunks.filter((x): x is string => Boolean(x)).join(" ");
}

/**
 * Products module: appended to the English SYSTEM message when a saved brand profile exists.
 * brandVoiceContext JSON stays the source of facts; this block teaches how to apply them.
 */
export function buildProductBrandIdentityAddendumEn(b: EffectiveBrandProfile): string {
  const name = b.name.trim();
  const lines: string[] = [];

  lines.push("BRAND IDENTITY (apply without sounding robotic or repetitive):");
  lines.push(
    `Write as if this PDP belongs to "${name}" — credible, human, specific; avoid corporate filler and repeated slogans.`
  );

  if (b.desc.trim()) {
    lines.push(`What the brand stands for: ${b.desc.trim()}`);
  }
  if (b.audience.trim()) {
    lines.push(
      `Buyer / reader: ${b.audience.trim()} — use language they would use; avoid generic “for everyone” copy.`
    );
  }
  if (b.toneOfVoice?.trim()) {
    lines.push(
      `Voice: ${b.toneOfVoice.trim()} — embody it in word choice and rhythm; do not repeatedly label the tone inside the copy (e.g. “our tone is…”).`
    );
  }
  if (b.keySellingPoints?.trim()) {
    lines.push(
      `Weave these proof points and differentiators across title, description, bullets, and SEO — vary wording by field; do not paste the same sentence into every slot.`
    );
    lines.push(`Source ideas (integrate naturally, do not list verbatim in every field): ${b.keySellingPoints.trim()}`);
  }
  if (b.websiteUrl?.trim()) {
    lines.push(
      `Optional subtle reference to online presence if it fits (${b.websiteUrl.trim()}); avoid stuffing or repeating the URL tone.`
    );
  }

  lines.push(
    `Use the brand name where it earns trust (e.g. title, opening, closing) — not in every sentence.`
  );
  lines.push(
    'Avoid stiff openers like “As a brand, we…” and avoid repeating identical benefit phrasing across title, description, bullets, and SEO.'
  );

  return lines.join("\n");
}
