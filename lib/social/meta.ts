import { decryptToken } from "@/lib/social/crypto";

export type MetaConnectionRow = {
  id: string;
  platform: "instagram" | "facebook";
  account_type: string;
  provider_account_id: string;
  account_display_name: string | null;
  scopes: string[] | null;
  access_token_ciphertext: string;
  access_token_iv: string;
  access_token_tag: string;
  expires_at: string | null;
};

function metaApiBase(): string {
  return "https://graph.facebook.com/v19.0";
}

function mustMetaEnv() {
  const appId = process.env.META_APP_ID?.trim() ?? "";
  const appSecret = process.env.META_APP_SECRET?.trim() ?? "";
  if (!appId || !appSecret) {
    throw new Error("Meta OAuth is not configured (META_APP_ID/META_APP_SECRET).");
  }
  return { appId, appSecret };
}

export function buildMetaAuthorizeUrl(args: {
  redirectUri: string;
  state: string;
}): string {
  const { appId } = mustMetaEnv();
  // Scopes for Pages + IG publishing. Some require app review in production.
  const scope = [
    "public_profile",
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "instagram_basic",
    "instagram_content_publish",
  ].join(",");
  const u = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", args.redirectUri);
  u.searchParams.set("state", args.state);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", scope);
  return u.toString();
}

export async function exchangeMetaCode(args: {
  code: string;
  redirectUri: string;
}): Promise<{ access_token: string; token_type: string; expires_in: number }> {
  const { appId, appSecret } = mustMetaEnv();
  const u = new URL(`${metaApiBase()}/oauth/access_token`);
  u.searchParams.set("client_id", appId);
  u.searchParams.set("client_secret", appSecret);
  u.searchParams.set("redirect_uri", args.redirectUri);
  u.searchParams.set("code", args.code);
  const r = await fetch(u.toString(), { method: "GET" });
  const j = (await r.json().catch(() => ({}))) as any;
  if (!r.ok) {
    throw new Error(j?.error?.message || "Meta code exchange failed.");
  }
  return j as { access_token: string; token_type: string; expires_in: number };
}

export async function fetchMetaPages(userAccessToken: string): Promise<
  Array<{ id: string; name: string; access_token?: string }>
> {
  const u = new URL(`${metaApiBase()}/me/accounts`);
  u.searchParams.set("access_token", userAccessToken);
  u.searchParams.set("fields", "id,name,access_token");
  const r = await fetch(u.toString());
  const j = (await r.json().catch(() => ({}))) as any;
  if (!r.ok || j?.error) throw new Error(j?.error?.message || "Failed to load Facebook Pages.");
  return Array.isArray(j.data) ? (j.data as any[]) : [];
}

export async function fetchInstagramBusinessAccount(pageId: string, pageAccessToken: string): Promise<{
  igBusinessId: string | null;
}> {
  const u = new URL(`${metaApiBase()}/${pageId}`);
  u.searchParams.set("access_token", pageAccessToken);
  u.searchParams.set("fields", "instagram_business_account");
  const r = await fetch(u.toString());
  const j = (await r.json().catch(() => ({}))) as any;
  if (!r.ok || j?.error) throw new Error(j?.error?.message || "Failed to load Instagram business account.");
  const igId = j?.instagram_business_account?.id;
  return { igBusinessId: typeof igId === "string" ? igId : null };
}

export async function publishInstagramImage(args: {
  igBusinessId: string;
  pageAccessToken: string;
  imageUrl: string;
  caption: string;
}): Promise<{ postId: string }> {
  // 1) create media container
  const createUrl = new URL(`${metaApiBase()}/${args.igBusinessId}/media`);
  createUrl.searchParams.set("image_url", args.imageUrl);
  createUrl.searchParams.set("caption", args.caption);
  createUrl.searchParams.set("access_token", args.pageAccessToken);
  const containerResponse = await fetch(createUrl.toString(), { method: "POST" });
  const containerData = (await containerResponse.json().catch(() => ({}))) as any;
  if (!containerResponse.ok || containerData?.error) {
    throw new Error(containerData?.error?.message || "Failed to create Instagram media container.");
  }
  const creationId = containerData?.id;
  if (!creationId) throw new Error("Meta did not return a creation id.");

  // Give Meta a moment to fetch/process the image.
  await new Promise((r) => setTimeout(r, 4000));

  // 2) publish container
  const publishUrl = new URL(`${metaApiBase()}/${args.igBusinessId}/media_publish`);
  publishUrl.searchParams.set("creation_id", creationId);
  publishUrl.searchParams.set("access_token", args.pageAccessToken);
  const publishResponse = await fetch(publishUrl.toString(), { method: "POST" });
  const publishData = (await publishResponse.json().catch(() => ({}))) as any;
  if (!publishResponse.ok || publishData?.error) {
    throw new Error(publishData?.error?.message || "Failed to publish Instagram post.");
  }
  const postId = publishData?.id;
  if (!postId) throw new Error("Meta did not return a post id.");
  return { postId };
}

export async function publishFacebookPagePost(args: {
  pageId: string;
  pageAccessToken: string;
  message: string;
}): Promise<{ postId: string }> {
  const u = new URL(`${metaApiBase()}/${args.pageId}/feed`);
  u.searchParams.set("message", args.message);
  u.searchParams.set("access_token", args.pageAccessToken);
  const r = await fetch(u.toString(), { method: "POST" });
  const j = (await r.json().catch(() => ({}))) as any;
  if (!r.ok || j?.error) throw new Error(j?.error?.message || "Failed to publish Facebook post.");
  const postId = j?.id;
  if (!postId) throw new Error("Meta did not return a post id.");
  return { postId };
}

export function getDecryptedAccessToken(row: MetaConnectionRow): string {
  return decryptToken({
    ciphertext: row.access_token_ciphertext,
    iv: row.access_token_iv,
    tag: row.access_token_tag,
  });
}

