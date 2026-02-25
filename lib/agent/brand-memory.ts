import { supabaseAdmin } from "@/lib/supabase/admin";
import { embedText } from "@/lib/ai/embeddings";

export async function saveBrandMemory(userId: string, content: string) {
  const embedding = await embedText(content);

  const { error } = await supabaseAdmin.from("brand_memory").insert({
    user_id: userId,
    content,
    embedding,
  });

  if (error) throw error;
}

export async function getBrandMemory(userId: string, query: string) {
  const queryEmbedding = await embedText(query);

  const { data, error } = await supabaseAdmin.rpc("match_brand_memory", {
    query_embedding: queryEmbedding,
    match_threshold: 0.75,
    match_count: 5,
    p_user_id: userId,
  });

  if (error) throw error;

  // data: [{ content, similarity }, ...]
  return data ?? [];
}