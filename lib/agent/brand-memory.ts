import { supabaseAdmin } from "@/lib/supabase/admin";
import { embedText } from "@/lib/ai/embeddings";

type BrandMemoryMetadata = {
  source?: "generate" | "manual" | "import";
  platforms?: string[];
  tone?: string;
  lang?: string;
  model?: string;
  // későbbre: viral_score, engagement_score, tags, stb.
  [key: string]: any;
};

function clampTextForEmbedding(text: string, maxChars = 8000) {
  // Embeddinghez nem kell végtelen hossz; a túl hosszú text drágább/lassabb.
  if (!text) return "";
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

/**
 * Opcionális: nagyon egyszerű dedup kulcs (content hash).
 * Ha nem akarsz hash oszlopot a DB-ben, akkor csak metadata-ba tesszük.
 */
function simpleHash(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

/**
 * Mentés a brand_memory táblába.
 * - embedding számolás
 * - metadata mentés (hasznos később filterezéshez/tanuláshoz)
 * - opcionális dedup (ha ugyanazt mentenéd, akkor skip)
 */
export async function saveBrandMemory(
  userId: string,
  content: string,
  metadata: BrandMemoryMetadata = {}
) {
  const cleaned = clampTextForEmbedding(content).trim();
  if (!cleaned) return;

  const contentHash = simpleHash(cleaned);

  // Dedup: ha azonos hash már létezik ennél a usernél, ne szemeteljünk
  // (Ehhez az kell, hogy legyen metadata jsonb és abban "content_hash".)
  // Ez olcsóbb, mint embeddinggel hasonlóságot számolni mentés előtt.
  const { data: existing, error: existErr } = await supabaseAdmin
    .from("brand_memory")
    .select("id")
    .eq("user_id", userId)
    .contains("metadata", { content_hash: contentHash })
    .limit(1);

  if (existErr) {
    // nem állítjuk le, csak logolhatod, de itt inkább folytatjuk mentéssel
    // throw existErr;
  } else if (existing && existing.length > 0) {
    // már mentve volt
    return;
  }

  const embedding = await embedText(cleaned);

  const finalMeta: BrandMemoryMetadata = {
    source: "generate",
    created_at: new Date().toISOString(),
    content_hash: contentHash,
    ...metadata,
  };

  const { error } = await supabaseAdmin.from("brand_memory").insert({
    user_id: userId,
    content: cleaned,
    embedding,
    metadata: finalMeta,
  });

  if (error) throw error;
}

/**
 * Lekér releváns memóriákat szemantikusan.
 * - threshold finomhangolható (0.70–0.85 tipikusan)
 * - count: 3–8 jó
 */
export async function getBrandMemory(
  userId: string,
  query: string,
  opts?: {
    threshold?: number;
    count?: number;
  }
) {
  const cleanedQuery = clampTextForEmbedding(query, 2000).trim();
  if (!cleanedQuery) return [];

  const queryEmbedding = await embedText(cleanedQuery);

  const { data, error } = await supabaseAdmin.rpc("match_brand_memory", {
    query_embedding: queryEmbedding,
    match_threshold: opts?.threshold ?? 0.75,
    match_count: opts?.count ?? 5,
    p_user_id: userId,
  });

  if (error) throw error;

  return data ?? [];
}