-- Persist AI Growth Audit results for unified History (one row per successful run).
create table if not exists public.site_audit_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  page_url text not null,
  report jsonb not null,
  signals jsonb,
  created_at timestamptz not null default now()
);

create index if not exists site_audit_runs_user_created_idx
  on public.site_audit_runs (user_id, created_at desc);

alter table public.site_audit_runs enable row level security;

create policy "site_audit_runs_select_own"
  on public.site_audit_runs for select
  to authenticated
  using (auth.uid() = user_id);

create policy "site_audit_runs_insert_own"
  on public.site_audit_runs for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "site_audit_runs_delete_own"
  on public.site_audit_runs for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.site_audit_runs is 'Saved Site Audit reports for History; optional signals snapshot JSON.';
