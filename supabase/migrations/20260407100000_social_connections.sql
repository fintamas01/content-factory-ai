-- Social OAuth connections + publishing logs (per user, per client/workspace).
-- Tokens are stored encrypted-at-rest by the app (ciphertext + iv + tag).

create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  platform text not null check (platform in ('instagram', 'facebook', 'linkedin')),
  account_type text not null,
  provider_account_id text not null,
  account_display_name text,
  scopes text[] not null default '{}'::text[],

  access_token_ciphertext text not null,
  access_token_iv text not null,
  access_token_tag text not null,

  refresh_token_ciphertext text,
  refresh_token_iv text,
  refresh_token_tag text,

  expires_at timestamptz,
  status text not null default 'connected' check (status in ('connected', 'expired', 'revoked', 'error')),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint social_connections_client_platform_provider_unique
    unique (client_id, platform, provider_account_id)
);

create index if not exists social_connections_user_client_platform_idx
  on public.social_connections (user_id, client_id, platform);

create index if not exists social_connections_client_platform_idx
  on public.social_connections (client_id, platform);

alter table public.social_connections enable row level security;

create policy "social_connections_select_own"
  on public.social_connections for select
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create policy "social_connections_insert_own"
  on public.social_connections for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create policy "social_connections_update_own"
  on public.social_connections for update
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  )
  with check (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create policy "social_connections_delete_own"
  on public.social_connections for delete
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create or replace function public.social_connections_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists social_connections_set_updated_at on public.social_connections;
create trigger social_connections_set_updated_at
  before update on public.social_connections
  for each row
  execute function public.social_connections_set_updated_at();

comment on table public.social_connections is 'Per-user OAuth connections for social publishing (scoped to client/workspace). Tokens stored encrypted-at-rest by app.';

-- --- Posting logs (audit trail, support, debugging) ---
create table if not exists public.social_post_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  platform text not null check (platform in ('instagram', 'facebook', 'linkedin')),
  connection_id uuid references public.social_connections (id) on delete set null,

  content_generation_id uuid references public.generations (id) on delete set null,

  requested_at timestamptz not null default now(),
  scheduled_for timestamptz,
  published_at timestamptz,
  status text not null default 'queued' check (status in ('queued', 'posted', 'failed')),

  payload jsonb not null default '{}'::jsonb,
  provider_response jsonb not null default '{}'::jsonb
);

create index if not exists social_post_logs_user_client_created_idx
  on public.social_post_logs (user_id, client_id, requested_at desc);

alter table public.social_post_logs enable row level security;

create policy "social_post_logs_select_own"
  on public.social_post_logs for select
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create policy "social_post_logs_insert_own"
  on public.social_post_logs for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create policy "social_post_logs_update_own"
  on public.social_post_logs for update
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  )
  with check (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

comment on table public.social_post_logs is 'Audit log for social publish attempts/results (per user, per client/workspace).';

