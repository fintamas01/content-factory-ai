-- Clients / Workspaces: multi-client scoping for all user data.
-- Migration strategy:
-- 1) Create `clients` (owner = user_id) with RLS.
-- 2) Add nullable `client_id` to existing user-scoped tables.
-- 3) Create a per-user "Default" client (for ALL existing auth.users).
-- 4) Backfill existing rows to Default client.
-- 5) Update constraints/indexes/policies to enforce (user_id, client_id) scoping.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  website_url text,
  created_at timestamptz not null default now(),
  constraint clients_user_name_unique unique (user_id, name)
);

create index if not exists clients_user_created_idx
  on public.clients (user_id, created_at desc);

alter table public.clients enable row level security;

create policy "clients_select_own"
  on public.clients for select
  to authenticated
  using (auth.uid() = user_id);

create policy "clients_insert_own"
  on public.clients for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "clients_update_own"
  on public.clients for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "clients_delete_own"
  on public.clients for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.clients is 'Client/workspace owned by a user. All AI platform data is scoped by (user_id, client_id).';

-- Ensure every existing user has a Default client.
insert into public.clients (user_id, name)
select u.id, 'Default'
from auth.users u
on conflict (user_id, name) do nothing;

-- Add client_id to core module tables (nullable first for safe backfill).
alter table if exists public.product_generations
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

alter table if exists public.generations
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

alter table if exists public.site_audit_runs
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

alter table if exists public.matrix_generations
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

alter table if exists public.autopilot_jobs
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

alter table if exists public.autopilot_results
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

-- Additional relevant tables referenced by the app (best-effort).
alter table if exists public.user_brand_profiles
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

alter table if exists public.woocommerce_connections
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

alter table if exists public.monthly_usage
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

alter table if exists public.brand_profiles
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

alter table if exists public.generated_posts
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

alter table if exists public.brand_memory
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

-- Backfill all existing rows to the Default client per user.
with defaults as (
  select id as client_id, user_id
  from public.clients
  where name = 'Default'
)
update public.product_generations t
set client_id = d.client_id
from defaults d
where t.client_id is null and t.user_id = d.user_id;

with defaults as (
  select id as client_id, user_id
  from public.clients
  where name = 'Default'
)
update public.generations t
set client_id = d.client_id
from defaults d
where t.client_id is null and t.user_id = d.user_id;

with defaults as (
  select id as client_id, user_id
  from public.clients
  where name = 'Default'
)
update public.site_audit_runs t
set client_id = d.client_id
from defaults d
where t.client_id is null and t.user_id = d.user_id;

with defaults as (
  select id as client_id, user_id
  from public.clients
  where name = 'Default'
)
update public.matrix_generations t
set client_id = d.client_id
from defaults d
where t.client_id is null and t.user_id = d.user_id;

with defaults as (
  select id as client_id, user_id
  from public.clients
  where name = 'Default'
)
update public.autopilot_jobs t
set client_id = d.client_id
from defaults d
where t.client_id is null and t.user_id = d.user_id;

with defaults as (
  select id as client_id, user_id
  from public.clients
  where name = 'Default'
)
update public.autopilot_results t
set client_id = d.client_id
from defaults d
where t.client_id is null and t.user_id = d.user_id;

with defaults as (
  select id as client_id, user_id
  from public.clients
  where name = 'Default'
)
update public.user_brand_profiles t
set client_id = d.client_id
from defaults d
where t.client_id is null and t.user_id = d.user_id;

with defaults as (
  select id as client_id, user_id
  from public.clients
  where name = 'Default'
)
update public.woocommerce_connections t
set client_id = d.client_id
from defaults d
where t.client_id is null and t.user_id = d.user_id;

with defaults as (
  select id as client_id, user_id
  from public.clients
  where name = 'Default'
)
update public.monthly_usage t
set client_id = d.client_id
from defaults d
where t.client_id is null and t.user_id = d.user_id;

with defaults as (
  select id as client_id, user_id
  from public.clients
  where name = 'Default'
)
update public.brand_profiles t
set client_id = d.client_id
from defaults d
where t.client_id is null and t.user_id = d.user_id;

with defaults as (
  select id as client_id, user_id
  from public.clients
  where name = 'Default'
)
update public.generated_posts t
set client_id = d.client_id
from defaults d
where t.client_id is null and t.user_id = d.user_id;

