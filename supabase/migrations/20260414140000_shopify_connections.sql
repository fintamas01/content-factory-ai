-- Shopify connection settings (per user, per workspace/client).
-- Stored server-side; used by API proxy routes.

create table if not exists public.shopify_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  store_domain text not null,
  access_token text not null,
  status text not null default 'connected' check (status in ('connected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_connections_user_client_unique unique (user_id, client_id)
);

create index if not exists shopify_connections_user_client_idx
  on public.shopify_connections (user_id, client_id);

create index if not exists shopify_connections_client_idx
  on public.shopify_connections (client_id);

alter table public.shopify_connections enable row level security;

create policy "shopify_connections_select_member"
  on public.shopify_connections for select to authenticated
  using (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create policy "shopify_connections_insert_member"
  on public.shopify_connections for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create policy "shopify_connections_update_member"
  on public.shopify_connections for update to authenticated
  using (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  )
  with check (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create policy "shopify_connections_delete_member"
  on public.shopify_connections for delete to authenticated
  using (
    auth.uid() = user_id
    and public.is_client_member(client_id)
  );

create or replace function public.shopify_connections_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shopify_connections_set_updated_at on public.shopify_connections;
create trigger shopify_connections_set_updated_at
  before update on public.shopify_connections
  for each row
  execute function public.shopify_connections_set_updated_at();

comment on table public.shopify_connections is 'Per-workspace Shopify Admin API token (MVP). Consider encrypting access_token at rest for production hardening.';

