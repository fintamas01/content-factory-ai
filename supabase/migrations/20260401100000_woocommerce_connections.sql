-- WooCommerce connection settings (per user). Stored server-side; used by API proxy routes.
create table if not exists public.woocommerce_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  store_url text not null,
  consumer_key text not null,
  consumer_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint woocommerce_connections_user_id_key unique (user_id)
);

create index if not exists woocommerce_connections_user_id_idx
  on public.woocommerce_connections (user_id);

alter table public.woocommerce_connections enable row level security;

create policy "woocommerce_connections_select_own"
  on public.woocommerce_connections for select
  to authenticated
  using (auth.uid() = user_id);

create policy "woocommerce_connections_upsert_own"
  on public.woocommerce_connections for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "woocommerce_connections_update_own"
  on public.woocommerce_connections for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "woocommerce_connections_delete_own"
  on public.woocommerce_connections for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.woocommerce_connections_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists woocommerce_connections_set_updated_at on public.woocommerce_connections;
create trigger woocommerce_connections_set_updated_at
  before update on public.woocommerce_connections
  for each row
  execute function public.woocommerce_connections_set_updated_at();

comment on table public.woocommerce_connections is 'Per-user WooCommerce REST API credentials (MVP). Consider encrypting secrets for production hardening.';