with defaults as (
  select id as client_id, user_id
  from public.clients
  where name = 'Default'
)
update public.brand_memory t
set client_id = d.client_id
from defaults d
where t.client_id is null and t.user_id = d.user_id;

-- Tighten uniqueness constraints for per-client rows (where relevant).
alter table if exists public.user_brand_profiles
  drop constraint if exists user_brand_profiles_user_id_key;
alter table if exists public.user_brand_profiles
  add constraint user_brand_profiles_user_client_unique unique (user_id, client_id);

alter table if exists public.woocommerce_connections
  drop constraint if exists woocommerce_connections_user_id_key;
alter table if exists public.woocommerce_connections
  add constraint woocommerce_connections_user_client_unique unique (user_id, client_id);

alter table if exists public.monthly_usage
  drop constraint if exists monthly_usage_user_month_unique;
alter table if exists public.monthly_usage
  add constraint monthly_usage_user_client_month_unique unique (user_id, client_id, month_key);

-- Make client_id required after backfill.
alter table if exists public.product_generations alter column client_id set not null;
alter table if exists public.generations alter column client_id set not null;
alter table if exists public.site_audit_runs alter column client_id set not null;
alter table if exists public.matrix_generations alter column client_id set not null;
alter table if exists public.autopilot_jobs alter column client_id set not null;
alter table if exists public.autopilot_results alter column client_id set not null;
alter table if exists public.user_brand_profiles alter column client_id set not null;
alter table if exists public.woocommerce_connections alter column client_id set not null;
alter table if exists public.monthly_usage alter column client_id set not null;

-- Optional tables: only enforce NOT NULL if they exist and are already populated safely.
-- (We intentionally avoid forcing NOT NULL on tables not managed by migrations in this repo.)

-- Add indexes optimized for the new scoping pattern.
create index if not exists product_generations_user_client_created_idx
  on public.product_generations (user_id, client_id, created_at desc);
create index if not exists generations_user_client_created_idx
  on public.generations (user_id, client_id, created_at desc);
create index if not exists site_audit_runs_user_client_created_idx
  on public.site_audit_runs (user_id, client_id, created_at desc);
create index if not exists matrix_generations_user_client_created_idx
  on public.matrix_generations (user_id, client_id, created_at desc);
create index if not exists autopilot_jobs_user_client_created_idx
  on public.autopilot_jobs (user_id, client_id, created_at desc);
create index if not exists autopilot_results_user_client_created_idx
  on public.autopilot_results (user_id, client_id, created_at desc);
create index if not exists user_brand_profiles_user_client_idx
  on public.user_brand_profiles (user_id, client_id);
create index if not exists woocommerce_connections_user_client_idx
  on public.woocommerce_connections (user_id, client_id);
create index if not exists monthly_usage_user_client_month_idx
  on public.monthly_usage (user_id, client_id, month_key);

