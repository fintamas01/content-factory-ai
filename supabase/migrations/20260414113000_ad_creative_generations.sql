-- AI Ad Creative Studio (V1): generation history (per user, per client/workspace).
-- V1 usage tracking: reuse existing "content" monthly usage counters (no new usage feature key yet).

create table if not exists public.ad_creative_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,

  title text,

  source_type text not null check (source_type in ('product_image', 'uploaded_asset', 'manual_prompt', 'url')),
  source_image_url text,
  source_asset_url text,

  product_name text,
  brand_name text,
  audience text,
  offer_summary text,
  language text not null default 'en',

  aspect_ratios text[] not null default '{}'::text[],

  generated_copy jsonb not null default '{}'::jsonb,
  generated_concepts jsonb not null default '{}'::jsonb,
  generated_assets jsonb not null default '{}'::jsonb,

  status text not null default 'succeeded' check (status in ('queued', 'running', 'succeeded', 'failed')),
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_creative_generations_user_client_created_idx
  on public.ad_creative_generations (user_id, client_id, created_at desc);

create index if not exists ad_creative_generations_client_created_idx
  on public.ad_creative_generations (client_id, created_at desc);

create index if not exists ad_creative_generations_client_status_updated_idx
  on public.ad_creative_generations (client_id, status, updated_at desc);

alter table public.ad_creative_generations enable row level security;

create policy "ad_creative_generations_select_own"
  on public.ad_creative_generations for select
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create policy "ad_creative_generations_insert_own"
  on public.ad_creative_generations for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create policy "ad_creative_generations_update_own"
  on public.ad_creative_generations for update
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  )
  with check (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create policy "ad_creative_generations_delete_own"
  on public.ad_creative_generations for delete
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create or replace function public.ad_creative_generations_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ad_creative_generations_set_updated_at on public.ad_creative_generations;
create trigger ad_creative_generations_set_updated_at
  before update on public.ad_creative_generations
  for each row
  execute function public.ad_creative_generations_set_updated_at();

comment on table public.ad_creative_generations is 'AI Ad Creative Studio generation history (scoped to client/workspace).';

