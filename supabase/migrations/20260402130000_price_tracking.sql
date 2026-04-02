-- Competitor price intelligence (Elite plan): tracked URLs + scraped comparison + AI recommendation.

create table if not exists public.price_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  product_name text not null,
  own_price numeric(12, 2),
  competitor_url text not null,
  competitor_price numeric(12, 2),
  difference_pct numeric(10, 2),
  recommendation text,
  woo_product_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists price_tracking_client_created_idx
  on public.price_tracking (client_id, created_at desc);

create index if not exists price_tracking_user_client_idx
  on public.price_tracking (user_id, client_id);

comment on table public.price_tracking is 'Elite: competitor URL price scrape vs own price + AI recommendation.';

alter table public.price_tracking enable row level security;

drop policy if exists "price_tracking_select_member" on public.price_tracking;
drop policy if exists "price_tracking_insert_member" on public.price_tracking;
drop policy if exists "price_tracking_update_member" on public.price_tracking;
drop policy if exists "price_tracking_delete_member" on public.price_tracking;

create policy "price_tracking_select_member"
  on public.price_tracking for select to authenticated
  using (public.is_client_member(client_id));

create policy "price_tracking_insert_member"
  on public.price_tracking for insert to authenticated
  with check (auth.uid() = user_id and public.is_client_member(client_id));

create policy "price_tracking_update_member"
  on public.price_tracking for update to authenticated
  using (auth.uid() = user_id and public.is_client_member(client_id))
  with check (auth.uid() = user_id and public.is_client_member(client_id));

create policy "price_tracking_delete_member"
  on public.price_tracking for delete to authenticated
  using (auth.uid() = user_id and public.is_client_member(client_id));