-- Update RLS policies for client-scoped tables.
-- We *don't* rely on the app to filter correctly; policies enforce client ownership.
do $$
begin
  -- product_generations
  begin
    drop policy if exists product_generations_select_own on public.product_generations;
    drop policy if exists product_generations_insert_own on public.product_generations;
    drop policy if exists product_generations_delete_own on public.product_generations;
  exception when undefined_object then null;
  end;
  create policy "product_generations_select_own"
    on public.product_generations for select
    to authenticated
    using (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );
  create policy "product_generations_insert_own"
    on public.product_generations for insert
    to authenticated
    with check (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );
  create policy "product_generations_delete_own"
    on public.product_generations for delete
    to authenticated
    using (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );

  -- generations
  begin
    drop policy if exists generations_select_own on public.generations;
    drop policy if exists generations_insert_own on public.generations;
    drop policy if exists generations_delete_own on public.generations;
  exception when undefined_object then null;
  end;
  create policy "generations_select_own"
    on public.generations for select
    to authenticated
    using (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );
  create policy "generations_insert_own"
    on public.generations for insert
    to authenticated
    with check (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );
  create policy "generations_delete_own"
    on public.generations for delete
    to authenticated
    using (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );

  -- site_audit_runs
  begin
    drop policy if exists site_audit_runs_select_own on public.site_audit_runs;
    drop policy if exists site_audit_runs_insert_own on public.site_audit_runs;
    drop policy if exists site_audit_runs_delete_own on public.site_audit_runs;
  exception when undefined_object then null;
  end;
  create policy "site_audit_runs_select_own"
    on public.site_audit_runs for select
    to authenticated
    using (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );
  create policy "site_audit_runs_insert_own"
    on public.site_audit_runs for insert
    to authenticated
    with check (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );
  create policy "site_audit_runs_delete_own"
    on public.site_audit_runs for delete
    to authenticated
    using (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );

  -- matrix_generations
  begin
    drop policy if exists matrix_generations_select_own on public.matrix_generations;
    drop policy if exists matrix_generations_insert_own on public.matrix_generations;
    drop policy if exists matrix_generations_delete_own on public.matrix_generations;
  exception when undefined_object then null;
  end;
  create policy "matrix_generations_select_own"
    on public.matrix_generations for select
    to authenticated
    using (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );
  create policy "matrix_generations_insert_own"
    on public.matrix_generations for insert
    to authenticated
    with check (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );
  create policy "matrix_generations_delete_own"
    on public.matrix_generations for delete
    to authenticated
    using (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );

  -- autopilot_jobs
  begin
    drop policy if exists autopilot_jobs_select_own on public.autopilot_jobs;
    drop policy if exists autopilot_jobs_insert_own on public.autopilot_jobs;
    drop policy if exists autopilot_jobs_update_own on public.autopilot_jobs;
    drop policy if exists autopilot_jobs_delete_own on public.autopilot_jobs;
  exception when undefined_object then null;
  end;
  create policy "autopilot_jobs_select_own"
    on public.autopilot_jobs for select
    to authenticated
    using (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );
  create policy "autopilot_jobs_insert_own"
    on public.autopilot_jobs for insert
    to authenticated
    with check (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );
  create policy "autopilot_jobs_update_own"
    on public.autopilot_jobs for update
    to authenticated
    using (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    )
    with check (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );
  create policy "autopilot_jobs_delete_own"
    on public.autopilot_jobs for delete
    to authenticated
    using (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );

  -- autopilot_results
  begin
    drop policy if exists autopilot_results_select_own on public.autopilot_results;
    drop policy if exists autopilot_results_insert_own on public.autopilot_results;
    drop policy if exists autopilot_results_delete_own on public.autopilot_results;
  exception when undefined_object then null;
  end;
  create policy "autopilot_results_select_own"
    on public.autopilot_results for select
    to authenticated
    using (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );
  create policy "autopilot_results_insert_own"
    on public.autopilot_results for insert
    to authenticated
    with check (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );
  create policy "autopilot_results_delete_own"
    on public.autopilot_results for delete
    to authenticated
    using (
      auth.uid() = user_id
      and exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
    );
end $$;

-- Update monthly usage RPC to increment usage per client (avoids cross-client quota bleed).
create or replace function public.increment_monthly_usage(p_feature text, p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_month text := to_char((now() at time zone 'utc'), 'YYYY-MM');
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_client_id is null then
    raise exception 'Missing client_id';
  end if;
  if not exists (select 1 from public.clients c where c.id = p_client_id and c.user_id = uid) then
    raise exception 'Invalid client_id';
  end if;
  if p_feature is null or p_feature not in ('content', 'product', 'audit') then
    raise exception 'Invalid feature';
  end if;

  insert into public.monthly_usage (
    user_id,
    client_id,
    month_key,
    content_count,
    product_count,
    audit_count
  )
  values (
    uid,
    p_client_id,
    v_month,
    case when p_feature = 'content' then 1 else 0 end,
    case when p_feature = 'product' then 1 else 0 end,
    case when p_feature = 'audit' then 1 else 0 end
  )
  on conflict (user_id, client_id, month_key) do update set
    content_count = public.monthly_usage.content_count
      + (case when p_feature = 'content' then 1 else 0 end),
    product_count = public.monthly_usage.product_count
      + (case when p_feature = 'product' then 1 else 0 end),
    audit_count = public.monthly_usage.audit_count
      + (case when p_feature = 'audit' then 1 else 0 end),
    updated_at = now();
end;
$$;

grant execute on function public.increment_monthly_usage(text, uuid) to authenticated;

