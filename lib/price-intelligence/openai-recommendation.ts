import OpenAI from "openai";

function describeSituation(args: {
  ownPrice: number | null;
  competitorPrice: number | null;
  differencePct: number | null;
  scrapeFailed: boolean;
}): string {
  if (args.scrapeFailed || args.competitorPrice == null) {
    return "Situation: competitor price missing or unreliable — reason about positioning without treating a gap as proven.";
  }
  if (args.ownPrice == null) {
    return "Situation: your price not provided — infer likely pricing moves only where grounded; say what to price-test.";
  }
  if (args.differencePct == null) {
    return "Situation: partial numbers — compare qualitatively, not as a precise gap.";
  }
  const d = args.differencePct;
  if (Math.abs(d) < 2) {
    return "Situation: you and the scraped competitor are roughly price-aligned — differentiation is mostly non-price.";
  }
  if (d > 0) {
    return `Situation: scraped competitor is ~${Math.abs(d).toFixed(0)}% above your list — you are priced lower in this snapshot; focus on margin recovery and perceived value, not only chasing their number.`;
  }
  return `Situation: scraped competitor is ~${Math.abs(d).toFixed(0)}% below your list — you read more expensive here; pressure is real but lowering list price is not the only lever.`;
}

function buildPrompt(args: {
  productName: string;
  ownPrice: number | null;
  competitorPrice: number | null;
  differencePct: number | null;
  scrapeFailed: boolean;
}): string {
  const own = args.ownPrice != null ? `$${args.ownPrice.toFixed(2)}` : "unknown";
  const comp = args.competitorPrice != null ? `$${args.competitorPrice.toFixed(2)}` : "unknown";
  const gap =
    args.differencePct != null
      ? `${args.differencePct >= 0 ? "+" : ""}${args.differencePct.toFixed(1)}% (competitor vs your price; positive means competitor higher)`
      : "n/a";
  const dataNote = args.scrapeFailed
    ? "Data: scrape failed or ambiguous — tell them to verify the competitor price on-page before big decisions."
    : "Data: scraped from HTML; could be wrong (variants, tax, bundles). One line on verifying.";

  const situation = describeSituation(args);

  return `Product: "${args.productName}"
Your price: ${own}
Competitor (scraped): ${comp}
Gap metric: ${gap}

${situation}
${dataNote}

Write for an operator who already knows e-commerce basics. Total length: 130–160 words.

Use this exact plain-text structure (no markdown # headings, no numbered essay):

Snapshot — One sentence: what the numbers suggest about relative price position, or what is unknown.

Positioning & perceived value — Two or three sentences: who this product should feel "for," what proof or story would make the price feel fair, and what would cheapen perception if you cut price blindly. Name one specific angle (e.g. risk reversal, outcome, materials, speed, fit for use-case) tied to this product name.

Moves — Exactly 3 bullet lines, each starting with "• ". Include at least TWO moves that do NOT require lowering the public list price (examples: bundle, first-order incentive, warranty/shipping threshold, tier rename, add-on, financing, loyalty, segment-specific offer, small SKU variant, or timed promo). The third may include a disciplined price adjustment IF the gap warrants it; if you recommend a price move, pair it with what value or term you add so it is not a naked discount.

Banned phrasing — Do not use: "monitor competitors," "stay competitive," "consider your costs," "it depends," "optimize pricing," or generic "add value" without naming how. Do not repeat the same idea in Snapshot and Moves.

Tone: direct, specific, no filler.`;
}

const SYSTEM = `You are a sharp retail pricing advisor (not a blogger). You think in positioning and perceived value first.

Rules:
- Every sentence must earn its place; no platitudes.
- Prefer concrete levers (offer structure, proof, packaging, segment, risk reversal) over "strategy."
- Treat competitor scrapes as noisy signals, not truth — calibrate language to uncertainty when data is weak.
- When the user is cheaper than the scrape, do not only say "raise price" or "you're underpriced" — discuss whether the discount is strategic and how to capture margin without eroding trust.
- When the user is more expensive, default to differentiation and offer design before "match their price."`;

export async function generatePriceRecommendation(args: {
  productName: string;
  ownPrice: number | null;
  competitorPrice: number | null;
  differencePct: number | null;
  scrapeFailed: boolean;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI is not configured.");

  const client = new OpenAI({ apiKey });
  const prompt = buildPrompt(args);

  const r = await client.chat.completions.create({
    model: process.env.OPENAI_PRICE_INTEL_MODEL?.trim() || "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: prompt },
    ],
    max_tokens: 450,
    temperature: 0.42,
    frequency_penalty: 0.2,
  });

  const text = r.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty model response.");
  return text;
}
