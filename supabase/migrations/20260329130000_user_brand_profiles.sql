-- Unified Brand Profile: one row per user for shared AI context (Content + Products).
create table if not exists public.user_brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_name text not null default '',
  brand_description text,
  target_audience text,
  tone_of_voice text,
  key_selling_points text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_brand_profiles_user_id_key unique (user_id)
);

create index if not exists user_brand_profiles_user_id_idx
  on public.user_brand_profiles (user_id);

alter table public.user_brand_profiles enable row level security;

create policy "user_brand_profiles_select_own"
  on public.user_brand_profiles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_brand_profiles_insert_own"
  on public.user_brand_profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_brand_profiles_update_own"
  on public.user_brand_profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_brand_profiles_delete_own"
  on public.user_brand_profiles for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.user_brand_profiles is 'Single saved brand voice + positioning per user; used as AI context for Content and Products.';

create or replace function public.user_brand_profiles_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_brand_profiles_set_updated_at on public.user_brand_profiles;
create trigger user_brand_profiles_set_updated_at
  before update on public.user_brand_profiles
  for each row
  execute function public.user_brand_profiles_set_updated_at();
